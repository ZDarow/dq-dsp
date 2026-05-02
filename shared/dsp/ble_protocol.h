/**
 * BLE Communication Protocol for Live DSP Parameter Updates
 *
 * Defines the GATT service layout and compact binary message format
 * used between the React web app (Web Bluetooth) and ESP-32 firmware.
 *
 * IMPORTANT: This file must stay in sync with src/types/ble-protocol.ts.
 * Any change here requires a matching change in the TypeScript types.
 */

#ifndef BLE_PROTOCOL_H
#define BLE_PROTOCOL_H

#include <stdint.h>

/* -----------------------------------------------------------------------
 * GATT Service & Characteristic UUIDs
 *
 * Custom 128-bit UUIDs using Bluetooth SIG base:
 *   xxxxxxxx-0000-1000-8000-00805f9b34fb
 * ----------------------------------------------------------------------- */
#define BLE_DSP_SERVICE_UUID        0xFF01  /* 16-bit short form */
#define BLE_CHAR_PARAM_UPDATE_UUID  0xFF02
#define BLE_CHAR_BULK_CONFIG_UUID   0xFF03
#define BLE_CHAR_STATUS_UUID        0xFF04
#define BLE_CHAR_DEVICE_INFO_UUID   0xFF05

/* Full 128-bit UUID for service advertisement:
 * 0000ff01-0000-1000-8000-00805f9b34fb */

/* -----------------------------------------------------------------------
 * Message Types
 * ----------------------------------------------------------------------- */
#define BLE_MSG_PARAM_UPDATE  0x01
#define BLE_MSG_BULK_CONFIG   0x02
#define BLE_MSG_ACK           0x80
#define BLE_MSG_STATUS        0x81
#define BLE_MSG_ERROR         0x82

/* -----------------------------------------------------------------------
 * Target Block Types
 * ----------------------------------------------------------------------- */
#define BLE_BLOCK_INPUT    0x01
#define BLE_BLOCK_OUTPUT   0x02
#define BLE_BLOCK_ROUTING  0x03
#define BLE_BLOCK_GLOBAL   0x04
#define BLE_BLOCK_SYSTEM   0x05

/* -----------------------------------------------------------------------
 * Parameter Types
 *
 * Grouped by functional area:
 *   0x01-0x0F  Channel basics (gain, mute, phase)
 *   0x10-0x1F  EQ band parameters
 *   0x20-0x2F  Crossover high-pass
 *   0x30-0x3F  Crossover low-pass
 *   0x40-0x4F  Delay
 *   0x50-0x5F  Routing matrix
 *   0x60-0x6F  Global parameters
 *   0x70-0x7F  Room EQ band parameters (input channels only)
 * ----------------------------------------------------------------------- */
#define BLE_PARAM_GAIN                 0x01
#define BLE_PARAM_MUTE                 0x02
#define BLE_PARAM_PHASE                0x03

#define BLE_PARAM_EQ_BAND_ENABLE       0x10
#define BLE_PARAM_EQ_BAND_FREQ         0x11
#define BLE_PARAM_EQ_BAND_GAIN         0x12
#define BLE_PARAM_EQ_BAND_Q            0x13
#define BLE_PARAM_EQ_BAND_TYPE         0x14

#define BLE_PARAM_CROSSOVER_HP_ENABLE  0x20
#define BLE_PARAM_CROSSOVER_HP_FREQ    0x21
#define BLE_PARAM_CROSSOVER_HP_TYPE    0x22
#define BLE_PARAM_CROSSOVER_HP_SLOPE   0x23

#define BLE_PARAM_CROSSOVER_LP_ENABLE  0x30
#define BLE_PARAM_CROSSOVER_LP_FREQ    0x31
#define BLE_PARAM_CROSSOVER_LP_TYPE    0x32
#define BLE_PARAM_CROSSOVER_LP_SLOPE   0x33

#define BLE_PARAM_DELAY                0x40

#define BLE_PARAM_ROUTING_ENABLE       0x50
#define BLE_PARAM_ROUTING_GAIN         0x51

#define BLE_PARAM_MASTER_VOLUME        0x60

/* System / drift compensation parameters */
#define BLE_PARAM_SYSTEM_DRIFT_KP      0x80
#define BLE_PARAM_SYSTEM_DRIFT_KI      0x81
#define BLE_PARAM_SYSTEM_DRIFT_TARGET  0x82
#define BLE_PARAM_SYSTEM_DRIFT_MAX_PPM 0x83

/* Room EQ band parameters (input channels only) */
#define BLE_PARAM_ROOM_EQ_BAND_ENABLE  0x70
#define BLE_PARAM_ROOM_EQ_BAND_FREQ    0x71
#define BLE_PARAM_ROOM_EQ_BAND_GAIN    0x72
#define BLE_PARAM_ROOM_EQ_BAND_Q       0x73
#define BLE_PARAM_ROOM_EQ_BAND_TYPE    0x74

/* -----------------------------------------------------------------------
 * Status / Error Codes
 * ----------------------------------------------------------------------- */
#define BLE_STATUS_OK             0x00
#define BLE_STATUS_INVALID_PARAM  0x01
#define BLE_STATUS_OUT_OF_RANGE   0x02
#define BLE_STATUS_BUSY           0x03
#define BLE_STATUS_CRC_ERROR      0x04

/* -----------------------------------------------------------------------
 * Filter Type Encoding
 *
 * Maps EQ filter types to uint8 wire values.
 * Must match FILTER_TYPE_TO_BLE in ble-protocol.ts.
 * ----------------------------------------------------------------------- */
#define BLE_FILTER_PEAKING    0x00
#define BLE_FILTER_LOW_SHELF  0x01
#define BLE_FILTER_HIGH_SHELF 0x02
#define BLE_FILTER_LOW_PASS   0x03
#define BLE_FILTER_HIGH_PASS  0x04
#define BLE_FILTER_BAND_PASS  0x05
#define BLE_FILTER_NOTCH      0x06
#define BLE_FILTER_ALL_PASS   0x07

/* Crossover filter type encoding */
#define BLE_XO_BUTTERWORTH     0x00
#define BLE_XO_LINKWITZ_RILEY  0x01

/* Crossover slope encoding (value = number of biquad stages) */
#define BLE_XO_SLOPE_12        0x01   /* 12 dB/oct = 1 stage  */
#define BLE_XO_SLOPE_24        0x02   /* 24 dB/oct = 2 stages */
#define BLE_XO_SLOPE_48        0x04   /* 48 dB/oct = 4 stages */

/* -----------------------------------------------------------------------
 * Wire Message Structures
 *
 * All structs are packed. Multi-byte values are little-endian.
 * ----------------------------------------------------------------------- */
#pragma pack(push, 1)

/**
 * Parameter update message (written to PARAM_UPDATE characteristic).
 *
 * Total size: 6-byte header + 1 or 4 bytes value = 7..10 bytes.
 * Fits in a single BLE packet (default MTU 23, ATT payload 20 bytes).
 *
 * Value encoding by param type:
 *   float32 (4 bytes): GAIN, EQ_BAND_FREQ, EQ_BAND_GAIN, EQ_BAND_Q,
 *                       CROSSOVER_HP_FREQ, CROSSOVER_LP_FREQ, DELAY,
 *                       ROUTING_GAIN, MASTER_VOLUME,
 *                       ROOM_EQ_BAND_FREQ, ROOM_EQ_BAND_GAIN, ROOM_EQ_BAND_Q
 *   uint8   (1 byte):  MUTE, PHASE, EQ_BAND_ENABLE, EQ_BAND_TYPE,
 *                       CROSSOVER_HP_ENABLE, CROSSOVER_HP_TYPE, CROSSOVER_HP_SLOPE,
 *                       CROSSOVER_LP_ENABLE, CROSSOVER_LP_TYPE, CROSSOVER_LP_SLOPE,
 *                       ROUTING_ENABLE, ROOM_EQ_BAND_ENABLE, ROOM_EQ_BAND_TYPE
 */
typedef struct {
    uint8_t msg_id;        /* Sequence number for ACK matching (wraps at 256) */
    uint8_t msg_type;      /* BLE_MSG_PARAM_UPDATE (0x01) */
    uint8_t target_block;  /* BLE_BLOCK_* */
    uint8_t channel;       /* Channel index (0-based); input_idx for routing */
    uint8_t param_type;    /* BLE_PARAM_* */
    uint8_t param_index;   /* Sub-index: EQ band idx, output_idx for routing, else 0 */
    /* Followed by value: either 1 byte (uint8) or 4 bytes (float32 LE) */
} ble_param_msg_header_t;

_Static_assert(sizeof(ble_param_msg_header_t) == 6,
    "param message header must be exactly 6 bytes");

/**
 * Full param message with float32 value (10 bytes total).
 */
typedef struct {
    ble_param_msg_header_t header;
    float value;
} ble_param_msg_f32_t;

_Static_assert(sizeof(ble_param_msg_f32_t) == 10,
    "float param message must be exactly 10 bytes");

/**
 * Full param message with uint8 value (7 bytes total).
 */
typedef struct {
    ble_param_msg_header_t header;
    uint8_t value;
} ble_param_msg_u8_t;

_Static_assert(sizeof(ble_param_msg_u8_t) == 7,
    "uint8 param message must be exactly 7 bytes");

/**
 * ACK message (notified on STATUS characteristic).
 *
 * Wire format: 3 bytes.
 */
typedef struct {
    uint8_t msg_id;       /* Echoed msg_id from the request */
    uint8_t msg_type;     /* BLE_MSG_ACK (0x80) */
    uint8_t status_code;  /* BLE_STATUS_* */
} ble_ack_msg_t;

_Static_assert(sizeof(ble_ack_msg_t) == 3,
    "ACK message must be exactly 3 bytes");

/**
 * Error message (notified on STATUS characteristic).
 *
 * Wire format: 4 bytes.
 */
typedef struct {
    uint8_t msg_id;       /* Echoed msg_id, or 0 for unsolicited errors */
    uint8_t msg_type;     /* BLE_MSG_ERROR (0x82) */
    uint8_t status_code;  /* BLE_STATUS_* */
    uint8_t detail;       /* Implementation-defined detail byte */
} ble_error_msg_t;

_Static_assert(sizeof(ble_error_msg_t) == 4,
    "error message must be exactly 4 bytes");

/**
 * Device info (read from DEVICE_INFO characteristic).
 *
 * Wire format: 12 bytes.
 */
typedef struct {
    uint8_t  fw_major;
    uint8_t  fw_minor;
    uint16_t fw_patch;       /* LE */
    uint32_t sample_rate;    /* LE */
    uint8_t  preset_index;
    uint8_t  num_inputs;
    uint8_t  num_outputs;
    uint8_t  max_eq_bands;
} ble_device_info_t;

_Static_assert(sizeof(ble_device_info_t) == 12,
    "device info must be exactly 12 bytes");

#pragma pack(pop)

/* -----------------------------------------------------------------------
 * Protocol Constants
 * ----------------------------------------------------------------------- */

/** Header size for param update messages (before value payload) */
#define BLE_PARAM_MSG_HEADER_SIZE  6

/** Maximum payload that fits in default BLE MTU (23 - 3 ATT overhead) */
#define BLE_MAX_SINGLE_PACKET      20

/** Recommended max unacknowledged messages in flight */
#define BLE_MAX_IN_FLIGHT          4

/* -----------------------------------------------------------------------
 * Helper: determine value size from param type
 * ----------------------------------------------------------------------- */

/**
 * Returns the value payload size in bytes for a given param type.
 * Returns 4 for float32 params, 1 for uint8 params, 0 for unknown.
 */
static inline uint8_t ble_param_value_size(uint8_t param_type) {
    switch (param_type) {
        /* float32 params (4 bytes) */
        case BLE_PARAM_GAIN:
        case BLE_PARAM_EQ_BAND_FREQ:
        case BLE_PARAM_EQ_BAND_GAIN:
        case BLE_PARAM_EQ_BAND_Q:
        case BLE_PARAM_CROSSOVER_HP_FREQ:
        case BLE_PARAM_CROSSOVER_LP_FREQ:
        case BLE_PARAM_DELAY:
        case BLE_PARAM_ROUTING_GAIN:
        case BLE_PARAM_MASTER_VOLUME:
        case BLE_PARAM_ROOM_EQ_BAND_FREQ:
        case BLE_PARAM_ROOM_EQ_BAND_GAIN:
        case BLE_PARAM_ROOM_EQ_BAND_Q:
        case BLE_PARAM_SYSTEM_DRIFT_KP:
        case BLE_PARAM_SYSTEM_DRIFT_KI:
        case BLE_PARAM_SYSTEM_DRIFT_TARGET:
        case BLE_PARAM_SYSTEM_DRIFT_MAX_PPM:
            return 4;

        /* uint8 params (1 byte) */
        case BLE_PARAM_MUTE:
        case BLE_PARAM_PHASE:
        case BLE_PARAM_EQ_BAND_ENABLE:
        case BLE_PARAM_EQ_BAND_TYPE:
        case BLE_PARAM_CROSSOVER_HP_ENABLE:
        case BLE_PARAM_CROSSOVER_HP_TYPE:
        case BLE_PARAM_CROSSOVER_HP_SLOPE:
        case BLE_PARAM_CROSSOVER_LP_ENABLE:
        case BLE_PARAM_CROSSOVER_LP_TYPE:
        case BLE_PARAM_CROSSOVER_LP_SLOPE:
        case BLE_PARAM_ROUTING_ENABLE:
        case BLE_PARAM_ROOM_EQ_BAND_ENABLE:
        case BLE_PARAM_ROOM_EQ_BAND_TYPE:
            return 1;

        default:
            return 0;  /* unknown param type */
    }
}

/**
 * Validates that a param update message has the correct total length.
 * Returns 1 if valid, 0 if invalid.
 */
static inline int ble_validate_param_msg_len(const uint8_t *data, uint16_t len) {
    if (len < BLE_PARAM_MSG_HEADER_SIZE) return 0;
    const ble_param_msg_header_t *hdr = (const ble_param_msg_header_t *)data;
    uint8_t val_size = ble_param_value_size(hdr->param_type);
    if (val_size == 0) return 0;
    return (len == BLE_PARAM_MSG_HEADER_SIZE + val_size) ? 1 : 0;
}

#endif /* BLE_PROTOCOL_H */
