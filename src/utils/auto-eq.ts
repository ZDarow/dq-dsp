/**
 * Phase-Aware Auto Room EQ
 *
 * Best practices for IIR/PEQ-based room correction:
 * - Prefer cuts over boosts (cuts are minimum-phase safe; boosts add energy)
 * - Only correct below ~500Hz aggressively (room modes are minimum-phase)
 * - Above 500Hz: only broad gentle corrections (low Q)
 * - Never boost to fill narrow dips (those are excess-phase from reflections)
 * - Narrow dips (high Q needed) are skipped — they're likely cancellations
 *
 * Algorithm: weighted greedy peak-picking with frequency-dependent constraints.
 */

import type { EQBand } from '../types/filter';
import type { MeasurementPoint } from './rew-parser';
import { generateFrequencyPoints, eqBandsResponse } from '../dsp/frequency-response';
import { FREQUENCY_RANGE } from '../constants/filter-options';

const NUM_POINTS = 512;

/** Transition region where aggressive correction tapers off */
const BASS_FULL_CORRECTION_HZ = 300;
const TRANSITION_END_HZ = 800;

export interface AutoEQParams {
  maxGainDb: number;   // max boost (positive), e.g. 6
  minGainDb: number;   // max cut (negative), e.g. -12
  maxQ: number;        // max Q, e.g. 8
  numBands: number;    // how many bands to use (1-10)
}

/**
 * Compute frequency-dependent correction weight.
 * - Below 300Hz: full weight (1.0) — room modes are minimum-phase
 * - 300-800Hz: linear taper from 1.0 to 0.4
 * - Above 800Hz: reduced weight (0.4) — only broad corrections
 */
function correctionWeight(freq: number): number {
  if (freq <= BASS_FULL_CORRECTION_HZ) return 1.0;
  if (freq >= TRANSITION_END_HZ) return 0.4;
  const t = (freq - BASS_FULL_CORRECTION_HZ) / (TRANSITION_END_HZ - BASS_FULL_CORRECTION_HZ);
  return 1.0 - t * 0.6;
}

/**
 * Detect if a residual dip is likely excess-phase (reflection cancellation).
 * Narrow dips that require high Q to correct are usually NOT minimum-phase.
 * Returns true if the dip should be skipped.
 */
function isLikelyExcessPhase(
  residual: number[],
  peakIdx: number,
  frequencies: number[],
): boolean {
  const val = residual[peakIdx];
  // Only applies to boosts (filling dips)
  if (val <= 0) return false;

  // Check width: find where residual drops to 50% of peak
  const half = Math.abs(val) / 2;
  let lo = peakIdx;
  let hi = peakIdx;
  while (lo > 0 && Math.abs(residual[lo]) > half) lo--;
  while (hi < residual.length - 1 && Math.abs(residual[hi]) > half) hi++;

  const bandwidth = Math.log2(frequencies[hi] / frequencies[lo]);
  // If bandwidth < 1/6 octave, it's a narrow dip — likely excess-phase
  if (bandwidth < 1 / 6) return true;

  // Deep narrow dips (> 6dB and < 1/3 octave) above 200Hz — likely cancellation
  if (Math.abs(val) > 6 && bandwidth < 1 / 3 && frequencies[peakIdx] > 200) return true;

  return false;
}

export function computeAutoEQ(
  measurement: MeasurementPoint[],
  targetValues: number[],
  targetFrequencies: number[],
  sampleRate: number,
  params: AutoEQParams,
): EQBand[] {
  const frequencies = generateFrequencyPoints(FREQUENCY_RANGE.min, FREQUENCY_RANGE.max, NUM_POINTS);

  const measMag = frequencies.map((f) => interpolate(measurement, f));
  const targetMag = frequencies.map((f) => interpolateTarget(targetFrequencies, targetValues, f));

  // Offset target to measurement median
  const sortedMeas = [...measMag].sort((a, b) => a - b);
  const medianOffset = sortedMeas[Math.floor(sortedMeas.length / 2)];
  const target = targetMag.map((t) => t + medianOffset);

  const bands: EQBand[] = [];
  const appliedEQ = new Float64Array(NUM_POINTS);
  const skipZones: { lo: number; hi: number }[] = []; // already-corrected frequency ranges

  for (let n = 0; n < params.numBands; n++) {
    const residual = frequencies.map((_, i) => target[i] - measMag[i] - appliedEQ[i]);

    // Score each point: |residual| * correctionWeight, penalizing boosts
    let bestIdx = -1;
    let bestScore = 0;

    for (let i = 0; i < residual.length; i++) {
      const freq = frequencies[i];
      const r = residual[i];
      const absR = Math.abs(r);

      // Skip if too close to an already-placed filter
      if (skipZones.some((z) => freq >= z.lo && freq <= z.hi)) continue;

      // Weight: prefer bass, prefer cuts (negative residual = cut needed)
      let weight = correctionWeight(freq);

      // Cuts get 1.5x priority over boosts (cuts are always safe)
      if (r < 0) weight *= 1.5;

      // Penalize boosts above transition region
      if (r > 0 && freq > TRANSITION_END_HZ) weight *= 0.3;

      const score = absR * weight;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx < 0 || bestScore < 0.5) break;

    // Check if this is a narrow dip we shouldn't try to fill
    if (isLikelyExcessPhase(residual, bestIdx, frequencies)) {
      // Mark this zone and try next iteration
      const freq = frequencies[bestIdx];
      skipZones.push({ lo: freq * 0.9, hi: freq * 1.1 });
      n--; // don't count this as a used band
      continue;
    }

    const peakFreq = frequencies[bestIdx];
    let gain = residual[bestIdx];

    // Apply frequency-dependent gain limits
    const weight = correctionWeight(peakFreq);
    const effectiveMaxGain = params.maxGainDb * weight;
    gain = Math.max(params.minGainDb, Math.min(effectiveMaxGain, gain));

    // Estimate Q from peak width
    const halfPeak = Math.abs(residual[bestIdx]) / 2;
    let loIdx = bestIdx;
    let hiIdx = bestIdx;
    while (loIdx > 0 && Math.abs(residual[loIdx]) > halfPeak) loIdx--;
    while (hiIdx < residual.length - 1 && Math.abs(residual[hiIdx]) > halfPeak) hiIdx++;

    const loFreq = frequencies[loIdx];
    const hiFreq = frequencies[hiIdx];
    const bandwidth = Math.log2(hiFreq / loFreq);
    let q = bandwidth > 0 ? Math.SQRT2 / (2 * Math.sinh((Math.LN2 / 2) * bandwidth)) : 4;

    // Above transition: enforce lower Q (broader corrections only)
    const maxQForFreq = peakFreq > TRANSITION_END_HZ
      ? Math.min(params.maxQ, 3)
      : params.maxQ;
    q = Math.max(0.5, Math.min(maxQForFreq, q));

    const band: EQBand = {
      enabled: true,
      filterType: 'peaking',
      frequency: Math.round(peakFreq),
      gain: Math.round(gain * 10) / 10,
      q: Math.round(q * 100) / 100,
    };
    bands.push(band);

    // Mark this frequency zone as handled
    const zoneWidth = peakFreq * (Math.pow(2, 1 / (2 * q)) - Math.pow(2, -1 / (2 * q)));
    skipZones.push({ lo: peakFreq - zoneWidth / 2, hi: peakFreq + zoneWidth / 2 });

    // Update cumulative EQ
    const bandResp = eqBandsResponse([band], frequencies, sampleRate);
    for (let i = 0; i < NUM_POINTS; i++) {
      appliedEQ[i] += bandResp[i].magnitude;
    }
  }

  // Pad remaining bands as disabled
  while (bands.length < 10) {
    bands.push({ enabled: false, filterType: 'peaking', frequency: 1000, gain: 0, q: 1.0 });
  }

  return bands;
}

function interpolate(data: MeasurementPoint[], freq: number): number {
  if (data.length === 0) return 0;
  if (freq <= data[0].frequency) return data[0].magnitude;
  if (freq >= data[data.length - 1].frequency) return data[data.length - 1].magnitude;

  let lo = 0;
  let hi = data.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (data[mid].frequency <= freq) lo = mid;
    else hi = mid;
  }

  const f0 = Math.log10(data[lo].frequency);
  const f1 = Math.log10(data[hi].frequency);
  const t = (Math.log10(freq) - f0) / (f1 - f0);
  return data[lo].magnitude + t * (data[hi].magnitude - data[lo].magnitude);
}

function interpolateTarget(freqs: number[], values: number[], freq: number): number {
  if (freqs.length === 0) return 0;
  if (freq <= freqs[0]) return values[0];
  if (freq >= freqs[freqs.length - 1]) return values[values.length - 1];

  let lo = 0;
  let hi = freqs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (freqs[mid] <= freq) lo = mid;
    else hi = mid;
  }

  const f0 = Math.log10(freqs[lo]);
  const f1 = Math.log10(freqs[hi]);
  const t = (Math.log10(freq) - f0) / (f1 - f0);
  return values[lo] + t * (values[hi] - values[lo]);
}
