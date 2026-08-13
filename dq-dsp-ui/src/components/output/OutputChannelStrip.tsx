import { useTranslation } from 'react-i18next';
import { useDSPStore } from '../../store/dsp-store';
import { getOutputColor } from '../../utils/colors';
import { GainSlider } from '../controls/GainSlider';
import { MuteButton } from '../controls/MuteButton';
import { PhaseButton } from '../controls/PhaseButton';
import { DelayInput } from '../controls/DelayInput';
import { PEQEditor } from '../eq/PEQEditor';
import { CrossoverPanel } from './CrossoverPanel';
import { LinkPicker } from './LinkPicker';
import { CopyPicker } from './CopyPicker';
import { getLinkPartners } from '../../store/slices/link-slice';
import type { EQBand } from '../../types/filter';

interface OutputChannelStripProps {
  index: number;
}

const OUTPUT_COUNT = 4;

export function OutputChannelStrip({ index }: OutputChannelStripProps) {
  const { t } = useTranslation();
  const output = useDSPStore((s) => s.outputs[index]);
  const sampleRate = useDSPStore((s) => s.sampleRate);
  const setOutputGain = useDSPStore((s) => s.setOutputGain);
  const toggleOutputMute = useDSPStore((s) => s.toggleOutputMute);
  const toggleOutputPhase = useDSPStore((s) => s.toggleOutputPhase);
  const setOutputDelay = useDSPStore((s) => s.setOutputDelay);
  const setOutputEQBand = useDSPStore((s) => s.setOutputEQBand);
  const setOutputCrossoverHP = useDSPStore((s) => s.setOutputCrossoverHP);
  const setOutputCrossoverLP = useDSPStore((s) => s.setOutputCrossoverLP);
  const color = getOutputColor(index);

  const outputLinkGroups = useDSPStore((s) => s.outputLinkGroups);
  const toggleOutputLinkMember = useDSPStore((s) => s.toggleOutputLinkMember);
  const copyOutput = useDSPStore((s) => s.copyOutput);

  const partners = getLinkPartners(outputLinkGroups, index);
  const others = Array.from({ length: OUTPUT_COUNT }, (_, i) => i).filter((i) => i !== index);

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="text-sm font-bold" style={{ color }}>
          {t('nav.output', { n: index + 1 })}
        </h3>
        <MuteButton muted={output.mute} onClick={() => toggleOutputMute(index)} />
        <PhaseButton inverted={output.phaseInvert} onClick={() => toggleOutputPhase(index)} />
        <div className="w-px h-4 bg-surface-bg" />

        <LinkPicker
          others={others}
          linkedPartners={partners}
          onToggle={(other) => toggleOutputLinkMember(index, other)}
          channelLabel={t('output.channelOut')}
        />

        <CopyPicker
          currentIndex={index}
          others={others}
          onCopy={(target) => copyOutput(index, target)}
          channelLabel={t('output.channelOut')}
        />
      </div>

      {/* Linked indicator with hint */}
      {partners.length > 0 && (
        <div className="text-xs text-accent/80 bg-accent/5 px-2 py-1 rounded border border-accent/15">
          {t('output.mirroring', { names: partners.map((p: number) => t('nav.output', { n: p + 1 })).join(', ') })}
        </div>
      )}

      {/* PEQ */}
      <div>
        <h4 className="text-xs text-text-secondary mb-2">{t('output.paramEq')}</h4>
        <PEQEditor
          bands={output.eqBands}
          sampleRate={sampleRate}
          color={color}
          crossover={output.crossover}
          onBandChange={(bandIndex: number, updates: Partial<EQBand>) =>
            setOutputEQBand(index, bandIndex, updates)
          }
        />
      </div>

      {/* Crossover */}
      <CrossoverPanel
        crossover={output.crossover}
        onHPChange={(u) => setOutputCrossoverHP(index, u)}
        onLPChange={(u) => setOutputCrossoverLP(index, u)}
        color={color}
      />

      {/* Gain */}
      <GainSlider value={output.gain} onChange={(g) => setOutputGain(index, g)} color={color} />

      {/* Delay */}
      <DelayInput value={output.delayMs} onChange={(ms) => setOutputDelay(index, ms)} />
    </div>
  );
}
