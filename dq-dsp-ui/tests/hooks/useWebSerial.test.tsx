/**
 * Unit tests for useWebSerial retry budget (audit H4) and bulk RX signature
 * collision handling (audit H3).
 *
 * H4: a message must get MAX_RETRIES + 1 = 4 total attempts (initial write +
 * 3 retries), whether the failure is a rejected write or an ACK timeout. A
 * write error must not drop the message without retry, and the post-retry
 * timeout must not delete it unconditionally.
 *
 * H3: while a bulk receive is active, every frame is consumed as raw config
 * bytes — even if it looks like ACK/ERROR/BULK-START. ACK/ERROR are accepted
 * only for msg_ids actually in flight.
 *
 * Run with: npx vitest run tests/hooks/useWebSerial.test.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSerial } from '../../src/hooks/useWebSerial';
import { encodeSerialFrame } from '../../src/types/serial-protocol';
import { BLE_MSG_ACK, BLE_MSG_BULK_CONFIG, BLE_ACK_TIMEOUT_MS } from '../../src/types/ble-protocol';

// ---------------------------------------------------------------------------
// Mock Web Serial
// ---------------------------------------------------------------------------

interface MockWriter {
  write: ReturnType<typeof vi.fn>;
  releaseLock: ReturnType<typeof vi.fn>;
}

interface MockReader {
  read: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  releaseLock: ReturnType<typeof vi.fn>;
}

interface MockPort {
  open: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  getInfo: ReturnType<typeof vi.fn>;
  writable: { getWriter: () => MockWriter } | null;
  readable: { getReader: () => MockReader } | null;
}

let mockWriter: MockWriter;
let mockReader: MockReader;
let mockPort: MockPort;

// Очередь RX-данных и отложенный resolve для read loop.
let rxQueue: Uint8Array[];
let pendingReadResolve: ((v: { value: Uint8Array; done: boolean }) => void) | null;

/** Подать данные в read loop (безопасно: и до, и после первого read()). */
function pushRx(data: Uint8Array) {
  if (pendingReadResolve) {
    const resolve = pendingReadResolve;
    pendingReadResolve = null;
    resolve({ value: data, done: false });
  } else {
    rxQueue.push(data);
  }
}

function createMockPort() {
  rxQueue = [];
  pendingReadResolve = null;
  mockWriter = {
    write: vi.fn().mockResolvedValue(undefined),
    releaseLock: vi.fn(),
  };
  mockReader = {
    read: vi.fn().mockImplementation(() => {
      if (rxQueue.length > 0) {
        return Promise.resolve({ value: rxQueue.shift()!, done: false });
      }
      return new Promise((resolve) => {
        pendingReadResolve = resolve;
      });
    }),
    cancel: vi.fn().mockResolvedValue(undefined),
    releaseLock: vi.fn(),
  };
  mockPort = {
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getInfo: vi.fn().mockReturnValue({ usbProductId: 0x1234 }),
    writable: { getWriter: () => mockWriter },
    readable: { getReader: () => mockReader },
  };
  Object.defineProperty(navigator, 'serial', {
    configurable: true,
    value: { requestPort: vi.fn().mockResolvedValue(mockPort) },
  });
}

async function connectHook() {
  const { result } = renderHook(() => useWebSerial());
  await act(async () => {
    await result.current.connect();
  });
  return result;
}

// ---------------------------------------------------------------------------

describe('useWebSerial retry budget (H4)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    createMockPort();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries a failed write up to MAX_RETRIES, then drops (4 attempts total)', async () => {
    const result = await connectHook();

    // First 3 writes reject, 4th succeeds.
    mockWriter.write
      .mockRejectedValueOnce(new Error('busy'))
      .mockRejectedValueOnce(new Error('busy'))
      .mockRejectedValueOnce(new Error('busy'))
      .mockResolvedValue(undefined);

    const payload = new Uint8Array([1, 0x01, 0x02, 0x00]);
    act(() => {
      result.current.sendParam(encodeSerialFrame(payload));
    });

    // Let the async write chain settle.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // 4 attempts: initial + 3 retries, then the 4th write succeeded.
    expect(mockWriter.write).toHaveBeenCalledTimes(4);

    // Message stays in flight awaiting ACK; no spurious drop.
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    // No ACK ever arrived, so after budget + timeout it is dropped silently.
    expect(mockWriter.write).toHaveBeenCalledTimes(4);
  });

  it('drops the message after ACK timeout when retries are exhausted', async () => {
    const result = await connectHook();

    // Writes always succeed, but the device never ACKs.
    mockWriter.write.mockResolvedValue(undefined);

    const payload = new Uint8Array([2, 0x01, 0x02, 0x00]);
    act(() => {
      result.current.sendParam(encodeSerialFrame(payload));
    });

    // Initial write.
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockWriter.write).toHaveBeenCalledTimes(1);

    // Each ACK timeout (BLE_ACK_TIMEOUT_MS) triggers a retry; 3 retries = 4 attempts.
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        vi.advanceTimersByTime(BLE_ACK_TIMEOUT_MS);
        await Promise.resolve();
      });
    }
    expect(mockWriter.write).toHaveBeenCalledTimes(4);

    // After the last timeout the message is dropped, no further writes.
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });
    expect(mockWriter.write).toHaveBeenCalledTimes(4);
  });

  it('clears the ACK timer when an ACK arrives', async () => {
    const result = await connectHook();
    mockWriter.write.mockResolvedValue(undefined);

    const payload = new Uint8Array([3, 0x01, 0x02, 0x00]);
    act(() => {
      result.current.sendParam(encodeSerialFrame(payload));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockWriter.write).toHaveBeenCalledTimes(1);

    // Device ACKs msg_id 3: [msg_id, ACK, status]
    pushRx(encodeSerialFrame(new Uint8Array([3, BLE_MSG_ACK, 0x00])));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // ACK cleared the timer: advancing time does not re-send.
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockWriter.write).toHaveBeenCalledTimes(1);
  });
});

describe('useWebSerial bulk RX signature collision (H3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    createMockPort();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('consumes ACK-looking bytes as bulk continuation, not as status', async () => {
    const result = await connectHook();
    const statusCb = vi.fn();
    result.current.onStatus(statusCb);

    // Device starts a bulk config transfer of 6 bytes:
    // [msg_id, BULK_CONFIG, size_lo=6, size_hi=0, ...first 2 bytes]
    const first = new Uint8Array([9, BLE_MSG_BULK_CONFIG, 6, 0, 0x01, 0x02]);
    // Continuation bytes that LOOK like ACK/ERROR signatures:
    // [0x80, 0x82, ...] would be parsed as status if not consumed as bulk data.
    const cont = new Uint8Array([0x80, 0x82, 0x00, 0x00]);

    pushRx(encodeSerialFrame(first));
    pushRx(encodeSerialFrame(cont));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // The bulk bytes that resemble ACK/ERROR must NOT fire status callbacks.
    expect(statusCb).not.toHaveBeenCalled();
  });

  it('ignores ACK/ERROR for msg_ids not in flight', async () => {
    const result = await connectHook();
    const statusCb = vi.fn();
    result.current.onStatus(statusCb);

    // A stale/duplicate ACK for msg_id 0x42 that we never sent.
    pushRx(encodeSerialFrame(new Uint8Array([0x42, BLE_MSG_ACK, 0x00])));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(statusCb).not.toHaveBeenCalled();
  });

  it('accepts ACK/ERROR only for in-flight msg_ids', async () => {
    const result = await connectHook();
    const statusCb = vi.fn();
    result.current.onStatus(statusCb);

    // Send a real param with msg_id 5.
    mockWriter.write.mockResolvedValue(undefined);
    const payload = new Uint8Array([5, 0x01, 0x02, 0x00]);
    act(() => {
      result.current.sendParam(encodeSerialFrame(payload));
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Device ACKs msg_id 5.
    pushRx(encodeSerialFrame(new Uint8Array([5, BLE_MSG_ACK, 0x00])));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(statusCb).toHaveBeenCalledTimes(1);
  });
});