import { useDSPStore } from '../../store/dsp-store';
import { formatDb } from '../../utils/format';
import { SerialStatusBar } from './SerialStatusBar';
import { PresetManager } from '../preset/PresetManager';
import { Logo } from './Logo';
import { useTheme } from '../../hooks/useTheme';
import { Tooltip } from '../ui/Tooltip';

interface ToolbarProps {
  onAbout: () => void;
}

export function Toolbar({ onAbout }: ToolbarProps) {
  const masterVolume = useDSPStore((s) => s.masterVolume);
  const setMasterVolume = useDSPStore((s) => s.setMasterVolume);
  const sampleRate = useDSPStore((s) => s.sampleRate);
  const resetAll = useDSPStore((s) => s.resetAll);
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-surface-bg/40 flex-wrap gap-y-2 gap-x-4">
      {/* Left group: branding + presets */}
      <div className="flex items-center gap-4">
        <Tooltip content="About DQ-DSP — architecture, pin map, software layout">
          <button
            onClick={onAbout}
            className="rounded transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Open About dialog"
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
          <label className="section-label" style={{ fontSize: '0.65rem' }}>Master</label>
          <Tooltip content={`Master volume: ${formatDb(masterVolume)}. Applied after all per-channel processing — the final dB knob before the DAC.`} wrapperClassName="inline-block">
            <input
              type="range"
              min={-72}
              max={12}
              step={0.5}
              value={masterVolume}
              onChange={(e) => setMasterVolume(Number(e.target.value))}
              className="dq-slider w-28"
              style={{
                ['--slider-fill' as string]: ((masterVolume - (-72)) / (12 - (-72))) * 100,
                ['--slider-color' as string]: masterVolume <= -72 ? 'var(--color-text-dimmed)' : 'var(--color-accent)',
              }}
              aria-label={`Master volume ${formatDb(masterVolume)}`}
            />
          </Tooltip>
          <span className="text-text-primary text-xs w-20 text-right value-mono font-semibold whitespace-nowrap">
            {formatDb(masterVolume)}
          </span>
        </div>

        <Tooltip content="USB device decides sample rate. Change CONFIG_UAC_SAMPLE_RATE in firmware sdkconfig + reflash to set a different value, then macOS Audio MIDI Setup must select it.">
          <div
            className="flex items-center gap-2 border border-surface-bg/50 bg-surface-bg/30 px-3 py-1.5"
            style={{ borderRadius: 'var(--radius-panel)' }}
          >
            <label className="section-label" style={{ fontSize: '0.65rem' }}>Sample Rate</label>
            <span className="text-text-primary text-xs value-mono cursor-default select-none">
              {(sampleRate / 1000).toFixed(1)} kHz
            </span>
          </div>
        </Tooltip>
      </div>

      {/* Right group: connections + theme + actions */}
      <div className="flex items-center gap-4">
        <SerialStatusBar />
        <Tooltip content={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
          <button
            onClick={toggleTheme}
            className="text-xs px-3 py-1 rounded bg-control-bg text-text-secondary hover:text-text-primary border border-surface-bg hover:border-mute transition-colors"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </Tooltip>
        <Tooltip content="Reset all DSP settings (gains, EQ, crossovers, routing, room EQ) back to factory defaults. Does not touch saved presets or device flash.">
          <button
            onClick={resetAll}
            className="text-xs px-3 py-1 rounded bg-control-bg text-text-secondary hover:text-text-primary border border-surface-bg hover:border-mute transition-colors"
          >
            Reset
          </button>
        </Tooltip>
        <Tooltip content="Open the About dialog — architecture, pin diagram, ASRC algorithm, and version info">
          <button
            onClick={onAbout}
            aria-label="About DQ-DSP"
            className="text-xs px-2.5 py-1 rounded bg-control-bg text-text-secondary hover:text-text-primary border border-surface-bg hover:border-accent transition-colors flex items-center gap-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            About
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
