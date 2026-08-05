import { useState, useCallback, useRef, useEffect } from 'react';
import {
  SERIAL_BAUD_RATE,
  SERIAL_FRAME_HEADER,
  SERIAL_MAX_PAYLOAD_SIZE,
  SERIAL_MSG_PING,
  SERIAL_MSG_PONG,
  SERIAL_MSG_SYNC_CONFIG,
  SERIAL_MSG_LOG,
  SERIAL_MSG_TELEMETRY,
  encodeSerialFrame,
  decodeSerialFrame,
  decodeTelemetry,
} from '../types/serial-protocol';
import type { DSPTelemetry } from '../types/serial-protocol';
import { BLE_MSG_ACK, BLE_MSG_ERROR, BLE_MSG_BULK_CONFIG } from '../types/ble-protocol';
import type { BLEAckMsg, BLEErrorMsg, BLEStatusCode } from '../types/ble-protocol';
import type { DSPConfig } from '../types/dsp';
import { encodeDSPConfig } from '../export/binary-encoder';
import { decodeDSPConfig } from '../export/binary-decoder';
import { useDSPStore } from '../store/dsp-store';

export interface WebSerialState {
  connected: boolean;
  connecting: boolean;
  portName: string;
  error: string | null;
  latency: number;
}

interface PendingMessage {
  msgId: number;
  data: Uint8Array;
  sentAt: number;
  retries: number;
}

type StatusCallback = (msg: BLEAckMsg | BLEErrorMsg) => void;

const ACK_TIMEOUT_MS = 300;
const MAX_IN_FLIGHT = 4;
const MAX_RETRIES = 3;
const AUTO_RECONNECT_DELAY_MS = 2000;
const PING_INTERVAL_MS = 5000;
const PONG_TIMEOUT_MS = 2000;

export function useWebSerial() {
  const [state, setState] = useState<WebSerialState>({
    connected: false,
    connecting: false,
    portName: '',
    error: null,
    latency: 0,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const portRef = useRef<any>(null);
  const writerRef = useRef<WritableStreamDefaultWriter | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const readLoopActiveRef = useRef(false);

  const inFlightRef = useRef<Map<number, PendingMessage>>(new Map());
  const sendQueueRef = useRef<Uint8Array[]>([]);
  const statusCallbacksRef = useRef<StatusCallback[]>([]);
  const logCallbacksRef = useRef<((text: string) => void)[]>([]);
  const telemetryCallbacksRef = useRef<((data: DSPTelemetry) => void)[]>([]);
  const configCallbacksRef = useRef<((config: DSPConfig) => void)[]>([]);
  const disconnectIntentionalRef = useRef(false);
  const ackTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const latencySamplesRef = useRef<number[]>([]);

  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingSentAtRef = useRef(0);
  const configRequestedRef = useRef(false);

  // RX buffer for frame assembly
  const rxBufferRef = useRef<number[]>([]);

  // Bulk config RX assembly
  const bulkRxBufferRef = useRef<Uint8Array | null>(null);
  const bulkRxExpectedSizeRef = useRef(0);
  const bulkRxOffsetRef = useRef(0);

  // Process outgoing queue: send buffered messages respecting in-flight limit
  const processQueue = useCallback(() => {
    while (
      sendQueueRef.current.length > 0 &&
      inFlightRef.current.size < MAX_IN_FLIGHT &&
      writerRef.current
    ) {
      const data = sendQueueRef.current.shift()!;
      // msg_id is the first byte of the payload inside the serial frame
      // The frame is: [0xAA, 0x55, len, ...payload, crc]
      // payload[0] = msg_id
      const msgId = data[3]; // skip header(2) + length(1)
      const pending: PendingMessage = {
        msgId,
        data,
        sentAt: performance.now(),
        retries: 0,
      };
      inFlightRef.current.set(msgId, pending);

      writerRef.current.write(data).catch((err: unknown) => {
        inFlightRef.current.delete(msgId);
        console.error('[Serial] Write failed:', err);
      });

      // Set ACK timeout
      const timeout = setTimeout(() => {
        const msg = inFlightRef.current.get(msgId);
        if (!msg) return;

        if (msg.retries < MAX_RETRIES) {
          msg.retries++;
          msg.sentAt = performance.now();
          writerRef.current?.write(msg.data).catch(() => {
            inFlightRef.current.delete(msgId);
          });
          const nextTimeout = setTimeout(() => {
            inFlightRef.current.delete(msgId);
            processQueue();
          }, ACK_TIMEOUT_MS);
          ackTimeoutsRef.current.set(msgId, nextTimeout);
        } else {
          inFlightRef.current.delete(msgId);
          processQueue();
        }
      }, ACK_TIMEOUT_MS);
      ackTimeoutsRef.current.set(msgId, timeout);
    }
  }, []);

  // Handle a decoded payload from the serial frame parser
  const handleRxPayload = useCallback((payload: Uint8Array) => {
    if (payload.length === 0) return;

    const msgType = payload[0];

    // Handle PONG
    if (msgType === SERIAL_MSG_PONG) {
      if (pongTimeoutRef.current) {
        clearTimeout(pongTimeoutRef.current);
        pongTimeoutRef.current = null;
      }
      if (pingSentAtRef.current > 0) {
        const rtt = performance.now() - pingSentAtRef.current;
        latencySamplesRef.current.push(rtt);
        if (latencySamplesRef.current.length > 20) {
          latencySamplesRef.current.shift();
        }
        const avgLatency = latencySamplesRef.current.reduce((a, b) => a + b, 0) / latencySamplesRef.current.length;
        setState((s) => ({ ...s, latency: Math.round(avgLatency) }));
        pingSentAtRef.current = 0;
      }
      // Config sync is available via requestConfig() but not auto-triggered.
      // Auto-sync was removed because it overwrites the user's UI settings
      // with the device's config (which may be defaults after a firmware update).
      return;
    }

    // Handle LOG messages
    if (msgType === SERIAL_MSG_LOG) {
      const text = new TextDecoder().decode(payload.slice(1));
      for (const cb of logCallbacksRef.current) {
        cb(text);
      }
      return;
    }

    // Handle TELEMETRY messages
    if (msgType === SERIAL_MSG_TELEMETRY) {
      const data = decodeTelemetry(payload);
      if (data) {
        for (const cb of telemetryCallbacksRef.current) {
          cb(data);
        }
      }
      return;
    }

    // Handle incoming BULK_CONFIG (device -> host, e.g. SYNC_CONFIG response)
    // First frame: [msg_id, BLE_MSG_BULK_CONFIG, size_lo, size_hi, ...data]
    if (payload.length >= 4 && payload[1] === BLE_MSG_BULK_CONFIG) {
      const totalSize = payload[2] | (payload[3] << 8);
      if (totalSize > 0 && totalSize < 65536) {
        bulkRxBufferRef.current = new Uint8Array(totalSize);
        bulkRxExpectedSizeRef.current = totalSize;
        bulkRxOffsetRef.current = 0;

        const chunk = payload.slice(4);
        if (chunk.length > 0) {
          bulkRxBufferRef.current.set(chunk, 0);
          bulkRxOffsetRef.current = chunk.length;
        }

        // Check if complete in one frame
        if (bulkRxOffsetRef.current >= totalSize) {
          const config = decodeDSPConfig(bulkRxBufferRef.current.buffer as ArrayBuffer);
          bulkRxBufferRef.current = null;
          if (config) {
            for (const cb of configCallbacksRef.current) {
              cb(config);
            }
          }
        }
      }
      return;
    }

    // Handle bulk continuation frames (raw data, no msg_type header)
    if (bulkRxBufferRef.current && bulkRxOffsetRef.current < bulkRxExpectedSizeRef.current) {
      const remaining = bulkRxExpectedSizeRef.current - bulkRxOffsetRef.current;
      const chunk = payload.slice(0, Math.min(payload.length, remaining));
      bulkRxBufferRef.current.set(chunk, bulkRxOffsetRef.current);
      bulkRxOffsetRef.current += chunk.length;

      if (bulkRxOffsetRef.current >= bulkRxExpectedSizeRef.current) {
        const config = decodeDSPConfig(bulkRxBufferRef.current.buffer as ArrayBuffer);
        bulkRxBufferRef.current = null;
        if (config) {
          for (const cb of configCallbacksRef.current) {
            cb(config);
          }
        }
      }
      return;
    }

    // Handle ACK / ERROR (BLE-format status messages inside serial frame)
    // Wire format: [msg_id, msg_type, status_code, ...optional detail]
    if (payload.length >= 3 && (payload[1] === BLE_MSG_ACK || payload[1] === BLE_MSG_ERROR)) {
      const msgId = payload[0];
      const ackMsgType = payload[1];
      const statusCode = payload[2] as BLEStatusCode;

      // Track latency from ACK round-trip
      const pending = inFlightRef.current.get(msgId);
      if (pending) {
        const latency = performance.now() - pending.sentAt;
        latencySamplesRef.current.push(latency);
        if (latencySamplesRef.current.length > 20) {
          latencySamplesRef.current.shift();
        }
        const avgLatency = latencySamplesRef.current.reduce((a, b) => a + b, 0) / latencySamplesRef.current.length;
        setState((s) => ({ ...s, latency: Math.round(avgLatency) }));
      }

      // Clear pending ACK
      inFlightRef.current.delete(msgId);
      const timeout = ackTimeoutsRef.current.get(msgId);
      if (timeout) {
        clearTimeout(timeout);
        ackTimeoutsRef.current.delete(msgId);
      }

      // Build status message and notify subscribers
      const statusMsg: BLEAckMsg | BLEErrorMsg = ackMsgType === BLE_MSG_ERROR
        ? { msgId, msgType: BLE_MSG_ERROR, statusCode, detail: payload.length >= 4 ? payload[3] : 0 }
        : { msgId, msgType: BLE_MSG_ACK, statusCode };

      for (const cb of statusCallbacksRef.current) {
        cb(statusMsg);
      }

      // Process more queued messages
      processQueue();
    }
  }, [processQueue]);

  // Frame parser: feed bytes into rxBuffer and extract complete frames
  const feedRxBytes = useCallback((bytes: Uint8Array) => {
    const buf = rxBufferRef.current;
    for (let i = 0; i < bytes.length; i++) {
      buf.push(bytes[i]);
    }

    // Scan for frames
    while (buf.length >= 4) {
      // Find header
      const headerIdx = buf.indexOf(SERIAL_FRAME_HEADER[0]);
      if (headerIdx === -1) {
        buf.length = 0;
        break;
      }
      if (headerIdx > 0) {
        buf.splice(0, headerIdx);
      }
      if (buf.length < 2) break;
      if (buf[1] !== SERIAL_FRAME_HEADER[1]) {
        buf.shift();
        continue;
      }

      // We have a header at [0,1]
      if (buf.length < 3) break;
      const payloadLen = buf[2];
      const frameSize = 2 + 1 + payloadLen + 1; // header + len + payload + crc
      if (buf.length < frameSize) break;

      const frameBytes = new Uint8Array(buf.splice(0, frameSize));
      const result = decodeSerialFrame(frameBytes);
      if (result.valid) {
        handleRxPayload(result.payload);
      }
    }
  }, [handleRxPayload]);

  // Read loop for incoming serial data
  const startReadLoop = useCallback(async () => {
    if (!readerRef.current || readLoopActiveRef.current) return;
    readLoopActiveRef.current = true;

    try {
      while (readLoopActiveRef.current) {
        const { value, done } = await readerRef.current.read();
        if (done) break;
        if (value) {
          feedRxBytes(value);
        }
      }
    } catch (err) {
      if (readLoopActiveRef.current) {
        console.error('[Serial] Read error:', err);
      }
    } finally {
      readLoopActiveRef.current = false;
    }
  }, [feedRxBytes]);

  // Cleanup all connection state
  const cleanupConnection = useCallback(() => {
    // Stop ping
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Clean up in-flight messages
    for (const timeout of ackTimeoutsRef.current.values()) {
      clearTimeout(timeout);
    }
    ackTimeoutsRef.current.clear();
    inFlightRef.current.clear();
    sendQueueRef.current = [];
    rxBufferRef.current = [];
    latencySamplesRef.current = [];
    bulkRxBufferRef.current = null;
    bulkRxExpectedSizeRef.current = 0;
    bulkRxOffsetRef.current = 0;
  }, []);

  // Handle unexpected disconnection with auto-reconnect
  const handleDisconnection = useCallback(async () => {
    readLoopActiveRef.current = false;
    setState((s) => ({ ...s, connected: false }));
    cleanupConnection();

    // Don't stack reconnect timers if a disconnection fires repeatedly.
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (!disconnectIntentionalRef.current && portRef.current) {
      reconnectTimeoutRef.current = setTimeout(async () => {
        reconnectTimeoutRef.current = null;
        try {
          setState((s) => ({ ...s, connecting: true, error: null }));

          // Attempt to reopen the port
          const port = portRef.current;
          await port.open({ baudRate: SERIAL_BAUD_RATE });

          writerRef.current = port.writable?.getWriter() ?? null;
          readerRef.current = port.readable?.getReader() ?? null;

          setState((s) => ({ ...s, connected: true, connecting: false }));
          startReadLoop();
        } catch {
          setState((s) => ({
            ...s,
            connecting: false,
            error: 'Auto-reconnect failed',
          }));
        }
      }, AUTO_RECONNECT_DELAY_MS);
    }
  }, [cleanupConnection, startReadLoop]);

  // Start ping/pong health monitoring
  const startPingPong = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    pingIntervalRef.current = setInterval(() => {
      if (!writerRef.current) return;

      const pingFrame = encodeSerialFrame(new Uint8Array([SERIAL_MSG_PING]));
      pingSentAtRef.current = performance.now();

      writerRef.current.write(pingFrame).catch(() => {
        // Write failed, likely disconnected
      });

      // Set pong timeout
      pongTimeoutRef.current = setTimeout(() => {
        // No pong received in time - consider disconnected
        console.warn('[Serial] Pong timeout - device may be disconnected');
        handleDisconnection();
      }, PONG_TIMEOUT_MS);
    }, PING_INTERVAL_MS);
  }, [handleDisconnection]);

  const connect = useCallback(async () => {
    if (!('serial' in navigator)) {
      setState((s) => ({ ...s, error: 'Web Serial API not supported in this browser' }));
      return;
    }

    try {
      setState((s) => ({ ...s, connecting: true, error: null }));
      disconnectIntentionalRef.current = false;
      configRequestedRef.current = false;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: SERIAL_BAUD_RATE });

      portRef.current = port;
      writerRef.current = port.writable?.getWriter() ?? null;
      readerRef.current = port.readable?.getReader() ?? null;

      const portInfo = port.getInfo();
      const portName = portInfo?.usbProductId
        ? `USB:${portInfo.usbProductId.toString(16)}`
        : 'ESP-32';

      setState({
        connected: true,
        connecting: false,
        portName,
        error: null,
        latency: 0,
      });

      // Start the read loop for incoming data
      startReadLoop();

      // Start ping/pong health monitoring
      startPingPong();
    } catch (err) {
      setState((s) => ({
        ...s,
        connecting: false,
        error: err instanceof Error ? err.message : 'Connection failed',
      }));
    }
  }, [startReadLoop, startPingPong]);

  const disconnect = useCallback(async () => {
    disconnectIntentionalRef.current = true;
    readLoopActiveRef.current = false;
    configRequestedRef.current = false;
    cleanupConnection();

    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current.releaseLock();
        readerRef.current = null;
      }
      if (writerRef.current) {
        writerRef.current.releaseLock();
        writerRef.current = null;
      }
      if (portRef.current) {
        await portRef.current.close();
        portRef.current = null;
      }
    } catch {
      // Ignore cleanup errors
    }

    setState({
      connected: false,
      connecting: false,
      portName: '',
      error: null,
      latency: 0,
    });
  }, [cleanupConnection]);

  /** Queue a raw param update for sending (already wrapped in serial frame) */
  const sendParam = useCallback((data: Uint8Array) => {
    sendQueueRef.current.push(data);
    processQueue();
  }, [processQueue]);

  /** Send full DSP config via serial using BLE_MSG_BULK_CONFIG protocol.
   *  First frame: [msg_id, BLE_MSG_BULK_CONFIG, size_lo, size_hi, ...data]
   *  Continuation frames: raw data chunks (firmware appends to bulk buffer) */
  const sendBulkConfig = useCallback(async (config: DSPConfig): Promise<boolean> => {
    if (!writerRef.current) {
      setState((s) => ({ ...s, error: 'Not connected' }));
      return false;
    }

    try {
      const drift = useDSPStore.getState().drift;
      const binary = encodeDSPConfig(config, drift);
      const data = new Uint8Array(binary);
      const totalSize = data.length;
      let offset = 0;

      // First frame: 4-byte header + first data chunk
      const FIRST_CHUNK_MAX = SERIAL_MAX_PAYLOAD_SIZE - 4;
      const firstChunkSize = Math.min(FIRST_CHUNK_MAX, totalSize);
      const firstPayload = new Uint8Array(4 + firstChunkSize);
      firstPayload[0] = 0; // msg_id
      firstPayload[1] = BLE_MSG_BULK_CONFIG;
      firstPayload[2] = totalSize & 0xff;        // size low byte
      firstPayload[3] = (totalSize >> 8) & 0xff;  // size high byte
      firstPayload.set(data.slice(0, firstChunkSize), 4);
      offset += firstChunkSize;

      await writerRef.current.write(encodeSerialFrame(firstPayload));

      // Continuation frames: raw data chunks
      while (offset < totalSize) {
        const chunkSize = Math.min(SERIAL_MAX_PAYLOAD_SIZE, totalSize - offset);
        const chunk = data.slice(offset, offset + chunkSize);
        offset += chunkSize;
        await writerRef.current.write(encodeSerialFrame(chunk));
      }

      setState((s) => ({ ...s, error: null }));
      return true;
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'Bulk config send failed',
      }));
      return false;
    }
  }, []);

  /** Subscribe to status/ACK notifications */
  const onStatus = useCallback((callback: StatusCallback) => {
    statusCallbacksRef.current.push(callback);
    return () => {
      statusCallbacksRef.current = statusCallbacksRef.current.filter((cb) => cb !== callback);
    };
  }, []);

  /** Subscribe to ESP_LOG text messages */
  const onLog = useCallback((callback: (text: string) => void) => {
    logCallbacksRef.current.push(callback);
    return () => {
      logCallbacksRef.current = logCallbacksRef.current.filter((cb) => cb !== callback);
    };
  }, []);

  /** Subscribe to DSP telemetry updates */
  const onTelemetry = useCallback((callback: (data: DSPTelemetry) => void) => {
    telemetryCallbacksRef.current.push(callback);
    return () => {
      telemetryCallbacksRef.current = telemetryCallbacksRef.current.filter((cb) => cb !== callback);
    };
  }, []);

  /** Subscribe to device config sync (received after SYNC_CONFIG request) */
  const onConfig = useCallback((callback: (config: DSPConfig) => void) => {
    configCallbacksRef.current.push(callback);
    return () => {
      configCallbacksRef.current = configCallbacksRef.current.filter((cb) => cb !== callback);
    };
  }, []);

  /** Request the device to send its current config */
  const requestConfig = useCallback(() => {
    if (!writerRef.current) return;
    const frame = encodeSerialFrame(new Uint8Array([SERIAL_MSG_SYNC_CONFIG]));
    writerRef.current.write(frame).catch(() => {});
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    const ackTimeouts = ackTimeoutsRef.current;
    return () => {
      disconnectIntentionalRef.current = true;
      readLoopActiveRef.current = false;
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (pongTimeoutRef.current) {
        clearTimeout(pongTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      for (const timeout of ackTimeouts.values()) {
        clearTimeout(timeout);
      }
      if (readerRef.current) {
        readerRef.current.cancel().catch(() => {});
      }
      if (writerRef.current) {
        writerRef.current.releaseLock();
      }
      if (portRef.current) {
        portRef.current.close().catch(() => {});
      }
    };
  }, []);

  return {
    state,
    connect,
    disconnect,
    sendParam,
    sendBulkConfig,
    onStatus,
    onLog,
    onTelemetry,
    onConfig,
    requestConfig,
  };
}
