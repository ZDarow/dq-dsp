import type { DSPTelemetry } from '../../types/serial-protocol';

interface DriftChartProps {
  history: DSPTelemetry[];
}

const CHART_HEIGHT = 150;
const PADDING_TOP = 6;
const PADDING_BOTTOM = 18;
const MAX_POINTS = 60;
const PLOT_HEIGHT = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

// Theme-aware via CSS vars — palette stays consistent with Response chart.
const COLOR_FILL = 'var(--color-meter-normal)';
const COLOR_PPM = 'var(--color-output-3)';
const COLOR_TARGET = 'var(--color-accent)';
const COLOR_DANGER = 'var(--color-mute)';
const COLOR_WARN = 'var(--color-meter-caution)';

export function DriftChart({ history }: DriftChartProps) {
  const empty = history.length === 0;
  const latest = empty ? null : history[history.length - 1];
  const fill = latest?.bufferFillPct ?? 0;
  const ppm = latest?.correctionPpm ?? 0;
  // When idle (no audio streaming) the firmware reports fill=0; show it
  // as "neutral" instead of red danger.
  const idle = !empty && history.every((d) => d.bufferFillPct < 10);
  const fillStatusColor = idle ? 'var(--color-text-dimmed)'
    : !empty && (fill < 15 || fill > 85) ? COLOR_DANGER
    : !empty && (fill < 25 || fill > 75) ? COLOR_WARN
    : COLOR_FILL;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 px-2 py-1.5 flex-wrap">
        <span className="section-label mr-1">Clock Drift</span>
        <span className="pill-badge" style={{ ['--pill-color' as string]: fillStatusColor }}>
          <span className="status-dot" style={{ backgroundColor: fillStatusColor, marginRight: 0 }} />
          Buf <span className="value-mono">{empty ? '--' : `${fill}%`}</span>
        </span>
        <span className="pill-badge" style={{ ['--pill-color' as string]: COLOR_PPM }}>
          <span className="status-dot" style={{ backgroundColor: COLOR_PPM, marginRight: 0 }} />
          PPM <span className="value-mono">{empty ? '--' : `${ppm >= 0 ? '+' : ''}${ppm.toFixed(1)}`}</span>
        </span>
        <span className="pill-badge" style={{ ['--pill-color' as string]: COLOR_TARGET, opacity: 0.65 }}>
          <span className="status-dot" style={{ backgroundColor: COLOR_TARGET, marginRight: 0 }} />
          Target 50%
        </span>
      </div>

      {empty ? (
        <div className="flex items-center justify-center h-[7rem] text-text-dimmed text-xs font-mono">
          Waiting for drift data...
        </div>
      ) : (
        <DriftPlot history={history} />
      )}
    </div>
  );
}

function DriftPlot({ history }: DriftChartProps) {
  const step = history.length > 1 ? 100 / (MAX_POINTS - 1) : 50;
  const xOffset = (MAX_POINTS - history.length) * step;
  const toX = (i: number) => xOffset + i * step;

  // Buffer fill (left axis: 0..100%)
  const toYFill = (pct: number) => PADDING_TOP + PLOT_HEIGHT * (1 - pct / 100);
  const fillPath = history
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toYFill(d.bufferFillPct)}`)
    .join(' ');
  const fillAreaPath =
    fillPath +
    ` L${toX(history.length - 1)},${PADDING_TOP + PLOT_HEIGHT}` +
    ` L${toX(0)},${PADDING_TOP + PLOT_HEIGHT} Z`;

  // Correction PPM (right axis: auto-scaled, symmetric)
  const ppmValues = history.map((d) => d.correctionPpm);
  const ppmAbsMax = Math.max(Math.abs(Math.min(...ppmValues)), Math.abs(Math.max(...ppmValues)), 10);
  const ppmRange = ppmAbsMax * 1.2;
  const toYPpm = (ppm: number) =>
    PADDING_TOP + PLOT_HEIGHT * (1 - (ppm + ppmRange) / (2 * ppmRange));
  const ppmPath = history
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toYPpm(d.correctionPpm)}`)
    .join(' ');

  // Danger/warn highlights — only when audio is actually streaming.
  // Idle state shows fill=0 across all samples (firmware only updates
  // s_drift_fill_pct inside the resampler path). Treat that as "no signal"
  // rather than "buffer empty danger" so the chart doesn't go fully red.
  const peakFill = history.reduce((m, d) => Math.max(m, d.bufferFillPct), 0);
  const streaming = peakFill >= 10;
  const highlights: { x: number; w: number; color: string }[] = [];
  if (streaming) {
    for (let i = 0; i < history.length; i++) {
      const f = history[i].bufferFillPct;
      if (f < 15 || f > 85) {
        highlights.push({ x: Math.max(0, toX(i) - step / 2), w: step, color: COLOR_DANGER });
      } else if (f < 25 || f > 75) {
        highlights.push({ x: Math.max(0, toX(i) - step / 2), w: step, color: COLOR_WARN });
      }
    }
  }

  const fillGridValues = [25, 50, 75];
  const ppmHi = Math.round(ppmRange * 0.8);

  return (
    <div className="relative" style={{ height: CHART_HEIGHT }}>
      <svg
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
      >
        <defs>
          <clipPath id="drift-plot">
            <rect x="0" y={PADDING_TOP} width="100" height={PLOT_HEIGHT} />
          </clipPath>
        </defs>

        {/* Fill % grid */}
        {fillGridValues.map((pct) => (
          <line key={pct}
            x1="0" y1={toYFill(pct)} x2="100" y2={toYFill(pct)}
            stroke="var(--color-surface-bg)" strokeWidth="0.3"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Danger zone background bands */}
        {highlights.map((h, i) => (
          <rect key={i}
            x={h.x} y={PADDING_TOP} width={h.w} height={PLOT_HEIGHT}
            fill={h.color} opacity="0.08"
            clipPath="url(#drift-plot)"
          />
        ))}

        {/* Target line at 50% */}
        <line
          x1="0" y1={toYFill(50)} x2="100" y2={toYFill(50)}
          stroke={COLOR_TARGET} strokeWidth="0.6"
          strokeDasharray="3,2"
          vectorEffect="non-scaling-stroke"
          opacity="0.45"
        />

        {/* Danger boundaries 15/85% */}
        {[15, 85].map((pct) => (
          <line key={pct}
            x1="0" y1={toYFill(pct)} x2="100" y2={toYFill(pct)}
            stroke={COLOR_DANGER} strokeWidth="0.4"
            strokeDasharray="1,2"
            vectorEffect="non-scaling-stroke"
            opacity="0.4"
          />
        ))}

        {/* PPM zero line */}
        <line
          x1="0" y1={toYPpm(0)} x2="100" y2={toYPpm(0)}
          stroke={COLOR_PPM} strokeWidth="0.4"
          strokeDasharray="2,2"
          vectorEffect="non-scaling-stroke"
          opacity="0.3"
        />

        {/* Buf fill area + line */}
        <path d={fillAreaPath} fill={COLOR_FILL} opacity="0.1" clipPath="url(#drift-plot)" />
        <path d={fillPath} fill="none" stroke={COLOR_FILL} strokeWidth="1.5"
          vectorEffect="non-scaling-stroke" clipPath="url(#drift-plot)" />

        {/* PPM line */}
        <path d={ppmPath} fill="none" stroke={COLOR_PPM} strokeWidth="1.2"
          vectorEffect="non-scaling-stroke" clipPath="url(#drift-plot)" opacity="0.85" />

        {/* X-axis baseline */}
        <line
          x1="0" y1={PADDING_TOP + PLOT_HEIGHT}
          x2="100" y2={PADDING_TOP + PLOT_HEIGHT}
          stroke="var(--color-surface-bg)" strokeWidth="0.4"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* HTML overlay: text labels (not stretched) */}
      <div className="absolute inset-0 pointer-events-none font-mono text-[0.65rem] font-semibold leading-none">
        {/* Left: fill % grid labels */}
        {fillGridValues.map((pct) => (
          <span key={pct}
            className="absolute pl-0.5 text-text-secondary"
            style={{ top: `${toYFill(pct)}px`, left: 0, transform: 'translateY(-50%)' }}>
            {pct}%
          </span>
        ))}

        {/* Left: danger zone labels */}
        <span className="absolute pl-0.5"
          style={{ top: `${toYFill(85)}px`, left: 0, transform: 'translateY(-110%)', color: COLOR_DANGER }}>
          85%
        </span>
        <span className="absolute pl-0.5"
          style={{ top: `${toYFill(15)}px`, left: 0, transform: 'translateY(10%)', color: COLOR_DANGER }}>
          15%
        </span>

        {/* Right: PPM axis labels */}
        <span className="absolute pr-0.5"
          style={{ top: `${toYPpm(ppmHi)}px`, right: 0, transform: 'translateY(-50%)', color: COLOR_PPM }}>
          +{ppmHi}
        </span>
        <span className="absolute pr-0.5"
          style={{ top: `${toYPpm(0)}px`, right: 0, transform: 'translateY(-50%)', color: COLOR_PPM, opacity: 0.7 }}>
          0
        </span>
        <span className="absolute pr-0.5"
          style={{ top: `${toYPpm(-ppmHi)}px`, right: 0, transform: 'translateY(-50%)', color: COLOR_PPM }}>
          −{ppmHi}
        </span>

        {/* X-axis time labels */}
        <span className="absolute pl-0.5 text-text-secondary" style={{ left: 0, bottom: 2 }}>-60s</span>
        <span className="absolute text-text-secondary" style={{ left: '50%', bottom: 2, transform: 'translateX(-50%)' }}>-30s</span>
        <span className="absolute pr-0.5 text-text-secondary" style={{ right: 0, bottom: 2 }}>now</span>
      </div>
    </div>
  );
}
