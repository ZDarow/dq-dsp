import type { StateCreator } from 'zustand';
import type { OutputChannel } from '../../types/dsp';
import type { EQBand, FilterType, CrossoverFilterType, CrossoverSlope } from '../../types/filter';
import type { DSPStore } from '../dsp-store';
import { createDefaultOutputChannel } from '../../constants/defaults';
import { msToSamples } from '../../dsp/utils';
import { getLinkPartners } from '../slices/link-slice';

export interface OutputSlice {
  outputs: [OutputChannel, OutputChannel, OutputChannel, OutputChannel];
  setOutputGain: (index: number, gain: number) => void;
  setOutputMute: (index: number, mute: boolean) => void;
  setOutputPhase: (index: number, invert: boolean) => void;
  toggleOutputMute: (index: number) => void;
  toggleOutputPhase: (index: number) => void;
  setOutputDelay: (index: number, ms: number) => void;
  setOutputEQBand: (outputIndex: number, bandIndex: number, updates: Partial<EQBand>) => void;
  setOutputEQBandType: (outputIndex: number, bandIndex: number, filterType: FilterType) => void;
  toggleOutputEQBand: (outputIndex: number, bandIndex: number) => void;
  setOutputCrossoverHP: (index: number, updates: { enabled?: boolean; filterType?: CrossoverFilterType; slope?: CrossoverSlope; frequency?: number }) => void;
  setOutputCrossoverLP: (index: number, updates: { enabled?: boolean; filterType?: CrossoverFilterType; slope?: CrossoverSlope; frequency?: number }) => void;
  resetOutput: (index: number) => void;
}

type Outputs = [OutputChannel, OutputChannel, OutputChannel, OutputChannel];

/** All output indices that should mirror changes from `index`. */
function partnersOf(state: { outputLinkGroups: number[][] }, index: number): number[] {
  return getLinkPartners(state.outputLinkGroups, index);
}

export const createOutputSlice: StateCreator<DSPStore, [], [], OutputSlice> = (set, get) => ({
  outputs: [
    createDefaultOutputChannel(),
    createDefaultOutputChannel(),
    createDefaultOutputChannel(),
    createDefaultOutputChannel(),
  ],

  setOutputGain: (index, gain) =>
    set((state) => {
      const outputs = [...state.outputs] as Outputs;
      outputs[index] = { ...outputs[index], gain };
      for (const p of partnersOf(state, index)) {
        outputs[p] = { ...outputs[p], gain };
      }
      return { outputs };
    }),

  setOutputMute: (index, mute) =>
    set((state) => {
      const outputs = [...state.outputs] as Outputs;
      outputs[index] = { ...outputs[index], mute };
      for (const p of partnersOf(state, index)) {
        outputs[p] = { ...outputs[p], mute };
      }
      return { outputs };
    }),

  setOutputPhase: (index, invert) =>
    set((state) => {
      const outputs = [...state.outputs] as Outputs;
      outputs[index] = { ...outputs[index], phaseInvert: invert };
      for (const p of partnersOf(state, index)) {
        outputs[p] = { ...outputs[p], phaseInvert: invert };
      }
      return { outputs };
    }),

  toggleOutputMute: (index) =>
    set((state) => {
      const outputs = [...state.outputs] as Outputs;
      const newMute = !outputs[index].mute;
      outputs[index] = { ...outputs[index], mute: newMute };
      for (const p of partnersOf(state, index)) {
        outputs[p] = { ...outputs[p], mute: newMute };
      }
      return { outputs };
    }),

  toggleOutputPhase: (index) =>
    set((state) => {
      const outputs = [...state.outputs] as Outputs;
      const newPhase = !outputs[index].phaseInvert;
      outputs[index] = { ...outputs[index], phaseInvert: newPhase };
      for (const p of partnersOf(state, index)) {
        outputs[p] = { ...outputs[p], phaseInvert: newPhase };
      }
      return { outputs };
    }),

  setOutputDelay: (index, ms) =>
    set((state) => {
      const sampleRate = get().sampleRate;
      const outputs = [...state.outputs] as Outputs;
      const samples = msToSamples(ms, sampleRate);
      outputs[index] = { ...outputs[index], delayMs: ms, delaySamples: samples };
      for (const p of partnersOf(state, index)) {
        outputs[p] = { ...outputs[p], delayMs: ms, delaySamples: samples };
      }
      return { outputs };
    }),

  setOutputEQBand: (outputIndex, bandIndex, updates) =>
    set((state) => {
      const outputs = [...state.outputs] as Outputs;
      const eqBands = [...outputs[outputIndex].eqBands];
      eqBands[bandIndex] = { ...eqBands[bandIndex], ...updates };
      outputs[outputIndex] = { ...outputs[outputIndex], eqBands };
      for (const p of partnersOf(state, outputIndex)) {
        const pBands = [...outputs[p].eqBands];
        pBands[bandIndex] = { ...pBands[bandIndex], ...updates };
        outputs[p] = { ...outputs[p], eqBands: pBands };
      }
      return { outputs };
    }),

  setOutputEQBandType: (outputIndex, bandIndex, filterType) =>
    set((state) => {
      const outputs = [...state.outputs] as Outputs;
      const eqBands = [...outputs[outputIndex].eqBands];
      eqBands[bandIndex] = { ...eqBands[bandIndex], filterType };
      outputs[outputIndex] = { ...outputs[outputIndex], eqBands };
      for (const p of partnersOf(state, outputIndex)) {
        const pBands = [...outputs[p].eqBands];
        pBands[bandIndex] = { ...pBands[bandIndex], filterType };
        outputs[p] = { ...outputs[p], eqBands: pBands };
      }
      return { outputs };
    }),

  toggleOutputEQBand: (outputIndex, bandIndex) =>
    set((state) => {
      const outputs = [...state.outputs] as Outputs;
      const eqBands = [...outputs[outputIndex].eqBands];
      const newEnabled = !eqBands[bandIndex].enabled;
      eqBands[bandIndex] = { ...eqBands[bandIndex], enabled: newEnabled };
      outputs[outputIndex] = { ...outputs[outputIndex], eqBands };
      for (const p of partnersOf(state, outputIndex)) {
        const pBands = [...outputs[p].eqBands];
        pBands[bandIndex] = { ...pBands[bandIndex], enabled: newEnabled };
        outputs[p] = { ...outputs[p], eqBands: pBands };
      }
      return { outputs };
    }),

  setOutputCrossoverHP: (index, updates) =>
    set((state) => {
      const outputs = [...state.outputs] as Outputs;
      const crossover = { ...outputs[index].crossover };
      crossover.highPass = { ...crossover.highPass, ...updates };
      outputs[index] = { ...outputs[index], crossover };
      for (const p of partnersOf(state, index)) {
        const pCrossover = { ...outputs[p].crossover };
        pCrossover.highPass = { ...pCrossover.highPass, ...updates };
        outputs[p] = { ...outputs[p], crossover: pCrossover };
      }
      return { outputs };
    }),

  setOutputCrossoverLP: (index, updates) =>
    set((state) => {
      const outputs = [...state.outputs] as Outputs;
      const crossover = { ...outputs[index].crossover };
      crossover.lowPass = { ...crossover.lowPass, ...updates };
      outputs[index] = { ...outputs[index], crossover };
      for (const p of partnersOf(state, index)) {
        const pCrossover = { ...outputs[p].crossover };
        pCrossover.lowPass = { ...pCrossover.lowPass, ...updates };
        outputs[p] = { ...outputs[p], crossover: pCrossover };
      }
      return { outputs };
    }),

  resetOutput: (index) =>
    set((state) => {
      const outputs = [...state.outputs] as Outputs;
      outputs[index] = createDefaultOutputChannel();
      for (const p of partnersOf(state, index)) {
        outputs[p] = createDefaultOutputChannel();
      }
      return { outputs };
    }),
});
