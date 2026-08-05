export type FilterType =
  | 'peaking'
  | 'lowShelf'
  | 'highShelf'
  | 'lowPass'
  | 'highPass'
  | 'bandPass'
  | 'notch'
  | 'allPass';

export type CrossoverFilterType =
  | 'butterworth'
  | 'linkwitzRiley';

export type CrossoverSlope = 12 | 24 | 48; // dB/oct

export interface BiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a1: number; // negated & normalized: -a1/a0
  a2: number; // negated & normalized: -a2/a0
}

export interface EQBand {
  enabled: boolean;
  filterType: FilterType;
  frequency: number;   // Hz, 20 to 20000
  gain: number;        // dB, -15 to +15
  q: number;           // 0.1 to 30
}

export interface CrossoverFilter {
  enabled: boolean;
  filterType: CrossoverFilterType;
  slope: CrossoverSlope;
  frequency: number; // Hz
}

export interface CrossoverConfig {
  highPass: CrossoverFilter;
  lowPass: CrossoverFilter;
}
