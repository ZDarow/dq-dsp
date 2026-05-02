import type { FilterType } from '../../types/filter';
import { FILTER_TYPES } from '../../constants/filter-options';
import { Tooltip } from '../ui/Tooltip';

interface FilterTypeSelectProps {
  value: FilterType;
  onChange: (value: FilterType) => void;
}

const FILTER_TYPE_HELP: Record<string, string> = {
  peak: 'Peaking EQ — boost or cut a band around the centre frequency. Most common for surgical fixes.',
  lowshelf: 'Low Shelf — broad gain change for everything below the corner frequency. Use to add/remove warmth.',
  highshelf: 'High Shelf — broad gain change for everything above the corner frequency. Use to add air or tame brightness.',
  lowpass: 'Low Pass — attenuate above the cutoff. Removes high-frequency content.',
  highpass: 'High Pass — attenuate below the cutoff. Removes rumble and DC offset.',
  notch: 'Notch — narrow deep cut at the centre frequency. Use to kill resonances.',
};

export function FilterTypeSelect({ value, onChange }: FilterTypeSelectProps) {
  const help = FILTER_TYPE_HELP[value] ?? 'EQ band filter type';
  return (
    <Tooltip content={help}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as FilterType)}
        className="bg-control-bg text-text-primary text-xs px-2 py-1 rounded border border-surface-bg focus:border-accent focus:outline-none"
        aria-label="EQ band filter type"
      >
        {FILTER_TYPES.map((ft) => (
          <option key={ft.value} value={ft.value}>
            {ft.label}
          </option>
        ))}
      </select>
    </Tooltip>
  );
}
