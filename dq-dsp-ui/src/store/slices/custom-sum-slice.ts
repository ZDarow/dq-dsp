import type { StateCreator } from 'zustand'
import type { CustomSum } from '../../types/custom-sum'
import type { DSPStore } from '../dsp-store'
import { createDefaultCustomSums } from '../../constants/defaults'

export interface CustomSumSlice {
  customSums: CustomSum[]
  addCustomSum: (sum: Omit<CustomSum, 'id'>) => void
  removeCustomSum: (id: string) => void
  updateCustomSum: (id: string, updates: Partial<Omit<CustomSum, 'id'>>) => void
  setCustomSums: (sums: CustomSum[]) => void
}

function newId(): string {
  return `sum-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const createCustomSumSlice: StateCreator<DSPStore, [], [], CustomSumSlice> = (set) => ({
  customSums: createDefaultCustomSums(),

  addCustomSum: (sum) =>
    set((s) => ({
      customSums: [...s.customSums, { ...sum, id: newId() }],
    })),

  removeCustomSum: (id) =>
    set((s) => ({
      customSums: s.customSums.filter((x) => x.id !== id),
    })),

  updateCustomSum: (id, updates) =>
    set((s) => ({
      customSums: s.customSums.map((x) => (x.id === id ? { ...x, ...updates } : x)),
    })),

  setCustomSums: (sums) => set({ customSums: sums }),
})
