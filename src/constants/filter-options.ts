import type { FilterType, CrossoverFilterType, CrossoverSlope } from '../types/filter';

export const FILTER_TYPES: { value: FilterType; label: string }[] = [
  { value: 'peaking', label: 'Peaking' },
  { value: 'lowShelf', label: 'Low Shelf' },
  { value: 'highShelf', label: 'High Shelf' },
  { value: 'lowPass', label: 'Low Pass' },
  { value: 'highPass', label: 'High Pass' },
  { value: 'bandPass', label: 'Band Pass' },
  { value: 'notch', label: 'Notch' },
  { value: 'allPass', label: 'All Pass' },
];

export const CROSSOVER_TYPES: { value: CrossoverFilterType; label: string }[] = [
  { value: 'butterworth', label: 'Butterworth' },
  { value: 'linkwitzRiley', label: 'Linkwitz-Riley' },
];

export const CROSSOVER_SLOPES: { value: CrossoverSlope; label: string }[] = [
  { value: 12, label: '12 dB/oct' },
  { value: 24, label: '24 dB/oct' },
  { value: 48, label: '48 dB/oct' },
];

export const FREQUENCY_RANGE = { min: 20, max: 20000 } as const;
export const GAIN_RANGE = { min: -72, max: 12 } as const;
export const EQ_GAIN_RANGE = { min: -15, max: 15 } as const;
export const Q_RANGE = { min: 0.1, max: 30 } as const;
export const DELAY_MAX_MS = 10;

export const SAMPLE_RATES = [44100, 48000, 88200, 96000] as const;
export type SampleRate = (typeof SAMPLE_RATES)[number];

export const NUM_INPUTS = 2;
export const NUM_OUTPUTS = 4;
export const NUM_EQ_BANDS = 10;

export const DEFAULT_FREQUENCIES = [
  31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
] as const;
