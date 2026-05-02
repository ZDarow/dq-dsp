import type { StateCreator } from 'zustand';
import type { EQBand } from '../../types/filter';
import type { InputChannel } from '../../types/dsp';
import type { MeasurementPoint } from '../../utils/rew-parser';
import type { DSPStore } from '../dsp-store';
import { parseREWMeasurement } from '../../utils/rew-parser';
import { createDefaultEQBands } from '../../constants/defaults';

/**
 * Mirror the top-level roomEqBands into inputs[i].roomEqBands.
 *
 * The store keeps two views of the same Room EQ state:
 *   - top-level `roomEqBands`  → consumed by the UI panel, the response
 *     chart, and the BLE/Serial diff middleware (live tuning)
 *   - nested `inputs[i].roomEqBands` → consumed by the bulk binary
 *     encoder (Upload + Save preset + Export JSON)
 *
 * Without this sync, live tuning works but Upload/Save export an empty
 * Room EQ block, so the device never gets the user's bands.
 */
function syncInputsRoomEq(
  inputs: [InputChannel, InputChannel],
  roomEqBands: [EQBand[], EQBand[]],
): [InputChannel, InputChannel] {
  return [
    { ...inputs[0], roomEqBands: roomEqBands[0].map((b) => ({ ...b })) },
    { ...inputs[1], roomEqBands: roomEqBands[1].map((b) => ({ ...b })) },
  ];
}

export interface RoomEQSlice {
  roomMeasurement: MeasurementPoint[] | null;
  roomSmoothing: 3 | 6 | 12 | 24;
  roomTargetCurve: 'flat' | 'harman' | 'tilt';
  roomTiltSlope: number;
  roomEqBands: [EQBand[], EQBand[]]; // per input channel
  roomEqEnabled: boolean; // master enable for room EQ
  roomLinked: boolean; // when true, edits apply to both inputs
  /**
   * Snapshot of per-band `enabled` flags from before the global toggle was
   * switched off. Restored on toggle-on so users get their previous selection
   * back. Null when toggle is on (or has never been disabled).
   *
   * Why this exists: the firmware only checks per-band `enabled` in its DSP
   * loop — there is no separate "global Room EQ enable" parameter on the
   * BLE/Serial wire. To make the global toggle actually affect audio we
   * mass-disable every band on toggle-off (the diff middleware then ships
   * per-band disables to the device) and restore from the stash on toggle-on.
   */
  roomEqEnabledStash: [boolean[], boolean[]] | null;
  importRoomMeasurement: (text: string) => void;
  clearRoomMeasurement: () => void;
  setRoomSmoothing: (n: 3 | 6 | 12 | 24) => void;
  setRoomTargetCurve: (curve: 'flat' | 'harman' | 'tilt') => void;
  setRoomTiltSlope: (slope: number) => void;
  setRoomEQBand: (inputIdx: number, bandIdx: number, updates: Partial<EQBand>) => void;
  toggleRoomEQBand: (inputIdx: number, bandIdx: number) => void;
  setRoomLinked: (linked: boolean) => void;
  setRoomEqEnabled: (enabled: boolean) => void;
}

export const createRoomEQSlice: StateCreator<DSPStore, [], [], RoomEQSlice> = (set) => ({
  roomMeasurement: null,
  roomSmoothing: 6,
  roomTargetCurve: 'flat',
  roomTiltSlope: -1,
  roomEqBands: [createDefaultEQBands(), createDefaultEQBands()],
  roomEqEnabled: true,
  roomEqEnabledStash: null,
  roomLinked: true,

  importRoomMeasurement: (text) => {
    const points = parseREWMeasurement(text);
    if (points.length > 0) {
      set({ roomMeasurement: points });
    }
  },

  clearRoomMeasurement: () => set({ roomMeasurement: null }),

  setRoomSmoothing: (n) => set({ roomSmoothing: n }),

  setRoomTargetCurve: (curve) => set({ roomTargetCurve: curve }),

  setRoomTiltSlope: (slope) => set({ roomTiltSlope: slope }),

  setRoomEQBand: (inputIdx, bandIdx, updates) =>
    set((state) => {
      const roomEqBands = [
        [...state.roomEqBands[0]],
        [...state.roomEqBands[1]],
      ] as [EQBand[], EQBand[]];
      roomEqBands[inputIdx][bandIdx] = {
        ...roomEqBands[inputIdx][bandIdx],
        ...updates,
      };
      if (state.roomLinked) {
        const other = inputIdx ^ 1;
        roomEqBands[other][bandIdx] = {
          ...roomEqBands[other][bandIdx],
          ...updates,
        };
      }
      return { roomEqBands, inputs: syncInputsRoomEq(state.inputs, roomEqBands) };
    }),

  toggleRoomEQBand: (inputIdx, bandIdx) =>
    set((state) => {
      const roomEqBands = [
        [...state.roomEqBands[0]],
        [...state.roomEqBands[1]],
      ] as [EQBand[], EQBand[]];
      const newEnabled = !roomEqBands[inputIdx][bandIdx].enabled;
      roomEqBands[inputIdx][bandIdx] = { ...roomEqBands[inputIdx][bandIdx], enabled: newEnabled };
      if (state.roomLinked) {
        const other = inputIdx ^ 1;
        roomEqBands[other][bandIdx] = { ...roomEqBands[other][bandIdx], enabled: newEnabled };
      }
      return { roomEqBands, inputs: syncInputsRoomEq(state.inputs, roomEqBands) };
    }),

  setRoomLinked: (linked) => set({ roomLinked: linked }),

  setRoomEqEnabled: (enabled) =>
    set((state) => {
      if (enabled === state.roomEqEnabled) return {};

      if (!enabled) {
        // Disabling: stash current per-band enabled flags, then force every
        // band off so the diff middleware ships per-band disables to firmware.
        const stash: [boolean[], boolean[]] = [
          state.roomEqBands[0].map((b) => b.enabled),
          state.roomEqBands[1].map((b) => b.enabled),
        ];
        const newBands: [EQBand[], EQBand[]] = [
          state.roomEqBands[0].map((b) => ({ ...b, enabled: false })),
          state.roomEqBands[1].map((b) => ({ ...b, enabled: false })),
        ];
        return {
          roomEqEnabled: false,
          roomEqBands: newBands,
          roomEqEnabledStash: stash,
          inputs: syncInputsRoomEq(state.inputs, newBands),
        };
      }

      // Enabling: restore from stash if we have one; otherwise leave bands
      // untouched (covers first-run / preset-import / legacy state).
      const stash = state.roomEqEnabledStash;
      if (!stash) return { roomEqEnabled: true };
      const newBands: [EQBand[], EQBand[]] = [
        state.roomEqBands[0].map((b, i) => ({ ...b, enabled: stash[0][i] ?? b.enabled })),
        state.roomEqBands[1].map((b, i) => ({ ...b, enabled: stash[1][i] ?? b.enabled })),
      ];
      return {
        roomEqEnabled: true,
        roomEqBands: newBands,
        roomEqEnabledStash: null,
        inputs: syncInputsRoomEq(state.inputs, newBands),
      };
    }),
});
