import type { CrosspointGain } from '../../types/dsp';
import { Tooltip } from '../ui/Tooltip';

interface CrosspointCellProps {
  crosspoint: CrosspointGain;
  inputIndex: number;
  outputIndex: number;
  inputColor: string;
  outputColor: string;
  onToggle: () => void;
  onGainChange: (gain: number) => void;
}

export function CrosspointCell({
  crosspoint,
  inputIndex,
  outputIndex,
  outputColor,
  onToggle,
  onGainChange,
}: CrosspointCellProps) {
  const routeLabel = `Input ${inputIndex + 1} → Output ${outputIndex + 1}`;
  const tooltip = crosspoint.enabled
    ? `${routeLabel} routed at ${Math.round(crosspoint.gain * 100)}%. Click cell to mute this route; drag the slider for partial mix (e.g. 50/50 mono blend).`
    : `${routeLabel} disabled. Click to enable routing — input audio will mix into this output channel.`;
  return (
    <Tooltip content={tooltip} wrapperClassName="block">
    <div
      className={`flex flex-col items-center gap-3 p-2 rounded border transition-colors cursor-pointer ${
        crosspoint.enabled
          ? 'bg-surface-bg border-accent'
          : 'bg-panel-bg border-control-bg hover:border-surface-bg'
      }`}
      onClick={onToggle}
      role="button"
      aria-pressed={crosspoint.enabled}
      aria-label={routeLabel}
    >
      {/* Connection indicator */}
      <div
        className="w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all"
        style={{
          borderColor: crosspoint.enabled ? outputColor : '#333',
          backgroundColor: crosspoint.enabled ? outputColor + '30' : 'transparent',
        }}
      >
        {crosspoint.enabled && (
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: outputColor }} />
        )}
      </div>

      {/* Gain control (only shown when enabled) */}
      {crosspoint.enabled && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={crosspoint.gain}
          onChange={(e) => {
            e.stopPropagation();
            onGainChange(Number(e.target.value));
          }}
          onClick={(e) => e.stopPropagation()}
          className="dq-slider w-14"
          style={{
            ['--slider-fill' as string]: crosspoint.gain * 100,
            ['--slider-color' as string]: outputColor,
          }}
          aria-label={`${routeLabel} gain`}
        />
      )}

      {crosspoint.enabled && (
        <span className="text-xs text-text-dimmed font-mono">
          {Math.round(crosspoint.gain * 100)}%
        </span>
      )}
    </div>
    </Tooltip>
  );
}
