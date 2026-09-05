// EQBandHandle is integrated directly into FrequencyResponseGraph as SVG circles.
// This file provides helper utilities for drag computation.

import { FREQUENCY_RANGE, EQ_GAIN_RANGE } from '../../constants/filter-options'
import { clamp } from '../../dsp/utils'

export function clampBandFrequency(freq: number): number {
  return clamp(freq, FREQUENCY_RANGE.min, FREQUENCY_RANGE.max)
}

export function clampBandGain(gain: number): number {
  return clamp(gain, EQ_GAIN_RANGE.min, EQ_GAIN_RANGE.max)
}

export function roundFrequency(freq: number): number {
  if (freq < 100) return Math.round(freq)
  if (freq < 1000) return Math.round(freq / 5) * 5
  if (freq < 10000) return Math.round(freq / 10) * 10
  return Math.round(freq / 100) * 100
}

export function roundGain(gain: number): number {
  return Math.round(gain * 2) / 2 // snap to 0.5 dB
}
