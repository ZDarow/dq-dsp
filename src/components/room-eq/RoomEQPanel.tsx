import { useState, useCallback, useRef, useMemo } from 'react';
import { useDSPStore } from '../../store/dsp-store';
import { RoomEQChart } from './RoomEQChart';
import { FREQUENCY_RANGE } from '../../constants/filter-options';
import type { EQBand } from '../../types/filter';
import { PEQEditor } from '../eq/PEQEditor';
import { computeAutoEQ } from '../../utils/auto-eq';
import { generateFrequencyPoints } from '../../dsp/frequency-response';
import { smoothOctave } from '../../utils/smoothing';
import { flatTarget, harmanTarget, tiltTarget } from '../../utils/target-curves';
import { Tooltip } from '../ui/Tooltip';

const REW_EXPORT_HELP = (
  <div className="space-y-1.5">
    <div className="font-semibold text-text-primary">Import a REW measurement (.txt)</div>
    <div className="text-text-secondary">
      Drop or pick a frequency-response file exported from{' '}
      <span className="value-mono">Room EQ Wizard</span>. We apply our own smoothing here in the UI,
      so export the raw response — don't pre-smooth in REW.
    </div>
    <div className="font-semibold text-text-primary mt-2">How to export from REW</div>
    <ol className="list-decimal list-inside text-text-secondary space-y-0.5">
      <li>Take a measurement (sweep) in REW.</li>
      <li>Open the SPL graph — leave smoothing at <span className="value-mono">None</span>.</li>
      <li>
        <span className="value-mono">File → Export → Export measurement as text</span>.
      </li>
      <li>
        <strong>Un-tick</strong>{' '}
        <span className="value-mono">Use REW measurement smoothing</span>; leave the delimiter as
        space/tab.
      </li>
      <li>Save the .txt and drop it here — pick smoothing (1/3 – 1/24) in the toolbar.</li>
    </ol>
  </div>
);

const SMOOTHING_OPTIONS = [3, 6, 12, 24] as const;
const TARGET_OPTIONS = ['flat', 'harman', 'tilt'] as const;

export function RoomEQPanel() {
  const [inputIndex, setInputIndex] = useState(0);

  const roomMeasurement = useDSPStore((s) => s.roomMeasurement);
  const roomSmoothing = useDSPStore((s) => s.roomSmoothing);
  const roomTargetCurve = useDSPStore((s) => s.roomTargetCurve);
  const roomTiltSlope = useDSPStore((s) => s.roomTiltSlope);
  const roomEqBands = useDSPStore((s) => s.roomEqBands[inputIndex]);
  const importRoomMeasurement = useDSPStore((s) => s.importRoomMeasurement);
  const clearRoomMeasurement = useDSPStore((s) => s.clearRoomMeasurement);
  const setRoomSmoothing = useDSPStore((s) => s.setRoomSmoothing);
  const setRoomTargetCurve = useDSPStore((s) => s.setRoomTargetCurve);
  const setRoomTiltSlope = useDSPStore((s) => s.setRoomTiltSlope);
  const setRoomEQBand = useDSPStore((s) => s.setRoomEQBand);
  // toggleRoomEQBand handled by PEQEditor via onBandChange
  const roomLinked = useDSPStore((s) => s.roomLinked);
  const setRoomLinked = useDSPStore((s) => s.setRoomLinked);
  const roomEqEnabled = useDSPStore((s) => s.roomEqEnabled);
  const setRoomEqEnabled = useDSPStore((s) => s.setRoomEqEnabled);
  const sampleRate = useDSPStore((s) => s.sampleRate);

  const [autoMaxGain, setAutoMaxGain] = useState(6);
  const [autoMinGain, setAutoMinGain] = useState(-12);
  const [autoMaxQ, setAutoMaxQ] = useState(8);
  const [autoNumBands, setAutoNumBands] = useState(10);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const frequencies = useMemo(
    () => generateFrequencyPoints(FREQUENCY_RANGE.min, FREQUENCY_RANGE.max, 256),
    [],
  );

  const handleAutoEQ = useCallback(() => {
    if (!roomMeasurement) return;
    const smoothed = smoothOctave(roomMeasurement, roomSmoothing);
    let targetVals: number[];
    switch (roomTargetCurve) {
      case 'harman': targetVals = harmanTarget(frequencies); break;
      case 'tilt': targetVals = tiltTarget(frequencies, roomTiltSlope); break;
      default: targetVals = flatTarget(frequencies);
    }
    const bands = computeAutoEQ(smoothed, targetVals, frequencies, sampleRate, {
      maxGainDb: autoMaxGain,
      minGainDb: autoMinGain,
      maxQ: autoMaxQ,
      numBands: autoNumBands,
    });
    // Apply to current input (and linked if enabled)
    for (let b = 0; b < bands.length; b++) {
      setRoomEQBand(inputIndex, b, bands[b]);
    }
  }, [roomMeasurement, roomSmoothing, roomTargetCurve, roomTiltSlope, frequencies, sampleRate,
      autoMaxGain, autoMinGain, autoMaxQ, autoNumBands, inputIndex, setRoomEQBand]);

  const handleFileLoad = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) importRoomMeasurement(text);
    };
    reader.readAsText(file);
  }, [importRoomMeasurement]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileLoad(file);
    // Reset so re-selecting the same file triggers onChange
    e.target.value = '';
  }, [handleFileLoad]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileLoad(file);
  }, [handleFileLoad]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  return (
    <div className="p-4 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Room EQ</h2>
        <div className="flex items-center gap-2">
          {/* Link L/R toggle */}
          <Tooltip content="Mirror Room EQ band edits between Input 1 and Input 2 — useful when both speakers sit in similar room positions and need the same correction.">
            <button
              onClick={() => setRoomLinked(!roomLinked)}
              className="px-3 py-1 text-xs font-medium rounded border transition-colors"
              style={{
                borderColor: roomLinked ? 'var(--color-chart-eq)' : 'var(--color-surface-bg)',
                backgroundColor: roomLinked ? 'color-mix(in srgb, var(--color-chart-eq) 20%, transparent)' : 'transparent',
                color: roomLinked ? 'var(--color-chart-eq)' : 'var(--color-text-dimmed)',
              }}
            >
              Link L/R
            </button>
          </Tooltip>

          {/* Channel selector */}
          <div className="flex rounded overflow-hidden border border-surface-bg">
            {[0, 1].map((idx) => (
              <Tooltip key={idx} content={`Edit Room EQ for Input ${idx + 1}. Each input has its own 10-band Room EQ stage applied before the per-output PEQ.`}>
                <button
                  onClick={() => setInputIndex(idx)}
                  className="px-3 py-1 text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: inputIndex === idx ? 'var(--color-accent)' + '30' : 'transparent',
                    color: inputIndex === idx ? 'var(--color-accent)' : 'var(--color-text-dimmed)',
                  }}
                >
                  Input {idx + 1}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>

      {/* Import / Controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* File import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          onChange={handleFileChange}
          className="hidden"
        />
        <Tooltip content={REW_EXPORT_HELP} maxWidth="22rem">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-xs font-medium rounded border border-surface-bg bg-panel-bg
                       hover:bg-surface-bg transition-colors text-text-secondary"
          >
            Import REW
          </button>
        </Tooltip>
        {roomMeasurement && (
          <Tooltip content="Discard the loaded measurement (does not change EQ band settings).">
            <button
              onClick={clearRoomMeasurement}
              className="px-3 py-1.5 text-xs font-medium rounded border border-surface-bg
                         hover:bg-surface-bg transition-colors text-text-dimmed"
            >
              Clear
            </button>
          </Tooltip>
        )}

        {/* Smoothing */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-text-dimmed uppercase tracking-wider">Smooth</span>
          {SMOOTHING_OPTIONS.map((n) => (
            <Tooltip key={n} content={`Apply 1/${n}-octave smoothing to the measurement. Coarser smoothing (1/3) hides narrow room nulls; finer (1/24) keeps detail. 1/6 is a common starting point.`}>
              <button
                onClick={() => setRoomSmoothing(n)}
                className="px-2 py-0.5 text-sm rounded border transition-colors"
                style={{
                  borderColor: roomSmoothing === n ? 'var(--color-accent)' : 'var(--color-surface-bg)',
                  backgroundColor: roomSmoothing === n ? 'var(--color-accent)' + '20' : 'transparent',
                  color: roomSmoothing === n ? 'var(--color-accent)' : 'var(--color-text-dimmed)',
                }}
              >
                1/{n}
              </button>
            </Tooltip>
          ))}
        </div>

        {/* Target curve */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-text-dimmed uppercase tracking-wider">Target</span>
          {TARGET_OPTIONS.map((t) => {
            const help =
              t === 'flat' ? 'Flat target — aim for ruler-flat in-room response. Best for analytical near-field listening.'
              : t === 'harman' ? 'Harman curve — research-backed in-room target with gentle bass shelf and high-frequency tilt that listeners prefer in blind tests.'
              : 'Tilt target — straight-line slope (negative dB per octave) from low to high. Adjust the slope slider to taste.';
            return (
              <Tooltip key={t} content={help}>
                <button
                  onClick={() => setRoomTargetCurve(t)}
                  className="px-2 py-0.5 text-sm rounded border transition-colors capitalize"
                  style={{
                    borderColor: roomTargetCurve === t ? '#ff8844' : 'var(--color-surface-bg)',
                    backgroundColor: roomTargetCurve === t ? '#ff884420' : 'transparent',
                    color: roomTargetCurve === t ? '#ff8844' : 'var(--color-text-dimmed)',
                  }}
                >
                  {t}
                </button>
              </Tooltip>
            );
          })}
          {roomTargetCurve === 'tilt' && (
            <Tooltip content={`Tilt slope ${roomTiltSlope.toFixed(1)} dB/oct — drag to taste`} wrapperClassName="inline-block">
              <input
                type="range"
                min={-3}
                max={0}
                step={0.1}
                value={roomTiltSlope}
                onChange={(e) => setRoomTiltSlope(parseFloat(e.target.value))}
                className="dq-slider w-20"
                style={{
                  ['--slider-fill' as string]: ((roomTiltSlope - (-3)) / (0 - (-3))) * 100,
                  ['--slider-color' as string]: '#ff8844',
                }}
                aria-label="Tilt target slope"
              />
            </Tooltip>
          )}
        </div>
      </div>

      {/* Auto EQ controls */}
      {roomMeasurement && (
        <div className="flex items-center gap-3 flex-wrap bg-panel-bg/50 rounded px-3 py-2 border border-surface-bg">
          <span className="text-xs text-text-dimmed uppercase tracking-wider">Auto EQ</span>

          <Tooltip content="Maximum number of EQ bands to allocate. Fewer = smoother, more transparent; more = tighter fit but risk of over-correction.">
            <div className="flex items-center gap-1">
              <span className="text-xs text-text-dimmed">Bands</span>
              <input type="number" min={1} max={10} value={autoNumBands}
                onChange={(e) => setAutoNumBands(Math.max(1, Math.min(10, parseInt(e.target.value) || 10)))}
                className="w-10 bg-transparent border border-surface-bg rounded px-1 py-0.5 text-xs text-text-secondary text-center font-mono focus:border-accent focus:outline-none"
                aria-label="Number of EQ bands" />
            </div>
          </Tooltip>

          <Tooltip content="Maximum allowed cut in dB. The auto-EQ never digs deeper than this — useful to keep room nulls (which can't be EQ'd out anyway) from monopolizing the bands.">
            <div className="flex items-center gap-1">
              <span className="text-xs text-text-dimmed">Cut</span>
              <input type="number" min={-24} max={0} step={1} value={autoMinGain}
                onChange={(e) => setAutoMinGain(Math.max(-24, Math.min(0, parseFloat(e.target.value) || -12)))}
                className="w-12 bg-transparent border border-surface-bg rounded px-1 py-0.5 text-xs text-text-secondary text-center font-mono focus:border-accent focus:outline-none"
                aria-label="Maximum cut in dB" />
              <span className="text-xs text-text-dimmed">dB</span>
            </div>
          </Tooltip>

          <Tooltip content="Maximum allowed boost in dB. Boosting deep room nulls usually wastes headroom — keep this conservative (≤6 dB).">
            <div className="flex items-center gap-1">
              <span className="text-xs text-text-dimmed">Boost</span>
              <input type="number" min={0} max={15} step={1} value={autoMaxGain}
                onChange={(e) => setAutoMaxGain(Math.max(0, Math.min(15, parseFloat(e.target.value) || 6)))}
                className="w-12 bg-transparent border border-surface-bg rounded px-1 py-0.5 text-xs text-text-secondary text-center font-mono focus:border-accent focus:outline-none"
                aria-label="Maximum boost in dB" />
              <span className="text-xs text-text-dimmed">dB</span>
            </div>
          </Tooltip>

          <Tooltip content="Maximum Q (filter narrowness). High Q can ring; 4–8 is a safe ceiling for room correction.">
            <div className="flex items-center gap-1">
              <span className="text-xs text-text-dimmed">Max Q</span>
              <input type="number" min={0.5} max={30} step={0.5} value={autoMaxQ}
                onChange={(e) => setAutoMaxQ(Math.max(0.5, Math.min(30, parseFloat(e.target.value) || 8)))}
                className="w-12 bg-transparent border border-surface-bg rounded px-1 py-0.5 text-xs text-text-secondary text-center font-mono focus:border-accent focus:outline-none"
                aria-label="Maximum Q" />
            </div>
          </Tooltip>

          <Tooltip content="Run auto-EQ — compute up to N peaking bands that pull the smoothed measurement towards the target curve. Overwrites the current Room EQ bands.">
            <button
              onClick={handleAutoEQ}
              className="px-4 py-1.5 text-xs font-semibold rounded hover:brightness-110 transition-all"
              style={{ backgroundColor: 'var(--color-chart-eq)', color: 'var(--color-app-bg)' }}
            >
              Calculate
            </button>
          </Tooltip>
        </div>
      )}

      {/* Drop zone + Chart */}
      <div
        className="rounded border transition-colors"
        style={{
          borderColor: isDragOver ? 'var(--color-accent)' : 'var(--color-surface-bg)',
          backgroundColor: isDragOver ? 'var(--color-accent)' + '08' : 'transparent',
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {roomMeasurement ? (
          <RoomEQChart inputIndex={inputIndex} />
        ) : (
          <div
            className="flex flex-col items-center justify-center h-[18.75rem] text-text-dimmed text-sm cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2 opacity-40">
              <path d="M12 16V4m0 0L8 8m4-4l4 4" />
              <path d="M20 16v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2" />
            </svg>
            <span>Import a REW measurement file (.txt)</span>
            <span className="text-sm text-text-dimmed mt-1">or drag and drop here</span>
          </div>
        )}
      </div>

      {/* Room EQ enable + PEQ editor (same component as output PEQ) */}
      <div className="flex items-center gap-2 mb-1">
        <Tooltip content="Bypass the Room EQ stage globally — A/B compare with-vs-without correction without losing the band settings.">
          <button
            onClick={() => setRoomEqEnabled(!roomEqEnabled)}
            className="px-3 py-1 text-xs font-semibold rounded border transition-colors"
            style={{
              borderColor: roomEqEnabled ? 'var(--color-chart-eq)' : 'var(--color-surface-bg)',
              backgroundColor: roomEqEnabled ? 'color-mix(in srgb, var(--color-chart-eq) 15%, transparent)' : 'transparent',
              color: roomEqEnabled ? 'var(--color-chart-eq)' : 'var(--color-text-dimmed)',
            }}
          >
            {roomEqEnabled ? 'Room EQ On' : 'Room EQ Off'}
          </button>
        </Tooltip>
        <span className="text-xs text-text-dimmed">Parametric EQ — 10 bands</span>
      </div>

      <div style={{ opacity: roomEqEnabled ? 1 : 0.4 }}>
        <PEQEditor
          bands={roomEqBands}
          sampleRate={sampleRate}
          color="var(--color-chart-eq)"
          onBandChange={(bandIdx: number, updates: Partial<EQBand>) => setRoomEQBand(inputIndex, bandIdx, updates)}
        />
      </div>
    </div>
  );
}
