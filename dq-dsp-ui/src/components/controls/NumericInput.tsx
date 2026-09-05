import { Tooltip } from '../ui/Tooltip'

interface NumericInputProps {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  label?: string
  format?: (v: number) => string
  className?: string
}

export function NumericInput({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  format,
  className = '',
}: NumericInputProps) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {label && <label className="text-text-secondary text-xs">{label}</label>}
      <Tooltip content={label ? `${label}: ${value} (range ${min}–${max})` : `Range ${min}–${max}`}>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={format ? format(value) : value}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)))
          }}
          className="bg-control-bg text-text-primary text-xs px-2 py-1 rounded w-20 border border-surface-bg focus:border-accent focus:outline-none font-mono text-right"
          aria-label={label}
        />
      </Tooltip>
    </div>
  )
}
