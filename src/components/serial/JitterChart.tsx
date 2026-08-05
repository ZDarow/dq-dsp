import { useTranslation } from 'react-i18next';
import type { DSPTelemetry } from '../../types/serial-protocol';

interface JitterChartProps {
  history: DSPTelemetry[];
}

const CHART_HEIGHT = 140;
const PADDING_TOP = 6;
const PADDING_BOTTOM = 18;
const MAX_POINTS = 60;
const PLOT_HEIGHT = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

const COLOR_AVG = 'var(--color-accent)';
const COLOR_BAND = 'var(--color-accent)';
const COLOR_WARN = 'var(--color-meter-caution)';
const COLOR_DANGER = 'var(--color-mute)';

export function JitterChart({ history }: JitterChartProps) {
  const { t } = useTranslation();
  const empty = history.length === 0;
  const latest = empty ? null : history[history.length - 1];
  const deadlineUs = latest && latest.blocksProcessed > 0
    ? 1_000_000 / latest.blocksProcessed
    : 0;
  const peakLoad = !empty && deadlineUs > 0 ? latest!.dspMaxUs / deadlineUs : 0;
  const loadStatusColor = peakLoad >= 0.9 ? COLOR_DANGER
    : peakLoad >= 0.6 ? COLOR_WARN
    : COLOR_AVG;
  const loadPct = !empty && deadlineUs > 0 ? Math.round((latest!.dspAvgUs / deadlineUs) * 100) : 0;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 px-2 py-1.5 flex-wrap">
        <span className="section-label mr-1">{t('charts.cpuLoad')}</span>
        <span className="pill-badge" style={{ ['--pill-color' as string]: loadStatusColor }}>
          <span className="status-dot" style={{ backgroundColor: loadStatusColor, marginRight: 0 }} />
          Avg <span className="value-mono">{empty ? '--' : `${loadPct}%`}</span>
        </span>
        <span className="pill-badge" style={{ ['--pill-color' as string]: COLOR_BAND, opacity: 0.7 }}>
          <span className="status-dot" style={{ backgroundColor: COLOR_BAND, marginRight: 0 }} />
          Min/Max <span className="value-mono">{empty ? '--' : `${latest!.dspMinUs}/${latest!.dspMaxUs}us`}</span>
        </span>
        <span className="pill-badge" style={{ ['--pill-color' as string]: COLOR_DANGER, opacity: 0.65 }}>
          <span className="status-dot" style={{ backgroundColor: COLOR_DANGER, marginRight: 0 }} />
          Limit <span className="value-mono">{empty ? '--' : `${Math.round(deadlineUs)}us`}</span>
        </span>
      </div>

      {empty ? (
        <div className="flex items-center justify-center h-[6.5rem] text-text-dimmed text-xs font-mono">
          Waiting for telemetry...
        </div>
      ) : (
        <JitterPlot history={history} deadlineUs={deadlineUs} />
      )}
    </div>
  );
}

interface JitterPlotProps {
  history: DSPTelemetry[];
  deadlineUs: number;
}

function JitterPlot({ history, deadlineUs }: JitterPlotProps) {
  const maxVal = Math.max(...history.map((d) => d.dspMaxUs), deadlineUs);
  const yMax = maxVal * 1.15 || 100;

  const toY = (us: number) => PADDING_TOP + PLOT_HEIGHT * (1 - us / yMax);
  const step = history.length > 1 ? 100 / (MAX_POINTS - 1) : 50;
  const xOffset = (MAX_POINTS - history.length) * step;
  const toX = (i: number) => xOffset + i * step;

  // Threshold highlight rects (warn/danger background bands)
  const highlights: { x: number; w: number; color: string }[] = [];
  if (deadlineUs > 0) {
    for (let i = 0; i < history.length; i++) {
      const ratio = history[i].dspMaxUs / deadlineUs;
      if (ratio >= 0.6) {
        const x = toX(i) - step / 2;
        const w = step;
        highlights.push({
          x: Math.max(0, x),
          w: Math.min(100, x + w) - Math.max(0, x),
          color: ratio >= 0.9 ? COLOR_DANGER : COLOR_WARN,
        });
      }
    }
  }

  const bandTop = history.map((d, i) => `${toX(i)},${toY(d.dspMaxUs)}`).join(' ');
  const bandBottom = history.map((d, i) => `${toX(i)},${toY(d.dspMinUs)}`).reverse().join(' ');
  const bandPoints = `${bandTop} ${bandBottom}`;

  const avgPath = history.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.dspAvgUs)}`).join(' ');
  const maxPath = history.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.dspMaxUs)}`).join(' ');
  const minPath = history.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.dspMinUs)}`).join(' ');

  const gridCount = 4;
  const gridLines = Array.from({ length: gridCount }, (_, i) => {
    const us = (yMax / gridCount) * (i + 1);
    return { y: toY(us), label: `${Math.round(us)}us` };
  }).filter((g) => g.y > PADDING_TOP);

  const deadlineY = deadlineUs > 0 ? toY(deadlineUs) : -1;

  // CPU% threshold lines — only the ones that fit in the plot area
  const cpuThresholds = deadlineUs > 0 ? [
    { pct: 0.6, color: COLOR_WARN, label: '60%' },
    { pct: 0.9, color: COLOR_DANGER, label: '90%' },
  ].map((t) => ({ ...t, y: toY(deadlineUs * t.pct) }))
    .filter((t) => t.y >= PADDING_TOP && t.y <= PADDING_TOP + PLOT_HEIGHT)
    : [];

  const deadlineFits = deadlineY >= PADDING_TOP && deadlineY <= PADDING_TOP + PLOT_HEIGHT;

  return (
    <div className="relative" style={{ height: CHART_HEIGHT }}>
      {/* SVG: paths, lines, rects only — no text (preserveAspectRatio=none stretches) */}
      <svg
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
      >
        <defs>
          <clipPath id="jitter-plot">
            <rect x="0" y={PADDING_TOP} width="100" height={PLOT_HEIGHT} />
          </clipPath>
        </defs>

        {gridLines.map((g, i) => (
          <line key={i}
            x1="0" y1={g.y} x2="100" y2={g.y}
            stroke="var(--color-surface-bg)" strokeWidth="0.3"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {highlights.map((h, i) => (
          <rect key={i}
            x={h.x} y={PADDING_TOP} width={h.w} height={PLOT_HEIGHT}
            fill={h.color} opacity="0.1"
            clipPath="url(#jitter-plot)"
          />
        ))}

        {cpuThresholds.map((t) => (
          <line key={t.label}
            x1="0" y1={t.y} x2="100" y2={t.y}
            stroke={t.color} strokeWidth="0.5"
            strokeDasharray="2,2"
            vectorEffect="non-scaling-stroke"
            opacity="0.5"
          />
        ))}

        {deadlineFits && (
          <line
            x1="0" y1={deadlineY} x2="100" y2={deadlineY}
            stroke={COLOR_DANGER} strokeWidth="0.8"
            strokeDasharray="3,2"
            vectorEffect="non-scaling-stroke"
            opacity="0.6"
          />
        )}

        <polygon
          points={bandPoints}
          fill={COLOR_BAND}
          opacity="0.12"
          clipPath="url(#jitter-plot)"
        />
        <path d={minPath} fill="none" stroke={COLOR_BAND} strokeWidth="0.5"
          vectorEffect="non-scaling-stroke" opacity="0.35" clipPath="url(#jitter-plot)" />
        <path d={maxPath} fill="none" stroke={COLOR_BAND} strokeWidth="0.5"
          vectorEffect="non-scaling-stroke" opacity="0.35" clipPath="url(#jitter-plot)" />
        <path d={avgPath} fill="none" stroke={COLOR_AVG} strokeWidth="1.5"
          vectorEffect="non-scaling-stroke" clipPath="url(#jitter-plot)" />

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
        {/* CPU% threshold labels — left edge, just above the line */}
        {cpuThresholds.map((t) => (
          <span key={t.label}
            className="absolute pl-1"
            style={{ top: `${t.y}px`, left: 0, transform: 'translateY(-110%)', color: t.color }}>
            {t.label}
          </span>
        ))}
        {deadlineFits && (
          <span
            className="absolute pl-1"
            style={{ top: `${deadlineY}px`, left: 0, transform: 'translateY(-110%)', color: COLOR_DANGER }}>
            100%
          </span>
        )}

        {/* Y-axis labels (us) — right edge */}
        {gridLines.map((g, i) => (
          <span key={i}
            className="absolute pr-1 text-text-secondary"
            style={{ top: `${g.y}px`, right: 0, transform: 'translateY(-50%)' }}>
            {g.label}
          </span>
        ))}

        {/* X-axis time labels — bottom row */}
        <span className="absolute pl-1 text-text-secondary" style={{ left: 0, bottom: 2 }}>-60s</span>
        <span className="absolute text-text-secondary" style={{ left: '50%', bottom: 2, transform: 'translateX(-50%)' }}>-30s</span>
        <span className="absolute pr-1 text-text-secondary" style={{ right: 0, bottom: 2 }}>now</span>
      </div>
    </div>
  );
}
