import type { StateCreator } from 'zustand';
import type { DSPConfig, DriftConfig, SelectedBlock } from '../../types/dsp';
import type { EQBand } from '../../types/filter';
import type { DSPStore } from '../dsp-store';
import { createDefaultEQBands } from '../../constants/defaults';

/** Flag to suppress serial middleware diff-sending during device config apply */
let _applyingDeviceConfig = false;
export function isApplyingDeviceConfig(): boolean {
  return _applyingDeviceConfig;
}

export interface GlobalSlice {
  masterVolume: number;
  sampleRate: number;
  selectedBlock: SelectedBlock;
  setMasterVolume: (volume: number) => void;
  setSampleRate: (rate: number) => void;
  setSelectedBlock: (block: SelectedBlock) => void;
  applyDeviceConfig: (config: DSPConfig & { drift?: DriftConfig }) => void;
}

export const createGlobalSlice: StateCreator<DSPStore, [], [], GlobalSlice> = (set) => ({
  masterVolume: 0,
  sampleRate: 48000,
  selectedBlock: { type: 'input', index: 0 },

  setMasterVolume: (volume) => set({ masterVolume: volume }),
  setSampleRate: (rate) => set({ sampleRate: rate }),
  setSelectedBlock: (block) => set({ selectedBlock: block }),

  applyDeviceConfig: (config) => {
    _applyingDeviceConfig = true;
    try {
      // Mirror device's inputs[i].roomEqBands into top-level so UI + middleware
      // (which both read top-level) reflect the synced device state.
      const roomEqBands: [EQBand[], EQBand[]] = [
        config.inputs[0]?.roomEqBands?.map((b) => ({ ...b })) ?? createDefaultEQBands(),
        config.inputs[1]?.roomEqBands?.map((b) => ({ ...b })) ?? createDefaultEQBands(),
      ];
      set({
        inputs: config.inputs,
        routing: config.routing,
        outputs: config.outputs,
        masterVolume: config.masterVolume,
        sampleRate: config.sampleRate,
        roomEqBands,
        ...(config.drift ? { drift: config.drift } : {}),
      });
    } finally {
      // Always clear the flag: if the state update above throws, the serial
      // middleware would otherwise stop diff-sending forever.
      _applyingDeviceConfig = false;
    }
  },
});
