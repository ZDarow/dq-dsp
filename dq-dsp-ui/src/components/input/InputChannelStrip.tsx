import { useTranslation } from 'react-i18next'
import { useDSPStore } from '../../store/dsp-store'
import { getLinkPartners } from '../../store/slices/link-slice'
import { getInputColor } from '../../utils/colors'
import { GainSlider } from '../controls/GainSlider'
import { MuteButton } from '../controls/MuteButton'
import { PhaseButton } from '../controls/PhaseButton'
import { LinkButton } from '../controls/LinkButton'
import { CopyPicker } from '../output/CopyPicker'
import { PEQEditor } from '../eq/PEQEditor'
import type { EQBand } from '../../types/filter'

interface InputChannelStripProps {
  index: number
}

export function InputChannelStrip({ index }: InputChannelStripProps) {
  const { t } = useTranslation()
  const input = useDSPStore((s) => s.inputs[index])
  const sampleRate = useDSPStore((s) => s.sampleRate)
  const setInputGain = useDSPStore((s) => s.setInputGain)
  const toggleInputMute = useDSPStore((s) => s.toggleInputMute)
  const toggleInputPhase = useDSPStore((s) => s.toggleInputPhase)
  const setInputEQBand = useDSPStore((s) => s.setInputEQBand)
  const inputLinkGroups = useDSPStore((s) => s.inputLinkGroups)
  const toggleInputLinkMember = useDSPStore((s) => s.toggleInputLinkMember)
  const copyInput = useDSPStore((s) => s.copyInput)
  const color = getInputColor(index)

  const partners = getLinkPartners(inputLinkGroups, index)
  const isLinked = partners.length > 0
  const other = index === 0 ? 1 : 0

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="text-sm font-bold" style={{ color }}>
          {t('nav.input', { n: index + 1 })}
        </h3>
        <MuteButton muted={input.mute} onClick={() => toggleInputMute(index)} />
        <PhaseButton inverted={input.phaseInvert} onClick={() => toggleInputPhase(index)} />
        <div className="w-px h-4 bg-surface-bg" />
        <LinkButton
          linked={isLinked}
          onClick={() => toggleInputLinkMember(index, other)}
          label={isLinked ? t('input.linkOn') : t('input.link')}
          title={t('input.linkTitle')}
        />
        <CopyPicker
          currentIndex={index}
          others={[other]}
          onCopy={(target) => copyInput(index, target)}
          channelLabel={t('input.channelIn')}
        />
      </div>

      {/* Linked indicator with hint */}
      {isLinked && (
        <div className="text-xs text-accent/80 bg-accent/5 px-2 py-1 rounded border border-accent/15">
          {t('input.linkActive')}
        </div>
      )}

      {/* Gain Control */}
      <GainSlider value={input.gain} onChange={(g) => setInputGain(index, g)} color={color} />

      {/* PEQ */}
      <div>
        <h4 className="text-xs text-text-secondary mb-2">{t('input.paramEq')}</h4>
        <PEQEditor
          bands={input.eqBands}
          sampleRate={sampleRate}
          color={color}
          onBandChange={(bandIndex: number, updates: Partial<EQBand>) =>
            setInputEQBand(index, bandIndex, updates)
          }
        />
      </div>
    </div>
  )
}
