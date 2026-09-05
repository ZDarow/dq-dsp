import type { StateCreator } from 'zustand'
import type { DSPStore } from '../dsp-store'
import type { InputChannel, OutputChannel } from '../../types/dsp'

export interface LinkSlice {
  /**
   * Flexible input link groups. Each subarray is a set of input indices
   * whose parameter changes mirror each other. Inputs not present in any
   * group are independent. Examples:
   *   []          — no links
   *   [[0,1]]     — In1+2 linked (classic stereo)
   */
  inputLinkGroups: number[][]

  /**
   * Flexible output link groups. Each subarray is a set of output indices
   * whose parameter changes mirror each other. Outputs not present in any
   * group are independent. Examples:
   *   []                    — no links
   *   [[0,1], [2,3]]        — Out1+2, Out3+4 (classic two stereo pairs)
   *   [[0,1,2,3]]           — all four outputs mirror (mono sub farm)
   *   [[0,2]]               — Out1+3 linked, Out2 + Out4 standalone
   */
  outputLinkGroups: number[][]

  /** Add a link between two inputs. Merges existing groups if needed. */
  linkInputs: (a: number, b: number) => void
  /** Remove an input from its group (group is dropped if it becomes a singleton). */
  unlinkInput: (index: number) => void
  /**
   * Convenience for the picker UI: if `current` and `other` already share
   * a group, unlink `other`; otherwise link them.
   */
  toggleInputLinkMember: (current: number, other: number) => void

  /** Add a link between two outputs. Merges existing groups if needed. */
  linkOutputs: (a: number, b: number) => void
  /** Remove an output from its group (group is dropped if it becomes a singleton). */
  unlinkOutput: (index: number) => void
  /**
   * Convenience for the picker UI: if `current` and `other` already share
   * a group, unlink `other`; otherwise link them.
   */
  toggleOutputLinkMember: (current: number, other: number) => void

  /** Copy all settings from one input to the other. */
  copyInput: (sourceIndex: number, targetIndex: number) => void
  /** Copy all settings from one output to any other output. */
  copyOutput: (sourceIndex: number, targetIndex: number) => void
}

// ---------------------------------------------------------------------------
// Group helpers (pure, exported for use by input-slice, output-slice, and UI)
// ---------------------------------------------------------------------------

/** Find the group containing `index`, or null if not linked. */
export function getLinkGroup(groups: number[][], index: number): number[] | null {
  return groups.find((g) => g.includes(index)) ?? null
}

/** True if `index` is part of any link group. */
export function isLinked(groups: number[][], index: number): boolean {
  return groups.some((g) => g.includes(index))
}

/** Return all OTHER members of the group containing `index` (empty array if not linked). */
export function getLinkPartners(groups: number[][], index: number): number[] {
  const g = getLinkGroup(groups, index)
  return g ? g.filter((i) => i !== index) : []
}

function withMerged(groups: number[][], a: number, b: number): number[][] {
  const groupA = groups.find((g) => g.includes(a))
  const groupB = groups.find((g) => g.includes(b))
  const others = groups.filter((g) => g !== groupA && g !== groupB)
  const merged = Array.from(new Set([...(groupA ?? [a]), ...(groupB ?? [b])])).sort((x, y) => x - y)
  return [...others, merged]
}

function withRemoved(groups: number[][], index: number): number[][] {
  return groups.map((g) => g.filter((i) => i !== index)).filter((g) => g.length >= 2) // drop empty/singleton groups
}

// ---------------------------------------------------------------------------
// Cloning helpers for copyInput / copyOutput
// ---------------------------------------------------------------------------

function cloneInput(ch: InputChannel): InputChannel {
  return {
    ...ch,
    eqBands: ch.eqBands.map((b) => ({ ...b })),
  }
}

function cloneOutput(ch: OutputChannel): OutputChannel {
  return {
    ...ch,
    eqBands: ch.eqBands.map((b) => ({ ...b })),
    crossover: {
      highPass: { ...ch.crossover.highPass },
      lowPass: { ...ch.crossover.lowPass },
    },
  }
}

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

export const createLinkSlice: StateCreator<DSPStore, [], [], LinkSlice> = (set) => ({
  inputLinkGroups: [],
  outputLinkGroups: [],

  linkInputs: (a, b) =>
    set((state) => {
      if (a === b) return {}
      return { inputLinkGroups: withMerged(state.inputLinkGroups, a, b) }
    }),

  unlinkInput: (index) =>
    set((state) => ({ inputLinkGroups: withRemoved(state.inputLinkGroups, index) })),

  toggleInputLinkMember: (current, other) =>
    set((state) => {
      if (current === other) return {}
      const group = getLinkGroup(state.inputLinkGroups, current)
      if (group?.includes(other)) {
        return { inputLinkGroups: withRemoved(state.inputLinkGroups, other) }
      }
      return { inputLinkGroups: withMerged(state.inputLinkGroups, current, other) }
    }),

  linkOutputs: (a, b) =>
    set((state) => {
      if (a === b) return {}
      return { outputLinkGroups: withMerged(state.outputLinkGroups, a, b) }
    }),

  unlinkOutput: (index) =>
    set((state) => ({ outputLinkGroups: withRemoved(state.outputLinkGroups, index) })),

  toggleOutputLinkMember: (current, other) =>
    set((state) => {
      if (current === other) return {}
      const group = getLinkGroup(state.outputLinkGroups, current)
      if (group?.includes(other)) {
        return { outputLinkGroups: withRemoved(state.outputLinkGroups, other) }
      }
      return { outputLinkGroups: withMerged(state.outputLinkGroups, current, other) }
    }),

  copyInput: (sourceIndex, targetIndex) =>
    set((state) => {
      const inputs = [...state.inputs] as [InputChannel, InputChannel]
      inputs[targetIndex] = cloneInput(inputs[sourceIndex])
      return { inputs }
    }),

  copyOutput: (sourceIndex, targetIndex) =>
    set((state) => {
      const outputs = [...state.outputs] as [
        OutputChannel,
        OutputChannel,
        OutputChannel,
        OutputChannel,
      ]
      outputs[targetIndex] = cloneOutput(outputs[sourceIndex])
      return { outputs }
    }),
})
