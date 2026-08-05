/**
 * Target curve generators for Room EQ.
 *
 * All functions return magnitude offsets in dB at the given frequencies.
 */

/**
 * Flat target: 0 dB at all frequencies.
 */
export function flatTarget(frequencies: number[]): number[] {
  return frequencies.map(() => 0);
}

/**
 * Harman-style target curve (simplified):
 * - +3 dB shelf below 100 Hz
 * - Transitions from +3 dB at 100 Hz to 0 dB at 200 Hz
 * - 0 dB at 200 Hz (reference)
 * - -1 dB/octave roll-off above 200 Hz
 *
 * All values are relative to 0 dB at 200 Hz.
 */
export function harmanTarget(frequencies: number[]): number[] {
  return frequencies.map((f) => {
    if (f <= 100) {
      return 3;
    } else if (f <= 200) {
      // Linear interpolation in log-freq space from +3 dB at 100 Hz to 0 dB at 200 Hz
      const t = (Math.log2(f) - Math.log2(100)) / (Math.log2(200) - Math.log2(100));
      return 3 * (1 - t);
    } else {
      // -1 dB per octave above 200 Hz
      return -Math.log2(f / 200);
    }
  });
}

/**
 * Tilt target: linear tilt in dB/octave relative to 1 kHz.
 *
 * @param frequencies       Array of frequencies to evaluate
 * @param slopeDbPerOctave  Slope in dB per octave (negative = downward tilt at high freqs)
 * @returns                 Magnitude offsets in dB
 */
export function tiltTarget(frequencies: number[], slopeDbPerOctave: number): number[] {
  return frequencies.map((f) => {
    return slopeDbPerOctave * Math.log2(f / 1000);
  });
}
