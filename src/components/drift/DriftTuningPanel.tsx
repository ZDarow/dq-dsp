import { useDSPStore } from '../../store/dsp-store';
import { DEFAULT_DRIFT } from '../../store/slices/drift-slice';
import { Tooltip } from '../ui/Tooltip';

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
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const display = format ? format(value) : String(value);
  const tooltip = `${label}: ${display} (range ${min}–${max})${hint ? ` — ${hint}` : ''}`;
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
  );
}

export function DriftTuningPanel() {
  const drift = useDSPStore((s) => s.drift);
  const setKp = useDSPStore((s) => s.setDriftKp);
  const setKi = useDSPStore((s) => s.setDriftKi);
  const setTarget = useDSPStore((s) => s.setDriftTargetFill);
  const setMaxPpm = useDSPStore((s) => s.setDriftMaxPpm);

  const handleReset = () => {
    setKp(DEFAULT_DRIFT.kp);
    setKi(DEFAULT_DRIFT.ki);
    setTarget(DEFAULT_DRIFT.targetFill);
    setMaxPpm(DEFAULT_DRIFT.maxPpm);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-text-primary text-sm font-medium">Drift Compensation (ASRC)</h3>
        <Tooltip content="Restore Kp, Ki, Target fill, and Max PPM to factory defaults — a safe starting point if tuning has gone unstable.">
          <button
            onClick={handleReset}
            className="text-xs text-text-dimmed hover:text-accent px-2 py-1 rounded border border-surface-bg hover:border-accent transition-colors"
          >
            Reset to defaults
          </button>
        </Tooltip>
      </div>

      {/* Tuning guide */}
      <div className="text-xs text-text-secondary bg-surface-bg rounded-lg p-3 space-y-2">
        <p>
          The USB host and ESP32 I2S clocks run independently and drift apart over time.
          A PI controller monitors the ring buffer fill level and adjusts the ASRC resampling
          ratio to keep them in sync. When tuning is off, audio glitches (clicks/pops) appear
          after several minutes.
        </p>
        <div className="space-y-1">
          <p className="text-text-primary font-medium">How to tune</p>
          <ul className="list-disc list-inside space-y-0.5 text-text-dimmed">
            <li>
              <span className="text-text-secondary">Kp</span> &mdash; Proportional gain. Reacts to how far the buffer
              fill is from the target right now. Higher = faster response but can overshoot and
              oscillate. Start low (0.1) and increase until the buffer stabilizes quickly.
            </li>
            <li>
              <span className="text-text-secondary">Ki</span> &mdash; Integral gain. Corrects steady-state drift that Kp
              alone can't eliminate. Too high causes slow oscillation. Increase in small steps
              (0.01) until the buffer stays centered without wandering.
            </li>
            <li>
              <span className="text-text-secondary">Target fill</span> &mdash; The desired ring buffer fill level. 50%
              gives equal headroom for both directions of drift. Lower values reduce latency but
              leave less margin for USB bursts.
            </li>
            <li>
              <span className="text-text-secondary">Max PPM</span> &mdash; Clamps the maximum correction. PPM = parts
              per million: at 48 kHz, 100 PPM means the effective sample rate shifts by
              ~4.8 Hz (48000 &times; 0.0001). Typical USB/I2S drift is 20&ndash;50 PPM. Set this
              just high enough to cover your actual drift &mdash; too high allows the controller
              to make unnecessarily large corrections.
            </li>
          </ul>
        </div>
        <div className="space-y-1">
          <p className="text-text-primary font-medium">If you hear clicks after 5&ndash;10 min</p>
          <ol className="list-decimal list-inside space-y-0.5 text-text-dimmed">
            <li>Try lowering Kp to 0.1 and Ki to 0.01 &mdash; aggressive gains can cause the
              ratio to jump, producing micro-glitches.</li>
            <li>Reduce Max PPM to 50&ndash;100 to limit correction magnitude.</li>
            <li>If the buffer slowly drifts to 0% or 100% and then glitches, increase Ki slightly
              to improve steady-state tracking.</li>
            <li>Watch the serial console for buffer fill % &mdash; it should hover near the target
              without large swings.</li>
          </ol>
        </div>
      </div>

      <div className="space-y-2">
        <SliderRow
          label="Kp (prop.)"
          value={drift.kp}
          min={0}
          max={2}
          step={0.01}
          onChange={setKp}
          format={(v) => v.toFixed(2)}
          hint="Proportional gain. Reacts to current buffer offset. Higher = faster response, risk of overshoot. Start at 0.1–0.3."
        />
        <SliderRow
          label="Ki (integral)"
          value={drift.ki}
          min={0}
          max={0.5}
          step={0.005}
          onChange={setKi}
          format={(v) => v.toFixed(3)}
          hint="Integral gain. Eliminates steady-state drift Kp can't fix. Too high causes slow oscillation. 0.01–0.05 is typical."
        />
        <SliderRow
          label="Target fill"
          value={drift.targetFill}
          min={0.1}
          max={0.9}
          step={0.01}
          onChange={setTarget}
          format={(v) => `${(v * 100).toFixed(0)}%`}
          hint="Desired ring buffer fill. 50% gives equal headroom in both directions. Lower = less latency but tighter underrun margin."
        />
        <SliderRow
          label="Max PPM"
          value={drift.maxPpm}
          min={10}
          max={2000}
          step={10}
          onChange={setMaxPpm}
          format={(v) => `${v}`}
          hint="Clamp on the resampling correction. Typical USB↔I2S drift is 20–50 PPM; set just enough to cover yours."
        />
      </div>
    </div>
  );
}
