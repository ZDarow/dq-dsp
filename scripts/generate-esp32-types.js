/**
 * Generate src/types/esp32.ts from shared/dsp/dsp_config.h.
 *
 * Run with: node scripts/generate-esp32-types.js
 */

const fs = require('fs');
const path = require('path');

const headerPath = path.join(__dirname, '..', 'dq-dsp-firmware', 'shared', 'dsp', 'dsp_config.h');
const outputPath = path.join(__dirname, '..', 'dq-dsp-ui', 'src', 'types', 'esp32.ts');

const content = fs.readFileSync(headerPath, 'utf8');

const lines = content.split('\n');
const defines = [];
const structs = [];
let currentStruct = null;
let inStruct = false;

// Name mapping from C to TypeScript
const nameMap = {
  'biquad_coeffs_t': 'ESP32BiquadSection',
  'biquad_state_t': 'ESP32BiquadState',
  'eq_band_params_t': 'ESP32EQBandParams',
  'xo_params_t': 'ESP32XOParams',
  'dsp_input_t': 'ESP32InputChannel',
  'dsp_crosspoint_t': 'ESP32Crosspoint',
  'dsp_output_t': 'ESP32OutputChannel',
  'dsp_global_t': 'ESP32Global',
  'dsp_header_t': 'ESP32Header',
  'dsp_system_t': 'ESP32System',
  'dsp_config_t': 'ESP32Config',
};

const arrayFields = {
  'eq_bands': 'ESP32BiquadSection',
  'eq_params': 'ESP32EQBandParams',
  'room_eq_bands': 'ESP32BiquadSection',
  'room_eq_params': 'ESP32EQBandParams',
  'hp_stages': 'ESP32BiquadSection',
  'lp_stages': 'ESP32BiquadSection',
};

for (const line of lines) {
  const trimmed = line.trim();

  // Parse #define constants
  const defineMatch = trimmed.match(/^#define\s+(\w+)\s+(.+)$/);
  if (defineMatch) {
    const name = defineMatch[1];
    let value = defineMatch[2].trim();
    value = value.replace(/\/\/.*$/, '').trim();
    if (value.includes('/*')) {
      value = value.split('/*')[0].trim();
    }
    defines.push({ name, value });
  }

  // Parse struct start
  if (trimmed.startsWith('typedef struct {')) {
    inStruct = true;
    currentStruct = { cName: '', fields: [] };
    continue;
  }

  // Parse struct end
  if (inStruct && trimmed.startsWith('}')) {
    const match = trimmed.match(/}\s*(\w+)\s*;/);
    if (match) {
      currentStruct.cName = match[1];
      structs.push(currentStruct);
    }
    inStruct = false;
    currentStruct = null;
    continue;
  }

  // Parse struct fields
  if (inStruct && currentStruct && trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
    let fieldLine = trimmed.replace(/\/\/.*$/, '').trim();
    if (fieldLine.includes('/*')) {
      fieldLine = fieldLine.split('/*')[0].trim();
    }
    if (fieldLine.length === 0) continue;

    const fieldMatch = fieldLine.match(/^(.+)\s+(\w+)(?:\[(.+?)\])?\s*;?\s*$/);
    if (fieldMatch) {
      let type = fieldMatch[1].trim();
      const name = fieldMatch[2];
      const arraySize = fieldMatch[3];

      // Map C types to TypeScript
      if (type === 'float') type = 'number';
      else if (type === 'uint8_t') type = 'number';
      else if (type === 'uint16_t') type = 'number';
      else if (type === 'uint32_t') type = 'number';
      else if (type === 'int8_t') type = 'number';
      else if (type.endsWith('_t')) {
        type = nameMap[type] || type.replace(/_t$/, '');
      }

      if (arraySize) {
        currentStruct.fields.push({ name, type: `${type}[]`, comment: '' });
      } else {
        currentStruct.fields.push({ name, type, comment: '' });
      }
    }
  }
}

// Generate TypeScript
let ts = `/**
 * Auto-generated from dsp_config.h — do not edit manually.
 * Run: node scripts/generate-esp32-types.js
 */

`;

// Constants
const constMap = {
  'DSP_MAGIC': 'ESP32_MAGIC',
  'DSP_VERSION': 'ESP32_CONFIG_VERSION',
  'DSP_MAX_PEQ_BANDS': 'MAX_PEQ_BANDS',
  'DSP_MAX_ROOM_EQ_BANDS': 'MAX_ROOM_EQ_BANDS',
  'DSP_MAX_XO_STAGES': 'MAX_CROSSOVER_STAGES',
  'DSP_NUM_INPUTS': 'NUM_INPUTS',
  'DSP_NUM_OUTPUTS': 'NUM_OUTPUTS',
  'MAX_DELAY_SAMPLES': 'MAX_DELAY_SAMPLES',
};

for (const def of defines) {
  if (def.value.includes('{') || def.value.includes('}')) continue;
  const exportName = constMap[def.name] || def.name;
  ts += `export const ${exportName} = ${def.value};\n`;
}
ts += '\n';

// Interfaces
for (const struct of structs) {
  const ifaceName = nameMap[struct.cName] || struct.cName.replace(/_t$/, '');
  ts += `export interface ${ifaceName} {\n`;
  for (const field of struct.fields) {
    if (field.name.startsWith('_pad') || field.name.startsWith('_reserved') || field.name.startsWith('_')) {
      continue;
    }
    ts += `  ${field.name}: ${field.type};\n`;
  }
  ts += '}\n\n';
}

fs.writeFileSync(outputPath, ts);
console.log(`Generated ${outputPath}`);
console.log(`  ${defines.length} constants, ${structs.length} interfaces`);
