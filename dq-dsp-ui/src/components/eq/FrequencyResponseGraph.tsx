import { useMemo, useCallback } from 'react'
import type { EQBand, CrossoverConfig } from '../../types/filter'
import type { FrequencyPoint } from '../../dsp/frequency-response'
import {
  generateFrequencyPoints,
  eqBandsResponse,
  singleBandResponse,
  crossoverResponse,
} from '../../dsp/frequency-response'
import { freqToLogPosition } from '../../dsp/utils'
import { FREQUENCY_RANGE, EQ_GAIN_RANGE } from '../../constants/filter-options'

interface FrequencyResponseGraphProps {
  bands: EQBand[]
  sampleRate: number
  crossover?: CrossoverConfig
  color: string
  bandColors?: string[]
  selectedBand?: number
  onBandDrag?: (bandIndex: number, frequency: number, gain: number) => void
  onBandClick?: (bandIndex: number) => void
  height?: number
}

const GRAPH_W = 600
const GRAPH_H = 200
const PAD = { top: 10, right: 10, bottom: 25, left: 40 }
const PLOT_W = GRAPH_W - PAD.left - PAD.right
const PLOT_H = GRAPH_H - PAD.top - PAD.bottom
const NUM_POINTS = 256

const DB_MIN = EQ_GAIN_RANGE.min - 3
const DB_MAX = EQ_GAIN_RANGE.max + 3

function freqToX(freq: number): number {
  return PAD.left + freqToLogPosition(freq, FREQUENCY_RANGE.min, FREQUENCY_RANGE.max) * PLOT_W
}

function dbToY(db: number): number {
  const norm = (db - DB_MIN) / (DB_MAX - DB_MIN)
  return PAD.top + (1 - norm) * PLOT_H
}

function pointsToPath(points: FrequencyPoint[]): string {
  return points
    .map((p, i) => {
      const x = freqToX(p.frequency)
      const y = dbToY(p.magnitude)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

const GRID_FREQUENCIES = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
const GRID_DB = [-15, -12, -9, -6, -3, 0, 3, 6, 9, 12, 15]

export function FrequencyResponseGraph({
  bands,
  sampleRate,
  crossover,
  color,
  bandColors,
  selectedBand,
  onBandDrag,
  onBandClick,
  height = 200,
}: FrequencyResponseGraphProps) {
  const frequencies = useMemo(
    () => generateFrequencyPoints(FREQUENCY_RANGE.min, FREQUENCY_RANGE.max, NUM_POINTS),
    [],
  )

  const combinedResponse = useMemo(
    () => eqBandsResponse(bands, frequencies, sampleRate),
    [bands, frequencies, sampleRate],
  )

  const crossoverResponseData = useMemo(
    () => (crossover ? crossoverResponse(crossover, frequencies, sampleRate) : null),
    [crossover, frequencies, sampleRate],
  )

  // Total response = EQ + crossover
  const totalResponse = useMemo(() => {
    if (!crossoverResponseData) return combinedResponse
    return combinedResponse.map((p, i) => ({
      frequency: p.frequency,
      magnitude: p.magnitude + crossoverResponseData[i].magnitude,
      phase: p.phase + crossoverResponseData[i].phase,
    }))
  }, [combinedResponse, crossoverResponseData])

  const individualResponses = useMemo(
    () => bands.map((band) => singleBandResponse(band, frequencies, sampleRate)),
    [bands, frequencies, sampleRate],
  )

  const handleSvgPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (selectedBand === undefined || !onBandDrag) return
      if (e.buttons !== 1) return

      const svg = e.currentTarget
      const rect = svg.getBoundingClientRect()
      const scaleX = GRAPH_W / rect.width
      const scaleY = GRAPH_H / rect.height
      const svgX = (e.clientX - rect.left) * scaleX
      const svgY = (e.clientY - rect.top) * scaleY

      const logPos = (svgX - PAD.left) / PLOT_W
      const freq = Math.pow(
        10,
        logPos * (Math.log10(FREQUENCY_RANGE.max) - Math.log10(FREQUENCY_RANGE.min)) +
          Math.log10(FREQUENCY_RANGE.min),
      )

      const dbNorm = 1 - (svgY - PAD.top) / PLOT_H
      const db = DB_MIN + dbNorm * (DB_MAX - DB_MIN)

      onBandDrag(
        selectedBand,
        Math.max(FREQUENCY_RANGE.min, Math.min(FREQUENCY_RANGE.max, freq)),
        Math.max(EQ_GAIN_RANGE.min, Math.min(EQ_GAIN_RANGE.max, db)),
      )
    },
    [selectedBand, onBandDrag],
  )

  const scaledH = height
  const viewBox = `0 0 ${GRAPH_W} ${GRAPH_H}`

  return (
    <svg
      viewBox={viewBox}
      className="w-full bg-surface-bg rounded"
      style={{ height: scaledH }}
      preserveAspectRatio="xMidYMid meet"
      onPointerMove={handleSvgPointerMove}
    >
      {/* Grid lines - frequency */}
      {GRID_FREQUENCIES.map((f) => {
        const x = freqToX(f)
        return (
          <g key={`f-${f}`}>
            <line
              x1={x}
              y1={PAD.top}
              x2={x}
              y2={PAD.top + PLOT_H}
              stroke="var(--color-surface-bg)"
              strokeWidth={0.5}
            />
            <text
              x={x}
              y={GRAPH_H - 4}
              textAnchor="middle"
              fill="var(--color-text-dimmed)"
              fontSize={8}
            >
              {f >= 1000 ? `${f / 1000}k` : f}
            </text>
          </g>
        )
      })}

      {/* Grid lines - dB */}
      {GRID_DB.map((db) => {
        const y = dbToY(db)
        return (
          <g key={`db-${db}`}>
            <line
              x1={PAD.left}
              y1={y}
              x2={PAD.left + PLOT_W}
              y2={y}
              stroke={db === 0 ? 'var(--color-text-dimmed)' : 'var(--color-surface-bg)'}
              opacity={db === 0 ? 0.4 : 1}
              strokeWidth={db === 0 ? 1 : 0.5}
            />
            <text
              x={PAD.left - 4}
              y={y + 3}
              textAnchor="end"
              fill="var(--color-text-dimmed)"
              fontSize={8}
            >
              {db > 0 ? `+${db}` : db}
            </text>
          </g>
        )
      })}

      {/* Individual band curves */}
      {individualResponses.map((resp, i) => {
        if (!bands[i].enabled) return null
        const bandColor = bandColors?.[i] ?? color
        return (
          <path
            key={`band-${i}`}
            d={pointsToPath(resp)}
            fill="none"
            stroke={bandColor}
            strokeWidth={i === selectedBand ? 1.5 : 0.8}
            opacity={i === selectedBand ? 0.6 : 0.2}
          />
        )
      })}

      {/* Crossover response */}
      {crossoverResponseData && (
        <path
          d={pointsToPath(crossoverResponseData)}
          fill="none"
          stroke="var(--color-text-secondary)"
          strokeWidth={1}
          strokeDasharray="4 2"
          opacity={0.4}
        />
      )}

      {/* Combined response curve */}
      <path d={pointsToPath(totalResponse)} fill="none" stroke={color} strokeWidth={2} />

      {/* Filled area under curve */}
      <path
        d={
          pointsToPath(totalResponse) +
          ` L ${freqToX(FREQUENCY_RANGE.max).toFixed(1)} ${dbToY(0).toFixed(1)} L ${freqToX(FREQUENCY_RANGE.min).toFixed(1)} ${dbToY(0).toFixed(1)} Z`
        }
        fill="var(--color-accent)"
        opacity={0.05}
      />

      {/* Band handles */}
      {bands.map((band, i) => {
        if (!band.enabled) return null
        const x = freqToX(band.frequency)
        const y = dbToY(band.gain)
        const isSelected = i === selectedBand
        const bandColor = bandColors?.[i] ?? color

        return (
          <g key={`handle-${i}`} onClick={() => onBandClick?.(i)} style={{ cursor: 'pointer' }}>
            <circle
              cx={x}
              cy={y}
              r={isSelected ? 6 : 4}
              fill={isSelected ? bandColor : 'transparent'}
              stroke={bandColor}
              strokeWidth={2}
            />
            <text
              x={x}
              y={y - 10}
              textAnchor="middle"
              fill={bandColor}
              fontSize={8}
              fontWeight={isSelected ? 700 : 400}
            >
              {i + 1}
            </text>
          </g>
        )
      })}

      {/* Plot border */}
      <rect
        x={PAD.left}
        y={PAD.top}
        width={PLOT_W}
        height={PLOT_H}
        fill="none"
        stroke="var(--color-control-bg)"
        strokeWidth={1}
      />
    </svg>
  )
}
