import type { BiquadCoefficients, CrossoverFilterType, CrossoverSlope } from '../types/filter'
import { calculateBiquadCoefficients } from './biquad'

/**
 * Decompose a crossover filter into cascaded biquad stages.
 *
 * Butterworth: maximally flat passband
 *   - 12 dB/oct = 1 biquad (2nd order)
 *   - 24 dB/oct = 2 cascaded biquads (4th order)
 *   - 48 dB/oct = 4 cascaded biquads (8th order)
 *
 * Linkwitz-Riley: squared Butterworth, flat at crossover point
 *   - 12 dB/oct = 1 biquad (LR2 = BW1 squared, but we use BW2 Q)
 *   - 24 dB/oct = 2 cascaded biquads (LR4 = BW2 squared)
 *   - 48 dB/oct = 4 cascaded biquads (LR8 = BW4 squared)
 */
export function calculateCrossoverStages(
  type: 'highPass' | 'lowPass',
  filterType: CrossoverFilterType,
  slope: CrossoverSlope,
  frequency: number,
  sampleRate: number,
): BiquadCoefficients[] {
  const filterKind = type === 'highPass' ? 'highPass' : 'lowPass'

  if (filterType === 'butterworth') {
    return butterworthStages(filterKind, slope, frequency, sampleRate)
  } else {
    return linkwitzRileyStages(filterKind, slope, frequency, sampleRate)
  }
}

function butterworthStages(
  type: 'highPass' | 'lowPass',
  slope: CrossoverSlope,
  frequency: number,
  sampleRate: number,
): BiquadCoefficients[] {
  const order = slope / 6 // 12->2, 24->4, 48->8
  const numStages = order / 2
  const stages: BiquadCoefficients[] = []

  for (let i = 0; i < numStages; i++) {
    // Q values for cascaded Butterworth stages
    const q = butterworthQ(order, i)
    stages.push(calculateBiquadCoefficients(type, frequency, sampleRate, 0, q))
  }

  return stages
}

function linkwitzRileyStages(
  type: 'highPass' | 'lowPass',
  slope: CrossoverSlope,
  frequency: number,
  sampleRate: number,
): BiquadCoefficients[] {
  // Linkwitz-Riley = two identical Butterworth filters cascaded
  // LR2N = BW_N squared
  const bwOrder = slope / 12 // LR12->BW1(approx), LR24->BW2, LR48->BW4
  const bwSlope = (bwOrder * 6) as CrossoverSlope

  // For LR12, use a single stage with Q=0.5 (critically damped pair)
  if (slope === 12) {
    const q = 0.5
    return [calculateBiquadCoefficients(type, frequency, sampleRate, 0, q)]
  }

  // For LR24 and LR48: cascade two Butterworth filters of half the order
  const bwStages = butterworthStages(type, bwSlope, frequency, sampleRate)
  return [...bwStages, ...bwStages] // doubled
}

/**
 * Calculate Q value for the i-th stage of an n-th order Butterworth filter.
 * Q = 1 / (2 * cos(pi * (2*k + 1) / (2*n))) where k = stage index
 */
function butterworthQ(order: number, stageIndex: number): number {
  const angle = (Math.PI * (2 * stageIndex + 1)) / (2 * order)
  return 1 / (2 * Math.cos(angle))
}
