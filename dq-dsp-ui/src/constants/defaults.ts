import type { InputChannel, OutputChannel, DSPConfig, RoutingMatrix } from '../types/dsp';
import type { EQBand, CrossoverConfig, CrossoverFilter } from '../types/filter';
import type { CustomSum } from '../types/custom-sum';
import { DEFAULT_FREQUENCIES, NUM_EQ_BANDS, NUM_INPUTS, NUM_OUTPUTS } from './filter-options';

export function createDefaultEQBand(index: number): EQBand {
  return {
    enabled: false,
    filterType: 'peaking',
    frequency: DEFAULT_FREQUENCIES[index] ?? 1000,
    gain: 0,
    q: 1.0,
  };
}

export function createDefaultEQBands(): EQBand[] {
  return Array.from({ length: NUM_EQ_BANDS }, (_, i) => createDefaultEQBand(i));
}

export function createDefaultCrossoverFilter(type: 'highPass' | 'lowPass'): CrossoverFilter {
  return {
    enabled: false,
    filterType: 'butterworth',
    slope: 24,
    frequency: type === 'highPass' ? 80 : 3000,
  };
}

export function createDefaultCrossover(): CrossoverConfig {
  return {
    highPass: createDefaultCrossoverFilter('highPass'),
    lowPass: createDefaultCrossoverFilter('lowPass'),
  };
}

export function createDefaultInputChannel(): InputChannel {
  return {
    gain: 0,
    mute: false,
    phaseInvert: false,
    eqBands: createDefaultEQBands(),
    roomEqBands: createDefaultEQBands(),
  };
}

export function createDefaultOutputChannel(): OutputChannel {
  return {
    gain: 0,
    mute: false,
    phaseInvert: false,
    delaySamples: 0,
    delayMs: 0,
    eqBands: createDefaultEQBands(),
    crossover: createDefaultCrossover(),
  };
}

export function createDefaultRoutingMatrix(): RoutingMatrix {
  // Default stereo: In1->Out1+Out3, In2->Out2+Out4
  const matrix: RoutingMatrix = [];
  for (let i = 0; i < NUM_INPUTS; i++) {
    matrix[i] = [];
    for (let o = 0; o < NUM_OUTPUTS; o++) {
      matrix[i][o] = {
        enabled: (i === 0 && (o === 0 || o === 2)) || (i === 1 && (o === 1 || o === 3)),
        gain: 1.0,
      };
    }
  }
  return matrix;
}

/**
 * Two pre-populated sums matching a typical 2-way active stereo:
 * Σ Speaker L = Out 1 + Out 2 (tweeter + woofer left)
 * Σ Speaker R = Out 3 + Out 4 (tweeter + woofer right)
 */
export function createDefaultCustomSums(): CustomSum[] {
  // Teal + amber — distinct, distinguishable, readable on both dark and
  // light theme glass. Old presets that still hold #ffffff / #ffeb3b will
  // continue to render as-is; users can pick a new colour in the editor.
  return [
    { id: 'default-sum-l', name: 'Σ Speaker L', color: '#0aa6a0', outputIndices: [0, 1], enabled: true },
    { id: 'default-sum-r', name: 'Σ Speaker R', color: '#d4a017', outputIndices: [2, 3], enabled: true },
  ];
}

export function createDefaultDSPConfig(): DSPConfig {
  return {
    inputs: [createDefaultInputChannel(), createDefaultInputChannel()],
    routing: createDefaultRoutingMatrix(),
    outputs: [
      createDefaultOutputChannel(),
      createDefaultOutputChannel(),
      createDefaultOutputChannel(),
      createDefaultOutputChannel(),
    ],
    masterVolume: 0,
    sampleRate: 48000,
    presetIndex: 0,
    presetName: 'Default',
    customSums: createDefaultCustomSums(),
  };
}
