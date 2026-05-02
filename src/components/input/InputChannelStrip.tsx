import { useDSPStore } from '../../store/dsp-store';
import { getInputColor } from '../../utils/colors';
import { GainSlider } from '../controls/GainSlider';
import { MuteButton } from '../controls/MuteButton';
import { PhaseButton } from '../controls/PhaseButton';
import { LinkButton } from '../controls/LinkButton';
import { CopyPicker } from '../output/CopyPicker';
import { PEQEditor } from '../eq/PEQEditor';
import type { EQBand } from '../../types/filter';

interface InputChannelStripProps {
  index: number;
}

export function InputChannelStrip({ index }: InputChannelStripProps) {
  const input = useDSPStore((s) => s.inputs[index]);
  const sampleRate = useDSPStore((s) => s.sampleRate);
  const setInputGain = useDSPStore((s) => s.setInputGain);
  const toggleInputMute = useDSPStore((s) => s.toggleInputMute);
  const toggleInputPhase = useDSPStore((s) => s.toggleInputPhase);
  const setInputEQBand = useDSPStore((s) => s.setInputEQBand);
  const inputsLinked = useDSPStore((s) => s.inputsLinked);
  const toggleInputsLinked = useDSPStore((s) => s.toggleInputsLinked);
  const copyInput = useDSPStore((s) => s.copyInput);
  const color = getInputColor(index);

  // Only 2 inputs — link target is fixed to the other one. Copy uses the
  // same picker UX as outputs for consistency, even though there's only
  // one possible target.
  const others = [index === 0 ? 1 : 0];

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="text-sm font-bold" style={{ color }}>
          Input {index + 1}
        </h3>
        <MuteButton muted={input.mute} onClick={() => toggleInputMute(index)} />
        <PhaseButton inverted={input.phaseInvert} onClick={() => toggleInputPhase(index)} />
        <div className="w-px h-4 bg-surface-bg" />
        <LinkButton
          linked={inputsLinked}
          onClick={toggleInputsLinked}
          label={inputsLinked ? 'In 1 ↔ 2 Linked' : 'Link In 1 ↔ 2'}
          title="Link mirrors gain, mute, phase, and PEQ between Input 1 and Input 2 in real time. Use for true stereo source where both channels need identical processing."
        />
        <CopyPicker
          currentIndex={index}
          others={others}
          onCopy={(target) => copyInput(index, target)}
          channelLabel="In"
        />
      </div>

      {/* Linked indicator with hint */}
      {inputsLinked && (
        <div className="text-xs text-accent/80 bg-accent/5 px-2 py-1 rounded border border-accent/15">
          Stereo link active — gain, mute, phase, and PEQ apply to both inputs
        </div>
      )}

      {/* Gain Control */}
      <GainSlider value={input.gain} onChange={(g) => setInputGain(index, g)} color={color} />

      {/* PEQ */}
      <div>
        <h4 className="text-xs text-text-secondary mb-2">Parametric EQ (10 bands)</h4>
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
  );
}
