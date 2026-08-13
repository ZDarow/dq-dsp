import { useCallback, useRef } from 'react';

export interface HeartbeatCallbacks {
  onLatency: (latency: number) => void;
}

export function useWebSerialHeartbeat(callbacks: HeartbeatCallbacks) {
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingSentAtRef = useRef(0);
  const latencySamplesRef = useRef<number[]>([]);

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

  const startPingPong = useCallback(() => {
    stopPingPong();
    pingIntervalRef.current = setInterval(() => {
      pingSentAtRef.current = performance.now();
    }, 5000);

    pongTimeoutRef.current = setTimeout(() => {
      console.warn('[Serial] PONG timeout, disconnecting');
    }, 2000);
  }, [stopPingPong]);

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
