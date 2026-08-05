import type { BLEAckMsg, BLEErrorMsg, BLEDeviceInfo, BLEStatusCode } from '../types/ble-protocol';
import { BLE_MSG_ACK, BLE_MSG_ERROR } from '../types/ble-protocol';

/**
 * Decode a status/ACK/error notification from the ESP-32 status characteristic.
 *
 * ACK wire format (3 bytes):
 *   [0] msg_id      u8
 *   [1] msg_type    u8  (0x80 = ACK, 0x82 = ERROR)
 *   [2] status_code u8
 *
 * ERROR wire format (4 bytes):
 *   [0] msg_id      u8
 *   [1] msg_type    u8  (0x82)
 *   [2] status_code u8
 *   [3] detail      u8
 */
export function decodeStatusMessage(data: DataView): BLEAckMsg | BLEErrorMsg {
  const msgId = data.getUint8(0);
  const msgType = data.getUint8(1);
  const statusCode = data.getUint8(2) as BLEStatusCode;

  if (msgType === BLE_MSG_ERROR) {
    const detail = data.byteLength >= 4 ? data.getUint8(3) : 0;
    return { msgId, msgType: BLE_MSG_ERROR, statusCode, detail };
  }

  return { msgId, msgType: BLE_MSG_ACK, statusCode };
}

/**
 * Decode device info read from the device info characteristic.
 *
 * Wire format (12 bytes):
 *   [0]     firmware_major  u8
 *   [1]     firmware_minor  u8
 *   [2..3]  firmware_patch  u16 LE
 *   [4..7]  sample_rate     u32 LE
 *   [8]     preset_index    u8
 *   [9]     num_inputs      u8
 *   [10]    num_outputs     u8
 *   [11]    max_eq_bands    u8
 */
export function decodeDeviceInfo(data: DataView): BLEDeviceInfo {
  return {
    firmwareMajor: data.getUint8(0),
    firmwareMinor: data.getUint8(1),
    firmwarePatch: data.getUint16(2, true),
    sampleRate: data.getUint32(4, true),
    presetIndex: data.getUint8(8),
    numInputs: data.getUint8(9),
    numOutputs: data.getUint8(10),
    maxEqBands: data.getUint8(11),
  };
}
