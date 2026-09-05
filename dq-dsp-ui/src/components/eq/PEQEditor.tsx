import { useState, useCallback } from 'react'
import type { EQBand, CrossoverConfig } from '../../types/filter'
import { FrequencyResponseGraph } from './FrequencyResponseGraph'
import { EQBandControl } from './EQBandControl'
import { roundFrequency, roundGain } from './EQBandHandle'

interface PEQEditorProps {
  bands: EQBand[]
  sampleRate: number
  color: string
  crossover?: CrossoverConfig
  onBandChange: (bandIndex: number, updates: Partial<EQBand>) => void
}

export function PEQEditor({ bands, sampleRate, color, crossover, onBandChange }: PEQEditorProps) {
  const [selectedBand, setSelectedBand] = useState<number>(0)

  const handleBandDrag = useCallback(
    (bandIndex: number, frequency: number, gain: number) => {
      onBandChange(bandIndex, {
        frequency: roundFrequency(frequency),
        gain: roundGain(gain),
      })
    },
    [onBandChange],
  )

  return (
    <div className="flex flex-col gap-2">
      {/* Frequency Response Graph */}
      <FrequencyResponseGraph
        bands={bands}
        sampleRate={sampleRate}
        crossover={crossover}
        color={color}
        selectedBand={selectedBand}
        onBandDrag={handleBandDrag}
        onBandClick={setSelectedBand}
        height={200}
      />

      {/* Band Controls Table */}
      <div className="flex flex-col gap-0.5 max-h-[15.625rem] overflow-y-auto">
        {bands.map((band, i) => (
          <EQBandControl
            key={i}
            band={band}
            index={i}
            selected={i === selectedBand}
            color={color}
            onChange={(updates) => onBandChange(i, updates)}
            onSelect={() => setSelectedBand(i)}
          />
        ))}
      </div>
    </div>
  )
}
