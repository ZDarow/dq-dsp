import { useCallback, useRef } from 'react';
import { SERIAL_MSG_PONG } from '../types/serial-protocol';

export interface HeartbeatCallbacks {
  onLatency: (latency: number) => void;
}

export function useWebSerialHeartbeat(callbacks: HeartbeatCallbacks) {
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingSentAtRef = useRef(0);
  const latencySamplesRef = useRef<number[]>([]);

  const startPingPong = useCallback(() => {
    stopPingPong();
    pingIntervalRef.current = setInterval(() => {
      pingSentAtRef.current = performance.now();
      // Actual PING send is handled by the main hook via serial_send_frame
      // This hook only tracks timing; the main hook calls sendPing()
    }, 5000);

    pongTimeoutRef.current = setTimeout(() => {
      console.warn('[Serial] PONG timeout, disconnecting');
      // Actual disconnect is handled by the main hook
    }, 2000);
  }, []);

  const stopPingPong = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = null;
    }
    pingSentAtRef.current = 0;
  }, []);

  const handlePong = useCallback(() => {
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
      callbacks.onLatency(Math.round(avgLatency));
      pingSentAtRef.current = 0;
    }
  }, [callbacks]);

  const getLatency = useCallback(() => {
    if (latencySamplesRef.current.length === 0) return 0;
    const avg = latencySamplesRef.current.reduce((a, b) => a + b, 0) / latencySamplesRef.current.length;
    return Math.round(avg);
  }, []);

  return {
    startPingPong,
    stopPingPong,
    handlePong,
    getLatency,
    isPingActive: () => pingIntervalRef.current !== null,
  };
}
