/**
 * Shared helpers for reading/writing EQ band parameters.
 *
 * These reduce duplication between binary-encoder.ts and binary-decoder.ts
 * for the shadow EQ param blocks (eq_band_params_t / ESP32EQBandParams).
 */

import type { EQBand } from '../types/filter';
import { FILTER_TYPE_TO_BLE, BLE_TO_FILTER_TYPE } from '../types/ble-protocol';
import { BinaryWriter } from './binary-encoder';
import { BinaryReader } from './binary-decoder';

export function writeEQBandParams(writer: BinaryWriter, band: EQBand): void {
  writer.writeFloat32(band.frequency);
  writer.writeFloat32(band.gain);
  writer.writeFloat32(band.q);
  writer.writeUint8(FILTER_TYPE_TO_BLE[band.filterType] ?? 0);
  writer.writeUint8(band.enabled ? 1 : 0);
  writer.writeUint8(0); // pad
  writer.writeUint8(0); // pad
}

export function writeDefaultEQBandParams(writer: BinaryWriter): void {
  writer.writeFloat32(1000);
  writer.writeFloat32(0);
  writer.writeFloat32(0.707);
  writer.writeUint8(0);
  writer.writeUint8(0);
  writer.writeUint8(0);
  writer.writeUint8(0);
}

export function readEQBandParams(reader: BinaryReader): EQBand {
  const frequency = reader.readFloat32();
  const gainDb = reader.readFloat32();
  const q = reader.readFloat32();
  const filterTypeBle = reader.readUint8();
  const enabled = reader.readUint8() !== 0;
  reader.skip(2); // pad

  return {
    enabled,
    filterType: BLE_TO_FILTER_TYPE[filterTypeBle] ?? 'peaking',
    frequency,
    gain: gainDb,
    q,
  };
}
