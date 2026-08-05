import type { StateCreator } from 'zustand';
import type { RoutingMatrix } from '../../types/dsp';
import type { DSPStore } from '../dsp-store';
import { createDefaultRoutingMatrix } from '../../constants/defaults';
import { NUM_INPUTS, NUM_OUTPUTS } from '../../constants/filter-options';

export interface RoutingSlice {
  routing: RoutingMatrix;
  setRoutingEnabled: (inputIdx: number, outputIdx: number, enabled: boolean) => void;
  toggleRoutingPoint: (inputIdx: number, outputIdx: number) => void;
  setRoutingGain: (inputIdx: number, outputIdx: number, gain: number) => void;
  setRoutingPreset: (preset: 'stereo' | 'mono' | 'clear') => void;
  resetRouting: () => void;
}

export const createRoutingSlice: StateCreator<DSPStore, [], [], RoutingSlice> = (set) => ({
  routing: createDefaultRoutingMatrix(),

  setRoutingEnabled: (inputIdx, outputIdx, enabled) =>
    set((state) => {
      const routing = state.routing.map((row) => row.map((cell) => ({ ...cell })));
      routing[inputIdx][outputIdx] = { ...routing[inputIdx][outputIdx], enabled };
      return { routing };
    }),

  toggleRoutingPoint: (inputIdx, outputIdx) =>
    set((state) => {
      const routing = state.routing.map((row) => row.map((cell) => ({ ...cell })));
      const current = routing[inputIdx][outputIdx];
      routing[inputIdx][outputIdx] = { ...current, enabled: !current.enabled };
      return { routing };
    }),

  setRoutingGain: (inputIdx, outputIdx, gain) =>
    set((state) => {
      const routing = state.routing.map((row) => row.map((cell) => ({ ...cell })));
      routing[inputIdx][outputIdx] = { ...routing[inputIdx][outputIdx], gain };
      return { routing };
    }),

  setRoutingPreset: (preset) =>
    set(() => {
      const routing: RoutingMatrix = [];
      for (let i = 0; i < NUM_INPUTS; i++) {
        routing[i] = [];
        for (let o = 0; o < NUM_OUTPUTS; o++) {
          let enabled = false;
          if (preset === 'stereo') {
            enabled = (i === 0 && (o === 0 || o === 2)) || (i === 1 && (o === 1 || o === 3));
          } else if (preset === 'mono') {
            enabled = true; // all crosspoints active
          }
          routing[i][o] = { enabled, gain: 1.0 };
        }
      }
      return { routing };
    }),

  resetRouting: () => set({ routing: createDefaultRoutingMatrix() }),
});
