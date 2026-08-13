import type { DSPConfig, DriftConfig } from '../types/dsp';
import type { BiquadCoefficients } from '../types/filter';
import { ESP32_MAGIC, ESP32_CONFIG_VERSION, MAX_PEQ_BANDS, MAX_CROSSOVER_STAGES } from '../types/esp32';
import { calculateBiquadCoefficients, identityBiquad } from '../dsp/biquad';
import { calculateCrossoverStages } from '../dsp/crossover';
import { dbToLinear } from '../dsp/utils';
import { FILTER_TYPE_TO_BLE, CROSSOVER_TYPE_TO_BLE, CROSSOVER_SLOPE_TO_BLE } from '../types/ble-protocol';
import { crc32 } from './checksum';
import { DEFAULT_DRIFT } from '../store/slices/drift-slice';
import { writeEQBandParams, writeDefaultEQBandParams } from './eq-band-params-io';

export class BinaryWriter {
  private buffer: ArrayBuffer;
  private view: DataView;
  private offset: number;

  constructor(size: number) {
    this.buffer = new ArrayBuffer(size);
    this.view = new DataView(this.buffer);
    this.offset = 0;
  }

  private ensureBounds(bytes: number): void {
    if (this.offset + bytes > this.buffer.byteLength) {
      throw new RangeError(
        `BinaryWriter: out of bounds at offset ${this.offset}, ` +
        `need ${bytes}, size ${this.buffer.byteLength}`
      );
    }
  }

  private validateFloat(value: number): void {
    if (!Number.isFinite(value)) {
      throw new RangeError(`BinaryWriter: NaN/Infinity at offset ${this.offset}`);
    }
  }

  writeUint8(value: number) {
    if (value < 0 || value > 255 || !Number.isInteger(value)) {
      throw new RangeError(`BinaryWriter: uint8 out of range at offset ${this.offset}: ${value}`);
    }
    this.ensureBounds(1);
    this.view.setUint8(this.offset, value);
    this.offset += 1;
  }

  writeUint16(value: number) {
    if (value < 0 || value > 65535 || !Number.isInteger(value)) {
      throw new RangeError(`BinaryWriter: uint16 out of range at offset ${this.offset}: ${value}`);
    }
    this.ensureBounds(2);
    this.view.setUint16(this.offset, value, true);
    this.offset += 2;
  }

  writeUint32(value: number) {
    if (value < 0 || value > 4294967295 || !Number.isInteger(value)) {
      throw new RangeError(`BinaryWriter: uint32 out of range at offset ${this.offset}: ${value}`);
    }
    this.ensureBounds(4);
    this.view.setUint32(this.offset, value, true);
    this.offset += 4;
  }

  writeFloat32(value: number) {
    this.validateFloat(value);
    this.ensureBounds(4);
    this.view.setFloat32(this.offset, value, true);
    this.offset += 4;
  }

  writeBiquad(coeffs: BiquadCoefficients) {
    this.writeFloat32(coeffs.b0);
    this.writeFloat32(coeffs.b1);
    this.writeFloat32(coeffs.b2);
    this.writeFloat32(coeffs.a1);
    this.writeFloat32(coeffs.a2);
  }

  align4() {
    while (this.offset % 4 !== 0) {
      this.writeUint8(0);
    }
  }

  getOffset(): number {
    return this.offset;
  }

  getBuffer(): ArrayBuffer {
    return this.buffer.slice(0, this.offset);
  }

  getUint8Array(): Uint8Array {
    return new Uint8Array(this.buffer, 0, this.offset);
  }

  writeUint32At(offset: number, value: number) {
    if (offset < 0 || offset + 4 > this.buffer.byteLength) {
      throw new RangeError(`BinaryWriter: writeUint32At out of bounds: offset ${offset}`);
    }
    this.view.setUint32(offset, value, true);
  }
}

/** Encode DSPConfig to binary format for ESP-32 */
export function encodeDSPConfig(config: DSPConfig, drift?: DriftConfig): ArrayBuffer {
  // Estimate max size: header(16) + inputs(2*368) + routing(8*8) + outputs(4*836) + global(12) + system(16) + padding
  const writer = new BinaryWriter(8192);

  // === Header (16 bytes) ===
  writer.writeUint32(ESP32_MAGIC);       // magic
  writer.writeUint16(ESP32_CONFIG_VERSION); // version
  writer.writeUint16(config.presetIndex);   // preset_index
  writer.writeUint32(config.sampleRate);    // sample_rate
  const crcOffset = writer.getOffset();
  writer.writeUint32(0);                    // crc32 placeholder

  // === Input Channels (2) ===
  for (let i = 0; i < 2; i++) {
    const input = config.inputs[i];
    writer.writeFloat32(dbToLinear(input.gain));
    writer.writeUint8(input.mute ? 1 : 0);
    writer.writeUint8(input.phaseInvert ? 1 : 0);
    writer.writeUint8(input.eqBands.filter((b) => b.enabled).length);
    writer.writeUint8(input.roomEqBands.filter((b) => b.enabled).length); // num_room_eq_bands
    writer.align4();

    // Write all MAX_PEQ_BANDS biquad sections (identity if disabled)
    for (let b = 0; b < MAX_PEQ_BANDS; b++) {
      const band = input.eqBands[b];
      if (band && band.enabled) {
        const coeffs = calculateBiquadCoefficients(
          band.filterType,
          band.frequency,
          config.sampleRate,
          band.gain,
          band.q,
        );
        writer.writeBiquad(coeffs);
      } else {
        writer.writeBiquad(identityBiquad());
      }
    }

    // Write shadow EQ band params (eq_band_params_t: 16 bytes each)
    for (let b = 0; b < MAX_PEQ_BANDS; b++) {
      const band = input.eqBands[b];
      if (band) {
        writeEQBandParams(writer, band);
      } else {
        writeDefaultEQBandParams(writer);
      }
    }

    // Write Room EQ biquad sections (identity if disabled)
    for (let b = 0; b < MAX_PEQ_BANDS; b++) {
      const band = input.roomEqBands[b];
      if (band && band.enabled) {
        const coeffs = calculateBiquadCoefficients(
          band.filterType,
          band.frequency,
          config.sampleRate,
          band.gain,
          band.q,
        );
        writer.writeBiquad(coeffs);
      } else {
        writer.writeBiquad(identityBiquad());
      }
    }

    // Write shadow Room EQ band params (16 bytes each)
    for (let b = 0; b < MAX_PEQ_BANDS; b++) {
      const band = input.roomEqBands[b];
      if (band) {
        writeEQBandParams(writer, band);
      } else {
        writeDefaultEQBandParams(writer);
      }
    }
  }

  // === Routing Matrix (2x4 = 8 crosspoints) ===
  for (let i = 0; i < 2; i++) {
    for (let o = 0; o < 4; o++) {
      const cp = config.routing[i][o];
      writer.writeUint8(cp.enabled ? 1 : 0);
      writer.writeUint8(0);
      writer.writeUint8(0);
      writer.writeUint8(0);
      writer.writeFloat32(cp.gain);
    }
  }

  // === Output Channels (4) ===
  for (let o = 0; o < 4; o++) {
    const output = config.outputs[o];

    // HP crossover stages
    let hpStages: BiquadCoefficients[] = [];
    if (output.crossover.highPass.enabled) {
      hpStages = calculateCrossoverStages(
        'highPass',
        output.crossover.highPass.filterType,
        output.crossover.highPass.slope,
        output.crossover.highPass.frequency,
        config.sampleRate,
      );
    }

    // LP crossover stages
    let lpStages: BiquadCoefficients[] = [];
    if (output.crossover.lowPass.enabled) {
      lpStages = calculateCrossoverStages(
        'lowPass',
        output.crossover.lowPass.filterType,
        output.crossover.lowPass.slope,
        output.crossover.lowPass.frequency,
        config.sampleRate,
      );
    }

    writer.writeFloat32(dbToLinear(output.gain));
    writer.writeUint32(output.delaySamples);
    writer.writeUint8(output.mute ? 1 : 0);
    writer.writeUint8(output.phaseInvert ? 1 : 0);
    writer.writeUint8(output.eqBands.filter((b) => b.enabled).length);
    writer.writeUint8(hpStages.length);
    writer.writeUint8(lpStages.length);
    writer.writeUint8(0); // reserved
    writer.align4();

    // PEQ biquads
    for (let b = 0; b < MAX_PEQ_BANDS; b++) {
      const band = output.eqBands[b];
      if (band && band.enabled) {
        const coeffs = calculateBiquadCoefficients(
          band.filterType,
          band.frequency,
          config.sampleRate,
          band.gain,
          band.q,
        );
        writer.writeBiquad(coeffs);
      } else {
        writer.writeBiquad(identityBiquad());
      }
    }

    // HP crossover biquads (pad to MAX_CROSSOVER_STAGES)
    for (let s = 0; s < MAX_CROSSOVER_STAGES; s++) {
      writer.writeBiquad(s < hpStages.length ? hpStages[s] : identityBiquad());
    }

    // LP crossover biquads (pad to MAX_CROSSOVER_STAGES)
    for (let s = 0; s < MAX_CROSSOVER_STAGES; s++) {
      writer.writeBiquad(s < lpStages.length ? lpStages[s] : identityBiquad());
    }

    // Write shadow EQ band params (eq_band_params_t: 16 bytes each)
    for (let b = 0; b < MAX_PEQ_BANDS; b++) {
      const band = output.eqBands[b];
      if (band) {
        writeEQBandParams(writer, band);
      } else {
        writeDefaultEQBandParams(writer);
      }
    }

    // Write shadow HP crossover params (xo_params_t: 8 bytes)
    const hp = output.crossover.highPass;
    writer.writeFloat32(hp.frequency);
    writer.writeUint8(CROSSOVER_TYPE_TO_BLE[hp.filterType] ?? 0);
    writer.writeUint8(CROSSOVER_SLOPE_TO_BLE[hp.slope] ?? 1);
    writer.writeUint8(hp.enabled ? 1 : 0);
    writer.writeUint8(0); // pad

    // Write shadow LP crossover params (xo_params_t: 8 bytes)
    const lp = output.crossover.lowPass;
    writer.writeFloat32(lp.frequency);
    writer.writeUint8(CROSSOVER_TYPE_TO_BLE[lp.filterType] ?? 0);
    writer.writeUint8(CROSSOVER_SLOPE_TO_BLE[lp.slope] ?? 1);
    writer.writeUint8(lp.enabled ? 1 : 0);
    writer.writeUint8(0); // pad
  }

  // === Global (12 bytes) ===
  writer.writeFloat32(dbToLinear(config.masterVolume));
  writer.writeUint32(config.sampleRate);
  writer.writeUint32(0); // reserved

  // === System / Drift (16 bytes) ===
  const d = drift ?? DEFAULT_DRIFT;
  writer.writeFloat32(d.kp);
  writer.writeFloat32(d.ki);
  writer.writeFloat32(d.targetFill);
  writer.writeFloat32(d.maxPpm);

  // Compute and write CRC32
  const dataWithoutCrc = writer.getUint8Array();
  // Zero out CRC field for computation
  const tempData = new Uint8Array(dataWithoutCrc);
  tempData[crcOffset] = 0;
  tempData[crcOffset + 1] = 0;
  tempData[crcOffset + 2] = 0;
  tempData[crcOffset + 3] = 0;
  const checksum = crc32(tempData);
  writer.writeUint32At(crcOffset, checksum);

  return writer.getBuffer();
}

/** Get the size of a DSP configuration binary in bytes */
export function getConfigSize(config: DSPConfig): number {
  return encodeDSPConfig(config).byteLength;
}
