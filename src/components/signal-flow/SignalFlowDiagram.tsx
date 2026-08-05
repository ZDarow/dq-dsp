import { useTranslation } from 'react-i18next';
import { useDSPStore } from '../../store/dsp-store';
import { INPUT_COLORS, OUTPUT_COLORS } from '../../utils/colors';
import { ProcessingBlock } from './ProcessingBlock';
import { ConnectionLine } from './ConnectionLine';
import { LevelMeter } from './LevelMeter';

export function SignalFlowDiagram() {
  const { t } = useTranslation();
  const selectedBlock = useDSPStore((s) => s.selectedBlock);
  const setSelectedBlock = useDSPStore((s) => s.setSelectedBlock);
  const inputs = useDSPStore((s) => s.inputs);
  const outputs = useDSPStore((s) => s.outputs);
  const routing = useDSPStore((s) => s.routing);

  const W = 900;
  const H = 200;

  // Layout constants
  const adcX = 20;
  const inputX = 100;
  const routingX = 280;
  const outputX = 460;
  const dacX = 780;
  const blockW = 100;
  const blockH = 36;

  const inputY = [40, 120];
  const outputY = [20, 60, 100, 140];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full min-w-[37.5rem] md:min-w-0 md:w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ADC Labels */}
      {inputY.map((y, i) => (
        <g key={`adc-${i}`}>
          <text x={adcX} y={y + blockH / 2} fill={INPUT_COLORS[i]} fontSize={10} fontWeight={600} dominantBaseline="middle">
            ADC {i + 1}
          </text>
          <line x1={adcX + 38} y1={y + blockH / 2} x2={inputX} y2={y + blockH / 2} stroke={INPUT_COLORS[i]} strokeWidth={1.5} opacity={0.5} />
        </g>
      ))}

      {/* Input Processing Blocks */}
      {inputY.map((y, i) => (
        <ProcessingBlock
          key={`input-${i}`}
          x={inputX}
          y={y}
          width={blockW}
          height={blockH}
          label={t('nav.input', { n: i + 1 })}
          sublabel={t('signalflow.gainPeq')}
          color={INPUT_COLORS[i]}
          selected={selectedBlock?.type === 'input' && selectedBlock.index === i}
          muted={inputs[i].mute}
          onClick={() => setSelectedBlock({ type: 'input', index: i })}
        />
      ))}

      {/* Routing connections (input -> routing block) */}
      {inputY.map((iy, i) => (
        <ConnectionLine
          key={`in-route-${i}`}
          x1={inputX + blockW}
          y1={iy + blockH / 2}
          x2={routingX}
          y2={H / 2}
          color={INPUT_COLORS[i]}
          active={!inputs[i].mute}
        />
      ))}

      {/* Routing Matrix Block */}
      <ProcessingBlock
        x={routingX}
        y={H / 2 - 25}
        width={120}
        height={50}
        label={t('signalflow.routing2x4')}
        sublabel={t('signalflow.matrix')}
        color="var(--color-accent)"
        selected={selectedBlock?.type === 'routing'}
        onClick={() => setSelectedBlock({ type: 'routing' })}
      />

      {/* Routing -> Output connections */}
      {outputY.map((oy, o) => {
        const hasSignal = routing.some((row) => row[o]?.enabled);
        // Find color of first active input
        let lineColor = OUTPUT_COLORS[o];
        for (let i = 0; i < routing.length; i++) {
          if (routing[i][o]?.enabled) {
            lineColor = OUTPUT_COLORS[o];
            break;
          }
        }
        return (
          <ConnectionLine
            key={`route-out-${o}`}
            x1={routingX + 120}
            y1={H / 2}
            x2={outputX}
            y2={oy + blockH / 2}
            color={lineColor}
            active={hasSignal}
          />
        );
      })}

      {/* Output Processing Blocks */}
      {outputY.map((y, i) => (
        <ProcessingBlock
          key={`output-${i}`}
          x={outputX}
          y={y}
          width={140}
          height={blockH}
          label={t('nav.output', { n: i + 1 })}
          sublabel={t('signalflow.peqXoGainDelay')}
          color={OUTPUT_COLORS[i]}
          selected={selectedBlock?.type === 'output' && selectedBlock.index === i}
          muted={outputs[i].mute}
          onClick={() => setSelectedBlock({ type: 'output', index: i })}
        />
      ))}

      {/* DAC Labels + Meters */}
      {outputY.map((y, i) => (
        <g key={`dac-${i}`}>
          <line
            x1={outputX + 140}
            y1={y + blockH / 2}
            x2={dacX - 30}
            y2={y + blockH / 2}
            stroke={OUTPUT_COLORS[i]}
            strokeWidth={1.5}
            opacity={outputs[i].mute ? 0.15 : 0.5}
          />
          <LevelMeter
            x={dacX - 20}
            y={y + 4}
            height={blockH - 8}
            level={outputs[i].mute ? 0 : 0.6}
            color={OUTPUT_COLORS[i]}
          />
          <text
            x={dacX}
            y={y + blockH / 2}
            fill={OUTPUT_COLORS[i]}
            fontSize={10}
            fontWeight={600}
            dominantBaseline="middle"
            opacity={outputs[i].mute ? 0.3 : 1}
          >
            DAC {i + 1}
          </text>
        </g>
      ))}

      {/* Signal flow label */}
      <text x={W / 2} y={H - 6} textAnchor="middle" fill="var(--color-text-dimmed)" fontSize={9}>
        {t('signalflow.flowLabel')}
      </text>
    </svg>
  );
}
