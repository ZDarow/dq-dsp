import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { createDefaultEQBands } from '../constants/defaults';
import { createInputSlice, type InputSlice } from './slices/input-slice';
import { createRoutingSlice, type RoutingSlice } from './slices/routing-slice';
import { createOutputSlice, type OutputSlice } from './slices/output-slice';
import { createGlobalSlice, type GlobalSlice } from './slices/global-slice';
import { createPresetSlice, type PresetSlice } from './slices/preset-slice';
import { createLinkSlice, type LinkSlice } from './slices/link-slice';
import { createSerialSlice, type SerialSlice } from './slices/serial-slice';
import { createRoomEQSlice, type RoomEQSlice } from './slices/room-eq-slice';
import { createDriftSlice, type DriftSlice } from './slices/drift-slice';
import { createCustomSumSlice, type CustomSumSlice } from './slices/custom-sum-slice';
import { createDefaultCustomSums } from '../constants/defaults';

export type DSPStore = InputSlice & RoutingSlice & OutputSlice & GlobalSlice & PresetSlice & LinkSlice & SerialSlice & RoomEQSlice & DriftSlice & CustomSumSlice;

const PERSIST_DEBOUNCE_MS = 300;

/**
 * localStorage adapter that coalesces writes: slider drags fire a store update
 * per pointer move, so a naive synchronous JSON.stringify + setItem runs on
 * every frame. Here the newest write wins and is flushed 300 ms after the last
 * change (data is still lost on an immediate tab close — acceptable for a
 * live-tuned config, and the same tradeoff the review recommended).
 */
function createDebouncedLocalStorage<T>(): PersistStorage<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: StorageValue<T> | null = null;

  return {
    getItem: (name) => {
      const raw = localStorage.getItem(name);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as StorageValue<T>;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      pending = value;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const v = pending;
        pending = null;
        if (v !== null) localStorage.setItem(name, JSON.stringify(v));
      }, PERSIST_DEBOUNCE_MS);
    },
    removeItem: (name) => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending = null;
      localStorage.removeItem(name);
    },
  };
}

export const useDSPStore = create<DSPStore>()(
  persist(
    (...a) => ({
      ...createInputSlice(...a),
      ...createRoutingSlice(...a),
      ...createOutputSlice(...a),
      ...createGlobalSlice(...a),
      ...createPresetSlice(...a),
      ...createLinkSlice(...a),
      ...createSerialSlice(...a),
      ...createRoomEQSlice(...a),
      ...createDriftSlice(...a),
      ...createCustomSumSlice(...a),
    }),
    {
      name: 'esp32-dsp-config',
      storage: createDebouncedLocalStorage<Partial<DSPStore>>(),
      partialize: (state) => ({
        inputs: state.inputs,
        routing: state.routing,
        outputs: state.outputs,
        masterVolume: state.masterVolume,
        sampleRate: state.sampleRate,
        presetIndex: state.presetIndex,
        presetName: state.presetName,
        presets: state.presets,
        inputsLinked: state.inputsLinked,
        outputLinkGroups: state.outputLinkGroups,
        roomEqBands: state.roomEqBands,
        roomMeasurement: state.roomMeasurement,
        roomSmoothing: state.roomSmoothing,
        roomTargetCurve: state.roomTargetCurve,
        roomTiltSlope: state.roomTiltSlope,
        roomEqEnabled: state.roomEqEnabled,
        roomEqEnabledStash: state.roomEqEnabledStash,
        drift: state.drift,
        customSums: state.customSums,
      }),
      merge: (persisted, current) => {
        const p = (persisted as StorageValue<Partial<DSPStore>>['state']) ?? {};
        const merged = { ...current, ...p };
        // Ensure new fields have defaults when loading old localStorage
        if (!merged.roomEqBands) {
          merged.roomEqBands = [createDefaultEQBands(), createDefaultEQBands()];
        }
        // Ensure inputs have roomEqBands (old stored inputs won't)
        if (merged.inputs) {
          for (let i = 0; i < merged.inputs.length; i++) {
            if (!merged.inputs[i].roomEqBands) {
              merged.inputs[i] = { ...merged.inputs[i], roomEqBands: createDefaultEQBands() };
            }
          }
        }
        // Backward-compat: pre-customSum localStorage
        if (!merged.customSums) {
          merged.customSums = createDefaultCustomSums();
        } else {
          // Migration: old default sum colors (#ffffff, #ffeb3b) read poorly
          // on light theme. If a stored sum still carries the legacy default
          // for a known default sum id, swap to the new theme-neutral palette.
          const newDefaults = createDefaultCustomSums();
          merged.customSums = merged.customSums.map((s) => {
            if (s.id === 'default-sum-l' && (s.color === '#ffffff' || s.color === '#FFFFFF')) {
              return { ...s, color: newDefaults[0].color };
            }
            if (s.id === 'default-sum-r' && (s.color === '#ffeb3b' || s.color === '#FFEB3B')) {
              return { ...s, color: newDefaults[1].color };
            }
            return s;
          });
        }
        // Migration: old `outputLinks: [bool, bool]` (Out1↔2, Out3↔4 fixed
        // pairs) → new flexible `outputLinkGroups: number[][]`.
        const legacy = (persisted as unknown as { outputLinks?: [boolean, boolean] })?.outputLinks;
        if (!merged.outputLinkGroups) {
          if (Array.isArray(legacy)) {
            const groups: number[][] = [];
            if (legacy[0]) groups.push([0, 1]);
            if (legacy[1]) groups.push([2, 3]);
            merged.outputLinkGroups = groups;
          } else {
            merged.outputLinkGroups = [];
          }
        }
        return merged as DSPStore;
      },
    },
  ),
);
