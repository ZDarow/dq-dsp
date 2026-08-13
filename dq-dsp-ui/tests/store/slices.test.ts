/**
 * Zustand slice behavior tests.
 *
 * Verifies linking, mirroring, and reset semantics for input, output,
 * room-eq, and link slices.
 *
 * Run with: npx vitest run tests/store/slices.test.ts
 */

import { describe, it, expect } from 'vitest';
import { createInputSlice, type InputSlice } from '../../src/store/slices/input-slice';
import { createOutputSlice, type OutputSlice } from '../../src/store/slices/output-slice';
import { createRoomEQSlice, type RoomEQSlice } from '../../src/store/slices/room-eq-slice';
import { createLinkSlice, type LinkSlice } from '../../src/store/slices/link-slice';
import { createDefaultInputChannel } from '../../src/constants/defaults';
import { createDefaultOutputChannel } from '../../src/constants/defaults';
import { createDefaultEQBands } from '../../src/constants/defaults';
import { create } from 'zustand';

// Helper: create a real Zustand store with the given slice
function createTestStore<T extends Record<string, any>>(
  sliceCreator: (set: any, get: any, api: any) => T,
  extra: Partial<T> = {}
) {
  return create<T>((set, get, api) => ({
    ...sliceCreator(set, get, api),
    ...extra,
  }));
}

describe('input-slice', () => {
  it('mirrors gain when linked via inputLinkGroups', () => {
    const store = createTestStore(createInputSlice, {
      inputs: [createDefaultInputChannel(), createDefaultInputChannel()],
      inputLinkGroups: [[0, 1]],
    } as any);

    store.getState().setInputGain(0, 6);
    const s = store.getState();

    expect(s.inputs[0].gain).toBe(6);
    expect(s.inputs[1].gain).toBe(6);
  });

  it('does not mirror when not linked', () => {
    const store = createTestStore(createInputSlice, {
      inputs: [createDefaultInputChannel(), createDefaultInputChannel()],
      inputLinkGroups: [],
    } as any);

    store.getState().setInputGain(0, 6);
    const s = store.getState();

    expect(s.inputs[0].gain).toBe(6);
    expect(s.inputs[1].gain).toBe(0);
  });

  it('toggles mute on partner when linked', () => {
    const store = createTestStore(createInputSlice, {
      inputs: [createDefaultInputChannel(), createDefaultInputChannel()],
      inputLinkGroups: [[0, 1]],
    } as any);

    store.getState().toggleInputMute(0);
    const s = store.getState();

    expect(s.inputs[0].mute).toBe(true);
    expect(s.inputs[1].mute).toBe(true);
  });

  it('resets both inputs when linked', () => {
    const store = createTestStore(createInputSlice, {
      inputs: [createDefaultInputChannel(), createDefaultInputChannel()],
      inputLinkGroups: [[0, 1]],
    } as any);

    store.getState().setInputGain(0, 12);
    store.getState().resetInput(0);
    const s = store.getState();

    expect(s.inputs[0].gain).toBe(0);
    expect(s.inputs[1].gain).toBe(0);
  });
});

describe('output-slice', () => {
  it('mirrors gain to link partners', () => {
    const store = createTestStore(
      createOutputSlice,
      {
        outputs: [
          createDefaultOutputChannel(),
          createDefaultOutputChannel(),
          createDefaultOutputChannel(),
          createDefaultOutputChannel(),
        ],
        outputLinkGroups: [[0, 1]],
      } as any
    );

    store.getState().setOutputGain(0, 9);
    const s = store.getState();

    expect(s.outputs[0].gain).toBe(9);
    expect(s.outputs[1].gain).toBe(9);
    expect(s.outputs[2].gain).toBe(0);
  });

  it('mirrors crossover HP to link partners', () => {
    const store = createTestStore(
      createOutputSlice,
      {
        outputs: [
          createDefaultOutputChannel(),
          createDefaultOutputChannel(),
          createDefaultOutputChannel(),
          createDefaultOutputChannel(),
        ],
        outputLinkGroups: [[2, 3]],
      } as any
    );

    store.getState().setOutputCrossoverHP(2, { enabled: true, frequency: 100, slope: 48 });
    const s = store.getState();

    expect(s.outputs[2].crossover.highPass.enabled).toBe(true);
    expect(s.outputs[2].crossover.highPass.frequency).toBeCloseTo(100, 0);
    expect(s.outputs[3].crossover.highPass.enabled).toBe(true);
    expect(s.outputs[3].crossover.highPass.frequency).toBeCloseTo(100, 0);
  });

  it('resetOutput clears linked partners', () => {
    const store = createTestStore(
      createOutputSlice,
      {
        outputs: [
          createDefaultOutputChannel(),
          createDefaultOutputChannel(),
          createDefaultOutputChannel(),
          createDefaultOutputChannel(),
        ],
        outputLinkGroups: [[0, 2]],
      } as any
    );

    store.getState().setOutputGain(0, 12);
    store.getState().resetOutput(0);
    const s = store.getState();

    expect(s.outputs[0].gain).toBe(0);
    expect(s.outputs[2].gain).toBe(0);
  });
});

describe('room-eq-slice', () => {
  it('updates room EQ band on specified input', () => {
    const store = createTestStore(
      createRoomEQSlice,
      {
        roomEqBands: [createDefaultEQBands(), createDefaultEQBands()],
        roomLinked: false,
        roomEqEnabled: true,
        roomEqEnabledStash: null,
        inputs: [createDefaultInputChannel(), createDefaultInputChannel()],
      } as any
    );

    store.getState().setRoomEQBand(0, 2, { frequency: 500, gain: -3 });
    const s = store.getState();

    expect(s.roomEqBands[0][2].frequency).toBeCloseTo(500, 0);
    expect(s.roomEqBands[0][2].gain).toBeCloseTo(-3, 1);
    expect(s.roomEqBands[1][2].frequency).toBeCloseTo(125, 0);
  });

  it('mirrors room EQ when roomLinked', () => {
    const store = createTestStore(
      createRoomEQSlice,
      {
        roomEqBands: [createDefaultEQBands(), createDefaultEQBands()],
        roomLinked: true,
        roomEqEnabled: true,
        roomEqEnabledStash: null,
        inputs: [createDefaultInputChannel(), createDefaultInputChannel()],
      } as any
    );

    store.getState().setRoomEQBand(0, 1, { enabled: true });
    const s = store.getState();

    expect(s.roomEqBands[0][1].enabled).toBe(true);
    expect(s.roomEqBands[1][1].enabled).toBe(true);
  });

  it('stashes and restores per-band enabled flags on global toggle', () => {
    const store = createTestStore(
      createRoomEQSlice,
      {
        roomEqBands: [createDefaultEQBands(), createDefaultEQBands()],
        roomLinked: false,
        roomEqEnabled: true,
        roomEqEnabledStash: null,
        inputs: [createDefaultInputChannel(), createDefaultInputChannel()],
      } as any
    );

    store.getState().setRoomEQBand(0, 0, { enabled: true });
    store.getState().setRoomEqEnabled(false);
    let s = store.getState();

    expect(s.roomEqEnabled).toBe(false);
    expect(s.roomEqBands[0][0].enabled).toBe(false);
    expect(s.roomEqEnabledStash).not.toBeNull();
    expect(s.roomEqEnabledStash![0][0]).toBe(true);

    store.getState().setRoomEqEnabled(true);
    s = store.getState();
    expect(s.roomEqEnabled).toBe(true);
    expect(s.roomEqBands[0][0].enabled).toBe(true);
  });
});

describe('link-slice', () => {
  it('links two outputs into a group', () => {
    const store = createTestStore(createLinkSlice, {
      outputLinkGroups: [],
    } as any);

    store.getState().linkOutputs(1, 3);
    const s = store.getState();

    expect(s.outputLinkGroups).toEqual([[1, 3]]);
  });

  it('merges existing groups when linking', () => {
    const store = createTestStore(createLinkSlice, {
      outputLinkGroups: [[0, 1], [2, 3]],
    } as any);

    store.getState().linkOutputs(1, 2);
    const s = store.getState();

    expect(s.outputLinkGroups).toEqual([[0, 1, 2, 3]]);
  });

  it('unlinkOutput removes singleton/empty groups', () => {
    const store = createTestStore(createLinkSlice, {
      outputLinkGroups: [[0, 1, 2]],
    } as any);

    store.getState().unlinkOutput(1);
    const s = store.getState();

    expect(s.outputLinkGroups).toEqual([[0, 2]]);
  });

  it('toggleOutputLinkMember adds or removes', () => {
    const store = createTestStore(createLinkSlice, {
      outputLinkGroups: [[0, 1]],
    } as any);

    store.getState().toggleOutputLinkMember(0, 2);
    expect(store.getState().outputLinkGroups).toEqual([[0, 1, 2]]);

    store.getState().toggleOutputLinkMember(0, 1);
    expect(store.getState().outputLinkGroups).toEqual([[0, 2]]);
  });

  it('copyInput clones channel data', () => {
    const input0 = { ...createDefaultInputChannel(), gain: 12, eqBands: createDefaultEQBands().map((b, i) => i === 0 ? { ...b, enabled: true, frequency: 2000 } : b) };
    const store = createTestStore(
      createLinkSlice,
      {
        outputLinkGroups: [],
        inputs: [input0, createDefaultInputChannel()],
      } as any
    );

    store.getState().copyInput(0, 1);
    const s = store.getState();

    expect(s.inputs[1].gain).toBe(12);
    expect(s.inputs[1].eqBands[0].enabled).toBe(true);
    expect(s.inputs[1].eqBands[0].frequency).toBeCloseTo(2000, 0);
  });
});
