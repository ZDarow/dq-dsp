import { useState, useCallback, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDSPStore } from '../../store/dsp-store'
import { RoomEQChart } from './RoomEQChart'
import { FREQUENCY_RANGE } from '../../constants/filter-options'
import type { EQBand } from '../../types/filter'
import { PEQEditor } from '../eq/PEQEditor'
import { computeAutoEQ } from '../../utils/auto-eq'
import { generateFrequencyPoints } from '../../dsp/frequency-response'
import { smoothOctave } from '../../utils/smoothing'
import { flatTarget, harmanTarget, tiltTarget } from '../../utils/target-curves'
import { Tooltip } from '../ui/Tooltip'

function RewExportHelp() {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      <div className="font-semibold text-text-primary">{t('roomEq.rewTitle')}</div>
      <div className="text-text-secondary">{t('roomEq.rewIntro')}</div>
      <div className="font-semibold text-text-primary mt-2">{t('roomEq.rewHowTo')}</div>
      <ol className="list-decimal list-inside text-text-secondary space-y-0.5">
        <li>{t('roomEq.rewStep1')}</li>
        <li>{t('roomEq.rewStep2')}</li>
        <li>{t('roomEq.rewStep3')}</li>
        <li>{t('roomEq.rewStep4')}</li>
        <li>{t('roomEq.rewStep5')}</li>
      </ol>
    </div>
  )
}

const SMOOTHING_OPTIONS = [3, 6, 12, 24] as const
const TARGET_OPTIONS = ['flat', 'harman', 'tilt'] as const

export function RoomEQPanel() {
  const { t } = useTranslation()
  const [inputIndex, setInputIndex] = useState(0)

  const roomMeasurement = useDSPStore((s) => s.roomMeasurement)
  const roomSmoothing = useDSPStore((s) => s.roomSmoothing)
  const roomTargetCurve = useDSPStore((s) => s.roomTargetCurve)
  const roomTiltSlope = useDSPStore((s) => s.roomTiltSlope)
  const roomEqBands = useDSPStore((s) => s.roomEqBands[inputIndex])
  const importRoomMeasurement = useDSPStore((s) => s.importRoomMeasurement)
  const clearRoomMeasurement = useDSPStore((s) => s.clearRoomMeasurement)
  const setRoomSmoothing = useDSPStore((s) => s.setRoomSmoothing)
  const setRoomTargetCurve = useDSPStore((s) => s.setRoomTargetCurve)
  const setRoomTiltSlope = useDSPStore((s) => s.setRoomTiltSlope)
  const setRoomEQBand = useDSPStore((s) => s.setRoomEQBand)
  // toggleRoomEQBand handled by PEQEditor via onBandChange
  const roomLinked = useDSPStore((s) => s.roomLinked)
  const setRoomLinked = useDSPStore((s) => s.setRoomLinked)
  const roomEqEnabled = useDSPStore((s) => s.roomEqEnabled)
  const setRoomEqEnabled = useDSPStore((s) => s.setRoomEqEnabled)
  const sampleRate = useDSPStore((s) => s.sampleRate)

  const [autoMaxGain, setAutoMaxGain] = useState(6)
  const [autoMinGain, setAutoMinGain] = useState(-12)
  const [autoMaxQ, setAutoMaxQ] = useState(8)
  const [autoNumBands, setAutoNumBands] = useState(10)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const frequencies = useMemo(
    () => generateFrequencyPoints(FREQUENCY_RANGE.min, FREQUENCY_RANGE.max, 256),
    [],
  )

  const handleAutoEQ = useCallback(() => {
    if (!roomMeasurement) return
    const smoothed = smoothOctave(roomMeasurement, roomSmoothing)
    let targetVals: number[]
    switch (roomTargetCurve) {
      case 'harman':
        targetVals = harmanTarget(frequencies)
        break
      case 'tilt':
        targetVals = tiltTarget(frequencies, roomTiltSlope)
        break
      default:
        targetVals = flatTarget(frequencies)
    }
    const bands = computeAutoEQ(smoothed, targetVals, frequencies, sampleRate, {
      maxGainDb: autoMaxGain,
      minGainDb: autoMinGain,
      maxQ: autoMaxQ,
      numBands: autoNumBands,
    })
    // Apply to current input (and linked if enabled)
    for (let b = 0; b < bands.length; b++) {
      setRoomEQBand(inputIndex, b, bands[b])
    }
  }, [
    roomMeasurement,
    roomSmoothing,
    roomTargetCurve,
    roomTiltSlope,
    frequencies,
    sampleRate,
    autoMaxGain,
    autoMinGain,
    autoMaxQ,
    autoNumBands,
    inputIndex,
    setRoomEQBand,
  ])

  const handleFileLoad = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        if (text) importRoomMeasurement(text)
      }
      reader.readAsText(file)
    },
    [importRoomMeasurement],
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFileLoad(file)
      // Reset so re-selecting the same file triggers onChange
      e.target.value = ''
    },
    [handleFileLoad],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFileLoad(file)
    },
    [handleFileLoad],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  return (
    <div className="p-4 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">{t('roomEq.title')}</h2>
        <div className="flex items-center gap-2">
          {/* Link L/R toggle */}
          <Tooltip content={t('roomEq.linkTooltip')}>
            <button
              onClick={() => setRoomLinked(!roomLinked)}
              className="px-3 py-1 text-xs font-medium rounded border transition-colors"
              style={{
                borderColor: roomLinked ? 'var(--color-chart-eq)' : 'var(--color-surface-bg)',
                backgroundColor: roomLinked
                  ? 'color-mix(in srgb, var(--color-chart-eq) 20%, transparent)'
                  : 'transparent',
                color: roomLinked ? 'var(--color-chart-eq)' : 'var(--color-text-dimmed)',
              }}
            >
              {t('roomEq.linkLR')}
            </button>
          </Tooltip>

          {/* Channel selector */}
          <div className="flex rounded overflow-hidden border border-surface-bg">
            {[0, 1].map((idx) => (
              <Tooltip key={idx} content={t('roomEq.editInput', { n: idx + 1 })}>
                <button
                  onClick={() => setInputIndex(idx)}
                  className="px-3 py-1 text-xs font-medium transition-colors"
                  style={{
                    backgroundColor:
                      inputIndex === idx ? 'var(--color-accent)' + '30' : 'transparent',
                    color: inputIndex === idx ? 'var(--color-accent)' : 'var(--color-text-dimmed)',
                  }}
                >
                  {t('nav.input', { n: idx + 1 })}
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
        <Tooltip content={<RewExportHelp />} maxWidth="22rem">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-xs font-medium rounded border border-surface-bg bg-panel-bg
                       hover:bg-surface-bg transition-colors text-text-secondary"
          >
            {t('roomEq.importRew')}
          </button>
        </Tooltip>
        {roomMeasurement && (
          <Tooltip content={t('roomEq.clearTooltip')}>
            <button
              onClick={clearRoomMeasurement}
              className="px-3 py-1.5 text-xs font-medium rounded border border-surface-bg
                         hover:bg-surface-bg transition-colors text-text-dimmed"
            >
              {t('roomEq.clear')}
            </button>
          </Tooltip>
        )}

        {/* Smoothing */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-text-dimmed uppercase tracking-wider">
            {t('roomEq.smooth')}
          </span>
          {SMOOTHING_OPTIONS.map((n) => (
            <Tooltip key={n} content={t('roomEq.smoothingTooltip', { n })}>
              <button
                onClick={() => setRoomSmoothing(n)}
                className="px-2 py-0.5 text-sm rounded border transition-colors"
                style={{
                  borderColor:
                    roomSmoothing === n ? 'var(--color-accent)' : 'var(--color-surface-bg)',
                  backgroundColor:
                    roomSmoothing === n ? 'var(--color-accent)' + '20' : 'transparent',
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
          <span className="text-xs text-text-dimmed uppercase tracking-wider">
            {t('roomEq.target')}
          </span>
          {TARGET_OPTIONS.map((tt) => {
            const help =
              tt === 'flat'
                ? t('roomEq.targetFlat')
                : tt === 'harman'
                  ? t('roomEq.targetHarman')
                  : t('roomEq.targetTilt')
            return (
              <Tooltip key={tt} content={help}>
                <button
                  onClick={() => setRoomTargetCurve(tt)}
                  className="px-2 py-0.5 text-sm rounded border transition-colors capitalize"
                  style={{
                    borderColor: roomTargetCurve === tt ? '#ff8844' : 'var(--color-surface-bg)',
                    backgroundColor: roomTargetCurve === tt ? '#ff884420' : 'transparent',
                    color: roomTargetCurve === tt ? '#ff8844' : 'var(--color-text-dimmed)',
                  }}
                >
                  {tt}
                </button>
              </Tooltip>
            )
          })}
          {roomTargetCurve === 'tilt' && (
            <Tooltip
              content={t('roomEq.tiltTooltip', { slope: roomTiltSlope.toFixed(1) })}
              wrapperClassName="inline-block"
            >
              <input
                type="range"
                min={-3}
                max={0}
                step={0.1}
                value={roomTiltSlope}
                onChange={(e) => setRoomTiltSlope(parseFloat(e.target.value))}
                className="dq-slider w-20"
                style={{
                  ['--slider-fill' as string]: ((roomTiltSlope - -3) / (0 - -3)) * 100,
                  ['--slider-color' as string]: '#ff8844',
                }}
                aria-label={t('roomEq.tiltAria')}
              />
            </Tooltip>
          )}
        </div>
      </div>

      {/* Auto EQ controls */}
      {roomMeasurement && (
        <div className="flex items-center gap-3 flex-wrap bg-panel-bg/50 rounded px-3 py-2 border border-surface-bg">
          <span className="text-xs text-text-dimmed uppercase tracking-wider">
            {t('roomEq.autoEq')}
          </span>

          <Tooltip content={t('roomEq.bandsTooltip')}>
            <div className="flex items-center gap-1">
              <span className="text-xs text-text-dimmed">{t('roomEq.bands')}</span>
              <input
                type="number"
                min={1}
                max={10}
                value={autoNumBands}
                onChange={(e) =>
                  setAutoNumBands(Math.max(1, Math.min(10, parseInt(e.target.value) || 10)))
                }
                className="w-10 bg-transparent border border-surface-bg rounded px-1 py-0.5 text-xs text-text-secondary text-center font-mono focus:border-accent focus:outline-none"
                aria-label={t('roomEq.bandsAria')}
              />
            </div>
          </Tooltip>

          <Tooltip content={t('roomEq.cutTooltip')}>
            <div className="flex items-center gap-1">
              <span className="text-xs text-text-dimmed">{t('roomEq.cut')}</span>
              <input
                type="number"
                min={-24}
                max={0}
                step={1}
                value={autoMinGain}
                onChange={(e) =>
                  setAutoMinGain(Math.max(-24, Math.min(0, parseFloat(e.target.value) || -12)))
                }
                className="w-12 bg-transparent border border-surface-bg rounded px-1 py-0.5 text-xs text-text-secondary text-center font-mono focus:border-accent focus:outline-none"
                aria-label={t('roomEq.cutAria')}
              />
              <span className="text-xs text-text-dimmed">dB</span>
            </div>
          </Tooltip>

          <Tooltip content={t('roomEq.boostTooltip')}>
            <div className="flex items-center gap-1">
              <span className="text-xs text-text-dimmed">{t('roomEq.boost')}</span>
              <input
                type="number"
                min={0}
                max={15}
                step={1}
                value={autoMaxGain}
                onChange={(e) =>
                  setAutoMaxGain(Math.max(0, Math.min(15, parseFloat(e.target.value) || 6)))
                }
                className="w-12 bg-transparent border border-surface-bg rounded px-1 py-0.5 text-xs text-text-secondary text-center font-mono focus:border-accent focus:outline-none"
                aria-label={t('roomEq.boostAria')}
              />
              <span className="text-xs text-text-dimmed">dB</span>
            </div>
          </Tooltip>

          <Tooltip content={t('roomEq.maxQTooltip')}>
            <div className="flex items-center gap-1">
              <span className="text-xs text-text-dimmed">{t('roomEq.maxQ')}</span>
              <input
                type="number"
                min={0.5}
                max={30}
                step={0.5}
                value={autoMaxQ}
                onChange={(e) =>
                  setAutoMaxQ(Math.max(0.5, Math.min(30, parseFloat(e.target.value) || 8)))
                }
                className="w-12 bg-transparent border border-surface-bg rounded px-1 py-0.5 text-xs text-text-secondary text-center font-mono focus:border-accent focus:outline-none"
                aria-label={t('roomEq.maxQAria')}
              />
            </div>
          </Tooltip>

          <Tooltip content={t('roomEq.calculateTooltip')}>
            <button
              onClick={handleAutoEQ}
              className="px-4 py-1.5 text-xs font-semibold rounded hover:brightness-110 transition-all"
              style={{ backgroundColor: 'var(--color-chart-eq)', color: 'var(--color-app-bg)' }}
            >
              {t('roomEq.calculate')}
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
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mb-2 opacity-40"
            >
              <path d="M12 16V4m0 0L8 8m4-4l4 4" />
              <path d="M20 16v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2" />
            </svg>
            <span>{t('roomEq.dropTitle')}</span>
            <span className="text-sm text-text-dimmed mt-1">{t('roomEq.dropHint')}</span>
          </div>
        )}
      </div>

      {/* Room EQ enable + PEQ editor (same component as output PEQ) */}
      <div className="flex items-center gap-2 mb-1">
        <Tooltip content={t('roomEq.bypassTooltip')}>
          <button
            onClick={() => setRoomEqEnabled(!roomEqEnabled)}
            className="px-3 py-1 text-xs font-semibold rounded border transition-colors"
            style={{
              borderColor: roomEqEnabled ? 'var(--color-chart-eq)' : 'var(--color-surface-bg)',
              backgroundColor: roomEqEnabled
                ? 'color-mix(in srgb, var(--color-chart-eq) 15%, transparent)'
                : 'transparent',
              color: roomEqEnabled ? 'var(--color-chart-eq)' : 'var(--color-text-dimmed)',
            }}
          >
            {roomEqEnabled ? t('roomEq.on') : t('roomEq.off')}
          </button>
        </Tooltip>
        <span className="text-xs text-text-dimmed">{t('roomEq.paramEqLabel')}</span>
      </div>

      <div style={{ opacity: roomEqEnabled ? 1 : 0.4 }}>
        <PEQEditor
          bands={roomEqBands}
          sampleRate={sampleRate}
          color="var(--color-chart-eq)"
          onBandChange={(bandIdx: number, updates: Partial<EQBand>) =>
            setRoomEQBand(inputIndex, bandIdx, updates)
          }
        />
      </div>
    </div>
  )
}
