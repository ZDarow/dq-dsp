import { useTranslation } from 'react-i18next'
import type { CrossoverConfig, CrossoverFilterType, CrossoverSlope } from '../../types/filter'
import { CROSSOVER_TYPES, CROSSOVER_SLOPES } from '../../constants/filter-options'
import { Tooltip } from '../ui/Tooltip'

interface CrossoverPanelProps {
  crossover: CrossoverConfig
  onHPChange: (updates: {
    enabled?: boolean
    filterType?: CrossoverFilterType
    slope?: CrossoverSlope
    frequency?: number
  }) => void
  onLPChange: (updates: {
    enabled?: boolean
    filterType?: CrossoverFilterType
    slope?: CrossoverSlope
    frequency?: number
  }) => void
  color: string
}

function FilterSection({
  label,
  filter,
  onChange,
  color,
  longName,
  description,
}: {
  label: string
  filter: CrossoverConfig['highPass']
  onChange: (updates: Record<string, unknown>) => void
  color: string
  longName: string
  description: string
}) {
  const { t } = useTranslation()
  return (
    <Tooltip content={description} wrapperClassName="block">
      <div className="flex items-center gap-2 p-2 rounded bg-panel-bg">
        <input
          type="checkbox"
          checked={filter.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          style={{ accentColor: color }}
          aria-label={t('crossover.enable', { name: longName })}
        />
        <span
          className="text-xs font-bold w-6"
          style={{ color: filter.enabled ? color : '#55556a' }}
        >
          {label}
        </span>

        <select
          value={filter.filterType}
          onChange={(e) => onChange({ filterType: e.target.value })}
          disabled={!filter.enabled}
          className="bg-control-bg text-text-primary text-xs px-1.5 py-0.5 rounded border border-surface-bg focus:border-accent focus:outline-none disabled:opacity-40"
        >
          {CROSSOVER_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey)}
            </option>
          ))}
        </select>

        <select
          value={filter.slope}
          onChange={(e) => onChange({ slope: Number(e.target.value) })}
          disabled={!filter.enabled}
          className="bg-control-bg text-text-primary text-xs px-1.5 py-0.5 rounded border border-surface-bg focus:border-accent focus:outline-none disabled:opacity-40"
        >
          {CROSSOVER_SLOPES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <input
          type="number"
          min={20}
          max={20000}
          value={Math.round(filter.frequency)}
          onChange={(e) => onChange({ frequency: Number(e.target.value) })}
          disabled={!filter.enabled}
          className="bg-control-bg text-text-primary text-xs px-1.5 py-0.5 rounded w-16 border border-surface-bg focus:border-accent focus:outline-none font-mono text-right disabled:opacity-40"
        />
        <span className="text-text-dimmed text-xs">Hz</span>
      </div>
    </Tooltip>
  )
}

export function CrossoverPanel({ crossover, onHPChange, onLPChange, color }: CrossoverPanelProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1">
      <Tooltip content={t('crossover.titleTooltip')}>
        <h4 className="text-xs text-text-secondary">{t('crossover.title')}</h4>
      </Tooltip>
      <FilterSection
        label={t('crossover.hp')}
        filter={crossover.highPass}
        onChange={onHPChange}
        color={color}
        longName={t('crossover.hpLong')}
        description={t('crossover.hpDesc')}
      />
      <FilterSection
        label={t('crossover.lp')}
        filter={crossover.lowPass}
        onChange={onLPChange}
        color={color}
        longName={t('crossover.lpLong')}
        description={t('crossover.lpDesc')}
      />
    </div>
  )
}
