export const ESP32_MAGIC = 0x44535043; // 'DSPC'
export const ESP32_CONFIG_VERSION = 4;
export const MAX_PEQ_BANDS = 10;
export const MAX_CROSSOVER_STAGES = 4; // max biquad stages per HP/LP

export interface ESP32Header {
  magic: number;       // uint32, 0x44535043
  version: number;     // uint16
  presetIndex: number; // uint16
  sampleRate: number;  // uint32
  crc32: number;       // uint32
}

export interface ESP32BiquadSection {
  b0: number; // float32
  b1: number; // float32
  b2: number; // float32
  a1: number; // float32 (negated: -a1/a0)
  a2: number; // float32 (negated: -a2/a0)
}

export interface ESP32EQBandParams {
  frequency: number;   // float32
  gainDb: number;      // float32
  q: number;           // float32
  filterType: number;  // uint8
  enabled: number;     // uint8
}

export interface ESP32XOParams {
  frequency: number;   // float32
  filterType: number;  // uint8
  slope: number;       // uint8
  enabled: number;     // uint8
}

export interface ESP32InputChannel {
  gain: number;              // float32, linear
  mute: number;              // uint8 (0 or 1), padded to 4 bytes
  phaseInvert: number;       // uint8 (0 or 1), padded to 4 bytes
  numEqBands: number;        // uint8, padded to 4 bytes
  numRoomEqBands: number;    // uint8 (was reserved)
  eqBands: ESP32BiquadSection[]; // MAX_PEQ_BANDS
  eqParams: ESP32EQBandParams[]; // MAX_PEQ_BANDS (shadow params)
  roomEqBands: ESP32BiquadSection[]; // MAX_PEQ_BANDS
  roomEqParams: ESP32EQBandParams[]; // MAX_PEQ_BANDS (shadow params)
}

export interface ESP32Crosspoint {
  enabled: number;  // uint8, padded to 4 bytes
  gain: number;     // float32
}

export interface ESP32OutputChannel {
  gain: number;              // float32, linear
  delaySamples: number;      // uint32
  mute: number;              // uint8, padded to 4 bytes
  phaseInvert: number;       // uint8, padded to 4 bytes
  numEqBands: number;        // uint8, padded to 4 bytes
  numHpStages: number;       // uint8
  numLpStages: number;       // uint8, padded to 4 bytes
  reserved: number;
  eqBands: ESP32BiquadSection[];     // MAX_PEQ_BANDS
  hpStages: ESP32BiquadSection[];    // MAX_CROSSOVER_STAGES
  lpStages: ESP32BiquadSection[];    // MAX_CROSSOVER_STAGES
  eqParams: ESP32EQBandParams[];     // MAX_PEQ_BANDS (shadow params)
  hpParams: ESP32XOParams;           // shadow HP crossover params
  lpParams: ESP32XOParams;           // shadow LP crossover params
}

export interface ESP32Global {
  masterVolume: number;  // float32, linear
  sampleRate: number;    // uint32
  reserved: number;      // uint32
}
