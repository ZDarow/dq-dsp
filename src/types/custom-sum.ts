/**
 * User-defined acoustic sum group on the response chart.
 *
 * Each sum picks an arbitrary set of outputs and adds their complex
 * frequency responses (so phase cancellations / crossover summing show up
 * correctly). Persisted in localStorage and exported as part of DSPConfig
 * so presets carry display preferences alongside DSP parameters.
 */
export interface CustomSum {
  /** Stable unique id (uuid-like; generated on creation). */
  id: string;
  /** User-editable label shown on the toggle pill and legend. */
  name: string;
  /** Stroke color for the curve and pill accent (hex). */
  color: string;
  /** Indices into outputs[] to sum (e.g. [0, 1] for Out 1 + Out 2). */
  outputIndices: number[];
  /** Visibility toggle, mirrors the pill state. */
  enabled: boolean;
}

/**
 * Preset color palette for custom sums — picked to read on BOTH the dark
 * `#1c1c1e` and light `#eef0f5` backdrops. Avoid pure white / pale-pastel
 * choices that disappear into the light-theme glass.
 */
export const CUSTOM_SUM_COLORS = [
  '#0aa6a0', // teal
  '#d4a017', // amber / gold
  '#1976d2', // deep blue
  '#c2185b', // rose
  '#7e57c2', // medium purple
  '#26a69a', // teal-green
  '#ef6c00', // burnt orange
  '#455a64', // blue-grey
] as const;
