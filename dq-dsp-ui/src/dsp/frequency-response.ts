import type { BiquadCoefficients, EQBand, CrossoverConfig } from '../types/filter';
import { calculateBiquadCoefficients } from './biquad';
import { calculateCrossoverStages } from './crossover';

export interface FrequencyPoint {
  frequency: number;
  magnitude: number;  // dB
  phase: number;      // degrees
}

/**
 * Evaluate a single biquad's complex frequency response at a given frequency.
 * H(z) = (b0 + b1*z^-1 + b2*z^-2) / (1 - a1*z^-1 - a2*z^-2)
 * Note: a1,a2 are stored negated, so denominator is (1 + a1_stored*z^-1 + a2_stored*z^-2)
 * Wait - our convention stores -a1/a0 and -a2/a0, so:
 *   denominator = 1 - (-a1/a0)*z^-1 - (-a2/a0)*z^-2 = 1 + (a1/a0)*z^-1 + (a2/a0)*z^-2
 * But we stored negated: a1_stored = -a1/a0, so original a1/a0 = -a1_stored
 *   denominator = 1 - a1_stored*z^-1 - a2_stored*z^-2
 */
function evaluateBiquad(
  coeffs: BiquadCoefficients,
  frequency: number,
  sampleRate: number,
): { re: number; im: number } {
  const w = (2 * Math.PI * frequency) / sampleRate;
  const cosW = Math.cos(w);
  const sinW = Math.sin(w);
  const cos2W = Math.cos(2 * w);
  const sin2W = Math.sin(2 * w);

  // Numerator: b0 + b1*e^(-jw) + b2*e^(-j2w)
  const numRe = coeffs.b0 + coeffs.b1 * cosW + coeffs.b2 * cos2W;
  const numIm = -(coeffs.b1 * sinW + coeffs.b2 * sin2W);

  // Denominator: 1 - a1*e^(-jw) - a2*e^(-j2w)
  // (a1, a2 are already negated in our convention)
  const denRe = 1 - coeffs.a1 * cosW - coeffs.a2 * cos2W;
  const denIm = coeffs.a1 * sinW + coeffs.a2 * sin2W;

  // Complex division: (numRe + j*numIm) / (denRe + j*denIm)
  const denMag2 = denRe * denRe + denIm * denIm;
  return {
    re: (numRe * denRe + numIm * denIm) / denMag2,
    im: (numIm * denRe - numRe * denIm) / denMag2,
  };
}

/** Generate logarithmically spaced frequency points */
export function generateFrequencyPoints(
  minFreq: number,
  maxFreq: number,
  numPoints: number,
): number[] {
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFreq);
  const points: number[] = [];
  for (let i = 0; i < numPoints; i++) {
    const logF = logMin + (i / (numPoints - 1)) * (logMax - logMin);
    points.push(Math.pow(10, logF));
  }
  return points;
}

/** Compute frequency response for a single biquad filter */
export function biquadResponse(
  coeffs: BiquadCoefficients,
  frequencies: number[],
  sampleRate: number,
): FrequencyPoint[] {
  return frequencies.map((freq) => {
    const h = evaluateBiquad(coeffs, freq, sampleRate);
    const magnitude = 20 * Math.log10(Math.sqrt(h.re * h.re + h.im * h.im));
    const phase = (Math.atan2(h.im, h.re) * 180) / Math.PI;
    return { frequency: freq, magnitude, phase };
  });
}

/** Compute combined frequency response for an array of EQ bands */
export function eqBandsResponse(
  bands: EQBand[],
  frequencies: number[],
  sampleRate: number,
): FrequencyPoint[] {
  // Coefficients depend only on (filterType, frequency, gain, q) — not on the
  // evaluation point — so compute them once per band instead of per frequency.
  const coeffs = bands
    .filter((b) => b.enabled)
    .map((b) => calculateBiquadCoefficients(b.filterType, b.frequency, sampleRate, b.gain, b.q));

  return frequencies.map((freq) => {
    let totalRe = 1;
    let totalIm = 0;

    for (const c of coeffs) {
      const h = evaluateBiquad(c, freq, sampleRate);
      // Multiply complex numbers
      const newRe = totalRe * h.re - totalIm * h.im;
      const newIm = totalRe * h.im + totalIm * h.re;
      totalRe = newRe;
      totalIm = newIm;
    }

    const magnitude = 20 * Math.log10(Math.sqrt(totalRe * totalRe + totalIm * totalIm));
    const phase = (Math.atan2(totalIm, totalRe) * 180) / Math.PI;
    return { frequency: freq, magnitude, phase };
  });
}

/** Compute response for a single EQ band (for individual band curves) */
export function singleBandResponse(
  band: EQBand,
  frequencies: number[],
  sampleRate: number,
): FrequencyPoint[] {
  if (!band.enabled) {
    return frequencies.map((f) => ({ frequency: f, magnitude: 0, phase: 0 }));
  }
  const coeffs = calculateBiquadCoefficients(
    band.filterType,
    band.frequency,
    sampleRate,
    band.gain,
    band.q,
  );
  return biquadResponse(coeffs, frequencies, sampleRate);
}

/**
 * Complex response of an EQ chain, kept in re/im form so callers can sum
 * channels acoustically (linear addition of complex H(f), then |·| → dB).
 * Summing in dB is wrong: it ignores phase, so a 6 dB notch from
 * out-of-phase summation looks like a 3 dB notch.
 */
export function eqBandsComplexResponse(
  bands: EQBand[],
  frequencies: number[],
  sampleRate: number,
): { re: number; im: number }[] {
  const coeffs = bands
    .filter((b) => b.enabled)
    .map((b) => calculateBiquadCoefficients(b.filterType, b.frequency, sampleRate, b.gain, b.q));

  return frequencies.map((freq) => {
    let re = 1;
    let im = 0;
    for (const c of coeffs) {
      const h = evaluateBiquad(c, freq, sampleRate);
      const newRe = re * h.re - im * h.im;
      const newIm = re * h.im + im * h.re;
      re = newRe;
      im = newIm;
    }
    return { re, im };
  });
}

/** Complex response of a crossover (HP and/or LP cascaded biquads). */
export function crossoverComplexResponse(
  crossover: CrossoverConfig,
  frequencies: number[],
  sampleRate: number,
): { re: number; im: number }[] {
  const allStages: BiquadCoefficients[] = [];
  if (crossover.highPass.enabled) {
    allStages.push(
      ...calculateCrossoverStages(
        'highPass',
        crossover.highPass.filterType,
        crossover.highPass.slope,
        crossover.highPass.frequency,
        sampleRate,
      ),
    );
  }
  if (crossover.lowPass.enabled) {
    allStages.push(
      ...calculateCrossoverStages(
        'lowPass',
        crossover.lowPass.filterType,
        crossover.lowPass.slope,
        crossover.lowPass.frequency,
        sampleRate,
      ),
    );
  }
  return frequencies.map((freq) => {
    let re = 1;
    let im = 0;
    for (const coeffs of allStages) {
      const h = evaluateBiquad(coeffs, freq, sampleRate);
      const newRe = re * h.re - im * h.im;
      const newIm = re * h.im + im * h.re;
      re = newRe;
      im = newIm;
    }
    return { re, im };
  });
}

/** Compute combined response for crossover filters */
export function crossoverResponse(
  crossover: CrossoverConfig,
  frequencies: number[],
  sampleRate: number,
): FrequencyPoint[] {
  const allStages: BiquadCoefficients[] = [];

  if (crossover.highPass.enabled) {
    const stages = calculateCrossoverStages(
      'highPass',
      crossover.highPass.filterType,
      crossover.highPass.slope,
      crossover.highPass.frequency,
      sampleRate,
    );
    allStages.push(...stages);
  }

  if (crossover.lowPass.enabled) {
    const stages = calculateCrossoverStages(
      'lowPass',
      crossover.lowPass.filterType,
      crossover.lowPass.slope,
      crossover.lowPass.frequency,
      sampleRate,
    );
    allStages.push(...stages);
  }

  return frequencies.map((freq) => {
    let totalRe = 1;
    let totalIm = 0;

    for (const coeffs of allStages) {
      const h = evaluateBiquad(coeffs, freq, sampleRate);
      const newRe = totalRe * h.re - totalIm * h.im;
      const newIm = totalRe * h.im + totalIm * h.re;
      totalRe = newRe;
      totalIm = newIm;
    }

    const magnitude = 20 * Math.log10(Math.sqrt(totalRe * totalRe + totalIm * totalIm));
    const phase = (Math.atan2(totalIm, totalRe) * 180) / Math.PI;
    return { frequency: freq, magnitude, phase };
  });
}
