import type { StateCreator } from 'zustand';
import type { InputChannel } from '../../types/dsp';
import type { EQBand, FilterType } from '../../types/filter';
import type { DSPStore } from '../dsp-store';
import { createDefaultInputChannel } from '../../constants/defaults';

export interface InputSlice {
  inputs: [InputChannel, InputChannel];
  setInputGain: (index: number, gain: number) => void;
  setInputMute: (index: number, mute: boolean) => void;
  setInputPhase: (index: number, invert: boolean) => void;
  toggleInputMute: (index: number) => void;
  toggleInputPhase: (index: number) => void;
  setInputEQBand: (inputIndex: number, bandIndex: number, updates: Partial<EQBand>) => void;
  setInputEQBandType: (inputIndex: number, bandIndex: number, filterType: FilterType) => void;
  toggleInputEQBand: (inputIndex: number, bandIndex: number) => void;
  resetInput: (index: number) => void;
}

/** Get the partner input index (0↔1) */
function partner(index: number): number {
  return index ^ 1;
}

export const createInputSlice: StateCreator<DSPStore, [], [], InputSlice> = (set) => ({
  inputs: [createDefaultInputChannel(), createDefaultInputChannel()],

  setInputGain: (index, gain) =>
    set((state) => {
      const inputs = [...state.inputs] as [InputChannel, InputChannel];
      inputs[index] = { ...inputs[index], gain };
      if (state.inputsLinked) {
        inputs[partner(index)] = { ...inputs[partner(index)], gain };
      }
      return { inputs };
    }),

  setInputMute: (index, mute) =>
    set((state) => {
      const inputs = [...state.inputs] as [InputChannel, InputChannel];
      inputs[index] = { ...inputs[index], mute };
      if (state.inputsLinked) {
        inputs[partner(index)] = { ...inputs[partner(index)], mute };
      }
      return { inputs };
    }),

  setInputPhase: (index, invert) =>
    set((state) => {
      const inputs = [...state.inputs] as [InputChannel, InputChannel];
      inputs[index] = { ...inputs[index], phaseInvert: invert };
      if (state.inputsLinked) {
        inputs[partner(index)] = { ...inputs[partner(index)], phaseInvert: invert };
      }
      return { inputs };
    }),

  toggleInputMute: (index) =>
    set((state) => {
      const inputs = [...state.inputs] as [InputChannel, InputChannel];
      const newMute = !inputs[index].mute;
      inputs[index] = { ...inputs[index], mute: newMute };
      if (state.inputsLinked) {
        inputs[partner(index)] = { ...inputs[partner(index)], mute: newMute };
      }
      return { inputs };
    }),

  toggleInputPhase: (index) =>
    set((state) => {
      const inputs = [...state.inputs] as [InputChannel, InputChannel];
      const newPhase = !inputs[index].phaseInvert;
      inputs[index] = { ...inputs[index], phaseInvert: newPhase };
      if (state.inputsLinked) {
        inputs[partner(index)] = { ...inputs[partner(index)], phaseInvert: newPhase };
      }
      return { inputs };
    }),

  setInputEQBand: (inputIndex, bandIndex, updates) =>
    set((state) => {
      const inputs = [...state.inputs] as [InputChannel, InputChannel];
      const eqBands = [...inputs[inputIndex].eqBands];
      eqBands[bandIndex] = { ...eqBands[bandIndex], ...updates };
      inputs[inputIndex] = { ...inputs[inputIndex], eqBands };
      if (state.inputsLinked) {
        const p = partner(inputIndex);
        const pBands = [...inputs[p].eqBands];
        pBands[bandIndex] = { ...pBands[bandIndex], ...updates };
        inputs[p] = { ...inputs[p], eqBands: pBands };
      }
      return { inputs };
    }),

  setInputEQBandType: (inputIndex, bandIndex, filterType) =>
    set((state) => {
      const inputs = [...state.inputs] as [InputChannel, InputChannel];
      const eqBands = [...inputs[inputIndex].eqBands];
      eqBands[bandIndex] = { ...eqBands[bandIndex], filterType };
      inputs[inputIndex] = { ...inputs[inputIndex], eqBands };
      if (state.inputsLinked) {
        const p = partner(inputIndex);
        const pBands = [...inputs[p].eqBands];
        pBands[bandIndex] = { ...pBands[bandIndex], filterType };
        inputs[p] = { ...inputs[p], eqBands: pBands };
      }
      return { inputs };
    }),

  toggleInputEQBand: (inputIndex, bandIndex) =>
    set((state) => {
      const inputs = [...state.inputs] as [InputChannel, InputChannel];
      const eqBands = [...inputs[inputIndex].eqBands];
      const newEnabled = !eqBands[bandIndex].enabled;
      eqBands[bandIndex] = { ...eqBands[bandIndex], enabled: newEnabled };
      inputs[inputIndex] = { ...inputs[inputIndex], eqBands };
      if (state.inputsLinked) {
        const p = partner(inputIndex);
        const pBands = [...inputs[p].eqBands];
        pBands[bandIndex] = { ...pBands[bandIndex], enabled: newEnabled };
        inputs[p] = { ...inputs[p], eqBands: pBands };
      }
      return { inputs };
    }),

  resetInput: (index) =>
    set((state) => {
      const inputs = [...state.inputs] as [InputChannel, InputChannel];
      inputs[index] = createDefaultInputChannel();
      if (state.inputsLinked) {
        inputs[partner(index)] = createDefaultInputChannel();
      }
      return { inputs };
    }),
});
