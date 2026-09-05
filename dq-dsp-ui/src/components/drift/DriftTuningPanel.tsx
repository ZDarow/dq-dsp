import { useTranslation } from 'react-i18next'
import { useDSPStore } from '../../store/dsp-store'
import { DEFAULT_DRIFT } from '../../store/slices/drift-slice'
import { Tooltip } from '../ui/Tooltip'

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  hint,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format?: (v: number) => string
  hint?: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  const display = format ? format(value) : String(value)
  const tooltip = `${label}: ${display} (range ${min}–${max})${hint ? ` — ${hint}` : ''}`
  return (
    <Tooltip content={tooltip} wrapperClassName="block">
      <div className="rounded-lg border border-surface-bg bg-panel-bg p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-text-secondary text-xs font-medium">{label}</span>
          <span className="text-sm font-mono font-semibold text-accent">{display}</span>
        </div>
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
            ['--slider-color' as string]: 'var(--color-accent)',
          }}
          aria-label={label}
        />
      </div>
    </Tooltip>
  )
}

export function DriftTuningPanel() {
  const { t } = useTranslation()
  const drift = useDSPStore((s) => s.drift)
  const setKp = useDSPStore((s) => s.setDriftKp)
  const setKi = useDSPStore((s) => s.setDriftKi)
  const setTarget = useDSPStore((s) => s.setDriftTargetFill)
  const setMaxPpm = useDSPStore((s) => s.setDriftMaxPpm)

  const handleReset = () => {
    setKp(DEFAULT_DRIFT.kp)
    setKi(DEFAULT_DRIFT.ki)
    setTarget(DEFAULT_DRIFT.targetFill)
    setMaxPpm(DEFAULT_DRIFT.maxPpm)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-text-primary text-sm font-medium">{t('drift.title')}</h3>
        <Tooltip content={t('drift.resetTooltip')}>
          <button
            onClick={handleReset}
            className="text-xs text-text-dimmed hover:text-accent px-2 py-1 rounded border border-surface-bg hover:border-accent transition-colors"
          >
            {t('drift.resetDefaults')}
          </button>
        </Tooltip>
      </div>

      {/* Tuning guide */}
      <div className="text-xs text-text-secondary bg-surface-bg rounded-lg p-3 space-y-2">
        <p>{t('drift.intro')}</p>
        <div className="space-y-1">
          <p className="text-text-primary font-medium">{t('drift.howToTune')}</p>
          <ul className="list-disc list-inside space-y-0.5 text-text-dimmed">
            <li>
              <span className="text-text-secondary">{t('drift.kp')}</span> &mdash;{' '}
              {t('drift.kpDesc')}
            </li>
            <li>
              <span className="text-text-secondary">{t('drift.ki')}</span> &mdash;{' '}
              {t('drift.kiDesc')}
            </li>
            <li>
              <span className="text-text-secondary">{t('drift.targetFill')}</span> &mdash;{' '}
              {t('drift.targetDesc')}
            </li>
            <li>
              <span className="text-text-secondary">{t('drift.maxPpm')}</span> &mdash;{' '}
              {t('drift.maxPpmDesc')}
            </li>
          </ul>
        </div>
        <div className="space-y-1">
          <p className="text-text-primary font-medium">{t('drift.clicksTitle')}</p>
          <ol className="list-decimal list-inside space-y-0.5 text-text-dimmed">
            <li>{t('drift.clicks1')}</li>
            <li>{t('drift.clicks2')}</li>
            <li>{t('drift.clicks3')}</li>
            <li>{t('drift.clicks4')}</li>
          </ol>
        </div>
      </div>

      <div className="space-y-2">
        <SliderRow
          label={t('drift.kp')}
          value={drift.kp}
          min={0}
          max={2}
          step={0.01}
          onChange={setKp}
          format={(v) => v.toFixed(2)}
          hint={t('drift.kpHint')}
        />
        <SliderRow
          label={t('drift.ki')}
          value={drift.ki}
          min={0}
          max={0.5}
          step={0.005}
          onChange={setKi}
          format={(v) => v.toFixed(3)}
          hint={t('drift.kiHint')}
        />
        <SliderRow
          label={t('drift.targetFill')}
          value={drift.targetFill}
          min={0.1}
          max={0.9}
          step={0.01}
          onChange={setTarget}
          format={(v) => `${(v * 100).toFixed(0)}%`}
          hint={t('drift.targetHint')}
        />
        <SliderRow
          label={t('drift.maxPpm')}
          value={drift.maxPpm}
          min={10}
          max={2000}
          step={10}
          onChange={setMaxPpm}
          format={(v) => `${v}`}
          hint={t('drift.maxPpmHint')}
        />
      </div>
    </div>
  )
}
