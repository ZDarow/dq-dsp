/**
 * Parser for Room EQ Wizard (REW) measurement text export files.
 *
 * REW format:
 * - Lines starting with `*` are comments/metadata
 * - Data lines are tab- or space-separated: frequency  magnitude  [phase]
 * - We only need frequency (Hz) and magnitude (dB)
 */

export interface MeasurementPoint {
  frequency: number
  magnitude: number
}

/**
 * Parse a REW text measurement export into an array of frequency/magnitude points.
 *
 * @param text  Raw file contents from a REW .txt export
 * @returns     Parsed measurement points sorted by frequency
 */
export function parseREWMeasurement(text: string): MeasurementPoint[] {
  const points: MeasurementPoint[] = []

  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines and comment lines (start with *)
    if (trimmed.length === 0 || trimmed.startsWith('*')) continue

    // Split on tabs or multiple spaces
    const parts = trimmed.split(/\t+|\s{2,}|\s+/)
    if (parts.length < 2) continue

    const frequency = parseFloat(parts[0])
    const magnitude = parseFloat(parts[1])

    // Validate parsed numbers
    if (!Number.isFinite(frequency) || !Number.isFinite(magnitude)) continue
    if (frequency <= 0) continue

    points.push({ frequency, magnitude })
  }

  // Sort by frequency (should already be sorted, but ensure)
  points.sort((a, b) => a.frequency - b.frequency)

  return points
}
