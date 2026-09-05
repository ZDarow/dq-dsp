import type { FilterType, CrossoverFilterType, CrossoverSlope } from '../types/filter'

export const FILTER_TYPES: { value: FilterType; labelKey: string }[] = [
  { value: 'peaking', labelKey: 'filterType.labelPeaking' },
  { value: 'lowShelf', labelKey: 'filterType.labelLowShelf' },
  { value: 'highShelf', labelKey: 'filterType.labelHighShelf' },
  { value: 'lowPass', labelKey: 'filterType.labelLowPass' },
  { value: 'highPass', labelKey: 'filterType.labelHighPass' },
  { value: 'bandPass', labelKey: 'filterType.labelBandPass' },
  { value: 'notch', labelKey: 'filterType.labelNotch' },
  { value: 'allPass', labelKey: 'filterType.labelAllPass' },
]

export const CROSSOVER_TYPES: { value: CrossoverFilterType; labelKey: string }[] = [
  { value: 'butterworth', labelKey: 'crossover.typeButterworth' },
  { value: 'linkwitzRiley', labelKey: 'crossover.typeLinkwitzRiley' },
]

export const CROSSOVER_SLOPES: { value: CrossoverSlope; label: string }[] = [
  { value: 12, label: '12 dB/oct' },
  { value: 24, label: '24 dB/oct' },
  { value: 48, label: '48 dB/oct' },
]

export const FREQUENCY_RANGE = { min: 20, max: 20000 } as const
export const GAIN_RANGE = { min: -72, max: 12 } as const
export const EQ_GAIN_RANGE = { min: -15, max: 15 } as const
export const Q_RANGE = { min: 0.1, max: 30 } as const
export const DELAY_MAX_MS = 10

export const SAMPLE_RATES = [44100, 48000, 88200, 96000] as const
export type SampleRate = (typeof SAMPLE_RATES)[number]

export const NUM_INPUTS = 2
export const NUM_OUTPUTS = 4
export const NUM_EQ_BANDS = 10

export const DEFAULT_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const
