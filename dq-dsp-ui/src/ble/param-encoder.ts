import type {
  BLEParamUpdateMsg,
  BLEParamValue,
  BLEBlockType,
  BLEParamType,
} from '../types/ble-protocol'
import {
  BLE_MSG_PARAM_UPDATE,
  BLE_BLOCK_INPUT,
  BLE_BLOCK_OUTPUT,
  BLE_BLOCK_ROUTING,
  BLE_BLOCK_GLOBAL,
  BLE_PARAM_GAIN,
  BLE_PARAM_MUTE,
  BLE_PARAM_PHASE,
  BLE_PARAM_EQ_BAND_ENABLE,
  BLE_PARAM_EQ_BAND_FREQ,
  BLE_PARAM_EQ_BAND_GAIN,
  BLE_PARAM_EQ_BAND_Q,
  BLE_PARAM_EQ_BAND_TYPE,
  BLE_PARAM_ROOM_EQ_BAND_ENABLE,
  BLE_PARAM_ROOM_EQ_BAND_FREQ,
  BLE_PARAM_ROOM_EQ_BAND_GAIN,
  BLE_PARAM_ROOM_EQ_BAND_Q,
  BLE_PARAM_ROOM_EQ_BAND_TYPE,
  BLE_PARAM_CROSSOVER_HP_ENABLE,
  BLE_PARAM_CROSSOVER_HP_FREQ,
  BLE_PARAM_CROSSOVER_HP_TYPE,
  BLE_PARAM_CROSSOVER_HP_SLOPE,
  BLE_PARAM_CROSSOVER_LP_ENABLE,
  BLE_PARAM_CROSSOVER_LP_FREQ,
  BLE_PARAM_CROSSOVER_LP_TYPE,
  BLE_PARAM_CROSSOVER_LP_SLOPE,
  BLE_PARAM_DELAY,
  BLE_PARAM_ROUTING_ENABLE,
  BLE_PARAM_ROUTING_GAIN,
  BLE_PARAM_MASTER_VOLUME,
  BLE_BLOCK_SYSTEM,
  BLE_PARAM_SYSTEM_DRIFT_KP,
  BLE_PARAM_SYSTEM_DRIFT_KI,
  BLE_PARAM_SYSTEM_DRIFT_TARGET,
  BLE_PARAM_SYSTEM_DRIFT_MAX_PPM,
  BLE_PARAM_MSG_HEADER_SIZE,
  BLE_MSG_ID_MAX,
  FILTER_TYPE_TO_BLE,
  CROSSOVER_TYPE_TO_BLE,
  CROSSOVER_SLOPE_TO_BLE,
} from '../types/ble-protocol'
import type { FilterType, CrossoverFilterType, CrossoverSlope } from '../types/filter'
import { dbToLinear } from '../dsp/utils'
import {
  SERIAL_MSG_PING,
  SERIAL_MSG_SYNC_CONFIG,
  SERIAL_MSG_SAVE_CONFIG,
} from '../types/serial-protocol'
import { crc8 } from '../types/serial-protocol'

/** Rolling message ID counter (0..255) */
let nextMsgId = 0

/**
 * Serial message IDs that share the first payload byte with a param update's
 * msg_id. The firmware treats single-byte payloads of 0xA0/0xA2/0xA5 as
 * control messages, and guards against collisions with payload_len == 1; the
 * UI avoids the collision outright so msg_ids stay unambiguous.
 */
const RESERVED_MSG_IDS = new Set<number>([
  SERIAL_MSG_PING,
  SERIAL_MSG_SYNC_CONFIG,
  SERIAL_MSG_SAVE_CONFIG,
])

/** Get next message ID and advance the counter */
export function getNextMsgId(): number {
  const id = nextMsgId
  do {
    nextMsgId = (nextMsgId + 1) % BLE_MSG_ID_MAX
  } while (RESERVED_MSG_IDS.has(nextMsgId))
  return id
}

/** Reset the message ID counter (useful for testing) */
export function resetMsgId(): void {
  nextMsgId = 0
}

/**
 * Reassign the msg_id of an already-encoded serial frame when the 8-bit
 * counter wrapped and the original ID is still awaiting its ACK (audit R3).
 * Scans forward for the first free ID, rewrites the payload's msg_id byte,
 * and recomputes the trailing CRC-8 over [length, ...payload].
 *
 * @param frame  Complete serial frame (0xAA 0x55 len payload... crc).
 * @param isBusy Predicate returning true for IDs currently in flight.
 * @returns      The new msg_id, or -1 if every ID is busy/reserved.
 */
export function reassignMsgId(frame: Uint8Array, isBusy: (id: number) => boolean): number {
  const payloadLen = frame[2]
  const old = frame[3]
  for (let i = 1; i < BLE_MSG_ID_MAX; i++) {
    const id = (old + i) % BLE_MSG_ID_MAX
    if (RESERVED_MSG_IDS.has(id)) continue
    if (isBusy(id)) continue
    frame[3] = id
    frame[3 + payloadLen] = crc8(frame, 2, 1 + payloadLen)
    return id
  }
  return -1
}

/**
 * Serialize a BLEParamUpdateMsg to its binary wire format.
 *
 * Wire layout:
 *   [0] msg_id       u8
 *   [1] msg_type     u8 (0x01)
 *   [2] target_block u8
 *   [3] channel      u8
 *   [4] param_type   u8
 *   [5] param_index  u8
 *   [6..] value      f32 LE (4 bytes) or u8 (1 byte)
 */
export function encodeParamUpdate(msg: BLEParamUpdateMsg): Uint8Array {
  const valueSize = msg.value.kind === 'f32' ? 4 : 1
  const buf = new ArrayBuffer(BLE_PARAM_MSG_HEADER_SIZE + valueSize)
  const view = new DataView(buf)

  view.setUint8(0, msg.msgId)
  view.setUint8(1, msg.msgType)
  view.setUint8(2, msg.targetBlock)
  view.setUint8(3, msg.channel)
  view.setUint8(4, msg.paramType)
  view.setUint8(5, msg.paramIndex)

  if (msg.value.kind === 'f32') {
    view.setFloat32(BLE_PARAM_MSG_HEADER_SIZE, msg.value.value, true)
  } else {
    view.setUint8(BLE_PARAM_MSG_HEADER_SIZE, msg.value.value)
  }

  return new Uint8Array(buf)
}

// ---------------------------------------------------------------------------
// Helper: build a full message from parts
// ---------------------------------------------------------------------------

function buildMsg(
  block: BLEBlockType,
  channel: number,
  paramType: BLEParamType,
  paramIndex: number,
  value: BLEParamValue,
): Uint8Array {
  const msgId = getNextMsgId()
  return encodeParamUpdate({
    msgId,
    msgType: BLE_MSG_PARAM_UPDATE,
    targetBlock: block,
    channel,
    paramType,
    paramIndex,
    value,
  })
}

// ---------------------------------------------------------------------------
// EQ Band helpers
// ---------------------------------------------------------------------------

export function encodeEQBandEnable(
  block: typeof BLE_BLOCK_INPUT | typeof BLE_BLOCK_OUTPUT,
  channel: number,
  bandIndex: number,
  enabled: boolean,
): Uint8Array {
  return buildMsg(block, channel, BLE_PARAM_EQ_BAND_ENABLE, bandIndex, {
    kind: 'u8',
    value: enabled ? 1 : 0,
  })
}

export function encodeEQBandFreq(
  block: typeof BLE_BLOCK_INPUT | typeof BLE_BLOCK_OUTPUT,
  channel: number,
  bandIndex: number,
  freqHz: number,
): Uint8Array {
  return buildMsg(block, channel, BLE_PARAM_EQ_BAND_FREQ, bandIndex, { kind: 'f32', value: freqHz })
}

export function encodeEQBandGain(
  block: typeof BLE_BLOCK_INPUT | typeof BLE_BLOCK_OUTPUT,
  channel: number,
  bandIndex: number,
  gainDb: number,
): Uint8Array {
  return buildMsg(block, channel, BLE_PARAM_EQ_BAND_GAIN, bandIndex, { kind: 'f32', value: gainDb })
}

export function encodeEQBandQ(
  block: typeof BLE_BLOCK_INPUT | typeof BLE_BLOCK_OUTPUT,
  channel: number,
  bandIndex: number,
  q: number,
): Uint8Array {
  return buildMsg(block, channel, BLE_PARAM_EQ_BAND_Q, bandIndex, { kind: 'f32', value: q })
}

export function encodeEQBandType(
  block: typeof BLE_BLOCK_INPUT | typeof BLE_BLOCK_OUTPUT,
  channel: number,
  bandIndex: number,
  filterType: FilterType,
): Uint8Array {
  return buildMsg(block, channel, BLE_PARAM_EQ_BAND_TYPE, bandIndex, {
    kind: 'u8',
    value: FILTER_TYPE_TO_BLE[filterType],
  })
}

/** Convenience: encode any single EQ band parameter update */
export function encodeEQBandUpdate(
  block: typeof BLE_BLOCK_INPUT | typeof BLE_BLOCK_OUTPUT,
  channel: number,
  bandIndex: number,
  paramType:
    | typeof BLE_PARAM_EQ_BAND_ENABLE
    | typeof BLE_PARAM_EQ_BAND_FREQ
    | typeof BLE_PARAM_EQ_BAND_GAIN
    | typeof BLE_PARAM_EQ_BAND_Q
    | typeof BLE_PARAM_EQ_BAND_TYPE,
  value: number | boolean | FilterType,
): Uint8Array {
  switch (paramType) {
    case BLE_PARAM_EQ_BAND_ENABLE:
      return encodeEQBandEnable(block, channel, bandIndex, value as boolean)
    case BLE_PARAM_EQ_BAND_FREQ:
      return encodeEQBandFreq(block, channel, bandIndex, value as number)
    case BLE_PARAM_EQ_BAND_GAIN:
      return encodeEQBandGain(block, channel, bandIndex, value as number)
    case BLE_PARAM_EQ_BAND_Q:
      return encodeEQBandQ(block, channel, bandIndex, value as number)
    case BLE_PARAM_EQ_BAND_TYPE:
      return encodeEQBandType(block, channel, bandIndex, value as FilterType)
  }
}

// ---------------------------------------------------------------------------
// Gain / Mute / Phase helpers
// ---------------------------------------------------------------------------

/** Encode gain update. Converts dB to linear for the wire. */
export function encodeGainUpdate(
  block: typeof BLE_BLOCK_INPUT | typeof BLE_BLOCK_OUTPUT,
  channel: number,
  gainDb: number,
): Uint8Array {
  return buildMsg(block, channel, BLE_PARAM_GAIN, 0, { kind: 'f32', value: dbToLinear(gainDb) })
}

export function encodeMuteUpdate(
  block: typeof BLE_BLOCK_INPUT | typeof BLE_BLOCK_OUTPUT,
  channel: number,
  muted: boolean,
): Uint8Array {
  return buildMsg(block, channel, BLE_PARAM_MUTE, 0, { kind: 'u8', value: muted ? 1 : 0 })
}

export function encodePhaseUpdate(
  block: typeof BLE_BLOCK_INPUT | typeof BLE_BLOCK_OUTPUT,
  channel: number,
  inverted: boolean,
): Uint8Array {
  return buildMsg(block, channel, BLE_PARAM_PHASE, 0, { kind: 'u8', value: inverted ? 1 : 0 })
}

// ---------------------------------------------------------------------------
// Crossover helpers (output only)
// ---------------------------------------------------------------------------

export function encodeCrossoverUpdate(
  channel: number,
  hpOrLp: 'hp' | 'lp',
  paramType: 'enable' | 'freq' | 'type' | 'slope',
  value: number | boolean | CrossoverFilterType | CrossoverSlope,
): Uint8Array {
  const paramMap = {
    hp: {
      enable: BLE_PARAM_CROSSOVER_HP_ENABLE,
      freq: BLE_PARAM_CROSSOVER_HP_FREQ,
      type: BLE_PARAM_CROSSOVER_HP_TYPE,
      slope: BLE_PARAM_CROSSOVER_HP_SLOPE,
    },
    lp: {
      enable: BLE_PARAM_CROSSOVER_LP_ENABLE,
      freq: BLE_PARAM_CROSSOVER_LP_FREQ,
      type: BLE_PARAM_CROSSOVER_LP_TYPE,
      slope: BLE_PARAM_CROSSOVER_LP_SLOPE,
    },
  } as const

  const bleParam = paramMap[hpOrLp][paramType]

  let bleValue: BLEParamValue
  switch (paramType) {
    case 'enable':
      bleValue = { kind: 'u8', value: (value as boolean) ? 1 : 0 }
      break
    case 'freq':
      bleValue = { kind: 'f32', value: value as number }
      break
    case 'type':
      bleValue = { kind: 'u8', value: CROSSOVER_TYPE_TO_BLE[value as CrossoverFilterType] }
      break
    case 'slope':
      bleValue = { kind: 'u8', value: CROSSOVER_SLOPE_TO_BLE[value as CrossoverSlope] }
      break
  }

  return buildMsg(BLE_BLOCK_OUTPUT, channel, bleParam, 0, bleValue)
}

// ---------------------------------------------------------------------------
// Delay helper (output only)
// ---------------------------------------------------------------------------

export function encodeDelayUpdate(channel: number, delaySamples: number): Uint8Array {
  return buildMsg(BLE_BLOCK_OUTPUT, channel, BLE_PARAM_DELAY, 0, {
    kind: 'f32',
    value: delaySamples,
  })
}

// ---------------------------------------------------------------------------
// Routing helpers
// ---------------------------------------------------------------------------

export function encodeRoutingEnable(
  inputIdx: number,
  outputIdx: number,
  enabled: boolean,
): Uint8Array {
  return buildMsg(BLE_BLOCK_ROUTING, inputIdx, BLE_PARAM_ROUTING_ENABLE, outputIdx, {
    kind: 'u8',
    value: enabled ? 1 : 0,
  })
}

export function encodeRoutingGain(
  inputIdx: number,
  outputIdx: number,
  gainLinear: number,
): Uint8Array {
  return buildMsg(BLE_BLOCK_ROUTING, inputIdx, BLE_PARAM_ROUTING_GAIN, outputIdx, {
    kind: 'f32',
    value: gainLinear,
  })
}

export function encodeRoutingUpdate(
  inputIdx: number,
  outputIdx: number,
  paramType: 'enable' | 'gain',
  value: boolean | number,
): Uint8Array {
  if (paramType === 'enable') {
    return encodeRoutingEnable(inputIdx, outputIdx, value as boolean)
  }
  return encodeRoutingGain(inputIdx, outputIdx, value as number)
}

// ---------------------------------------------------------------------------
// Master volume (global)
// ---------------------------------------------------------------------------

/** Encode master volume. Converts dB to linear for the wire. */
export function encodeMasterVolume(volumeDb: number): Uint8Array {
  return buildMsg(BLE_BLOCK_GLOBAL, 0, BLE_PARAM_MASTER_VOLUME, 0, {
    kind: 'f32',
    value: dbToLinear(volumeDb),
  })
}

// ---------------------------------------------------------------------------
// Room EQ Band helpers (input only)
// ---------------------------------------------------------------------------

export function encodeRoomEQBandEnable(
  channel: number,
  bandIndex: number,
  enabled: boolean,
): Uint8Array {
  return buildMsg(BLE_BLOCK_INPUT, channel, BLE_PARAM_ROOM_EQ_BAND_ENABLE, bandIndex, {
    kind: 'u8',
    value: enabled ? 1 : 0,
  })
}

export function encodeRoomEQBandFreq(
  channel: number,
  bandIndex: number,
  freqHz: number,
): Uint8Array {
  return buildMsg(BLE_BLOCK_INPUT, channel, BLE_PARAM_ROOM_EQ_BAND_FREQ, bandIndex, {
    kind: 'f32',
    value: freqHz,
  })
}

export function encodeRoomEQBandGain(
  channel: number,
  bandIndex: number,
  gainDb: number,
): Uint8Array {
  return buildMsg(BLE_BLOCK_INPUT, channel, BLE_PARAM_ROOM_EQ_BAND_GAIN, bandIndex, {
    kind: 'f32',
    value: gainDb,
  })
}

export function encodeRoomEQBandQ(channel: number, bandIndex: number, q: number): Uint8Array {
  return buildMsg(BLE_BLOCK_INPUT, channel, BLE_PARAM_ROOM_EQ_BAND_Q, bandIndex, {
    kind: 'f32',
    value: q,
  })
}

export function encodeRoomEQBandType(
  channel: number,
  bandIndex: number,
  filterType: FilterType,
): Uint8Array {
  return buildMsg(BLE_BLOCK_INPUT, channel, BLE_PARAM_ROOM_EQ_BAND_TYPE, bandIndex, {
    kind: 'u8',
    value: FILTER_TYPE_TO_BLE[filterType],
  })
}

// ---------------------------------------------------------------------------
// Drift compensation (system) helpers
// ---------------------------------------------------------------------------

export function encodeDriftKp(kp: number): Uint8Array {
  return buildMsg(BLE_BLOCK_SYSTEM, 0, BLE_PARAM_SYSTEM_DRIFT_KP, 0, { kind: 'f32', value: kp })
}

export function encodeDriftKi(ki: number): Uint8Array {
  return buildMsg(BLE_BLOCK_SYSTEM, 0, BLE_PARAM_SYSTEM_DRIFT_KI, 0, { kind: 'f32', value: ki })
}

export function encodeDriftTargetFill(target: number): Uint8Array {
  return buildMsg(BLE_BLOCK_SYSTEM, 0, BLE_PARAM_SYSTEM_DRIFT_TARGET, 0, {
    kind: 'f32',
    value: target,
  })
}

export function encodeDriftMaxPpm(maxPpm: number): Uint8Array {
  return buildMsg(BLE_BLOCK_SYSTEM, 0, BLE_PARAM_SYSTEM_DRIFT_MAX_PPM, 0, {
    kind: 'f32',
    value: maxPpm,
  })
}
