import type { DSPConfig, DriftConfig, InputChannel, OutputChannel, CrosspointGain } from '../types/dsp';
import type { EQBand, CrossoverFilter, CrossoverConfig } from '../types/filter';
import { ESP32_MAGIC, ESP32_CONFIG_VERSION, MAX_PEQ_BANDS, MAX_CROSSOVER_STAGES } from '../types/esp32';
import { BLE_TO_FILTER_TYPE, BLE_TO_CROSSOVER_TYPE, BLE_TO_CROSSOVER_SLOPE } from '../types/ble-protocol';
import { linearToDb } from '../dsp/utils';
import { crc32 } from './checksum';

class BinaryReader {
  private view: DataView;
  private offset: number;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    this.offset = 0;
  }

  /** Guard every read against running past the end of the buffer. */
  private ensure(bytes: number): void {
    if (this.offset + bytes > this.view.byteLength) {
      throw new RangeError(
        `BinaryReader: out of bounds at offset ${this.offset}, ` +
        `need ${bytes}, size ${this.view.byteLength}`,
      );
    }
  }

  readUint8(): number {
    this.ensure(1);
    const v = this.view.getUint8(this.offset);
    this.offset += 1;
    return v;
  }

  readUint16(): number {
    this.ensure(2);
    const v = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return v;
  }

  readUint32(): number {
    this.ensure(4);
    const v = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return v;
  }

  readFloat32(): number {
    this.ensure(4);
    const v = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return v;
  }

  skip(bytes: number) {
    this.ensure(bytes);
    this.offset += bytes;
  }

  align4() {
    while (this.offset % 4 !== 0) {
      this.offset += 1;
    }
  }

  getOffset(): number {
    return this.offset;
  }

  remaining(): number {
    return this.view.byteLength - this.offset;
  }
}

export type DecodedDSPConfig = DSPConfig & { drift?: DriftConfig };

/** Decode a binary dsp_config_t blob back into a DSPConfig store object. */
export function decodeDSPConfig(data: ArrayBuffer): DecodedDSPConfig | null {
  if (data.byteLength < 16) return null;

  const reader = new BinaryReader(data);

  // === Header (16 bytes) ===
  const magic = reader.readUint32();
  if (magic !== ESP32_MAGIC) return null;

  const version = reader.readUint16();
  if (version !== ESP32_CONFIG_VERSION && version !== 3) return null;

  const presetIndex = reader.readUint16();
  const sampleRate = reader.readUint32();
  const storedCrc = reader.readUint32();

  // Verify CRC32 (IEEE 802.3, over the whole blob with the crc field zeroed —
  // same scheme as binary-encoder.ts). Enforced only for the current layout;
  // legacy v3 blobs predate the drift section and are accepted as-is.
  // storedCrc === 0 is treated as "not computed" (old firmware never sets the
  // field) and decoded anyway, so a UI update doesn't require reflashing the
  // device.
  if (version === ESP32_CONFIG_VERSION && storedCrc !== 0) {
    const crcOffset = 12;
    const zeroed = new Uint8Array(data);
    zeroed[crcOffset] = 0;
    zeroed[crcOffset + 1] = 0;
    zeroed[crcOffset + 2] = 0;
    zeroed[crcOffset + 3] = 0;
    if (crc32(zeroed) !== storedCrc) {
      return null;
    }
  }

  // === Input Channels (2) ===
  const inputs: [InputChannel, InputChannel] = [
    readInputChannel(reader),
    readInputChannel(reader),
  ];

  // === Routing Matrix (2x4) ===
  const routing: CrosspointGain[][] = [];
  for (let i = 0; i < 2; i++) {
    routing[i] = [];
    for (let o = 0; o < 4; o++) {
      const enabled = reader.readUint8() !== 0;
      reader.skip(3); // pad
      const gain = reader.readFloat32();
      routing[i][o] = { enabled, gain };
    }
  }

  // === Output Channels (4) ===
  const outputs: [OutputChannel, OutputChannel, OutputChannel, OutputChannel] = [
    readOutputChannel(reader, sampleRate),
    readOutputChannel(reader, sampleRate),
    readOutputChannel(reader, sampleRate),
    readOutputChannel(reader, sampleRate),
  ];

  // === Global (12 bytes) ===
  const masterVolumeLinear = reader.readFloat32();
  reader.skip(4); // sample_rate (already read from header)
  reader.skip(4); // reserved

  const masterVolume = linearToDb(masterVolumeLinear);

  // === System / Drift (16 bytes, version >= 4) ===
  let drift: DriftConfig | undefined;
  if (reader.remaining() >= 16) {
    drift = {
      kp: reader.readFloat32(),
      ki: reader.readFloat32(),
      targetFill: reader.readFloat32(),
      maxPpm: reader.readFloat32(),
    };
  }

  return {
    inputs,
    routing,
    outputs,
    masterVolume: Number.isFinite(masterVolume) ? masterVolume : 0,
    sampleRate,
    presetIndex,
    presetName: 'Device',
    drift,
  };
}

function readInputChannel(reader: BinaryReader): InputChannel {
  const gainLinear = reader.readFloat32();
  const mute = reader.readUint8() !== 0;
  const phaseInvert = reader.readUint8() !== 0;
  reader.skip(1); // num_eq_bands
  reader.skip(1); // num_room_eq_bands
  reader.align4();

  // Skip biquad coefficients (5 floats * 10 bands = 200 bytes)
  reader.skip(MAX_PEQ_BANDS * 5 * 4);

  // Read shadow EQ band params (16 bytes each)
  const eqBands: EQBand[] = [];
  for (let b = 0; b < MAX_PEQ_BANDS; b++) {
    const frequency = reader.readFloat32();
    const gainDb = reader.readFloat32();
    const q = reader.readFloat32();
    const filterTypeBle = reader.readUint8();
    const enabled = reader.readUint8() !== 0;
    reader.skip(2); // pad

    eqBands.push({
      enabled,
      filterType: BLE_TO_FILTER_TYPE[filterTypeBle] ?? 'peaking',
      frequency,
      gain: gainDb,
      q,
    });
  }

  // Skip Room EQ biquad coefficients (5 floats * 10 bands = 200 bytes)
  reader.skip(MAX_PEQ_BANDS * 5 * 4);

  // Read shadow Room EQ band params (16 bytes each)
  const roomEqBands: EQBand[] = [];
  for (let b = 0; b < MAX_PEQ_BANDS; b++) {
    const frequency = reader.readFloat32();
    const gainDb = reader.readFloat32();
    const q = reader.readFloat32();
    const filterTypeBle = reader.readUint8();
    const enabled = reader.readUint8() !== 0;
    reader.skip(2); // pad

    roomEqBands.push({
      enabled,
      filterType: BLE_TO_FILTER_TYPE[filterTypeBle] ?? 'peaking',
      frequency,
      gain: gainDb,
      q,
    });
  }

  const gain = linearToDb(gainLinear);
  return {
    gain: Number.isFinite(gain) ? gain : 0,
    mute,
    phaseInvert,
    eqBands,
    roomEqBands,
  };
}

function readOutputChannel(reader: BinaryReader, sampleRate: number): OutputChannel {
  const gainLinear = reader.readFloat32();
  const delaySamples = reader.readUint32();
  const mute = reader.readUint8() !== 0;
  const phaseInvert = reader.readUint8() !== 0;
  reader.skip(1); // num_eq_bands
  reader.skip(1); // num_hp_stages
  reader.skip(1); // num_lp_stages
  reader.skip(1); // reserved
  reader.align4();

  // Skip biquad coefficients: EQ (10*20) + HP (4*20) + LP (4*20) = 360 bytes
  reader.skip(MAX_PEQ_BANDS * 5 * 4);         // EQ biquads
  reader.skip(MAX_CROSSOVER_STAGES * 5 * 4);   // HP biquads
  reader.skip(MAX_CROSSOVER_STAGES * 5 * 4);   // LP biquads

  // Read shadow EQ band params (16 bytes each)
  const eqBands: EQBand[] = [];
  for (let b = 0; b < MAX_PEQ_BANDS; b++) {
    const frequency = reader.readFloat32();
    const gainDb = reader.readFloat32();
    const q = reader.readFloat32();
    const filterTypeBle = reader.readUint8();
    const enabled = reader.readUint8() !== 0;
    reader.skip(2); // pad

    eqBands.push({
      enabled,
      filterType: BLE_TO_FILTER_TYPE[filterTypeBle] ?? 'peaking',
      frequency,
      gain: gainDb,
      q,
    });
  }

  // Read shadow HP crossover params (8 bytes)
  const hpFreq = reader.readFloat32();
  const hpType = reader.readUint8();
  const hpSlope = reader.readUint8();
  const hpEnabled = reader.readUint8() !== 0;
  reader.skip(1); // pad

  const highPass: CrossoverFilter = {
    enabled: hpEnabled,
    filterType: BLE_TO_CROSSOVER_TYPE[hpType] ?? 'butterworth',
    slope: BLE_TO_CROSSOVER_SLOPE[hpSlope] ?? 12,
    frequency: hpFreq,
  };

  // Read shadow LP crossover params (8 bytes)
  const lpFreq = reader.readFloat32();
  const lpType = reader.readUint8();
  const lpSlope = reader.readUint8();
  const lpEnabled = reader.readUint8() !== 0;
  reader.skip(1); // pad

  const lowPass: CrossoverFilter = {
    enabled: lpEnabled,
    filterType: BLE_TO_CROSSOVER_TYPE[lpType] ?? 'butterworth',
    slope: BLE_TO_CROSSOVER_SLOPE[lpSlope] ?? 12,
    frequency: lpFreq,
  };

  const crossover: CrossoverConfig = { highPass, lowPass };
  const delayMs = sampleRate > 0 ? (delaySamples / sampleRate) * 1000 : 0;
  const gain = linearToDb(gainLinear);

  return {
    gain: Number.isFinite(gain) ? gain : 0,
    mute,
    phaseInvert,
    delaySamples,
    delayMs,
    eqBands,
    crossover,
  };
}
