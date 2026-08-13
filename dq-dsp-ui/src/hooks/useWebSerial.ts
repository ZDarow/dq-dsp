import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useDSPStore } from '../store/dsp-store';
import { useWebSerialSend } from './useWebSerialSend';
import { useWebSerialBulk } from './useWebSerialBulk';
import { useWebSerialHeartbeat } from './useWebSerialHeartbeat';

export interface WebSerialState {
  connected: boolean;
  connecting: boolean;
  portName: string;
  error: string | null;
  latency: number;
}

type StatusCallback = (msg: BLEAckMsg | BLEErrorMsg) => void;

const AUTO_RECONNECT_DELAY_MS = 2000;
const BULK_RX_TIMEOUT_MS = 5000;

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
  const disconnectIntentionalRef = useRef(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configRequestedRef = useRef(false);
  const rxBufferRef = useRef<number[]>([]);
  const bulkTxActiveRef = useRef(false);

  const statusCallbacksRef = useRef<StatusCallback[]>([]);
  const logCallbacksRef = useRef<((text: string) => void)[]>([]);
  const telemetryCallbacksRef = useRef<((data: DSPTelemetry) => void)[]>([]);
  const configCallbacksRef = useRef<((config: DSPConfig) => void)[]>([]);

  const sendCallbacks = useMemo(() => ({
    onStatus: (msg: BLEAckMsg | BLEErrorMsg) => {
      for (const cb of statusCallbacksRef.current) cb(msg);
    },
    onWrite: async (data: Uint8Array) => {
      if (!writerRef.current) return;
      await writerRef.current.write(data);
    },
  }), []);

  const send = useWebSerialSend(sendCallbacks);
  const bulk = useWebSerialBulk({
    onConfig: (config) => {
      for (const cb of configCallbacksRef.current) cb(config);
    },
  });
  const heartbeat = useWebSerialHeartbeat({
    onLatency: (latency) => {
      setState((s) => ({ ...s, latency }));
    },
  });

  const sendRef = useRef(send);
  sendRef.current = send;
  const bulkRef = useRef(bulk);
  bulkRef.current = bulk;
  const heartbeatRef = useRef(heartbeat);
  heartbeatRef.current = heartbeat;

  // Frame parser: feed bytes into rxBuffer and extract complete frames
  const feedRxBytes = useCallback((bytes: Uint8Array) => {
    const buf = rxBufferRef.current;
    for (let i = 0; i < bytes.length; i++) {
      buf.push(bytes[i]);
    }

    while (buf.length >= 4) {
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

      if (buf.length < 3) break;
      const payloadLen = buf[2];
      const frameSize = 2 + 1 + payloadLen + 1;
      if (buf.length < frameSize) break;

      const frameBytes = new Uint8Array(buf.splice(0, frameSize));
      const result = decodeSerialFrame(frameBytes);
      if (result.valid) {
        handleRxPayload(result.payload);
      }
    }
  }, []);

  const handleRxPayload = useCallback((payload: Uint8Array) => {
    if (payload.length === 0) return;

    if (bulkRef.current.isBulkActive()) {
      bulkRef.current.handleBulkContinuation(payload);
      return;
    }

    const msgType = payload[0];

    if (msgType === SERIAL_MSG_PONG) {
      heartbeatRef.current.handlePong();
      return;
    }

    if (msgType === SERIAL_MSG_LOG) {
      const text = new TextDecoder().decode(payload.slice(1));
      for (const cb of logCallbacksRef.current) {
        cb(text);
      }
      return;
    }

    if (msgType === SERIAL_MSG_TELEMETRY) {
      const data = decodeTelemetry(payload);
      if (data) {
        for (const cb of telemetryCallbacksRef.current) {
          cb(data);
        }
      }
      return;
    }

    if (payload.length >= 3 && (payload[1] === BLE_MSG_ACK || payload[1] === BLE_MSG_ERROR)) {
      sendRef.current.handleAck(payload);
      return;
    }

    if (payload.length >= 4 && payload[1] === BLE_MSG_BULK_CONFIG) {
      bulkRef.current.handleBulkStart(payload);
      return;
    }
  }, []);

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
    heartbeatRef.current.stopPingPong();
    sendRef.current.dropAll();
    bulkRef.current.reset();

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    rxBufferRef.current = [];
    bulkTxActiveRef.current = false;
    configRequestedRef.current = false;
  }, []);

  // Handle unexpected disconnection with auto-reconnect
  const handleDisconnection = useCallback(async () => {
    readLoopActiveRef.current = false;
    setState((s) => ({ ...s, connected: false }));
    cleanupConnection();

    if (!disconnectIntentionalRef.current && portRef.current) {
      reconnectTimeoutRef.current = setTimeout(async () => {
        reconnectTimeoutRef.current = null;
        try {
          setState((s) => ({ ...s, connecting: true, error: null }));

          const port = portRef.current;
          await port.open({ baudRate: SERIAL_BAUD_RATE });

          writerRef.current = port.writable?.getWriter() ?? null;
          readerRef.current = port.readable?.getReader() ?? null;

          setState((s) => ({ ...s, connected: true, connecting: false }));
          startReadLoop();
          heartbeatRef.current.startPingPong();
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
    heartbeatRef.current.startPingPong();
  }, []);

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

      startReadLoop();
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

  const sendParam = useCallback((data: Uint8Array) => {
    sendRef.current.sendParam(data);
  }, []);

  const sendBulkConfig = useCallback(async (config: DSPConfig): Promise<boolean> => {
    if (!writerRef.current) {
      setState((s) => ({ ...s, error: 'Not connected' }));
      return false;
    }
    if (bulkTxActiveRef.current) {
      setState((s) => ({ ...s, error: 'Bulk config already in progress' }));
      return false;
    }

    bulkTxActiveRef.current = true;
    try {
      const drift = useDSPStore.getState().drift;
      const binary = encodeDSPConfig(config, drift);
      const data = new Uint8Array(binary);
      const totalSize = data.length;
      let offset = 0;

      const FIRST_CHUNK_MAX = SERIAL_MAX_PAYLOAD_SIZE - 4;
      const firstChunkSize = Math.min(FIRST_CHUNK_MAX, totalSize);
      const firstPayload = new Uint8Array(4 + firstChunkSize);
      firstPayload[0] = 0;
      firstPayload[1] = BLE_MSG_BULK_CONFIG;
      firstPayload[2] = totalSize & 0xff;
      firstPayload[3] = (totalSize >> 8) & 0xff;
      firstPayload.set(data.slice(0, firstChunkSize), 4);
      offset += firstChunkSize;

      await writerRef.current.write(encodeSerialFrame(firstPayload));

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
    } finally {
      bulkTxActiveRef.current = false;
      sendRef.current.processQueue();
    }
  }, []);

  const onStatus = useCallback((callback: StatusCallback) => {
    statusCallbacksRef.current.push(callback);
    return () => {
      statusCallbacksRef.current = statusCallbacksRef.current.filter((cb) => cb !== callback);
    };
  }, []);

  const onLog = useCallback((callback: (text: string) => void) => {
    logCallbacksRef.current.push(callback);
    return () => {
      logCallbacksRef.current = logCallbacksRef.current.filter((cb) => cb !== callback);
    };
  }, []);

  const onTelemetry = useCallback((callback: (data: DSPTelemetry) => void) => {
    telemetryCallbacksRef.current.push(callback);
    return () => {
      telemetryCallbacksRef.current = telemetryCallbacksRef.current.filter((cb) => cb !== callback);
    };
  }, []);

  const onConfig = useCallback((callback: (config: DSPConfig) => void) => {
    configCallbacksRef.current.push(callback);
    return () => {
      configCallbacksRef.current = configCallbacksRef.current.filter((cb) => cb !== callback);
    };
  }, []);

  const requestConfig = useCallback(() => {
    if (!writerRef.current) return;
    const frame = encodeSerialFrame(new Uint8Array([SERIAL_MSG_SYNC_CONFIG]));
    writerRef.current.write(frame).catch(() => {});
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectIntentionalRef.current = true;
      readLoopActiveRef.current = false;
      cleanupConnection();
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
  }, [cleanupConnection]);

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
