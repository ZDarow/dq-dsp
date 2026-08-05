/**
 * Biquad coefficient tests
 *
 * Verifies against Audio EQ Cookbook reference values.
 * Run with: npx vitest run tests/dsp/biquad.test.ts
 */

import { describe, it, expect } from 'vitest';
import { calculateBiquadCoefficients, identityBiquad } from '../../src/dsp/biquad';
import {
  generateFrequencyPoints,
  eqBandsResponse,
  singleBandResponse,
} from '../../src/dsp/frequency-response';

const SAMPLE_RATE = 48000;

describe('biquad coefficient calculation', () => {
  it('identity biquad passes signal unchanged', () => {
    const id = identityBiquad();
    expect(id.b0).toBe(1);
    expect(id.b1).toBe(0);
    expect(id.b2).toBe(0);
    expect(id.a1).toBe(0);
    expect(id.a2).toBe(0);
  });

  it('peaking filter at 1kHz +6dB should measure +6dB at 1kHz', () => {
    const freqs = [1000];
    const band = {
      enabled: true,
      filterType: 'peaking' as const,
      frequency: 1000,
      gain: 6,
      q: 1,
    };
    const response = singleBandResponse(band, freqs, SAMPLE_RATE);
    expect(Math.abs(response[0].magnitude - 6)).toBeLessThan(0.1);
  });

  it('peaking filter at 1kHz +6dB should be ~0dB at distant frequencies', () => {
    const freqs = [50, 20000];
    const band = {
      enabled: true,
      filterType: 'peaking' as const,
      frequency: 1000,
      gain: 6,
      q: 1,
    };
    const response = singleBandResponse(band, freqs, SAMPLE_RATE);
    for (const point of response) {
      expect(Math.abs(point.magnitude)).toBeLessThan(1.0);
    }
  });

  it('lowPass at 1kHz should attenuate high frequencies', () => {
    const coeffs = calculateBiquadCoefficients('lowPass', 1000, SAMPLE_RATE, 0, 0.707);
    expect(coeffs.b0).toBeGreaterThan(0);
    // Verify at 10kHz the response is attenuated
    const freqs = [10000];
    const band = {
      enabled: true,
      filterType: 'lowPass' as const,
      frequency: 1000,
      gain: 0,
      q: 0.707,
    };
    const response = singleBandResponse(band, freqs, SAMPLE_RATE);
    expect(response[0].magnitude).toBeLessThan(-10);
  });

  it('highPass at 1kHz should attenuate low frequencies', () => {
    const freqs = [100];
    const band = {
      enabled: true,
      filterType: 'highPass' as const,
      frequency: 1000,
      gain: 0,
      q: 0.707,
    };
    const response = singleBandResponse(band, freqs, SAMPLE_RATE);
    expect(response[0].magnitude).toBeLessThan(-10);
  });

  it('notch at 1kHz should deeply attenuate at 1kHz', () => {
    const freqs = [1000];
    const band = {
      enabled: true,
      filterType: 'notch' as const,
      frequency: 1000,
      gain: 0,
      q: 10,
    };
    const response = singleBandResponse(band, freqs, SAMPLE_RATE);
    expect(response[0].magnitude).toBeLessThan(-30);
  });

  it('lowShelf at 200Hz +6dB should boost below 200Hz', () => {
    const freqs = [50];
    const band = {
      enabled: true,
      filterType: 'lowShelf' as const,
      frequency: 200,
      gain: 6,
      q: 0.707,
    };
    const response = singleBandResponse(band, freqs, SAMPLE_RATE);
    expect(response[0].magnitude).toBeGreaterThan(4);
  });

  it('highShelf at 5kHz +6dB should boost above 5kHz', () => {
    const freqs = [15000];
    const band = {
      enabled: true,
      filterType: 'highShelf' as const,
      frequency: 5000,
      gain: 6,
      q: 0.707,
    };
    const response = singleBandResponse(band, freqs, SAMPLE_RATE);
    expect(response[0].magnitude).toBeGreaterThan(4);
  });

  it('combined EQ bands response is sum of individual responses (in dB, approximately)', () => {
    const freqs = generateFrequencyPoints(20, 20000, 64);
    const bands = [
      { enabled: true, filterType: 'peaking' as const, frequency: 100, gain: 3, q: 1 },
      { enabled: true, filterType: 'peaking' as const, frequency: 10000, gain: -3, q: 1 },
    ];
    const combined = eqBandsResponse(bands, freqs, SAMPLE_RATE);

    // At 100Hz the boost should be approximately +3dB
    const at100 = combined.find((p) => Math.abs(p.frequency - 100) < 5);
    expect(at100!.magnitude).toBeGreaterThan(2);

    // At 10kHz the cut should be approximately -3dB
    const at10k = combined.find((p) => Math.abs(p.frequency - 10000) < 500);
    expect(at10k!.magnitude).toBeLessThan(-2);
  });
});
