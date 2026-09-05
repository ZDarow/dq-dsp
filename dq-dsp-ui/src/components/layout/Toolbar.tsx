import { useTranslation } from 'react-i18next'
import { useDSPStore } from '../../store/dsp-store'
import { formatDb } from '../../utils/format'
import { SerialStatusBar } from './SerialStatusBar'
import { PresetManager } from '../preset/PresetManager'
import { Logo } from './Logo'
import { useTheme } from '../../hooks/useTheme'
import { Tooltip } from '../ui/Tooltip'
import { SUPPORTED_LANGUAGES, setLanguage } from '../../i18n'

interface ToolbarProps {
  onAbout: () => void
}

export function Toolbar({ onAbout }: ToolbarProps) {
  const { t, i18n } = useTranslation()
  const masterVolume = useDSPStore((s) => s.masterVolume)
  const setMasterVolume = useDSPStore((s) => s.setMasterVolume)
  const sampleRate = useDSPStore((s) => s.sampleRate)
  const resetAll = useDSPStore((s) => s.resetAll)
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-surface-bg/40 flex-wrap gap-y-2 gap-x-4">
      {/* Left group: branding + presets */}
      <div className="flex items-center gap-4">
        <Tooltip content={t('toolbar.aboutLogoTooltip')}>
          <button
            onClick={onAbout}
            className="rounded transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={t('toolbar.aboutAria')}
          >
            <Logo />
          </button>
        </Tooltip>
        <PresetManager />
      </div>

      {/* Center group: master volume + sample rate */}
      <div className="flex items-center gap-4">
        <div
          className="flex items-center gap-2 border border-surface-bg/50 bg-surface-bg/30 px-3 py-1.5"
          style={{ borderRadius: 'var(--radius-panel)' }}
        >
          <label className="section-label" style={{ fontSize: '0.65rem' }}>
            {t('toolbar.master')}
          </label>
          <Tooltip
            content={t('toolbar.masterTooltip', { value: formatDb(masterVolume) })}
            wrapperClassName="inline-block"
          >
            <input
              type="range"
              min={-72}
              max={12}
              step={0.5}
              value={masterVolume}
              onChange={(e) => setMasterVolume(Number(e.target.value))}
              className="dq-slider w-28"
              style={{
                ['--slider-fill' as string]: ((masterVolume - -72) / (12 - -72)) * 100,
                ['--slider-color' as string]:
                  masterVolume <= -72 ? 'var(--color-text-dimmed)' : 'var(--color-accent)',
              }}
              aria-label={t('toolbar.masterTooltip', { value: formatDb(masterVolume) })}
            />
          </Tooltip>
          <span className="text-text-primary text-xs w-20 text-right value-mono font-semibold whitespace-nowrap">
            {formatDb(masterVolume)}
          </span>
        </div>

        <Tooltip content={t('toolbar.sampleRateTooltip')}>
          <div
            className="flex items-center gap-2 border border-surface-bg/50 bg-surface-bg/30 px-3 py-1.5"
            style={{ borderRadius: 'var(--radius-panel)' }}
          >
            <label className="section-label" style={{ fontSize: '0.65rem' }}>
              {t('toolbar.sampleRate')}
            </label>
            <span className="text-text-primary text-xs value-mono cursor-default select-none">
              {(sampleRate / 1000).toFixed(1)} kHz
            </span>
          </div>
        </Tooltip>
      </div>

      {/* Right group: connections + theme + actions */}
      <div className="flex items-center gap-4">
        <SerialStatusBar />
        <Tooltip
          content={t('toolbar.themeTooltip', { theme: theme === 'dark' ? 'light' : 'dark' })}
        >
          <button
            onClick={toggleTheme}
            className="text-xs px-3 py-1 rounded bg-control-bg text-text-secondary hover:text-text-primary border border-surface-bg hover:border-mute transition-colors"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </Tooltip>
        <Tooltip content={t('toolbar.resetTooltip')}>
          <button
            onClick={resetAll}
            className="text-xs px-3 py-1 rounded bg-control-bg text-text-secondary hover:text-text-primary border border-surface-bg hover:border-mute transition-colors"
          >
            {t('common.reset')}
          </button>
        </Tooltip>
        <select
          aria-label={t('toolbar.language')}
          value={i18n.language}
          onChange={(e) =>
            setLanguage(e.target.value as (typeof SUPPORTED_LANGUAGES)[number]['code'])
          }
          className="text-xs px-2 py-1 rounded bg-control-bg text-text-secondary hover:text-text-primary border border-surface-bg hover:border-mute transition-colors cursor-pointer"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
        <Tooltip content={t('toolbar.aboutTooltip')}>
          <button
            onClick={onAbout}
            aria-label={t('toolbar.aboutAria')}
            className="text-xs px-2.5 py-1 rounded bg-control-bg text-text-secondary hover:text-text-primary border border-surface-bg hover:border-accent transition-colors flex items-center gap-1"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            {t('common.about')}
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
