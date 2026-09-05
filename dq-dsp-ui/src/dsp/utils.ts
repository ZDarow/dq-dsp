/** Convert dB to linear gain */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20)
}

/** Convert linear gain to dB */
export function linearToDb(linear: number): number {
  if (linear <= 0) return -Infinity
  return 20 * Math.log10(linear)
}

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Convert frequency to logarithmic position (0..1) within a range */
export function freqToLogPosition(freq: number, minFreq: number, maxFreq: number): number {
  return (Math.log10(freq) - Math.log10(minFreq)) / (Math.log10(maxFreq) - Math.log10(minFreq))
}

/** Convert logarithmic position (0..1) back to frequency */
export function logPositionToFreq(pos: number, minFreq: number, maxFreq: number): number {
  return Math.pow(10, pos * (Math.log10(maxFreq) - Math.log10(minFreq)) + Math.log10(minFreq))
}

/** Snap frequency to nearest "nice" value */
export function snapFrequency(freq: number): number {
  const nice = [
    20, 25, 31, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600,
    2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000,
  ]
  let closest = nice[0]
  let closestDist = Math.abs(Math.log10(freq) - Math.log10(nice[0]))
  for (let i = 1; i < nice.length; i++) {
    const dist = Math.abs(Math.log10(freq) - Math.log10(nice[i]))
    if (dist < closestDist) {
      closest = nice[i]
      closestDist = dist
    }
  }
  return closest
}

/** Convert delay in ms to samples */
export function msToSamples(ms: number, sampleRate: number): number {
  return Math.round((ms * sampleRate) / 1000)
}

/** Convert samples to ms */
export function samplesToMs(samples: number, sampleRate: number): number {
  return (samples / sampleRate) * 1000
}
