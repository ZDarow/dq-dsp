import { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDSPStore } from '../../store/dsp-store'
import {
  generateFrequencyPoints,
  eqBandsResponse,
  eqBandsComplexResponse,
  crossoverComplexResponse,
} from '../../dsp/frequency-response'
import type { FrequencyPoint } from '../../dsp/frequency-response'
import { INPUT_COLORS, OUTPUT_COLORS } from '../../utils/colors'
import { freqToLogPosition } from '../../dsp/utils'
import { FREQUENCY_RANGE } from '../../constants/filter-options'
import { CustomSumEditor } from './CustomSumEditor'
import { Tooltip } from '../ui/Tooltip'

const CHART_HEIGHT = 250
const LABEL_AREA_BOTTOM = 18
const LABEL_AREA_RIGHT = 30
const DB_RANGE = 24
const NUM_FREQ_POINTS = 256

const FREQ_GRID = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
const DB_GRID = [-18, -12, -6, 0, 6, 12, 18]

interface ChannelDef {
  label: string
  color: string
}

export function AllChannelsResponseChart() {
  const { t } = useTranslation()
  const inputs = useDSPStore((s) => s.inputs)
  const outputs = useDSPStore((s) => s.outputs)
  const routing = useDSPStore((s) => s.routing)
  const sampleRate = useDSPStore((s) => s.sampleRate)
  const roomEqBands = useDSPStore((s) => s.roomEqBands)
  const roomEqEnabled = useDSPStore((s) => s.roomEqEnabled)
  const customSums = useDSPStore((s) => s.customSums)
  const updateCustomSum = useDSPStore((s) => s.updateCustomSum)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(800)
  const [editorOpen, setEditorOpen] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) setContainerW(e.contentRect.width)
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  // Visibility for the 6 fixed channels (In1/2 + Out1-4). Custom sum visibility
  // lives on each CustomSum.enabled so it persists with the preset.
  const [fixedVisible, setFixedVisible] = useState<boolean[]>([true, true, true, true, true, true])

  const fixedChannels: ChannelDef[] = useMemo(
    () => [
      { label: t('nav.input', { n: 1 }), color: INPUT_COLORS[0] },
      { label: t('nav.input', { n: 2 }), color: INPUT_COLORS[1] },
      { label: t('nav.output', { n: 1 }), color: OUTPUT_COLORS[0] },
      { label: t('nav.output', { n: 2 }), color: OUTPUT_COLORS[1] },
      { label: t('nav.output', { n: 3 }), color: OUTPUT_COLORS[2] },
      { label: t('nav.output', { n: 4 }), color: OUTPUT_COLORS[3] },
    ],
    [t],
  )
  const FIXED_COUNT = fixedChannels.length

  const frequencies = useMemo(
    () => generateFrequencyPoints(FREQUENCY_RANGE.min, FREQUENCY_RANGE.max, NUM_FREQ_POINTS),
    [],
  )

  // Pre-compute per-input magnitude arrays (room EQ + input EQ)
  const inputMagnitudes = useMemo(() => {
    return inputs.map((inp, i) => {
      const eqResp = eqBandsResponse(inp.eqBands, frequencies, sampleRate)
      const roomResp = roomEqEnabled
        ? eqBandsResponse(roomEqBands[i], frequencies, sampleRate)
        : null
      return eqResp.map((p, fi) => p.magnitude + (roomResp ? roomResp[fi].magnitude : 0))
    })
  }, [inputs, roomEqBands, roomEqEnabled, frequencies, sampleRate])

  // Pre-compute complex per-input chain (room EQ × input EQ) for use in sum.
  const inputComplex = useMemo(() => {
    return inputs.map((inp, i) => {
      const eqC = eqBandsComplexResponse(inp.eqBands, frequencies, sampleRate)
      if (!roomEqEnabled) return eqC
      const roomC = eqBandsComplexResponse(roomEqBands[i], frequencies, sampleRate)
      return eqC.map((c, fi) => ({
        re: c.re * roomC[fi].re - c.im * roomC[fi].im,
        im: c.re * roomC[fi].im + c.im * roomC[fi].re,
      }))
    })
  }, [inputs, roomEqBands, roomEqEnabled, frequencies, sampleRate])

  // Per-output complex responses: routed-input sum × output EQ × crossover.
  // Used for acoustic per-input summing (one Σ curve per input, grouping
  // every output that input is routed to).
  const outputComplex = useMemo(() => {
    return outputs.map((out, oi) => {
      const outEqC = eqBandsComplexResponse(out.eqBands, frequencies, sampleRate)
      const xoC = crossoverComplexResponse(out.crossover, frequencies, sampleRate)
      return frequencies.map((_, fi) => {
        // Sum routed inputs in complex (linear) domain: H_in = Σ_i gain_i · H_input_i
        let inRe = 0
        let inIm = 0
        let anyRouted = false
        for (let ii = 0; ii < 2; ii++) {
          const cp = routing[ii]?.[oi]
          if (cp?.enabled && cp.gain > 0) {
            inRe += cp.gain * inputComplex[ii][fi].re
            inIm += cp.gain * inputComplex[ii][fi].im
            anyRouted = true
          }
        }
        // No routing: visualize the output filter chain as if fed unity input,
        // matching the previous chart's passthrough fallback.
        if (!anyRouted) {
          inRe = 1
          inIm = 0
        }
        // Multiply by output EQ
        const a = outEqC[fi]
        const re = inRe * a.re - inIm * a.im
        const im = inRe * a.im + inIm * a.re
        // Multiply by crossover
        const b = xoC[fi]
        const r2 = re * b.re - im * b.im
        const i2 = re * b.im + im * b.re
        return { re: r2, im: i2 }
      })
    })
  }, [outputs, routing, inputComplex, frequencies, sampleRate])

  const responses: FrequencyPoint[][] = useMemo(() => {
    // Input channels: room EQ + input EQ (magnitude only, existing behavior)
    const inputResponses: FrequencyPoint[][] = inputMagnitudes.map((mags) =>
      mags.map((mag, fi) => ({
        frequency: frequencies[fi],
        magnitude: mag,
        phase: 0,
      })),
    )

    // Output channels: derive magnitude from the same complex pipeline used
    // for the sums, so individual lines and pair sums stay self-consistent.
    const outputResponses: FrequencyPoint[][] = outputComplex.map((complexResp) =>
      complexResp.map((c, fi) => ({
        frequency: frequencies[fi],
        magnitude: 20 * Math.log10(Math.max(Math.hypot(c.re, c.im), 1e-10)),
        phase: 0,
      })),
    )

    // User-defined custom sums: complex acoustic add of selected outputs.
    // Each entry in customSums maps to one curve appended after the fixed
    // channels; ordering is preserved so visibility/index lookups are stable.
    const customSumResponses: FrequencyPoint[][] = customSums.map((sum) => {
      const accumulator = frequencies.map(() => ({ re: 0, im: 0 }))
      for (const oi of sum.outputIndices) {
        if (oi < 0 || oi >= outputComplex.length) continue
        for (let fi = 0; fi < frequencies.length; fi++) {
          accumulator[fi].re += outputComplex[oi][fi].re
          accumulator[fi].im += outputComplex[oi][fi].im
        }
      }
      return accumulator.map((c, fi): FrequencyPoint => ({
        frequency: frequencies[fi],
        magnitude: 20 * Math.log10(Math.max(Math.hypot(c.re, c.im), 1e-10)),
        phase: 0,
      }))
    })

    return [...inputResponses, ...outputResponses, ...customSumResponses]
  }, [inputMagnitudes, outputComplex, customSums, frequencies])

  const plotW = containerW - LABEL_AREA_RIGHT
  const plotH = CHART_HEIGHT - LABEL_AREA_BOTTOM

  const toX = (freq: number) =>
    freqToLogPosition(freq, FREQUENCY_RANGE.min, FREQUENCY_RANGE.max) * plotW
  const toY = (db: number) => plotH * (1 - (db + DB_RANGE) / (2 * DB_RANGE))

  const toggleFixed = (i: number) =>
    setFixedVisible((v) => {
      const n = [...v]
      n[i] = !n[i]
      return n
    })

  // Helper: visibility for any curve index in the unified responses array.
  const isVisible = (ci: number): boolean => {
    if (ci < FIXED_COUNT) return fixedVisible[ci]
    return customSums[ci - FIXED_COUNT]?.enabled ?? false
  }

  // Helper: color for any curve index.
  const colorOf = (ci: number): string => {
    if (ci < FIXED_COUNT) return fixedChannels[ci].color
    return customSums[ci - FIXED_COUNT]?.color ?? '#ffffff'
  }

  return (
    <div className="glass-panel mx-4 my-3" style={{ borderRadius: 'var(--radius-panel)' }}>
      {/* Toggle buttons */}
      <div className="flex items-center gap-1.5 px-4 py-1.5 flex-wrap">
        <span className="section-label mr-1">{t('charts.response')}</span>
        {fixedChannels.map((ch, i) => (
          <Tooltip
            key={i}
            content={t('charts.toggleTrace', {
              action: fixedVisible[i] ? t('charts.hide') : t('charts.show'),
              name: ch.label,
            })}
          >
            <button
              onClick={() => toggleFixed(i)}
              className="pill-badge is-toggleable"
              data-active={fixedVisible[i]}
              style={{ ['--pill-color' as string]: ch.color }}
            >
              <span className="status-dot" style={{ backgroundColor: ch.color, marginRight: 0 }} />
              {ch.label}
            </button>
          </Tooltip>
        ))}

        {/* Custom sum pills (toggle visibility via CustomSum.enabled) */}
        {customSums.map((sum) => (
          <Tooltip
            key={sum.id}
            content={t('customSum.sumOf', {
              name: sum.name,
              outputs:
                sum.outputIndices.map((i) => t('nav.output', { n: i + 1 })).join(' + ') ||
                t('customSum.emptyOutputs'),
            })}
          >
            <button
              onClick={() => updateCustomSum(sum.id, { enabled: !sum.enabled })}
              className="pill-badge is-toggleable"
              data-active={sum.enabled}
              style={{ ['--pill-color' as string]: sum.color, fontWeight: 700 }}
            >
              <span className="status-dot" style={{ backgroundColor: sum.color, marginRight: 0 }} />
              {sum.name}
            </button>
          </Tooltip>
        ))}

        {/* Manage-sums entry point */}
        <Tooltip content={t('customSum.manageTooltip')}>
          <button
            onClick={() => setEditorOpen(true)}
            className="text-xs px-2 py-0.5 rounded-full border border-dashed border-surface-bg text-text-dimmed hover:text-text-primary hover:border-text-dimmed transition-colors"
          >
            + Σ
          </button>
        </Tooltip>
      </div>

      {editorOpen && <CustomSumEditor onClose={() => setEditorOpen(false)} />}

      {/* Chart area */}
      <div ref={containerRef} className="relative px-4 pb-2" style={{ height: CHART_HEIGHT }}>
        {/* SVG for lines only — no text */}
        <svg width={plotW} height={plotH} className="absolute top-0 left-4">
          {/* Frequency grid lines */}
          {FREQ_GRID.map((f) => {
            const x = toX(f)
            return (
              <line
                key={`f-${f}`}
                x1={x}
                y1={0}
                x2={x}
                y2={plotH}
                stroke="var(--color-surface-bg)"
                strokeWidth="1"
              />
            )
          })}

          {/* dB grid lines */}
          {DB_GRID.map((db) => {
            const y = toY(db)
            return (
              <line
                key={`db-${db}`}
                x1={0}
                y1={y}
                x2={plotW}
                y2={y}
                stroke={db === 0 ? 'var(--color-text-dimmed)' : 'var(--color-surface-bg)'}
                strokeWidth={db === 0 ? 1 : 1}
                opacity={db === 0 ? 0.4 : 1}
              />
            )
          })}

          {/* Clip region */}
          <defs>
            <clipPath id="all-ch-clip">
              <rect x={0} y={0} width={plotW} height={plotH} />
            </clipPath>
          </defs>

          {/* Response curves */}
          {responses.map((resp, ci) => {
            const path = resp
              .map((p, i) => {
                const x = toX(p.frequency)
                const y = toY(Math.max(-DB_RANGE, Math.min(DB_RANGE, p.magnitude)))
                return `${i === 0 ? 'M' : 'L'}${x},${y}`
              })
              .join(' ')

            const isSum = ci >= FIXED_COUNT
            const visible = isVisible(ci)
            return (
              <path
                key={ci}
                d={path}
                fill="none"
                stroke={colorOf(ci)}
                strokeWidth={isSum ? 2.5 : 1.5}
                opacity={visible ? (isSum ? 1 : 0.9) : 0.06}
                clipPath="url(#all-ch-clip)"
              />
            )
          })}
        </svg>

        {/* HTML labels — not affected by SVG scaling */}
        {/* Frequency labels along the bottom */}
        {FREQ_GRID.map((f) => {
          const x = toX(f)
          return (
            <span
              key={`fl-${f}`}
              className="absolute text-xs text-text-dimmed font-mono pointer-events-none"
              style={{ left: `calc(1rem + ${x}px)`, top: plotH + 2, transform: 'translateX(-50%)' }}
            >
              {f >= 1000 ? `${f / 1000}k` : f}
            </span>
          )
        })}

        {/* dB labels along the right */}
        {DB_GRID.map((db) => {
          const y = toY(db)
          return (
            <span
              key={`dl-${db}`}
              className="absolute text-xs text-text-dimmed font-mono pointer-events-none"
              style={{ left: `calc(1rem + ${plotW + 4}px)`, top: y - 6 }}
            >
              {db > 0 ? `+${db}` : db}
            </span>
          )
        })}
      </div>
    </div>
  )
}
