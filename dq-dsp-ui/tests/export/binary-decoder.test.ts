/**
 * Binary decoder round-trip tests.
 *
 * Verifies that encodeDSPConfig -> decodeDSPConfig is lossless for
 * default and mutated configs.
 *
 * Run with: npx vitest run tests/export/binary-decoder.test.ts
 */

import { describe, it, expect } from 'vitest';
import { encodeDSPConfig } from '../../src/export/binary-encoder';
import { decodeDSPConfig } from '../../src/export/binary-decoder';
import { createDefaultDSPConfig } from '../../src/constants/defaults';

function roundTrip(config: unknown) {
  const buffer = encodeDSPConfig(config as Parameters<typeof encodeDSPConfig>[0]);
  const decoded = decodeDSPConfig(buffer);
  expect(decoded).not.toBeNull();
  return decoded;
}

describe('binary-decoder round-trip', () => {
  it('decodes default config without loss', () => {
    const config = createDefaultDSPConfig();
    const decoded = roundTrip(config)!;

    expect(decoded.sampleRate).toBe(config.sampleRate);
    expect(decoded.presetIndex).toBe(config.presetIndex);
    expect(decoded.masterVolume).toBeCloseTo(config.masterVolume, 5);
    expect(decoded.inputs[0].gain).toBeCloseTo(config.inputs[0].gain, 5);
    expect(decoded.inputs[0].mute).toBe(config.inputs[0].mute);
    expect(decoded.outputs.length).toBe(4);
  });

  it('preserves routing matrix', () => {
    const config = createDefaultDSPConfig();
    const decoded = roundTrip(config)!;

    for (let i = 0; i < 2; i++) {
      for (let o = 0; o < 4; o++) {
        expect(decoded.routing[i][o].enabled).toBe(config.routing[i][o].enabled);
        expect(decoded.routing[i][o].gain).toBeCloseTo(config.routing[i][o].gain, 5);
      }
    }
  });

  it('preserves EQ band parameters', () => {
    const config = createDefaultDSPConfig();
    config.inputs[0].eqBands[0].enabled = true;
    config.inputs[0].eqBands[0].frequency = 1000;
    config.inputs[0].eqBands[0].gain = 6;
    config.inputs[0].eqBands[0].q = 1.5;
    config.inputs[0].eqBands[0].filterType = 'highShelf';

    const decoded = roundTrip(config)!;
    const band = decoded.inputs[0].eqBands[0];

    expect(band.enabled).toBe(true);
    expect(band.frequency).toBeCloseTo(1000, 0);
    expect(band.gain).toBeCloseTo(6, 1);
    expect(band.q).toBeCloseTo(1.5, 1);
    expect(band.filterType).toBe('highShelf');
  });

  it('preserves crossover parameters', () => {
    const config = createDefaultDSPConfig();
    config.outputs[0].crossover.highPass.enabled = true;
    config.outputs[0].crossover.highPass.filterType = 'butterworth';
    config.outputs[0].crossover.highPass.slope = 48;
    config.outputs[0].crossover.highPass.frequency = 80;

    const decoded = roundTrip(config)!;
    const hp = decoded.outputs[0].crossover.highPass;

    expect(hp.enabled).toBe(true);
    expect(hp.filterType).toBe('butterworth');
    expect(hp.slope).toBe(48);
    expect(hp.frequency).toBeCloseTo(80, 0);
  });

  it('preserves delay samples', () => {
    const config = createDefaultDSPConfig();
    config.outputs[1].delaySamples = 240;

    const decoded = roundTrip(config)!;
    expect(decoded.outputs[1].delaySamples).toBe(240);
    expect(decoded.outputs[1].delayMs).toBeCloseTo(240 / config.sampleRate * 1000, 1);
  });

  it('rejects corrupted CRC', () => {
    const config = createDefaultDSPConfig();
    const buffer = encodeDSPConfig(config);
    const corrupted = new Uint8Array(buffer);
    corrupted[20] ^= 0xFF; // flip bits in payload

    const decoded = decodeDSPConfig(corrupted.buffer);
    expect(decoded).toBeNull();
  });

  it('rejects wrong magic', () => {
    const config = createDefaultDSPConfig();
    const buffer = encodeDSPConfig(config);
    const view = new DataView(buffer);
    view.setUint32(0, 0xDEADBEEF, true);

    const decoded = decodeDSPConfig(buffer);
    expect(decoded).toBeNull();
  });

  it('accepts legacy v3 blob with zero CRC', () => {
    const config = createDefaultDSPConfig();
    const buffer = encodeDSPConfig(config);
    const view = new DataView(buffer);

    // Force version 3 and zero CRC
    view.setUint16(4, 3, true);
    view.setUint32(12, 0, true);

    const decoded = decodeDSPConfig(buffer);
    expect(decoded).not.toBeNull();
    expect(decoded.sampleRate).toBe(config.sampleRate);
  });
});
