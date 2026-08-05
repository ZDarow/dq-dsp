import type { DSPConfig } from '../types/dsp';

export interface PresetFile {
  format: 'esp32-dsp-preset';
  version: number;
  name: string;
  config: DSPConfig;
}

const CURRENT_VERSION = 1;

/** Wrap a DSPConfig into a preset file object */
export function createPresetFile(name: string, config: DSPConfig): PresetFile {
  return {
    format: 'esp32-dsp-preset',
    version: CURRENT_VERSION,
    name,
    config,
  };
}

/** Download a preset as a .json file */
export function downloadPreset(name: string, config: DSPConfig): void {
  const preset = createPresetFile(name, config);
  const json = JSON.stringify(preset, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const filename = name.replace(/\s+/g, '_').toLowerCase() + '.json';
  downloadBlob(blob, filename);
}

/** Parse and validate a preset from a JSON string. Returns null if invalid. */
export function parsePresetJSON(text: string): PresetFile | null {
  try {
    const obj = JSON.parse(text);

    // Accept both our preset file format and raw DSPConfig
    if (obj.format === 'esp32-dsp-preset' && obj.config) {
      if (!validateDSPConfig(obj.config)) return null;
      return obj as PresetFile;
    }

    // Raw DSPConfig (e.g. from the Export dialog JSON)
    if (validateDSPConfig(obj)) {
      return {
        format: 'esp32-dsp-preset',
        version: CURRENT_VERSION,
        name: obj.presetName ?? 'Imported',
        config: obj,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/** Read a single File object and parse as preset */
export async function readPresetFile(file: File): Promise<PresetFile | null> {
  const text = await file.text();
  return parsePresetJSON(text);
}

/** Read multiple File objects (from file or folder input) and return valid presets */
export async function readPresetFiles(files: FileList): Promise<PresetFile[]> {
  const presets: PresetFile[] = [];
  for (const file of Array.from(files)) {
    if (!file.name.endsWith('.json')) continue;
    const preset = await readPresetFile(file);
    if (preset) {
      presets.push(preset);
    }
  }
  return presets;
}

/** Basic structural validation of a DSPConfig object */
function validateDSPConfig(obj: unknown): obj is DSPConfig {
  if (!obj || typeof obj !== 'object') return false;
  const c = obj as Record<string, unknown>;
  return (
    Array.isArray(c.inputs) &&
    c.inputs.length === 2 &&
    Array.isArray(c.outputs) &&
    c.outputs.length === 4 &&
    Array.isArray(c.routing) &&
    typeof c.masterVolume === 'number' &&
    typeof c.sampleRate === 'number'
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
