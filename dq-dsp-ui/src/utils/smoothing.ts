/**
 * Octave-band smoothing for frequency response data.
 */

import type { MeasurementPoint } from './rew-parser';

/**
 * Apply fractional-octave smoothing to measurement data.
 *
 * For 1/N octave smoothing, at each output frequency f, the average
 * magnitude (in dB) is computed over all input points within the band:
 *   [f * 2^(-1/(2N)), f * 2^(1/(2N))]
 *
 * @param data            Input measurement points (must be sorted by frequency)
 * @param octaveFraction  Smoothing width in fractional octaves (e.g., 3 for 1/3 octave)
 * @returns               Smoothed measurement points at the same frequencies
 */
export function smoothOctave(
  data: MeasurementPoint[],
  octaveFraction: number,
): MeasurementPoint[] {
  if (data.length === 0) return [];
  if (octaveFraction <= 0) return data.map((p) => ({ ...p }));

  const halfBandOctaves = 1 / (2 * octaveFraction);

  return data.map((point) => {
    const fLow = point.frequency * Math.pow(2, -halfBandOctaves);
    const fHigh = point.frequency * Math.pow(2, halfBandOctaves);

    let sum = 0;
    let count = 0;

    for (const p of data) {
      if (p.frequency < fLow) continue;
      if (p.frequency > fHigh) break;
      sum += p.magnitude;
      count++;
    }

    return {
      frequency: point.frequency,
      magnitude: count > 0 ? sum / count : point.magnitude,
    };
  });
}
