import { useCallback, useRef } from 'react';
import { BLE_MSG_ACK, BLE_MSG_ERROR, BLE_ACK_TIMEOUT_MS, BLE_MAX_IN_FLIGHT } from '../types/ble-protocol';
import type { BLEAckMsg, BLEErrorMsg, BLEStatusCode } from '../types/ble-protocol';

export interface PendingMessage {
  msgId: number;
  data: Uint8Array;
  sentAt: number;
  retries: number;
}

export interface SendCallbacks {
  onStatus: (msg: BLEAckMsg | BLEErrorMsg) => void;
  onWrite: (data: Uint8Array) => void;
}

export function useWebSerialSend(callbacks: SendCallbacks) {
  const inFlightRef = useRef<Map<number, PendingMessage>>(new Map());
  const sendQueueRef = useRef<Uint8Array[]>([]);
  const ackTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const sendPendingRef = useRef<(msg: PendingMessage) => void>(() => {});

  const processQueue = useCallback(() => {
    while (
      sendQueueRef.current.length > 0 &&
      inFlightRef.current.size < BLE_MAX_IN_FLIGHT &&
      sendPendingRef.current
    ) {
      const data = sendQueueRef.current.shift()!;
      const msgId = data[3];
      const newId = msgId; // msg_id reassignment is handled by caller if needed
      if (inFlightRef.current.has(newId)) continue;

      const pending: PendingMessage = {
        msgId: newId,
        data,
        sentAt: performance.now(),
        retries: 0,
      };
      inFlightRef.current.set(newId, pending);
      sendPendingRef.current(pending);
    }
  }, []);

  const sendPending = useCallback((msg: PendingMessage) => {
    const msgId = msg.msgId;

    const drop = () => {
      const timer = ackTimeoutsRef.current.get(msgId);
      if (timer) {
        clearTimeout(timer);
        ackTimeoutsRef.current.delete(msgId);
      }
      inFlightRef.current.delete(msgId);
      processQueue();
    };

    const scheduleAckTimeout = () => {
      const prev = ackTimeoutsRef.current.get(msgId);
      if (prev) clearTimeout(prev);
      const timeout = setTimeout(() => {
        ackTimeoutsRef.current.delete(msgId);
        const live = inFlightRef.current.get(msgId);
        if (!live) return;
        if (live.retries < 3) {
          live.retries++;
          sendPendingRef.current(live);
        } else {
          drop();
        }
      }, BLE_ACK_TIMEOUT_MS);
      ackTimeoutsRef.current.set(msgId, timeout);
    };

    const attemptWrite = () => {
      msg.sentAt = performance.now();
      scheduleAckTimeout();
      callbacks.onWrite(msg.data).catch((err: unknown) => {
        console.error('[Serial] Write failed:', err);
        if (msg.retries < 3) {
          msg.retries++;
          attemptWrite();
        } else {
          drop();
        }
      });
    };

    attemptWrite();
  }, [callbacks, processQueue]);

  sendPendingRef.current = sendPending;

  const sendParam = useCallback((frame: Uint8Array) => {
    sendQueueRef.current.push(frame);
    processQueue();
  }, [processQueue]);

  const handleAck = useCallback((payload: Uint8Array) => {
    const msgId = payload[0];
    const ackMsgType = payload[1];
    const statusCode = payload[2] as BLEStatusCode;

    const pending = inFlightRef.current.get(msgId);
    if (!pending) return;

    const latency = performance.now() - pending.sentAt;
    const timeout = ackTimeoutsRef.current.get(msgId);
    if (timeout) {
      clearTimeout(timeout);
      ackTimeoutsRef.current.delete(msgId);
    }

    inFlightRef.current.delete(msgId);

    const statusMsg: BLEAckMsg | BLEErrorMsg = ackMsgType === BLE_MSG_ERROR
      ? { msgId, msgType: BLE_MSG_ERROR, statusCode, detail: payload.length >= 4 ? payload[3] : 0 }
      : { msgId, msgType: BLE_MSG_ACK, statusCode };

    callbacks.onStatus(statusMsg);
    processQueue();
  }, [callbacks, processQueue]);

  const dropAll = useCallback(() => {
    for (const [id, timer] of ackTimeoutsRef.current) {
      clearTimeout(timer);
    }
    ackTimeoutsRef.current.clear();
    inFlightRef.current.clear();
    sendQueueRef.current = [];
  }, []);

  return {
    sendParam,
    handleAck,
    dropAll,
    processQueue,
    get inFlightSize() { return inFlightRef.current.size; },
    get queueSize() { return sendQueueRef.current.length; },
  };
}
