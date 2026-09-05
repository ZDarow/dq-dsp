import type { BiquadCoefficients, FilterType } from '../types/filter'

/**
 * Calculate biquad filter coefficients using the Audio EQ Cookbook formulas.
 * Robert Bristow-Johnson's Audio EQ Cookbook:
 * https://www.w3.org/2011/audio/audio-eq-cookbook.html
 *
 * Returns coefficients in negated-a convention:
 *   a1 = -a1/a0, a2 = -a2/a0  (for addition-only inner loop)
 *   b0 = b0/a0, b1 = b1/a0, b2 = b2/a0
 */
export function calculateBiquadCoefficients(
  filterType: FilterType,
  frequency: number,
  sampleRate: number,
  gain: number, // dB (only used for peaking, lowShelf, highShelf)
  q: number,
): BiquadCoefficients {
  const w0 = (2 * Math.PI * frequency) / sampleRate
  const cosW0 = Math.cos(w0)
  const sinW0 = Math.sin(w0)
  const alpha = sinW0 / (2 * q)
  const A = Math.pow(10, gain / 40) // sqrt of linear gain

  let b0: number, b1: number, b2: number
  let a0: number, a1: number, a2: number

  switch (filterType) {
    case 'peaking':
      b0 = 1 + alpha * A
      b1 = -2 * cosW0
      b2 = 1 - alpha * A
      a0 = 1 + alpha / A
      a1 = -2 * cosW0
      a2 = 1 - alpha / A
      break

    case 'lowShelf': {
      const sqrtA = Math.sqrt(A)
      const twoSqrtAAlpha = 2 * sqrtA * alpha
      b0 = A * (A + 1 - (A - 1) * cosW0 + twoSqrtAAlpha)
      b1 = 2 * A * (A - 1 - (A + 1) * cosW0)
      b2 = A * (A + 1 - (A - 1) * cosW0 - twoSqrtAAlpha)
      a0 = A + 1 + (A - 1) * cosW0 + twoSqrtAAlpha
      a1 = -2 * (A - 1 + (A + 1) * cosW0)
      a2 = A + 1 + (A - 1) * cosW0 - twoSqrtAAlpha
      break
    }

    case 'highShelf': {
      const sqrtA = Math.sqrt(A)
      const twoSqrtAAlpha = 2 * sqrtA * alpha
      b0 = A * (A + 1 + (A - 1) * cosW0 + twoSqrtAAlpha)
      b1 = -2 * A * (A - 1 + (A + 1) * cosW0)
      b2 = A * (A + 1 + (A - 1) * cosW0 - twoSqrtAAlpha)
      a0 = A + 1 - (A - 1) * cosW0 + twoSqrtAAlpha
      a1 = 2 * (A - 1 - (A + 1) * cosW0)
      a2 = A + 1 - (A - 1) * cosW0 - twoSqrtAAlpha
      break
    }

    case 'lowPass':
      b0 = (1 - cosW0) / 2
      b1 = 1 - cosW0
      b2 = (1 - cosW0) / 2
      a0 = 1 + alpha
      a1 = -2 * cosW0
      a2 = 1 - alpha
      break

    case 'highPass':
      b0 = (1 + cosW0) / 2
      b1 = -(1 + cosW0)
      b2 = (1 + cosW0) / 2
      a0 = 1 + alpha
      a1 = -2 * cosW0
      a2 = 1 - alpha
      break

    case 'bandPass':
      b0 = alpha
      b1 = 0
      b2 = -alpha
      a0 = 1 + alpha
      a1 = -2 * cosW0
      a2 = 1 - alpha
      break

    case 'notch':
      b0 = 1
      b1 = -2 * cosW0
      b2 = 1
      a0 = 1 + alpha
      a1 = -2 * cosW0
      a2 = 1 - alpha
      break

    case 'allPass':
      b0 = 1 - alpha
      b1 = -2 * cosW0
      b2 = 1 + alpha
      a0 = 1 + alpha
      a1 = -2 * cosW0
      a2 = 1 - alpha
      break

    default:
      throw new Error(`Unknown filter type: ${filterType}`)
  }

  // Normalize and negate a coefficients
  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: -a1 / a0, // negated for addition-only inner loop
    a2: -a2 / a0, // negated for addition-only inner loop
  }
}

/** Identity (pass-through) biquad coefficients */
export function identityBiquad(): BiquadCoefficients {
  return { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 }
}
