/**
 * BLE Communication Protocol for Live DSP Parameter Updates
 *
 * Defines the GATT service layout and compact binary message format
 * used between the React web app (Web Bluetooth) and ESP-32 firmware.
 *
 * IMPORTANT: This file must stay in sync with firmware/main/ble_protocol.h.
 * Any change here requires a matching change in the C header.
 */

import type { FilterType, CrossoverFilterType, CrossoverSlope } from './filter'

// ---------------------------------------------------------------------------
// GATT Service & Characteristic UUIDs
// ---------------------------------------------------------------------------

/** Custom GATT service for DSP control */
export const BLE_DSP_SERVICE_UUID = '0000ff01-0000-1000-8000-00805f9b34fb'

/** Write: individual parameter updates (msg_type = PARAM_UPDATE) */
export const BLE_CHAR_PARAM_UPDATE_UUID = '0000ff02-0000-1000-8000-00805f9b34fb'

/** Write: bulk configuration transfer (msg_type = BULK_CONFIG) */
export const BLE_CHAR_BULK_CONFIG_UUID = '0000ff03-0000-1000-8000-00805f9b34fb'

/** Notify: ACK / status / error responses from ESP-32 */
export const BLE_CHAR_STATUS_UUID = '0000ff04-0000-1000-8000-00805f9b34fb'

/** Read: device info (firmware version, preset index, sample rate) */
export const BLE_CHAR_DEVICE_INFO_UUID = '0000ff05-0000-1000-8000-00805f9b34fb'

// ---------------------------------------------------------------------------
// Message Types
// ---------------------------------------------------------------------------

export const BLE_MSG_PARAM_UPDATE = 0x01 as const
export const BLE_MSG_BULK_CONFIG = 0x02 as const
export const BLE_MSG_ACK = 0x80 as const
export const BLE_MSG_ERROR = 0x82 as const

export type BLEMessageType =
  | typeof BLE_MSG_PARAM_UPDATE
  | typeof BLE_MSG_BULK_CONFIG
  | typeof BLE_MSG_ACK
  | typeof BLE_MSG_ERROR

// ---------------------------------------------------------------------------
// Target Block Types
// ---------------------------------------------------------------------------

export const BLE_BLOCK_INPUT = 0x01 as const
export const BLE_BLOCK_OUTPUT = 0x02 as const
export const BLE_BLOCK_ROUTING = 0x03 as const
export const BLE_BLOCK_GLOBAL = 0x04 as const
export const BLE_BLOCK_SYSTEM = 0x05 as const

export type BLEBlockType =
  | typeof BLE_BLOCK_INPUT
  | typeof BLE_BLOCK_OUTPUT
  | typeof BLE_BLOCK_ROUTING
  | typeof BLE_BLOCK_GLOBAL
  | typeof BLE_BLOCK_SYSTEM

// ---------------------------------------------------------------------------
// Parameter Types
// ---------------------------------------------------------------------------

export const BLE_PARAM_GAIN = 0x01 as const
export const BLE_PARAM_MUTE = 0x02 as const
export const BLE_PARAM_PHASE = 0x03 as const
export const BLE_PARAM_EQ_BAND_ENABLE = 0x10 as const
export const BLE_PARAM_EQ_BAND_FREQ = 0x11 as const
export const BLE_PARAM_EQ_BAND_GAIN = 0x12 as const
export const BLE_PARAM_EQ_BAND_Q = 0x13 as const
export const BLE_PARAM_EQ_BAND_TYPE = 0x14 as const
export const BLE_PARAM_CROSSOVER_HP_ENABLE = 0x20 as const
export const BLE_PARAM_CROSSOVER_HP_FREQ = 0x21 as const
export const BLE_PARAM_CROSSOVER_HP_TYPE = 0x22 as const
export const BLE_PARAM_CROSSOVER_HP_SLOPE = 0x23 as const
export const BLE_PARAM_CROSSOVER_LP_ENABLE = 0x30 as const
export const BLE_PARAM_CROSSOVER_LP_FREQ = 0x31 as const
export const BLE_PARAM_CROSSOVER_LP_TYPE = 0x32 as const
export const BLE_PARAM_CROSSOVER_LP_SLOPE = 0x33 as const
export const BLE_PARAM_DELAY = 0x40 as const
export const BLE_PARAM_ROUTING_ENABLE = 0x50 as const
export const BLE_PARAM_ROUTING_GAIN = 0x51 as const
export const BLE_PARAM_MASTER_VOLUME = 0x60 as const
export const BLE_PARAM_SYSTEM_DRIFT_KP = 0x80 as const
export const BLE_PARAM_SYSTEM_DRIFT_KI = 0x81 as const
export const BLE_PARAM_SYSTEM_DRIFT_TARGET = 0x82 as const
export const BLE_PARAM_SYSTEM_DRIFT_MAX_PPM = 0x83 as const

export const BLE_PARAM_ROOM_EQ_BAND_ENABLE = 0x70 as const
export const BLE_PARAM_ROOM_EQ_BAND_FREQ = 0x71 as const
export const BLE_PARAM_ROOM_EQ_BAND_GAIN = 0x72 as const
export const BLE_PARAM_ROOM_EQ_BAND_Q = 0x73 as const
export const BLE_PARAM_ROOM_EQ_BAND_TYPE = 0x74 as const

export type BLEParamType =
  | typeof BLE_PARAM_GAIN
  | typeof BLE_PARAM_MUTE
  | typeof BLE_PARAM_PHASE
  | typeof BLE_PARAM_EQ_BAND_ENABLE
  | typeof BLE_PARAM_EQ_BAND_FREQ
  | typeof BLE_PARAM_EQ_BAND_GAIN
  | typeof BLE_PARAM_EQ_BAND_Q
  | typeof BLE_PARAM_EQ_BAND_TYPE
  | typeof BLE_PARAM_CROSSOVER_HP_ENABLE
  | typeof BLE_PARAM_CROSSOVER_HP_FREQ
  | typeof BLE_PARAM_CROSSOVER_HP_TYPE
  | typeof BLE_PARAM_CROSSOVER_HP_SLOPE
  | typeof BLE_PARAM_CROSSOVER_LP_ENABLE
  | typeof BLE_PARAM_CROSSOVER_LP_FREQ
  | typeof BLE_PARAM_CROSSOVER_LP_TYPE
  | typeof BLE_PARAM_CROSSOVER_LP_SLOPE
  | typeof BLE_PARAM_DELAY
  | typeof BLE_PARAM_ROUTING_ENABLE
  | typeof BLE_PARAM_ROUTING_GAIN
  | typeof BLE_PARAM_MASTER_VOLUME
  | typeof BLE_PARAM_ROOM_EQ_BAND_ENABLE
  | typeof BLE_PARAM_ROOM_EQ_BAND_FREQ
  | typeof BLE_PARAM_ROOM_EQ_BAND_GAIN
  | typeof BLE_PARAM_ROOM_EQ_BAND_Q
  | typeof BLE_PARAM_ROOM_EQ_BAND_TYPE
  | typeof BLE_PARAM_SYSTEM_DRIFT_KP
  | typeof BLE_PARAM_SYSTEM_DRIFT_KI
  | typeof BLE_PARAM_SYSTEM_DRIFT_TARGET
  | typeof BLE_PARAM_SYSTEM_DRIFT_MAX_PPM

// ---------------------------------------------------------------------------
// Status / Error Codes
// ---------------------------------------------------------------------------

export const BLE_STATUS_OK = 0x00 as const
export const BLE_STATUS_INVALID_PARAM = 0x01 as const
export const BLE_STATUS_OUT_OF_RANGE = 0x02 as const
export const BLE_STATUS_BUSY = 0x03 as const
export const BLE_STATUS_CRC_ERROR = 0x04 as const

export type BLEStatusCode =
  | typeof BLE_STATUS_OK
  | typeof BLE_STATUS_INVALID_PARAM
  | typeof BLE_STATUS_OUT_OF_RANGE
  | typeof BLE_STATUS_BUSY
  | typeof BLE_STATUS_CRC_ERROR

// ---------------------------------------------------------------------------
// Filter Type Encoding (maps TS string enums to uint8 wire values)
// ---------------------------------------------------------------------------

export const BLE_FILTER_PEAKING = 0x00 as const
export const BLE_FILTER_LOW_SHELF = 0x01 as const
export const BLE_FILTER_HIGH_SHELF = 0x02 as const
export const BLE_FILTER_LOW_PASS = 0x03 as const
export const BLE_FILTER_HIGH_PASS = 0x04 as const
export const BLE_FILTER_BAND_PASS = 0x05 as const
export const BLE_FILTER_NOTCH = 0x06 as const
export const BLE_FILTER_ALL_PASS = 0x07 as const

export const FILTER_TYPE_TO_BLE: Record<FilterType, number> = {
  peaking: BLE_FILTER_PEAKING,
  lowShelf: BLE_FILTER_LOW_SHELF,
  highShelf: BLE_FILTER_HIGH_SHELF,
  lowPass: BLE_FILTER_LOW_PASS,
  highPass: BLE_FILTER_HIGH_PASS,
  bandPass: BLE_FILTER_BAND_PASS,
  notch: BLE_FILTER_NOTCH,
  allPass: BLE_FILTER_ALL_PASS,
}

export const BLE_TO_FILTER_TYPE: Record<number, FilterType> = Object.fromEntries(
  Object.entries(FILTER_TYPE_TO_BLE).map(([k, v]) => [v, k as FilterType]),
)

export const BLE_XO_BUTTERWORTH = 0x00 as const
export const BLE_XO_LINKWITZ_RILEY = 0x01 as const

export const CROSSOVER_TYPE_TO_BLE: Record<CrossoverFilterType, number> = {
  butterworth: BLE_XO_BUTTERWORTH,
  linkwitzRiley: BLE_XO_LINKWITZ_RILEY,
}

export const BLE_TO_CROSSOVER_TYPE: Record<number, CrossoverFilterType> = Object.fromEntries(
  Object.entries(CROSSOVER_TYPE_TO_BLE).map(([k, v]) => [v, k as CrossoverFilterType]),
)

export const CROSSOVER_SLOPE_TO_BLE: Record<CrossoverSlope, number> = {
  12: 0x01,
  24: 0x02,
  48: 0x04,
}

export const BLE_TO_CROSSOVER_SLOPE: Record<number, CrossoverSlope> = Object.fromEntries(
  Object.entries(CROSSOVER_SLOPE_TO_BLE).map(([k, v]) => [v, Number(k) as CrossoverSlope]),
)

// ---------------------------------------------------------------------------
// Wire Message Layouts
// ---------------------------------------------------------------------------

/**
 * PARAM_UPDATE message (written to BLE_CHAR_PARAM_UPDATE_UUID).
 *
 * Wire format (7-11 bytes):
 *   [0]  msg_id       u8   Sequence number for ACK matching
 *   [1]  msg_type     u8   BLE_MSG_PARAM_UPDATE (0x01)
 *   [2]  target_block u8   BLE_BLOCK_*
 *   [3]  channel      u8   Channel index (0-based) or input_idx for routing
 *   [4]  param_type   u8   BLE_PARAM_*
 *   [5]  param_index  u8   Sub-index (EQ band index, output_idx for routing, 0 otherwise)
 *   [6..] value       varies (see BLEParamValue)
 *
 * Total size: 6-byte header + 1 to 4 bytes value = 7 to 10 bytes.
 * Always fits in a single BLE packet (default MTU 23, ATT payload 20).
 */
export interface BLEParamUpdateMsg {
  msgId: number // u8
  msgType: typeof BLE_MSG_PARAM_UPDATE
  targetBlock: BLEBlockType
  channel: number // u8
  paramType: BLEParamType
  paramIndex: number // u8
  value: BLEParamValue
}

/**
 * Parameter value payload.
 *
 * - float32 (4 bytes): gain, frequency, Q, delay, master volume, routing gain
 * - uint8   (1 byte):  mute, phase, enable flags, filter type, crossover type/slope
 */
export type BLEParamValue =
  | { kind: 'f32'; value: number } // float32 (4 bytes on wire)
  | { kind: 'u8'; value: number } // uint8   (1 byte on wire)

/** Map from param type to its value encoding */
export const PARAM_VALUE_KIND: Record<BLEParamType, 'f32' | 'u8'> = {
  [BLE_PARAM_GAIN]: 'f32',
  [BLE_PARAM_MUTE]: 'u8',
  [BLE_PARAM_PHASE]: 'u8',
  [BLE_PARAM_EQ_BAND_ENABLE]: 'u8',
  [BLE_PARAM_EQ_BAND_FREQ]: 'f32',
  [BLE_PARAM_EQ_BAND_GAIN]: 'f32',
  [BLE_PARAM_EQ_BAND_Q]: 'f32',
  [BLE_PARAM_EQ_BAND_TYPE]: 'u8',
  [BLE_PARAM_CROSSOVER_HP_ENABLE]: 'u8',
  [BLE_PARAM_CROSSOVER_HP_FREQ]: 'f32',
  [BLE_PARAM_CROSSOVER_HP_TYPE]: 'u8',
  [BLE_PARAM_CROSSOVER_HP_SLOPE]: 'u8',
  [BLE_PARAM_CROSSOVER_LP_ENABLE]: 'u8',
  [BLE_PARAM_CROSSOVER_LP_FREQ]: 'f32',
  [BLE_PARAM_CROSSOVER_LP_TYPE]: 'u8',
  [BLE_PARAM_CROSSOVER_LP_SLOPE]: 'u8',
  [BLE_PARAM_DELAY]: 'f32',
  [BLE_PARAM_ROUTING_ENABLE]: 'u8',
  [BLE_PARAM_ROUTING_GAIN]: 'f32',
  [BLE_PARAM_MASTER_VOLUME]: 'f32',
  [BLE_PARAM_ROOM_EQ_BAND_ENABLE]: 'u8',
  [BLE_PARAM_ROOM_EQ_BAND_FREQ]: 'f32',
  [BLE_PARAM_ROOM_EQ_BAND_GAIN]: 'f32',
  [BLE_PARAM_ROOM_EQ_BAND_Q]: 'f32',
  [BLE_PARAM_ROOM_EQ_BAND_TYPE]: 'u8',
  [BLE_PARAM_SYSTEM_DRIFT_KP]: 'f32',
  [BLE_PARAM_SYSTEM_DRIFT_KI]: 'f32',
  [BLE_PARAM_SYSTEM_DRIFT_TARGET]: 'f32',
  [BLE_PARAM_SYSTEM_DRIFT_MAX_PPM]: 'f32',
}

/**
 * ACK message (notified on BLE_CHAR_STATUS_UUID).
 *
 * Wire format (3 bytes):
 *   [0] msg_id      u8   Original msg_id being acknowledged
 *   [1] msg_type    u8   BLE_MSG_ACK (0x80)
 *   [2] status_code u8   BLE_STATUS_*
 */
export interface BLEAckMsg {
  msgId: number // u8 - echoed from request
  msgType: typeof BLE_MSG_ACK
  statusCode: BLEStatusCode
}

/**
 * ERROR message (notified on BLE_CHAR_STATUS_UUID).
 *
 * Wire format (4 bytes):
 *   [0] msg_id      u8   Original msg_id (or 0 if unsolicited)
 *   [1] msg_type    u8   BLE_MSG_ERROR (0x82)
 *   [2] status_code u8   BLE_STATUS_*
 *   [3] detail      u8   Implementation-defined detail byte
 */
export interface BLEErrorMsg {
  msgId: number
  msgType: typeof BLE_MSG_ERROR
  statusCode: BLEStatusCode
  detail: number // u8
}

/**
 * Device info (read from BLE_CHAR_DEVICE_INFO_UUID).
 *
 * Wire format (12 bytes):
 *   [0..1]  firmware_major  u8, u8  (major.minor)
 *   [2..3]  firmware_patch  u16     LE
 *   [4..7]  sample_rate     u32     LE
 *   [8]     preset_index    u8
 *   [9]     num_inputs      u8
 *   [10]    num_outputs     u8
 *   [11]    max_eq_bands    u8
 */
export interface BLEDeviceInfo {
  firmwareMajor: number
  firmwareMinor: number
  firmwarePatch: number
  sampleRate: number
  presetIndex: number
  numInputs: number
  numOutputs: number
  maxEqBands: number
}

// ---------------------------------------------------------------------------
// Addressing helpers
// ---------------------------------------------------------------------------

/**
 * For ROUTING block, `channel` = input index, `paramIndex` = output index.
 * This encodes a specific crosspoint in the routing matrix.
 *
 * Example: set routing gain for input 1 -> output 3:
 *   targetBlock = BLE_BLOCK_ROUTING
 *   channel     = 1
 *   paramType   = BLE_PARAM_ROUTING_GAIN
 *   paramIndex  = 3
 *   value       = { kind: 'f32', value: 0.75 }
 */

/**
 * For EQ params, `channel` = channel index, `paramIndex` = EQ band index (0..9).
 *
 * Example: set EQ band 4 frequency on output channel 2:
 *   targetBlock = BLE_BLOCK_OUTPUT
 *   channel     = 2
 *   paramType   = BLE_PARAM_EQ_BAND_FREQ
 *   paramIndex  = 4
 *   value       = { kind: 'f32', value: 1000.0 }
 */

/**
 * For GLOBAL block, `channel` and `paramIndex` are both 0 (unused).
 *
 * Example: set master volume:
 *   targetBlock = BLE_BLOCK_GLOBAL
 *   channel     = 0
 *   paramType   = BLE_PARAM_MASTER_VOLUME
 *   paramIndex  = 0
 *   value       = { kind: 'f32', value: 0.8 }
 */

// ---------------------------------------------------------------------------
// Protocol constants
// ---------------------------------------------------------------------------

/** Header size for param update messages (before value payload) */
export const BLE_PARAM_MSG_HEADER_SIZE = 6

/** Maximum message size that fits in default BLE MTU (23 - 3 ATT overhead = 20) */
export const BLE_MAX_SINGLE_PACKET = 20

/** Timeout (ms) waiting for ACK from ESP-32 before retransmit */
export const BLE_ACK_TIMEOUT_MS = 200

/** Maximum number of unacknowledged messages in flight */
export const BLE_MAX_IN_FLIGHT = 4

/** Message ID wraps at 256 (u8) */
export const BLE_MSG_ID_MAX = 256
