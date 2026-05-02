import type { EQBand, FilterType } from '../../types/filter';
import { FilterTypeSelect } from '../controls/FilterTypeSelect';
import { formatFrequency } from '../../utils/format';
import { Tooltip } from '../ui/Tooltip';

interface EQBandControlProps {
  band: EQBand;
  index: number;
  selected: boolean;
  color: string;
  onChange: (updates: Partial<EQBand>) => void;
  onSelect: () => void;
}

export function EQBandControl({ band, index, selected, color, onChange, onSelect }: EQBandControlProps) {
  return (
    <Tooltip content={`Band ${index + 1} — click row to focus the draggable handle on the graph; toggle the checkbox to bypass without losing settings.`} wrapperClassName="block">
    <div
      className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
        selected ? 'bg-surface-bg' : 'hover:bg-surface-bg/50'
      }`}
      onClick={onSelect}
    >
      {/* Enable checkbox */}
      <input
        type="checkbox"
        checked={band.enabled}
        onChange={(e) => {
          e.stopPropagation();
          onChange({ enabled: e.target.checked });
        }}
        className="accent-current"
        style={{ accentColor: color }}
        aria-label={`Enable band ${index + 1}`}
      />

      {/* Band number */}
      <span className="w-4 text-center font-bold" style={{ color: band.enabled ? color : '#55556a' }}>
        {index + 1}
      </span>

      {/* Filter type */}
      <FilterTypeSelect
        value={band.filterType}
        onChange={(filterType: FilterType) => onChange({ filterType })}
      />

      {/* Frequency */}
      <input
        type="number"
        min={20}
        max={20000}
        value={Math.round(band.frequency)}
        onChange={(e) => onChange({ frequency: Number(e.target.value) })}
        onClick={(e) => e.stopPropagation()}
        className="bg-control-bg text-text-primary text-xs px-1.5 py-0.5 rounded w-16 border border-surface-bg focus:border-accent focus:outline-none font-mono text-right"
        aria-label={`Band ${index + 1} frequency`}
      />
      <span className="text-text-dimmed text-xs w-6">{formatFrequency(band.frequency).includes('k') ? 'kHz' : 'Hz'}</span>

      {/* Gain */}
      <input
        type="number"
        min={-15}
        max={15}
        step={0.5}
        value={band.gain}
        onChange={(e) => onChange({ gain: Number(e.target.value) })}
        onClick={(e) => e.stopPropagation()}
        className="bg-control-bg text-text-primary text-xs px-1.5 py-0.5 rounded w-14 border border-surface-bg focus:border-accent focus:outline-none font-mono text-right"
        aria-label={`Band ${index + 1} gain`}
      />
      <span className="text-text-dimmed text-xs">dB</span>

      {/* Q */}
      <input
        type="number"
        min={0.1}
        max={30}
        step={0.1}
        value={band.q}
        onChange={(e) => onChange({ q: Number(e.target.value) })}
        onClick={(e) => e.stopPropagation()}
        className="bg-control-bg text-text-primary text-xs px-1.5 py-0.5 rounded w-14 border border-surface-bg focus:border-accent focus:outline-none font-mono text-right"
        aria-label={`Band ${index + 1} Q`}
      />
      <span className="text-text-dimmed text-xs">Q</span>
    </div>
    </Tooltip>
  );
}
