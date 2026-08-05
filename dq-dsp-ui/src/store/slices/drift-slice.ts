import type { StateCreator } from 'zustand';
import type { DriftConfig } from '../../types/dsp';
import type { DSPStore } from '../dsp-store';

export interface DriftSlice {
  drift: DriftConfig;
  setDriftKp: (kp: number) => void;
  setDriftKi: (ki: number) => void;
  setDriftTargetFill: (target: number) => void;
  setDriftMaxPpm: (maxPpm: number) => void;
}

// Defaults tuned in-field on the prototype hardware — gentle Kp/Ki with a
// generous ±1400 PPM headroom and a low 20% target fill. Adjust live via
// the System panel; "Reset to defaults" snaps back to these values.
export const DEFAULT_DRIFT: DriftConfig = {
  kp: 0.10,
  ki: 0.020,
  targetFill: 0.20,
  maxPpm: 1400,
};

export const createDriftSlice: StateCreator<DSPStore, [], [], DriftSlice> = (set) => ({
  drift: { ...DEFAULT_DRIFT },

  setDriftKp: (kp) =>
    set((state) => ({ drift: { ...state.drift, kp } })),

  setDriftKi: (ki) =>
    set((state) => ({ drift: { ...state.drift, ki } })),

  setDriftTargetFill: (target) =>
    set((state) => ({ drift: { ...state.drift, targetFill: target } })),

  setDriftMaxPpm: (maxPpm) =>
    set((state) => ({ drift: { ...state.drift, maxPpm } })),
});
