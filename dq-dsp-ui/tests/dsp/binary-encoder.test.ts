/**
 * Binary encoder tests
 *
 * Verifies the binary encoding matches the expected format.
 * Run with: npx vitest run tests/dsp/binary-encoder.test.ts
 */

import { describe, it, expect } from 'vitest';
import { encodeDSPConfig, BinaryWriter } from '../../src/export/binary-encoder';
import { createDefaultDSPConfig } from '../../src/constants/defaults';
import { ESP32_MAGIC, ESP32_CONFIG_VERSION } from '../../src/types/esp32';
import { crc32 } from '../../src/export/checksum';

describe('binary encoder', () => {
  it('encodes default config with correct magic number', () => {
    const config = createDefaultDSPConfig();
    const buffer = encodeDSPConfig(config);
    const view = new DataView(buffer);

    expect(view.getUint32(0, true)).toBe(ESP32_MAGIC);
  });

  it('encodes correct version and preset index', () => {
    const config = createDefaultDSPConfig();
    config.presetIndex = 3;
    const buffer = encodeDSPConfig(config);
    const view = new DataView(buffer);

    expect(view.getUint16(4, true)).toBe(ESP32_CONFIG_VERSION);
    expect(view.getUint16(6, true)).toBe(3);
  });

  it('encodes correct sample rate', () => {
    const config = createDefaultDSPConfig();
    config.sampleRate = 96000;
    const buffer = encodeDSPConfig(config);
    const view = new DataView(buffer);

    expect(view.getUint32(8, true)).toBe(96000);
  });

  it('produces valid CRC32', () => {
    const config = createDefaultDSPConfig();
    const buffer = encodeDSPConfig(config);
    const data = new Uint8Array(buffer);

    // Read the stored CRC
    const view = new DataView(buffer);
    const storedCrc = view.getUint32(12, true);

    // Zero out the CRC field and compute
    const check = new Uint8Array(data);
    check[12] = 0;
    check[13] = 0;
    check[14] = 0;
    check[15] = 0;
    const computed = crc32(check);

    expect(storedCrc).toBe(computed);
  });

  it('output binary size is reasonable', () => {
    const config = createDefaultDSPConfig();
    const buffer = encodeDSPConfig(config);

    // Should be around 2300-2500 bytes for default config
    expect(buffer.byteLength).toBeGreaterThan(1000);
    expect(buffer.byteLength).toBeLessThan(5000);
  });

  it('encodes muted input correctly', () => {
    const config = createDefaultDSPConfig();
    config.inputs[0].mute = true;
    const buffer = encodeDSPConfig(config);
    const view = new DataView(buffer);

    // After header (16 bytes), first input starts
    // gain (4 bytes float), then mute (1 byte)
    const muteOffset = 16 + 4; // header + gain
    expect(view.getUint8(muteOffset)).toBe(1);
  });

  it('encodes different configs to different binaries', () => {
    const config1 = createDefaultDSPConfig();
    const config2 = createDefaultDSPConfig();
    config2.inputs[0].gain = 6;

    const buf1 = encodeDSPConfig(config1);
    const buf2 = encodeDSPConfig(config2);

    // Same size but different content
    expect(buf1.byteLength).toBe(buf2.byteLength);

    const arr1 = new Uint8Array(buf1);
    const arr2 = new Uint8Array(buf2);
    let differ = false;
    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) {
        differ = true;
        break;
      }
    }
    expect(differ).toBe(true);
  });

  it('routing matrix encoding is correct', () => {
    const config = createDefaultDSPConfig();
    // Default stereo: In1->Out1+Out3, In2->Out2+Out4
    const buffer = encodeDSPConfig(config);
    const view = new DataView(buffer);

    // Find routing matrix offset
    // Header(16) + 2 inputs * 728 bytes per input.
    // Input layout: gain(4) + mute/phase/numEq/numRoom(4) + align(0) = 8
    //   + EQ biquads (10*20=200) + EQ params (10*16=160)
    //   + RoomEQ biquads (10*20=200) + RoomEQ params (10*16=160) = 728
    const inputSize = 8 + 10 * 20 + 10 * 16 + 10 * 20 + 10 * 16; // 728
    const routingStart = 16 + 2 * inputSize;

    // In1->Out1 should be enabled (1)
    expect(view.getUint8(routingStart)).toBe(1);
    // In1->Out2 should be disabled (0)
    expect(view.getUint8(routingStart + 8)).toBe(0);
  });
});

describe('BinaryWriter validation', () => {
  it('rejects NaN float32', () => {
    const writer = new BinaryWriter(64);
    expect(() => writer.writeFloat32(NaN)).toThrow('NaN/Infinity');
  });

  it('rejects Infinity float32', () => {
    const writer = new BinaryWriter(64);
    expect(() => writer.writeFloat32(Infinity)).toThrow('NaN/Infinity');
    expect(() => writer.writeFloat32(-Infinity)).toThrow('NaN/Infinity');
  });

  it('rejects out-of-range uint8', () => {
    const writer = new BinaryWriter(64);
    expect(() => writer.writeUint8(-1)).toThrow('uint8 out of range');
    expect(() => writer.writeUint8(256)).toThrow('uint8 out of range');
    expect(() => writer.writeUint8(1.5)).toThrow('uint8 out of range');
  });

  it('rejects out-of-range uint16', () => {
    const writer = new BinaryWriter(64);
    expect(() => writer.writeUint16(-1)).toThrow('uint16 out of range');
    expect(() => writer.writeUint16(65536)).toThrow('uint16 out of range');
  });

  it('rejects out-of-range uint32', () => {
    const writer = new BinaryWriter(64);
    expect(() => writer.writeUint32(-1)).toThrow('uint32 out of range');
    expect(() => writer.writeUint32(4294967296)).toThrow('uint32 out of range');
  });

  it('rejects buffer overflow', () => {
    const writer = new BinaryWriter(4);
    writer.writeUint32(0);
    expect(() => writer.writeUint8(0)).toThrow('out of bounds');
  });

  it('accepts valid finite floats', () => {
    const writer = new BinaryWriter(64);
    expect(() => {
      writer.writeFloat32(0);
      writer.writeFloat32(-0);
      writer.writeFloat32(1.5);
      writer.writeFloat32(-3.14e10);
    }).not.toThrow();
  });
});
