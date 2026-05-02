import { useEffect, useRef, useState, useCallback } from 'react';
import { useDSPStore } from '../../store/dsp-store';
import { JitterChart } from './JitterChart';
import { DriftChart } from './DriftChart';

const MIN_WIDTH = 300;
const MAX_WIDTH = 1000;
const DEFAULT_WIDTH = 400;

export function SerialConsole() {
  const logs = useDSPStore((s) => s.serialLogs);
  const telemetry = useDSPStore((s) => s.serialTelemetry);
  const telemetryHistory = useDSPStore((s) => s.serialTelemetryHistory);
  const clearLogs = useDSPStore((s) => s.clearSerialLogs);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // Auto-scroll only the log container, not the page. Previously used
  // scrollIntoView() which bubbles up to every scrollable ancestor and
  // dragged the whole page down on each new line.
  useEffect(() => {
    const el = logContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startX.current - ev.clientX;
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta)));
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [width]);

  return (
    <div
      className="glass-panel-strong flex flex-col relative
                 w-full md:w-auto shrink-0 overflow-hidden min-h-0
                 max-h-[50vh] md:max-h-screen h-auto md:h-screen"
      style={{
        borderRadius: 0,
        borderTop: 0,
        borderBottom: 0,
        borderRight: 0,
        ...(typeof window !== 'undefined' && window.innerWidth >= 768 ? { width } : {}),
      }}
    >
      {/* Resize handle (desktop only) */}
      <div
        onMouseDown={onMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/40 active:bg-accent/60 z-10 hidden md:block"
      />

      {/* Drift chart */}
      <div className="border-b border-surface-bg/60">
        <DriftChart history={telemetryHistory} />
      </div>

      {/* Jitter chart */}
      <div className="border-b border-surface-bg/60">
        <JitterChart history={telemetryHistory} />
      </div>

      {/* Log header: section-label + blocks/s + clear */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-surface-bg/60">
        <span className="section-label mr-1">Serial Log</span>
        {telemetry && (
          <span className="pill-badge" style={{ ['--pill-color' as string]: 'var(--color-text-dimmed)', opacity: 0.75 }}>
            <span className="value-mono">{telemetry.blocksProcessed}</span> blk/s
          </span>
        )}
        <button
          onClick={clearLogs}
          className="ml-auto text-xs px-2 py-0.5 rounded bg-control-bg text-text-dimmed border border-surface-bg hover:text-text-primary transition-colors shrink-0"
        >
          Clear
        </button>
      </div>

      {/* Log area — flex-1 + min-h-0 lets the container actually shrink so the
       * overflow-auto kicks in instead of pushing parent past its bounds. */}
      <div ref={logContainerRef} className="flex-1 min-h-0 overflow-auto p-2 font-mono text-[0.7rem] leading-tight text-text-primary">
        {logs.length === 0 ? (
          <span className="text-text-dimmed">Waiting for logs...</span>
        ) : (
          logs.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
