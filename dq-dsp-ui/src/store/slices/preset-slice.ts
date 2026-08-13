import type { StateCreator } from 'zustand';
import type { DSPConfig } from '../../types/dsp';
import type { EQBand } from '../../types/filter';
import type { DSPStore } from '../dsp-store';
import { createDefaultDSPConfig, createDefaultCustomSums, createDefaultEQBands } from '../../constants/defaults';

export interface PresetData {
  name: string;
  config: DSPConfig;
}

export interface PresetSlice {
  presetIndex: number;
  presetName: string;
  presets: PresetData[];
  setPresetName: (name: string) => void;
  /** Save current config into the preset list at a given index (overwrite) */
  savePreset: (index: number) => void;
  /** Load a preset from the list by index */
  loadPreset: (index: number) => void;
  /** Save current config as a new preset appended to the list */
  saveCurrentAsPreset: () => void;
  /** Delete a preset from the list */
  deletePreset: (index: number) => void;
  /** Rename a preset in the list */
  renamePreset: (index: number, name: string) => void;
  /** Add multiple presets to the list (for batch import) */
  addPresets: (presets: PresetData[]) => void;
  /** Snapshot current state as DSPConfig */
  exportConfig: () => DSPConfig;
  /** Load a DSPConfig into the store */
  importConfig: (config: DSPConfig) => void;
  /** Reset to factory defaults */
  resetAll: () => void;
}

export const createPresetSlice: StateCreator<DSPStore, [], [], PresetSlice> = (set, get) => ({
  presetIndex: -1,
  presetName: 'Default',
  presets: [],

  setPresetName: (name) => set({ presetName: name }),

  savePreset: (index) => {
    const state = get();
    const config = state.exportConfig();
    set((s) => {
      const presets = [...s.presets];
      presets[index] = { name: config.presetName, config };
      return { presets, presetIndex: index };
    });
  },

  loadPreset: (index) => {
    const state = get();
    const preset = state.presets[index];
    if (preset) {
      state.importConfig(preset.config);
      set({ presetIndex: index });
    }
  },

  saveCurrentAsPreset: () => {
    const state = get();
    const config = state.exportConfig();
    set((s) => {
      const presets = [...s.presets, { name: config.presetName, config }];
      return { presets, presetIndex: presets.length - 1 };
    });
  },

  deletePreset: (index) =>
    set((s) => {
      const presets = s.presets.filter((_, i) => i !== index);
      let presetIndex = s.presetIndex;
      if (presetIndex === index) {
        presetIndex = -1; // deselect
      } else if (presetIndex > index) {
        presetIndex--; // shift down
      }
      return { presets, presetIndex };
    }),

  renamePreset: (index, name) =>
    set((s) => {
      const presets = [...s.presets];
      if (presets[index]) {
        presets[index] = { ...presets[index], name };
      }
      return { presets };
    }),

  addPresets: (newPresets) =>
    set((s) => ({
      presets: [...s.presets, ...newPresets],
    })),

  exportConfig: () => {
    const state = get();
    return {
      inputs: state.inputs,
      routing: state.routing,
      outputs: state.outputs,
      masterVolume: state.masterVolume,
      sampleRate: state.sampleRate,
      presetIndex: state.presetIndex,
      presetName: state.presetName,
      customSums: state.customSums,
      inputLinkGroups: state.inputLinkGroups,
      outputLinkGroups: state.outputLinkGroups,
    };
  },

  importConfig: (config) => {
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
      presetIndex: config.presetIndex,
      presetName: config.presetName,
      roomEqBands,
      customSums: config.customSums ?? createDefaultCustomSums(),
      inputLinkGroups: config.inputLinkGroups ?? ((config as unknown as { inputsLinked?: boolean }).inputsLinked ? [[0, 1]] : []),
      outputLinkGroups: config.outputLinkGroups ?? [],
    });
  },

  resetAll: () => {
    const defaults = createDefaultDSPConfig();
    set({
      inputs: defaults.inputs,
      routing: defaults.routing,
      outputs: defaults.outputs,
      masterVolume: defaults.masterVolume,
      sampleRate: defaults.sampleRate,
      presetIndex: defaults.presetIndex,
      presetName: defaults.presetName,
      customSums: defaults.customSums ?? createDefaultCustomSums(),
      roomEqBands: [
        defaults.inputs[0]?.roomEqBands?.map((b) => ({ ...b })) ?? createDefaultEQBands(),
        defaults.inputs[1]?.roomEqBands?.map((b) => ({ ...b })) ?? createDefaultEQBands(),
      ],
      inputLinkGroups: [],
      outputLinkGroups: [],
    });
  },
});
