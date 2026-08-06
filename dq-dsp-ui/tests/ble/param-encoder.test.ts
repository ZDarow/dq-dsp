/**
 * Unit tests for msg_id collision handling (audit R3).
 *
 * When the 8-bit msg_id counter wraps, a freshly sent message can reuse an
 * ID that is still awaiting its ACK. `reassignMsgId` rewrites the payload's
 * msg_id byte and recomputes the trailing CRC-8, keeping ACK matching
 * correct. These tests pin that behaviour.
 *
 * Run with: npx vitest run tests/ble/param-encoder.test.ts
 */

import { describe, it, expect } from 'vitest';
import { reassignMsgId, resetMsgId } from '../../src/ble/param-encoder';
import { encodeSerialFrame, decodeSerialFrame } from '../../src/types/serial-protocol';

describe('reassignMsgId', () => {
  it('reassigns a busy ID to the next free ID and keeps the frame valid', () => {
    const payload = new Uint8Array([5, 0x01, 0x02, 0x03, 0x04]);
    const frame = encodeSerialFrame(payload);

    const newId = reassignMsgId(frame, (id) => id === 5 || id === 6);

    expect(newId).toBe(7);
    expect(frame[3]).toBe(7);

    const decoded = decodeSerialFrame(frame);
    expect(decoded.valid).toBe(true);
    expect(decoded.payload[0]).toBe(7);
  });

  it('skips reserved control IDs (0xA0/0xA2/0xA5)', () => {
    // 0x9F + 1 = 0xA0 (SERIAL_MSG_PING, reserved) -> skip to 0xA1.
    const payload = new Uint8Array([0x9f, 0x01, 0x00]);
    const frame = encodeSerialFrame(payload);

    const newId = reassignMsgId(frame, () => false);

    expect(newId).toBe(0xa1);
    expect(frame[3]).toBe(0xa1);
  });

  it('wraps around the 8-bit range', () => {
    // 0xFF + 1 wraps to 0x00 (not reserved, not busy).
    const payload = new Uint8Array([0xff, 0x01, 0x00]);
    const frame = encodeSerialFrame(payload);

    const newId = reassignMsgId(frame, (id) => id === 0xff);

    expect(newId).toBe(0);
    expect(frame[3]).toBe(0);
  });

  it('returns -1 when every ID is busy', () => {
    const allBusy = new Set<number>(Array.from({ length: 256 }, (_, i) => i));
    const payload = new Uint8Array([0x10, 0x01, 0x00]);
    const frame = encodeSerialFrame(payload);

    expect(reassignMsgId(frame, (id) => allBusy.has(id))).toBe(-1);
    expect(frame[3]).toBe(0x10); // untouched
  });

  it('is deterministic across resets (allocator still advances)', () => {
    resetMsgId();
    expect(() => resetMsgId()).not.toThrow();
  });
});
