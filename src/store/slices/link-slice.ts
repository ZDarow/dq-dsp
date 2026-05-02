import type { StateCreator } from 'zustand';
import type { DSPStore } from '../dsp-store';
import type { InputChannel, OutputChannel } from '../../types/dsp';

export interface LinkSlice {
  /** Stereo link for the 2 inputs — only one possible pair so it stays a bool. */
  inputsLinked: boolean;
  /**
   * Flexible output link groups. Each subarray is a set of output indices
   * whose parameter changes mirror each other. Outputs not present in any
   * group are independent. Examples:
   *   []                    — no links
   *   [[0,1], [2,3]]        — Out1+2, Out3+4 (classic two stereo pairs)
   *   [[0,1,2,3]]           — all four outputs mirror (mono sub farm)
   *   [[0,2]]               — Out1+3 linked, Out2 + Out4 standalone
   */
  outputLinkGroups: number[][];

  setInputsLinked: (linked: boolean) => void;
  toggleInputsLinked: () => void;

  /** Add a link between two outputs. Merges existing groups if needed. */
  linkOutputs: (a: number, b: number) => void;
  /** Remove an output from its group (group is dropped if it becomes a singleton). */
  unlinkOutput: (index: number) => void;
  /**
   * Convenience for the picker UI: if `current` and `other` already share
   * a group, unlink `other`; otherwise link them.
   */
  toggleOutputLinkMember: (current: number, other: number) => void;

  /** Copy all settings from one input to the other. */
  copyInput: (sourceIndex: number, targetIndex: number) => void;
  /** Copy all settings from one output to any other output. */
  copyOutput: (sourceIndex: number, targetIndex: number) => void;
}

// ---------------------------------------------------------------------------
// Group helpers (pure, exported for use by output-slice and UI components)
// ---------------------------------------------------------------------------

/** Find the group containing `index`, or null if not linked. */
export function getOutputLinkGroup(groups: number[][], index: number): number[] | null {
  return groups.find((g) => g.includes(index)) ?? null;
}

/** True if `index` is part of any link group. */
export function isOutputLinked(groups: number[][], index: number): boolean {
  return groups.some((g) => g.includes(index));
}

/** Return all OTHER members of the group containing `index` (empty array if not linked). */
export function getOutputLinkPartners(groups: number[][], index: number): number[] {
  const g = getOutputLinkGroup(groups, index);
  return g ? g.filter((i) => i !== index) : [];
}

function withMerged(groups: number[][], a: number, b: number): number[][] {
  const groupA = groups.find((g) => g.includes(a));
  const groupB = groups.find((g) => g.includes(b));
  const others = groups.filter((g) => g !== groupA && g !== groupB);
  const merged = Array.from(new Set([...(groupA ?? [a]), ...(groupB ?? [b])])).sort((x, y) => x - y);
  return [...others, merged];
}

function withRemoved(groups: number[][], index: number): number[][] {
  return groups
    .map((g) => g.filter((i) => i !== index))
    .filter((g) => g.length >= 2); // drop empty/singleton groups
}

// ---------------------------------------------------------------------------
// Cloning helpers for copyInput / copyOutput
// ---------------------------------------------------------------------------

function cloneInput(ch: InputChannel): InputChannel {
  return {
    ...ch,
    eqBands: ch.eqBands.map((b) => ({ ...b })),
  };
}

function cloneOutput(ch: OutputChannel): OutputChannel {
  return {
    ...ch,
    eqBands: ch.eqBands.map((b) => ({ ...b })),
    crossover: {
      highPass: { ...ch.crossover.highPass },
      lowPass: { ...ch.crossover.lowPass },
    },
  };
}

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

export const createLinkSlice: StateCreator<DSPStore, [], [], LinkSlice> = (set) => ({
  inputsLinked: false,
  outputLinkGroups: [],

  setInputsLinked: (linked) => set({ inputsLinked: linked }),
  toggleInputsLinked: () => set((state) => ({ inputsLinked: !state.inputsLinked })),

  linkOutputs: (a, b) =>
    set((state) => {
      if (a === b) return {};
      return { outputLinkGroups: withMerged(state.outputLinkGroups, a, b) };
    }),

  unlinkOutput: (index) =>
    set((state) => ({ outputLinkGroups: withRemoved(state.outputLinkGroups, index) })),

  toggleOutputLinkMember: (current, other) =>
    set((state) => {
      if (current === other) return {};
      const group = getOutputLinkGroup(state.outputLinkGroups, current);
      if (group?.includes(other)) {
        // Already linked — remove `other` from the group.
        return { outputLinkGroups: withRemoved(state.outputLinkGroups, other) };
      }
      return { outputLinkGroups: withMerged(state.outputLinkGroups, current, other) };
    }),

  copyInput: (sourceIndex, targetIndex) =>
    set((state) => {
      const inputs = [...state.inputs] as [InputChannel, InputChannel];
      inputs[targetIndex] = cloneInput(inputs[sourceIndex]);
      return { inputs };
    }),

  copyOutput: (sourceIndex, targetIndex) =>
    set((state) => {
      const outputs = [...state.outputs] as [OutputChannel, OutputChannel, OutputChannel, OutputChannel];
      outputs[targetIndex] = cloneOutput(outputs[sourceIndex]);
      return { outputs };
    }),
});
