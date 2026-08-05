/**
 * UART Serial Communication Protocol for Live DSP Parameter Updates
 *
 * Defines the serial frame format that wraps BLE-compatible payloads for
 * point-to-point UART communication between the web app and ESP-32.
 *
 * The payload bytes inside each serial frame use the EXACT same binary
 * format as BLE messages (see ble-protocol.ts).  This file only adds
 * the serial transport layer: framing, CRC, and serial-specific control
 * messages (PING, PONG, SYNC_CONFIG).
 *
 * IMPORTANT: This file must stay in sync with firmware/main/serial_protocol.h.
 * Any change here requires a matching change in the C header.
 */

import type {
  BLEMessageType,
  BLEBlockType,
  BLEParamType,
  BLEStatusCode,
} from './ble-protocol';

// Re-export BLE types so downstream code can import everything from one place
export type { BLEMessageType, BLEBlockType, BLEParamType, BLEStatusCode };

// ---------------------------------------------------------------------------
// Serial Frame Constants
// ---------------------------------------------------------------------------

/** UART baud rate (must match ESP-32 firmware config) */
export const SERIAL_BAUD_RATE = 115200;

/** Two-byte start-of-frame marker */
export const SERIAL_FRAME_HEADER = [0xaa, 0x55] as const;

/** Maximum total frame size in bytes (header + length + payload + crc) */
export const SERIAL_MAX_FRAME_SIZE = 256;

/** Maximum payload size: max frame minus 4 overhead bytes (2 header + 1 length + 1 crc) */
export const SERIAL_MAX_PAYLOAD_SIZE = SERIAL_MAX_FRAME_SIZE - 4;

// ---------------------------------------------------------------------------
// Serial-Specific Message Types
//
// These extend the BLE message type space (0x01-0x82) with control messages
// that only exist on the serial transport.
// ---------------------------------------------------------------------------

export const SERIAL_MSG_PING        = 0xa0 as const;
export const SERIAL_MSG_PONG        = 0xa1 as const;
export const SERIAL_MSG_SYNC_CONFIG = 0xa2 as const;
export const SERIAL_MSG_LOG         = 0xa3 as const;
export const SERIAL_MSG_TELEMETRY   = 0xa4 as const;
export const SERIAL_MSG_SAVE_CONFIG = 0xa5 as const;

export type SerialMessageType =
  | typeof SERIAL_MSG_PING
  | typeof SERIAL_MSG_PONG
  | typeof SERIAL_MSG_SYNC_CONFIG
  | typeof SERIAL_MSG_LOG
  | typeof SERIAL_MSG_TELEMETRY
  | typeof SERIAL_MSG_SAVE_CONFIG;

// ---------------------------------------------------------------------------
// DSP Telemetry
// ---------------------------------------------------------------------------

export interface DSPTelemetry {
  dspMinUs: number;
  dspMaxUs: number;
  dspAvgUs: number;
  blocksProcessed: number;
  bufferFillPct: number;    // ring buffer fill 0..100
  correctionPpm: number;    // PI controller output in PPM
}

/** Decode a SERIAL_MSG_TELEMETRY payload into a DSPTelemetry object. */
export function decodeTelemetry(payload: Uint8Array): DSPTelemetry | null {
  // Payload: [0xA4, ...24 bytes of dsp_telemetry_t]
  if (payload.length < 17) return null;
  const view = new DataView(payload.buffer, payload.byteOffset + 1, Math.min(payload.length - 1, 24));
  const hasDrift = view.byteLength >= 24;
  return {
    dspMinUs: view.getUint32(0, true),
    dspMaxUs: view.getUint32(4, true),
    dspAvgUs: view.getUint32(8, true),
    blocksProcessed: view.getUint32(12, true),
    bufferFillPct: hasDrift ? view.getUint8(16) : 0,
    correctionPpm: hasDrift ? view.getFloat32(20, true) : 0,
  };
}

/**
 * PING payload: single byte [0xA0].
 * Sent by host to check if the device is alive.
 *
 * PONG payload: single byte [0xA1].
 * Sent by device in response to PING.
 *
 * SYNC_CONFIG payload: [0xA2].
 * Sent by host to request a full config dump from the device.
 * The device responds with a sequence of PARAM_UPDATE frames covering
 * every active parameter.
 */

// ---------------------------------------------------------------------------
// CRC-8 (polynomial 0x07, init 0x00, no reflect, no final XOR)
// ---------------------------------------------------------------------------

/** Pre-computed CRC-8 lookup table (polynomial 0x07). */
const CRC8_TABLE: Readonly<Uint8Array> = /* @__PURE__ */ (() => {
  const table = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) : (crc << 1);
      crc &= 0xff;
    }
    table[i] = crc;
  }
  return table;
})();

/**
 * Compute CRC-8 over a byte sequence.
 *
 * Uses polynomial 0x07 (x^8 + x^2 + x + 1), initial value 0x00,
 * no input/output reflection, no final XOR.  Matches the firmware
 * implementation in serial_protocol.h.
 */
export function crc8(data: Uint8Array, offset = 0, length = data.length - offset): number {
  let crc = 0x00;
  const end = offset + length;
  for (let i = offset; i < end; i++) {
    crc = CRC8_TABLE[crc ^ data[i]];
  }
  return crc;
}

// ---------------------------------------------------------------------------
// Frame Encoder
// ---------------------------------------------------------------------------

/**
 * Encode a payload into a serial frame.
 *
 * Frame layout:
 *   [0]    0xAA        Start marker byte 1
 *   [1]    0x55        Start marker byte 2
 *   [2]    length      Payload length in bytes (u8, max 252)
 *   [3..N] payload     BLE-compatible message bytes
 *   [N+1]  crc8        CRC-8 over the length byte + payload bytes
 *
 * @param payload  The BLE-format message bytes to wrap.
 * @returns        The complete serial frame as a Uint8Array.
 * @throws         If payload exceeds SERIAL_MAX_PAYLOAD_SIZE.
 */
export function encodeSerialFrame(payload: Uint8Array): Uint8Array {
  if (payload.length > SERIAL_MAX_PAYLOAD_SIZE) {
    throw new RangeError(
      `Payload size ${payload.length} exceeds max ${SERIAL_MAX_PAYLOAD_SIZE}`
    );
  }

  // Total frame: 2 (header) + 1 (length) + N (payload) + 1 (crc)
  const frame = new Uint8Array(2 + 1 + payload.length + 1);

  // Header
  frame[0] = 0xaa;
  frame[1] = 0x55;

  // Length
  frame[2] = payload.length;

  // Payload
  frame.set(payload, 3);

  // CRC over [length, ...payload]
  frame[3 + payload.length] = crc8(frame, 2, 1 + payload.length);

  return frame;
}

// ---------------------------------------------------------------------------
// Frame Decoder
// ---------------------------------------------------------------------------

/** Result of attempting to decode a serial frame. */
export interface DecodeResult {
  /** The extracted payload bytes (empty if invalid). */
  payload: Uint8Array;
  /** Whether the frame passed all validation checks. */
  valid: boolean;
}

/**
 * Decode a serial frame, verifying the header, length, and CRC.
 *
 * @param data  Raw bytes that should contain a complete serial frame.
 * @returns     The decoded payload and a validity flag.
 */
export function decodeSerialFrame(data: Uint8Array): DecodeResult {
  const invalid: DecodeResult = { payload: new Uint8Array(0), valid: false };

  // Minimum frame: 2 header + 1 length + 0 payload + 1 crc = 4 bytes
  if (data.length < 4) return invalid;

  // Check header
  if (data[0] !== 0xaa || data[1] !== 0x55) return invalid;

  // Extract length
  const payloadLen = data[2];

  // Check total frame size: header(2) + length(1) + payload(N) + crc(1)
  const expectedSize = 2 + 1 + payloadLen + 1;
  if (data.length < expectedSize) return invalid;

  // Verify CRC over [length, ...payload]
  const expectedCrc = data[3 + payloadLen];
  const actualCrc = crc8(data, 2, 1 + payloadLen);
  if (actualCrc !== expectedCrc) return invalid;

  // Extract payload
  const payload = data.slice(3, 3 + payloadLen);
  return { payload, valid: true };
}
