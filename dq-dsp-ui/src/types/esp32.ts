/**
 * Auto-generated from dsp_config.h — do not edit manually.
 * Run: node scripts/generate-esp32-types.js
 */

export const ESP32_MAGIC = 0x44535043;
export const ESP32_CONFIG_VERSION = 4;
export const MAX_PEQ_BANDS = 10;
export const MAX_ROOM_EQ_BANDS = 10;
export const MAX_CROSSOVER_STAGES = 4;
export const NUM_INPUTS = 2;
export const NUM_OUTPUTS = 4;
export const MAX_DELAY_SAMPLES = 960;

export interface ESP32BiquadSection {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

export interface ESP32BiquadState {
  z1: number;
  z2: number;
}

export interface ESP32EQBandParams {
  frequency: number;
  gain_db: number;
  q: number;
  filter_type: number;
  enabled: number;
}

export interface ESP32XOParams {
  frequency: number;
  filter_type: number;
  slope: number;
  enabled: number;
}

export interface ESP32InputChannel {
  gain: number;
  mute: number;
  phase_invert: number;
  num_eq_bands: number;
  num_room_eq_bands: number;
  eq_bands: ESP32BiquadSection[];
  eq_params: ESP32EQBandParams[];
  room_eq_bands: ESP32BiquadSection[];
  room_eq_params: ESP32EQBandParams[];
}

export interface ESP32Crosspoint {
  enabled: number;
  gain: number;
}

export interface ESP32OutputChannel {
  gain: number;
  delay_samples: number;
  mute: number;
  phase_invert: number;
  num_eq_bands: number;
  num_hp_stages: number;
  num_lp_stages: number;
  eq_bands: ESP32BiquadSection[];
  hp_stages: ESP32BiquadSection[];
  lp_stages: ESP32BiquadSection[];
  eq_params: ESP32EQBandParams[];
  hp_params: ESP32XOParams;
  lp_params: ESP32XOParams;
}

export interface ESP32Global {
  master_volume: number;
  sample_rate: number;
  reserved: number;
}

export interface ESP32Header {
  magic: number;
  version: number;
  preset_index: number;
  sample_rate: number;
  crc32: number;
}

export interface ESP32System {
  drift_kp: number;
  drift_ki: number;
  drift_target_fill: number;
  drift_max_ppm: number;
}

export interface ESP32Config {
  header: ESP32Header;
  inputs: ESP32InputChannel[];
  routing: ESP32Crosspoint[];
  outputs: ESP32OutputChannel[];
  global: ESP32Global;
  system: ESP32System;
}

