import { useCallback, useRef } from 'react';

interface KnobProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label: string;
  formatValue?: (v: number) => string;
  size?: number;
  color?: string;
}

export function Knob({
  value,
  min,
  max,
  step = 0.1,
  onChange,
  label,
  formatValue = (v) => v.toFixed(1),
  size = 64,
  color = '#4466ff',
}: KnobProps) {
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);

  const normalizedValue = (value - min) / (max - min);
  const angle = -135 + normalizedValue * 270;
  const radius = size / 2 - 4;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startValue: value };
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
    },
    [value],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dy = dragRef.current.startY - e.clientY;
      const range = max - min;
      const sensitivity = range / 150;
      let newValue = dragRef.current.startValue + dy * sensitivity;
      newValue = Math.round(newValue / step) * step;
      newValue = Math.min(max, Math.max(min, newValue));
      onChange(newValue);
    },
    [min, max, step, onChange],
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const cx = size / 2;
  const cy = size / 2;
  const rad = (angle * Math.PI) / 180;
  const indicatorX = cx + Math.cos(rad) * (radius - 6);
  const indicatorY = cy + Math.sin(rad) * (radius - 6);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg
        width={size}
        height={size}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ cursor: 'ns-resize', touchAction: 'none' }}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={formatValue(value)}
      >
        <title>{`${label}: ${formatValue(value)} (range ${formatValue(min)}–${formatValue(max)}). Drag up/down to adjust.`}</title>
        {/* Track */}
        <circle cx={cx} cy={cy} r={radius} fill="#1a1a26" stroke="#222233" strokeWidth={2} />
        {/* Indicator line */}
        <line
          x1={cx}
          y1={cy}
          x2={indicatorX}
          y2={indicatorY}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Center dot */}
        <circle cx={cx} cy={cy} r={3} fill={color} />
      </svg>
      <span className="text-text-primary text-xs font-mono">{formatValue(value)}</span>
      <span className="text-text-dimmed text-xs">{label}</span>
    </div>
  );
}
