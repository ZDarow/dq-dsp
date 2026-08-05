/**
 * UART Serial Communication Protocol for Live DSP Parameter Updates
 *
 * Defines the serial frame format that wraps BLE-compatible payloads for
 * point-to-point UART communication between the web app and ESP-32.
 *
 * The payload bytes inside each serial frame use the EXACT same binary
 * format as BLE messages (see ble_protocol.h).  This file only adds
 * the serial transport layer: framing, CRC, and serial-specific control
 * messages (PING, PONG, SYNC_CONFIG).
 *
 * IMPORTANT: This file must stay in sync with src/types/serial-protocol.ts.
 * Any change here requires a matching change in the TypeScript types.
 */

#ifndef SERIAL_PROTOCOL_H
#define SERIAL_PROTOCOL_H

#include <stdint.h>
#include <stddef.h>
#include "ble_protocol.h"  /* Reuse BLE message types, block types, param types */

/* -----------------------------------------------------------------------
 * Serial Frame Constants
 * ----------------------------------------------------------------------- */

#define SERIAL_BAUD_RATE          115200

#define SERIAL_FRAME_HEADER_0     0xAA
#define SERIAL_FRAME_HEADER_1     0x55

/** Maximum total frame size (header + length + payload + crc) */
#define SERIAL_MAX_FRAME_SIZE     256

/** Maximum payload size: max frame minus 4 overhead bytes */
#define SERIAL_MAX_PAYLOAD_SIZE   (SERIAL_MAX_FRAME_SIZE - 4)

/* -----------------------------------------------------------------------
 * Serial-Specific Message Types
 *
 * These extend the BLE message type space (0x01-0x82) with control
 * messages that only exist on the serial transport.
 * ----------------------------------------------------------------------- */

/** PING: host -> device heartbeat check. Payload: single byte [0xA0]. */
#define SERIAL_MSG_PING           0xA0

/** PONG: device -> host heartbeat reply. Payload: single byte [0xA1]. */
#define SERIAL_MSG_PONG           0xA1

/**
 * SYNC_CONFIG: host -> device request for full config dump.
 * Payload: single byte [0xA2].
 * Device responds with a sequence of PARAM_UPDATE frames.
 */
#define SERIAL_MSG_SYNC_CONFIG    0xA2

/** LOG: device -> host ESP_LOG text wrapped in a frame. Payload: [0xA3, ...utf8_bytes] */
#define SERIAL_MSG_LOG            0xA3

/** TELEMETRY: device -> host structured DSP stats. Payload: [0xA4, ...binary_stats] */
#define SERIAL_MSG_TELEMETRY      0xA4

/** SAVE_CONFIG: host -> device, persist current config to NVS flash. Payload: [0xA5] */
#define SERIAL_MSG_SAVE_CONFIG    0xA5

/* -----------------------------------------------------------------------
 * DSP Telemetry Structure (sent via SERIAL_MSG_TELEMETRY)
 * ----------------------------------------------------------------------- */

#pragma pack(push, 1)
typedef struct {
    uint32_t dsp_min_us;        /* min processing time in microseconds */
    uint32_t dsp_max_us;        /* max processing time */
    uint32_t dsp_avg_us;        /* average processing time */
    uint32_t blocks_processed;  /* blocks in this reporting period */
    uint8_t  buffer_fill_pct;   /* ring buffer fill 0..100% */
    int8_t   padding[3];        /* alignment */
    float    correction_ppm;    /* PI controller output in PPM */
} dsp_telemetry_t;              /* 24 bytes */
#pragma pack(pop)

_Static_assert(sizeof(dsp_telemetry_t) == 24, "telemetry struct must be 24 bytes");

/* -----------------------------------------------------------------------
 * Serial Frame Format
 *
 * Wire layout:
 *   Byte 0:     0xAA           Start marker byte 1
 *   Byte 1:     0x55           Start marker byte 2
 *   Byte 2:     length         Payload length in bytes (u8, max 252)
 *   Byte 3..N:  payload[]      BLE-compatible message bytes
 *   Byte N+1:   crc8           CRC-8 over bytes [2..N] (length + payload)
 *
 * Total frame size: 2 (header) + 1 (length) + N (payload) + 1 (crc)
 * ----------------------------------------------------------------------- */

#pragma pack(push, 1)

typedef struct {
    uint8_t header[2];      /* { 0xAA, 0x55 } */
    uint8_t length;         /* Payload length in bytes */
    /* Followed by: uint8_t payload[length]; uint8_t crc8; */
} serial_frame_header_t;

#pragma pack(pop)

_Static_assert(sizeof(serial_frame_header_t) == 3,
    "serial frame header must be exactly 3 bytes");

/* -----------------------------------------------------------------------
 * CRC-8 (polynomial 0x07, init 0x00, no reflect, no final XOR)
 *
 * Matches the TypeScript implementation in serial-protocol.ts.
 * ----------------------------------------------------------------------- */

/**
 * Compute CRC-8 over a byte buffer.
 *
 * Uses polynomial 0x07 (x^8 + x^2 + x + 1), initial value 0x00,
 * no input/output reflection, no final XOR.
 *
 * @param data   Pointer to the data buffer.
 * @param length Number of bytes to process.
 * @return       The computed CRC-8 value.
 */
static inline uint8_t serial_crc8(const uint8_t *data, size_t length) {
    uint8_t crc = 0x00;
    for (size_t i = 0; i < length; i++) {
        crc ^= data[i];
        for (int bit = 0; bit < 8; bit++) {
            crc = (crc & 0x80) ? ((uint8_t)((crc << 1) ^ 0x07)) : (uint8_t)(crc << 1);
        }
    }
    return crc;
}

/* -----------------------------------------------------------------------
 * Frame Helpers
 * ----------------------------------------------------------------------- */

/**
 * Encode a payload into a serial frame buffer.
 *
 * @param payload      Pointer to the payload bytes.
 * @param payload_len  Number of payload bytes (max SERIAL_MAX_PAYLOAD_SIZE).
 * @param out_frame    Output buffer; must be at least (payload_len + 4) bytes.
 * @return             Total frame size written, or 0 on error.
 */
static inline size_t serial_frame_encode(
    const uint8_t *payload,
    uint8_t payload_len,
    uint8_t *out_frame
) {
    if (payload_len > SERIAL_MAX_PAYLOAD_SIZE) return 0;

    /* Header */
    out_frame[0] = SERIAL_FRAME_HEADER_0;
    out_frame[1] = SERIAL_FRAME_HEADER_1;

    /* Length */
    out_frame[2] = payload_len;

    /* Payload */
    for (uint8_t i = 0; i < payload_len; i++) {
        out_frame[3 + i] = payload[i];
    }

    /* CRC over [length, ...payload] */
    out_frame[3 + payload_len] = serial_crc8(&out_frame[2], 1 + payload_len);

    return (size_t)2 + 1 + payload_len + 1;
}

#endif /* SERIAL_PROTOCOL_H */
