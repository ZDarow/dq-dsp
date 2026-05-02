import { formatDb } from '../../utils/format';
import { Tooltip } from '../ui/Tooltip';

interface GainSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  color?: string;
}

export function GainSlider({
  value,
  min = -72,
  max = 12,
  step = 0.5,
  onChange,
  label = 'Gain',
  color,
}: GainSliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const isMuted = value <= min;
  const fillColor = isMuted ? 'var(--color-text-dimmed)' : (color || 'var(--color-accent)');

  return (
    <div className="rounded-lg border border-surface-bg bg-panel-bg p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-text-secondary text-xs font-medium">{label}</span>
        <span
          className="text-sm font-mono font-semibold"
          style={{ color: isMuted ? 'var(--color-text-dimmed)' : (color || 'var(--color-text-primary)') }}
        >
          {formatDb(value)}
        </span>
      </div>
      <Tooltip
        content={`${label}: ${formatDb(value)} (range ${min} to ${max} dB). Drag to adjust; bottom of range silences the channel.`}
        wrapperClassName="block"
      >
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="dq-slider"
          style={{
            ['--slider-fill' as string]: pct,
            ['--slider-color' as string]: fillColor,
          }}
          aria-label={`${label} ${formatDb(value)}`}
        />
      </Tooltip>
    </div>
  );
}
