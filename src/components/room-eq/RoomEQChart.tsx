import { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { useDSPStore } from '../../store/dsp-store';
import { generateFrequencyPoints, eqBandsResponse } from '../../dsp/frequency-response';
import { smoothOctave } from '../../utils/smoothing';
import { flatTarget, harmanTarget, tiltTarget } from '../../utils/target-curves';
import { freqToLogPosition, logPositionToFreq } from '../../dsp/utils';
import { FREQUENCY_RANGE } from '../../constants/filter-options';
import type { MeasurementPoint } from '../../utils/rew-parser';

const CHART_HEIGHT = 375;
const LABEL_AREA_BOTTOM = 18;
const LABEL_AREA_RIGHT = 30;
const NUM_FREQ_POINTS = 256;
const FREQ_GRID = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];

interface RoomEQChartProps {
  inputIndex: number;
}

export function RoomEQChart({ inputIndex }: RoomEQChartProps) {
  const roomMeasurement = useDSPStore((s) => s.roomMeasurement);
  const roomSmoothing = useDSPStore((s) => s.roomSmoothing);
  const roomTargetCurve = useDSPStore((s) => s.roomTargetCurve);
  const roomTiltSlope = useDSPStore((s) => s.roomTiltSlope);
  const roomEqBands = useDSPStore((s) => s.roomEqBands[inputIndex]);
  const sampleRate = useDSPStore((s) => s.sampleRate);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(800);
  const [cursorX, setCursorX] = useState<number | null>(null);
  const [showPhase, setShowPhase] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) setContainerW(e.contentRect.width);
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const frequencies = useMemo(
    () => generateFrequencyPoints(FREQUENCY_RANGE.min, FREQUENCY_RANGE.max, NUM_FREQ_POINTS),
    [],
  );

  // Smoothed measurement
  const smoothedMeasurement = useMemo(() => {
    if (!roomMeasurement) return null;
    return smoothOctave(roomMeasurement, roomSmoothing);
  }, [roomMeasurement, roomSmoothing]);

  // EQ correction curve (from room EQ bands)
  const eqResponse = useMemo(
    () => eqBandsResponse(roomEqBands, frequencies, sampleRate),
    [roomEqBands, frequencies, sampleRate],
  );

  // Target curve
  const targetValues = useMemo(() => {
    switch (roomTargetCurve) {
      case 'harman': return harmanTarget(frequencies);
      case 'tilt': return tiltTarget(frequencies, roomTiltSlope);
      default: return flatTarget(frequencies);
    }
  }, [roomTargetCurve, roomTiltSlope, frequencies]);

  // Compute dB range from measurement
  const { dbMin, dbMax, dbRange } = useMemo(() => {
    if (!smoothedMeasurement || smoothedMeasurement.length === 0) {
      return { dbMin: -24, dbMax: 24, dbRange: 48 };
    }
    const mags = smoothedMeasurement.map((p) => p.magnitude);
    const rawMin = Math.min(...mags);
    const rawMax = Math.max(...mags);
    const margin = 6;
    const min = Math.floor((rawMin - margin) / 6) * 6;
    const max = Math.ceil((rawMax + margin) / 6) * 6;
    return { dbMin: min, dbMax: max, dbRange: max - min };
  }, [smoothedMeasurement]);

  const dbGridLines = useMemo(() => {
    const lines: number[] = [];
    const step = dbRange > 48 ? 12 : 6;
    for (let db = dbMin; db <= dbMax; db += step) {
      lines.push(db);
    }
    return lines;
  }, [dbMin, dbMax, dbRange]);

  const plotW = containerW - LABEL_AREA_RIGHT;
  const plotH = CHART_HEIGHT - LABEL_AREA_BOTTOM;

  const toX = useCallback(
    (freq: number) => freqToLogPosition(freq, FREQUENCY_RANGE.min, FREQUENCY_RANGE.max) * plotW,
    [plotW],
  );
  const toY = useCallback(
    (db: number) => plotH * (1 - (db - dbMin) / dbRange),
    [plotH, dbMin, dbRange],
  );

  // Build measurement path from smoothed data
  const measurementPath = useMemo(() => {
    if (!smoothedMeasurement || smoothedMeasurement.length === 0) return '';
    return smoothedMeasurement
      .filter((p) => p.frequency >= FREQUENCY_RANGE.min && p.frequency <= FREQUENCY_RANGE.max)
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.frequency)},${toY(p.magnitude)}`)
      .join(' ');
  }, [smoothedMeasurement, toX, toY]);

  // Build EQ correction curve path
  const eqPath = useMemo(() => {
    return eqResponse
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.frequency)},${toY(p.magnitude)}`)
      .join(' ');
  }, [eqResponse, toX, toY]);

  // Build predicted path (measurement + EQ)
  const predictedPath = useMemo(() => {
    if (!smoothedMeasurement || smoothedMeasurement.length === 0) return '';
    return buildPredictedPath(smoothedMeasurement, eqResponse.map((p) => p.magnitude), frequencies, toX, toY);
  }, [smoothedMeasurement, eqResponse, frequencies, toX, toY]);

  // Build target curve path
  const targetPath = useMemo(() => {
    // If there is a measurement, offset target to match measurement median
    let offset = 0;
    if (smoothedMeasurement && smoothedMeasurement.length > 0) {
      const mags = smoothedMeasurement.map((p) => p.magnitude);
      const sorted = [...mags].sort((a, b) => a - b);
      offset = sorted[Math.floor(sorted.length / 2)];
    }
    return frequencies
      .map((f, i) => `${i === 0 ? 'M' : 'L'}${toX(f)},${toY(targetValues[i] + offset)}`)
      .join(' ');
  }, [targetValues, frequencies, smoothedMeasurement, toX, toY]);

  // Phase response path (EQ correction phase)
  const phaseToY = useCallback(
    (deg: number) => plotH * (1 - (deg + 180) / 360),
    [plotH],
  );

  const phasePath = useMemo(() => {
    if (!showPhase) return '';
    return eqResponse
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.frequency)},${phaseToY(p.phase)}`)
      .join(' ');
  }, [showPhase, eqResponse, toX, phaseToY]);

  // Cursor: compute frequency and values at cursor position
  const cursorInfo = useMemo(() => {
    if (cursorX === null || plotW <= 0) return null;
    const ratio = Math.max(0, Math.min(1, cursorX / plotW));
    const freq = logPositionToFreq(ratio, FREQUENCY_RANGE.min, FREQUENCY_RANGE.max);

    // Measurement value at cursor freq
    const measDb = smoothedMeasurement ? interpolateMeasurement(smoothedMeasurement, freq) : null;

    // EQ value at cursor freq (find nearest frequency point)
    const freqIdx = frequencies.reduce((best, f, i) =>
      Math.abs(f - freq) < Math.abs(frequencies[best] - freq) ? i : best, 0);
    const eqDb = eqResponse[freqIdx]?.magnitude ?? 0;
    const eqPhase = eqResponse[freqIdx]?.phase ?? 0;

    // Predicted
    const predictedDb = measDb !== null ? measDb + eqDb : null;

    // Target
    let targetDb: number | null = null;
    if (smoothedMeasurement && smoothedMeasurement.length > 0) {
      const mags = smoothedMeasurement.map((p) => p.magnitude);
      const sorted = [...mags].sort((a, b) => a - b);
      const offset = sorted[Math.floor(sorted.length / 2)];
      targetDb = targetValues[freqIdx] + offset;
    }

    return { freq, measDb, eqDb, eqPhase, predictedDb, targetDb };
  }, [cursorX, plotW, smoothedMeasurement, eqResponse, frequencies, targetValues]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCursorX(e.clientX - rect.left);
  }, []);

  const handleMouseLeave = useCallback(() => setCursorX(null), []);

  return (
    <div ref={containerRef} className="relative" style={{ height: CHART_HEIGHT }}
      onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <svg width={plotW} height={plotH} className="absolute top-0 left-0">
        {/* Frequency grid */}
        {FREQ_GRID.map((f) => {
          const x = toX(f);
          return (
            <line key={`f-${f}`} x1={x} y1={0} x2={x} y2={plotH}
              stroke="var(--color-surface-bg)" strokeWidth="1" />
          );
        })}

        {/* dB grid */}
        {dbGridLines.map((db) => {
          const y = toY(db);
          return (
            <line key={`db-${db}`} x1={0} y1={y} x2={plotW} y2={y}
              stroke={db === 0 ? 'var(--color-text-dimmed)' : 'var(--color-surface-bg)'}
              strokeWidth="1" opacity={db === 0 ? 0.4 : 1} />
          );
        })}

        <defs>
          <clipPath id="room-eq-clip">
            <rect x={0} y={0} width={plotW} height={plotH} />
          </clipPath>
        </defs>

        {/* Target curve (dashed) */}
        {targetPath && (
          <path d={targetPath} fill="none" stroke="var(--color-chart-target)" strokeWidth={1}
            strokeDasharray="4,3" opacity={0.6} clipPath="url(#room-eq-clip)" />
        )}

        {/* Smoothed measurement (dimmed) */}
        {measurementPath && (
          <path d={measurementPath} fill="none" stroke="var(--color-chart-measurement)" strokeWidth={1.5}
            opacity={0.5} clipPath="url(#room-eq-clip)" />
        )}

        {/* EQ correction curve (cyan) */}
        <path d={eqPath} fill="none" stroke="var(--color-chart-eq)" strokeWidth={1.5}
          opacity={0.8} clipPath="url(#room-eq-clip)" />

        {/* Predicted response (bright white) */}
        {predictedPath && (
          <path d={predictedPath} fill="none" stroke="var(--color-chart-predicted)" strokeWidth={2}
            opacity={0.9} clipPath="url(#room-eq-clip)" />
        )}

        {/* Phase grid lines (only when phase is shown) */}
        {showPhase && [-90, 0, 90].map((deg) => {
          const y = phaseToY(deg);
          return (
            <line key={`ph-${deg}`} x1={0} y1={y} x2={plotW} y2={y}
              stroke="var(--color-chart-phase)" strokeWidth={0.5} strokeDasharray="2,4" opacity={0.2} />
          );
        })}

        {/* EQ phase response */}
        {showPhase && phasePath && (
          <path d={phasePath} fill="none" stroke="var(--color-chart-phase)" strokeWidth={1}
            opacity={0.5} clipPath="url(#room-eq-clip)" />
        )}

        {/* Band frequency/gain handles */}
        {roomEqBands.map((band, i) => {
          if (!band.enabled) return null;
          const x = toX(band.frequency);
          const y = toY(band.gain);
          if (x < 0 || x > plotW) return null;
          return (
            <circle key={i} cx={x} cy={y} r={4}
              fill="var(--color-chart-eq)" stroke="var(--color-text-primary)" strokeWidth={1}
              opacity={0.9} />
          );
        })}
      </svg>

      {/* Frequency labels */}
      {FREQ_GRID.map((f) => {
        const x = toX(f);
        return (
          <span key={`fl-${f}`}
            className="absolute text-xs text-text-dimmed font-mono pointer-events-none"
            style={{ left: x, top: plotH + 2, transform: 'translateX(-50%)' }}>
            {f >= 1000 ? `${f / 1000}k` : f}
          </span>
        );
      })}

      {/* dB labels */}
      {dbGridLines.map((db) => {
        const y = toY(db);
        return (
          <span key={`dl-${db}`}
            className="absolute text-xs text-text-dimmed font-mono pointer-events-none"
            style={{ left: plotW + 4, top: y - 6 }}>
            {db > 0 ? `+${db}` : db}
          </span>
        );
      })}

      {/* Phase degree labels (right side, only when phase shown) */}
      {showPhase && [-90, 0, 90].map((deg) => (
        <span key={`phl-${deg}`}
          className="absolute text-xs font-mono pointer-events-none opacity-60"
          style={{ color: 'var(--color-chart-phase)', right: 2, top: phaseToY(deg) - 6 }}>
          {deg > 0 ? '+' : ''}{deg}°
        </span>
      ))}

      {/* Legend */}
      <div className="absolute top-1 right-10 flex gap-3 text-xs items-center">
        <span style={{ color: 'var(--color-chart-measurement)' }}>Measurement</span>
        <span style={{ color: 'var(--color-chart-eq)' }}>Room EQ</span>
        <span style={{ color: 'var(--color-chart-predicted)' }}>Predicted</span>
        <span style={{ color: 'var(--color-chart-target)' }}>Target</span>
        <button
          onClick={() => setShowPhase((p) => !p)}
          className="px-1.5 py-0.5 rounded border transition-colors"
          style={{
            borderColor: showPhase ? 'var(--color-chart-phase)' : 'var(--color-surface-bg)',
            backgroundColor: showPhase ? 'color-mix(in srgb, var(--color-chart-phase) 15%, transparent)' : 'transparent',
            color: showPhase ? 'var(--color-chart-phase)' : 'var(--color-text-dimmed)',
          }}
        >
          Phase
        </button>
      </div>

      {/* Cursor crosshair + readout */}
      {cursorX !== null && cursorInfo && cursorX >= 0 && cursorX <= plotW && (
        <>
          {/* Vertical line */}
          <svg width={plotW} height={plotH} className="absolute top-0 left-0 pointer-events-none">
            <line x1={cursorX} y1={0} x2={cursorX} y2={plotH}
              stroke="var(--color-text-dimmed)" strokeWidth={1} strokeDasharray="2,2" opacity={0.5} />
          </svg>

          {/* Readout tooltip */}
          <div
            className="absolute pointer-events-none bg-panel-bg/90 border border-surface-bg rounded px-2 py-1 text-xs font-mono leading-relaxed whitespace-nowrap z-10"
            style={{
              left: cursorX > plotW / 2 ? cursorX - 8 : cursorX + 8,
              top: 4,
              transform: cursorX > plotW / 2 ? 'translateX(-100%)' : 'none',
            }}
          >
            <div className="text-text-primary font-semibold">
              {cursorInfo.freq >= 1000
                ? `${(cursorInfo.freq / 1000).toFixed(2)} kHz`
                : `${Math.round(cursorInfo.freq)} Hz`}
            </div>
            {cursorInfo.measDb !== null && (
              <div style={{ color: 'var(--color-chart-measurement)' }}>Meas: {cursorInfo.measDb.toFixed(1)} dB</div>
            )}
            <div style={{ color: 'var(--color-chart-eq)' }}>EQ: {cursorInfo.eqDb > 0 ? '+' : ''}{cursorInfo.eqDb.toFixed(1)} dB</div>
            {showPhase && (
              <div style={{ color: 'var(--color-chart-phase)' }}>Phase: {cursorInfo.eqPhase > 0 ? '+' : ''}{cursorInfo.eqPhase.toFixed(1)}°</div>
            )}
            {cursorInfo.predictedDb !== null && (
              <div style={{ color: 'var(--color-chart-predicted)' }}>Pred: {cursorInfo.predictedDb.toFixed(1)} dB</div>
            )}
            {cursorInfo.targetDb !== null && (
              <div style={{ color: 'var(--color-chart-target)' }}>Target: {cursorInfo.targetDb.toFixed(1)} dB</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Build predicted response path by interpolating the smoothed measurement
 * at the EQ frequency points and adding the EQ response.
 */
function buildPredictedPath(
  measurement: MeasurementPoint[],
  eqMagnitudes: number[],
  frequencies: number[],
  toX: (f: number) => number,
  toY: (db: number) => number,
): string {
  return frequencies
    .map((f, i) => {
      const measDb = interpolateMeasurement(measurement, f);
      const predicted = measDb + eqMagnitudes[i];
      return `${i === 0 ? 'M' : 'L'}${toX(f)},${toY(predicted)}`;
    })
    .join(' ');
}

/** Linear interpolation of measurement magnitude at a given frequency (log scale) */
function interpolateMeasurement(measurement: MeasurementPoint[], freq: number): number {
  if (measurement.length === 0) return 0;
  if (freq <= measurement[0].frequency) return measurement[0].magnitude;
  if (freq >= measurement[measurement.length - 1].frequency) return measurement[measurement.length - 1].magnitude;

  // Binary search for the bracketing points
  let lo = 0;
  let hi = measurement.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (measurement[mid].frequency <= freq) lo = mid;
    else hi = mid;
  }

  const f0 = Math.log10(measurement[lo].frequency);
  const f1 = Math.log10(measurement[hi].frequency);
  const t = (Math.log10(freq) - f0) / (f1 - f0);
  return measurement[lo].magnitude + t * (measurement[hi].magnitude - measurement[lo].magnitude);
}
