import { DELAY_MAX_MS } from '../../constants/filter-options';
import { Tooltip } from '../ui/Tooltip';

interface DelayInputProps {
  value: number; // ms
  onChange: (ms: number) => void;
}

export function DelayInput({ value, onChange }: DelayInputProps) {
  return (
    <Tooltip
      content="Output delay in milliseconds. Use to time-align drivers — e.g. delay the tweeter to match a deeper-cone woofer's acoustic centre. 1 ms ≈ 34 cm of distance."
      wrapperClassName="block"
    >
      <div className="flex items-center gap-2">
        <label className="text-text-secondary text-xs w-10">Delay</label>
        <input
          type="number"
          min={0}
          max={DELAY_MAX_MS}
          step={0.001}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!isNaN(v)) onChange(Math.min(Math.max(v, 0), DELAY_MAX_MS));
          }}
          className="flex-1 bg-surface-secondary text-text-primary text-xs font-mono px-2 py-1 rounded border border-border"
          aria-label={`Delay in milliseconds (0 to ${DELAY_MAX_MS})`}
        />
        <span className="text-text-secondary text-xs w-8">ms</span>
      </div>
    </Tooltip>
  );
}
