import type { StateCreator } from 'zustand'
import type { DriftConfig } from '../../types/dsp'
import type { DSPStore } from '../dsp-store'

export interface DriftSlice {
  drift: DriftConfig
  setDriftKp: (kp: number) => void
  setDriftKi: (ki: number) => void
  setDriftTargetFill: (target: number) => void
  setDriftMaxPpm: (maxPpm: number) => void
}

// Defaults mirrored from the firmware's initial config
// (dq-dsp-firmware/main/main.c — drift_kp/ki/target_fill/max_ppm). The UI and
// the device must reset to the same behaviour, so this file stays in sync
// with main.c; tune live via the System panel, then update BOTH sides.
export const DEFAULT_DRIFT: DriftConfig = {
  kp: 0.3,
  ki: 0.05,
  targetFill: 0.5,
  maxPpm: 200,
}

export const createDriftSlice: StateCreator<DSPStore, [], [], DriftSlice> = (set) => ({
  drift: { ...DEFAULT_DRIFT },

  setDriftKp: (kp) => set((state) => ({ drift: { ...state.drift, kp } })),

  setDriftKi: (ki) => set((state) => ({ drift: { ...state.drift, ki } })),

  setDriftTargetFill: (target) =>
    set((state) => ({ drift: { ...state.drift, targetFill: target } })),

  setDriftMaxPpm: (maxPpm) => set((state) => ({ drift: { ...state.drift, maxPpm } })),
})
