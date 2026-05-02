import { useMemo } from 'react';
import { useDSPStore } from './dsp-store';
import type { EQBand } from '../types/filter';
import type { InputChannel, OutputChannel, RoutingMatrix, SelectedBlock } from '../types/dsp';

// Input selectors
export function useInputChannel(index: number): InputChannel {
  return useDSPStore((s) => s.inputs[index]);
}

export function useInputEQBands(index: number): EQBand[] {
  return useDSPStore((s) => s.inputs[index].eqBands);
}

// Output selectors
export function useOutputChannel(index: number): OutputChannel {
  return useDSPStore((s) => s.outputs[index]);
}

export function useOutputEQBands(index: number): EQBand[] {
  return useDSPStore((s) => s.outputs[index].eqBands);
}

// Routing selectors
export function useRoutingMatrix(): RoutingMatrix {
  return useDSPStore((s) => s.routing);
}

// Global selectors
export function useSelectedBlock(): SelectedBlock {
  return useDSPStore((s) => s.selectedBlock);
}

export function useSampleRate(): number {
  return useDSPStore((s) => s.sampleRate);
}

export function useMasterVolume(): number {
  return useDSPStore((s) => s.masterVolume);
}

// Memoized computed selectors
export function useActiveInputBands(index: number): EQBand[] {
  const bands = useInputEQBands(index);
  return useMemo(() => bands.filter((b) => b.enabled), [bands]);
}

export function useActiveOutputBands(index: number): EQBand[] {
  const bands = useOutputEQBands(index);
  return useMemo(() => bands.filter((b) => b.enabled), [bands]);
}
