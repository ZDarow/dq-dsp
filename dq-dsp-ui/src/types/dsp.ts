import type { EQBand, CrossoverConfig } from './filter';
import type { CustomSum } from './custom-sum';

export interface InputChannel {
  gain: number;        // dB, -72 to +12
  mute: boolean;
  phaseInvert: boolean;
  eqBands: EQBand[];   // 10 bands
  roomEqBands: EQBand[]; // 10 bands — Room EQ (before PEQ in signal chain)
}

export interface OutputChannel {
  gain: number;        // dB, -72 to +12
  mute: boolean;
  phaseInvert: boolean;
  delaySamples: number; // 0 to max based on sample rate (max ~10ms)
  delayMs: number;      // convenience: delay in ms
  eqBands: EQBand[];   // 10 bands
  crossover: CrossoverConfig;
}

export interface CrosspointGain {
  enabled: boolean;
  gain: number;  // linear 0..1 (default 1.0 when enabled)
}

// 2 inputs x 4 outputs
export type RoutingMatrix = CrosspointGain[][];

export interface DSPConfig {
  inputs: [InputChannel, InputChannel];
  routing: RoutingMatrix;  // [inputIdx][outputIdx]
  outputs: [OutputChannel, OutputChannel, OutputChannel, OutputChannel];
  masterVolume: number;    // dB
  sampleRate: number;
  presetIndex: number;
  presetName: string;
  /** Optional in older presets — falls back to defaults on import. */
  customSums?: CustomSum[];
  /** UI-only mirroring metadata for round-tripping through JSON exports. */
  inputLinkGroups?: number[][];
  outputLinkGroups?: number[][];
}

export interface DriftConfig {
  kp: number;         // PI proportional gain (default 0.3)
  ki: number;         // PI integral gain (default 0.05)
  targetFill: number; // ring buffer fill target 0..1 (default 0.5)
  maxPpm: number;     // max correction ±ppm (default 200)
}

export type SelectedBlock =
  | { type: 'input'; index: number }
  | { type: 'roomEq' }
  | { type: 'routing' }
  | { type: 'output'; index: number }
  | { type: 'system' }
  | null;
