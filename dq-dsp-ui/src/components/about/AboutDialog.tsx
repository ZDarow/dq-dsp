import { useTranslation, Trans } from 'react-i18next'
import { Logo } from '../layout/Logo'
import { Tooltip } from '../ui/Tooltip'

interface AboutDialogProps {
  onClose: () => void
}

function Block({
  tone,
  children,
}: {
  tone: 'src' | 'dsp' | 'out' | 'out2' | 'ctrl' | 'plain'
  children: React.ReactNode
}) {
  const palette = {
    src: 'var(--color-accent)',
    dsp: 'var(--color-meter-normal)',
    out: 'var(--color-output-2)',
    out2: 'var(--color-output-3)',
    ctrl: 'var(--color-output-3)',
    plain: 'var(--color-text-dimmed)',
  } as const
  const color = palette[tone]
  return (
    <span
      className="inline-flex flex-col items-center px-3 py-1.5 rounded-md text-[0.75rem] whitespace-nowrap text-center"
      style={{
        border: `1px solid ${tone === 'plain' ? 'var(--color-surface-bg)' : color}`,
        color: tone === 'plain' ? 'var(--color-text-secondary)' : color,
        backgroundColor: 'color-mix(in srgb, var(--color-panel-bg) 60%, transparent)',
      }}
    >
      {children}
    </span>
  )
}

function Arrow() {
  return <span className="text-text-dimmed text-base">→</span>
}

function Card({
  title,
  children,
  full,
}: {
  title?: string
  children: React.ReactNode
  full?: boolean
}) {
  return (
    <div
      className={`glass-panel p-4 ${full ? 'col-span-full' : ''}`}
      style={{ borderRadius: 'var(--radius-panel)' }}
    >
      {title && (
        <h3 className="section-label mb-3" style={{ color: 'var(--color-output-2)' }}>
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}

// SVG pin diagram — ESP32-S3 → 2× PCM5102A (TENSTAR ROBOT / GY-PCM5102 board).
// Pin order matches the silk-screen on the actual purple breakout: SCK, BCK,
// DIN, LCK, GND, VIN top-to-bottom on the front edge. SCK is tied to GND so
// the chip generates its master clock internally from BCK.

const PIN_I2S0 = 'var(--color-meter-normal)'
const PIN_I2S1 = 'var(--color-output-2)'
const PIN_PWR = 'var(--color-mute)'
const PIN_GND = 'var(--color-text-dimmed)'
const PIN_TEXT = 'var(--color-text-primary)'
const PIN_DIM = 'var(--color-text-secondary)'
const PIN_SURFACE = 'var(--color-surface-bg)'
const PIN_PANEL = 'color-mix(in srgb, var(--color-panel-bg) 80%, transparent)'

// DAC pin row — declared at module scope so React doesn't recreate the
// component on every render of <PinDiagram>.
function DacPins({ baseY, accent }: { baseY: number; accent: string }) {
  const { t } = useTranslation()
  const rows: Array<{ y: number; label: string; tone: string; note?: string }> = [
    { y: 0, label: 'SCK', tone: PIN_GND, note: t('about.pinSckNote') },
    { y: 22, label: 'BCK', tone: accent },
    { y: 44, label: 'DIN', tone: accent },
    { y: 66, label: 'LCK', tone: accent },
    { y: 88, label: 'GND', tone: PIN_GND },
    { y: 110, label: 'VIN', tone: PIN_PWR, note: t('about.pinVinNote') },
  ]
  return (
    <g>
      {rows.map((r) => (
        <g key={r.label}>
          <circle cx={510} cy={baseY + r.y} r={4} fill={r.tone} />
          <text
            x={520}
            y={baseY + r.y + 4}
            fontSize="11"
            fontFamily="monospace"
            fill={PIN_TEXT}
            fontWeight={600}
          >
            {r.label}
          </text>
          {r.note && (
            <text
              x={560}
              y={baseY + r.y + 4}
              fontSize="9.5"
              fontFamily="monospace"
              fill={PIN_DIM}
              fontStyle="italic"
            >
              {r.note}
            </text>
          )}
        </g>
      ))}
    </g>
  )
}

function PinDiagram() {
  const { t } = useTranslation()
  const I2S0 = PIN_I2S0
  const I2S1 = PIN_I2S1
  const PWR = PIN_PWR
  const GND = PIN_GND
  const TEXT = PIN_TEXT
  const DIM = PIN_DIM
  const SURFACE = PIN_SURFACE
  const PANEL = PIN_PANEL

  return (
    <svg viewBox="0 0 760 510" className="w-full" style={{ maxHeight: 600 }}>
      <defs>
        <marker
          id="arrow-i2s0"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 Z" fill={I2S0} />
        </marker>
        <marker
          id="arrow-i2s1"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 Z" fill={I2S1} />
        </marker>
        <marker
          id="arrow-pwr"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 Z" fill={PWR} />
        </marker>
        <marker
          id="arrow-gnd"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 Z" fill={GND} />
        </marker>
      </defs>

      {/* ESP32-S3 module */}
      <g>
        <rect
          x="30"
          y="50"
          width="200"
          height="400"
          rx="12"
          fill={PANEL}
          stroke={SURFACE}
          strokeWidth="1.5"
        />
        <text x="130" y="78" textAnchor="middle" fontSize="14" fontWeight="700" fill={TEXT}>
          ESP32-S3
        </text>
        <text x="130" y="94" textAnchor="middle" fontSize="10" fill={DIM}>
          {t('about.pinUsbSub')}
        </text>

        {/* Power pins */}
        <circle cx="230" cy="140" r="4" fill={PWR} />
        <text x="220" y="144" textAnchor="end" fontSize="11" fontFamily="monospace" fill={TEXT}>
          3V3
        </text>
        <circle cx="230" cy="162" r="4" fill={GND} />
        <text x="220" y="166" textAnchor="end" fontSize="11" fontFamily="monospace" fill={TEXT}>
          GND
        </text>

        {/* I2S0 group */}
        <text x="40" y="210" fontSize="10" fill={I2S0} fontWeight="700" letterSpacing="0.05em">
          I2S0 → DAC #1
        </text>
        <circle cx="230" cy="226" r="4" fill={I2S0} />
        <text x="220" y="230" textAnchor="end" fontSize="11" fontFamily="monospace" fill={TEXT}>
          GPIO 4 · BCK
        </text>
        <circle cx="230" cy="248" r="4" fill={I2S0} />
        <text x="220" y="252" textAnchor="end" fontSize="11" fontFamily="monospace" fill={TEXT}>
          GPIO 5 · LCK
        </text>
        <circle cx="230" cy="270" r="4" fill={I2S0} />
        <text x="220" y="274" textAnchor="end" fontSize="11" fontFamily="monospace" fill={TEXT}>
          GPIO 6 · DIN
        </text>

        {/* I2S1 group */}
        <text x="40" y="320" fontSize="10" fill={I2S1} fontWeight="700" letterSpacing="0.05em">
          I2S1 → DAC #2
        </text>
        <circle cx="230" cy="336" r="4" fill={I2S1} />
        <text x="220" y="340" textAnchor="end" fontSize="11" fontFamily="monospace" fill={TEXT}>
          GPIO 16 · BCK
        </text>
        <circle cx="230" cy="358" r="4" fill={I2S1} />
        <text x="220" y="362" textAnchor="end" fontSize="11" fontFamily="monospace" fill={TEXT}>
          GPIO 17 · LCK
        </text>
        <circle cx="230" cy="380" r="4" fill={I2S1} />
        <text x="220" y="384" textAnchor="end" fontSize="11" fontFamily="monospace" fill={TEXT}>
          GPIO 18 · DIN
        </text>

        {/* USB connector indicator */}
        <rect
          x="60"
          y="10"
          width="60"
          height="22"
          rx="3"
          fill={SURFACE}
          stroke={DIM}
          strokeWidth="1"
        />
        <text x="90" y="25" textAnchor="middle" fontSize="9" fontFamily="monospace" fill={DIM}>
          USB-C
        </text>
        <line x1="90" y1="32" x2="90" y2="50" stroke={DIM} strokeWidth="1" strokeDasharray="2,2" />
      </g>

      {/* DAC #1 — PCM5102A (Left) */}
      <g>
        <rect
          x="500"
          y="50"
          width="240"
          height="180"
          rx="10"
          fill={PANEL}
          stroke={I2S0}
          strokeWidth="1.5"
        />
        <text x="620" y="76" textAnchor="middle" fontSize="14" fontWeight="700" fill={I2S0}>
          PCM5102A #1
        </text>
        <text x="620" y="92" textAnchor="middle" fontSize="10" fill={DIM}>
          {t('about.pinDacLeft')}
        </text>
        <text x="620" y="106" textAnchor="middle" fontSize="9" fill={DIM} fontStyle="italic">
          GY-PCM5102 · TENSTAR ROBOT
        </text>
        <DacPins baseY={120} accent={I2S0} />
        <text
          x="620"
          y="248"
          textAnchor="middle"
          fontSize="9"
          fill={DIM}
          fontStyle="italic"
          opacity="0.85"
        >
          {t('about.pinJumper')}
        </text>
      </g>

      {/* DAC #2 — PCM5102A (Right) */}
      <g>
        <rect
          x="500"
          y="270"
          width="240"
          height="180"
          rx="10"
          fill={PANEL}
          stroke={I2S1}
          strokeWidth="1.5"
        />
        <text x="620" y="296" textAnchor="middle" fontSize="14" fontWeight="700" fill={I2S1}>
          PCM5102A #2
        </text>
        <text x="620" y="312" textAnchor="middle" fontSize="10" fill={DIM}>
          {t('about.pinDacRight')}
        </text>
        <text x="620" y="326" textAnchor="middle" fontSize="9" fill={DIM} fontStyle="italic">
          GY-PCM5102 · TENSTAR ROBOT
        </text>
        <DacPins baseY={340} accent={I2S1} />
        <text
          x="620"
          y="468"
          textAnchor="middle"
          fontSize="9"
          fill={DIM}
          fontStyle="italic"
          opacity="0.85"
        >
          {t('about.pinJumper')}
        </text>
      </g>

      {/* 3V3 → both VINs */}
      {/* VIN row sits at baseY+110 → DAC1: y=230, DAC2: y=450 */}
      <path
        d="M 230 140 L 360 140 L 360 230 L 510 230"
        fill="none"
        stroke={PWR}
        strokeWidth="2"
        markerEnd="url(#arrow-pwr)"
      />
      <path
        d="M 360 230 L 360 450 L 510 450"
        fill="none"
        stroke={PWR}
        strokeWidth="2"
        markerEnd="url(#arrow-pwr)"
      />

      {/* GND → DAC GND pads (at baseY+88) AND DAC SCK pads (at baseY+0) */}
      {/* DAC1 GND y=208, DAC1 SCK y=120, DAC2 GND y=428, DAC2 SCK y=340 */}
      <path
        d="M 230 162 L 380 162 L 380 208 L 510 208"
        fill="none"
        stroke={GND}
        strokeWidth="2"
        markerEnd="url(#arrow-gnd)"
      />
      <path
        d="M 380 162 L 380 120 L 510 120"
        fill="none"
        stroke={GND}
        strokeWidth="1.6"
        markerEnd="url(#arrow-gnd)"
        opacity="0.85"
      />
      <path
        d="M 380 208 L 380 428 L 510 428"
        fill="none"
        stroke={GND}
        strokeWidth="2"
        markerEnd="url(#arrow-gnd)"
      />
      <path
        d="M 380 428 L 380 340 L 510 340"
        fill="none"
        stroke={GND}
        strokeWidth="1.6"
        markerEnd="url(#arrow-gnd)"
        opacity="0.85"
      />

      {/* I2S0 → DAC #1 — three direct lines, each going to its specific pad */}
      {/* DAC1 BCK y=142, LCK y=186, DIN y=164 */}
      <path
        d="M 230 226 C 340 226, 420 142, 510 142"
        fill="none"
        stroke={I2S0}
        strokeWidth="2"
        markerEnd="url(#arrow-i2s0)"
      />
      <path
        d="M 230 248 C 340 248, 420 186, 510 186"
        fill="none"
        stroke={I2S0}
        strokeWidth="2"
        markerEnd="url(#arrow-i2s0)"
      />
      <path
        d="M 230 270 C 340 270, 420 164, 510 164"
        fill="none"
        stroke={I2S0}
        strokeWidth="2"
        markerEnd="url(#arrow-i2s0)"
      />

      {/* I2S1 → DAC #2 */}
      {/* DAC2 BCK y=362, LCK y=406, DIN y=384 */}
      <path
        d="M 230 336 C 340 336, 420 362, 510 362"
        fill="none"
        stroke={I2S1}
        strokeWidth="2"
        markerEnd="url(#arrow-i2s1)"
      />
      <path
        d="M 230 358 C 340 358, 420 406, 510 406"
        fill="none"
        stroke={I2S1}
        strokeWidth="2"
        markerEnd="url(#arrow-i2s1)"
      />
      <path
        d="M 230 380 C 340 380, 420 384, 510 384"
        fill="none"
        stroke={I2S1}
        strokeWidth="2"
        markerEnd="url(#arrow-i2s1)"
      />

      {/* Legend */}
      <g transform="translate(40 488)">
        <circle cx="0" cy="0" r="4" fill={I2S0} />
        <text x="10" y="4" fontSize="10" fill={DIM}>
          {t('about.pinLegendI2S0')}
        </text>
        <circle cx="120" cy="0" r="4" fill={I2S1} />
        <text x="130" y="4" fontSize="10" fill={DIM}>
          {t('about.pinLegendI2S1')}
        </text>
        <circle cx="240" cy="0" r="4" fill={PWR} />
        <text x="250" y="4" fontSize="10" fill={DIM}>
          {t('about.pinLegend3V3')}
        </text>
        <circle cx="340" cy="0" r="4" fill={GND} />
        <text x="350" y="4" fontSize="10" fill={DIM}>
          {t('about.pinLegendGnd')}
        </text>
      </g>
    </svg>
  )
}

export function AboutDialog({ onClose }: AboutDialogProps) {
  const { t } = useTranslation()
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-6"
      onClick={onClose}
    >
      <div
        className="glass-panel-strong w-full max-w-5xl my-4"
        style={{ borderRadius: 'var(--radius-panel)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-bg/50">
          <Logo />
          <Tooltip content={t('about.closeTooltip')}>
            <button
              onClick={onClose}
              className="text-text-dimmed hover:text-text-primary text-2xl leading-none px-2 transition-colors"
              aria-label={t('about.closeAria')}
            >
              ×
            </button>
          </Tooltip>
        </div>

        {/* Body — scrollable content */}
        <div className="px-6 py-5 space-y-6">
          {/* About blurb + author */}
          <section>
            <h2 className="section-label mb-2" style={{ color: 'var(--color-accent)' }}>
              {t('about.title')}
            </h2>
            <p className="text-text-primary text-sm leading-relaxed">{t('about.blurb')}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
              <span className="section-label">{t('about.author')}</span>
              <a
                href="https://tamduongs.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline font-mono"
              >
                tamduongs.com
              </a>
            </div>
          </section>

          {/* DSP Features */}
          <section>
            <h2 className="section-label mb-3" style={{ color: 'var(--color-output-3)' }}>
              {t('about.featuresTitle')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card title={t('about.cardPerInput')}>
                <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                  <li>{t('about.featInput1')}</li>
                  <li>
                    <Trans i18nKey="about.featInput2" />
                  </li>
                  <li>
                    <Trans i18nKey="about.featInput3" />
                  </li>
                  <li>{t('about.featInput4')}</li>
                </ul>
              </Card>
              <Card title={t('about.cardRouting')}>
                <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                  <li>{t('about.featRouting1')}</li>
                  <li>{t('about.featRouting2')}</li>
                  <li>{t('about.featRouting3')}</li>
                </ul>
              </Card>
              <Card title={t('about.cardPerOutput')}>
                <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                  <li>{t('about.featOutput1')}</li>
                  <li>
                    <Trans i18nKey="about.featOutput2" />
                  </li>
                  <li>
                    <Trans i18nKey="about.featOutput3" />
                  </li>
                  <li>{t('about.featOutput4')}</li>
                  <li>{t('about.featOutput5')}</li>
                </ul>
              </Card>
              <Card title={t('about.cardMaster')}>
                <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                  <li>{t('about.featMaster1')}</li>
                  <li>{t('about.featMaster2')}</li>
                  <li>{t('about.featMaster3')}</li>
                  <li>{t('about.featMaster4')}</li>
                  <li>{t('about.featMaster5')}</li>
                </ul>
              </Card>
              <Card title={t('about.cardWorkflow')}>
                <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                  <li>{t('about.featWorkflow1')}</li>
                  <li>{t('about.featWorkflow2')}</li>
                  <li>
                    <Trans i18nKey="about.featWorkflow3" />
                  </li>
                  <li>
                    <Trans i18nKey="about.featWorkflow4" />
                  </li>
                  <li>{t('about.featWorkflow5')}</li>
                </ul>
              </Card>
              <Card title={t('about.cardAudioPath')}>
                <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                  <li>{t('about.featAudio1')}</li>
                  <li>{t('about.featAudio2')}</li>
                  <li>{t('about.featAudio3')}</li>
                  <li>{t('about.featAudio4')}</li>
                </ul>
              </Card>
            </div>
          </section>

          {/* Signal Flow Overview */}
          <section>
            <h2 className="section-label mb-3" style={{ color: 'var(--color-output-3)' }}>
              {t('about.signalFlowTitle')}
            </h2>
            <Card full>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <Block tone="src">
                  {t('about.sfUSBHost')}
                  <br />
                  <span className="text-[0.65rem] opacity-70">{t('about.sfUSBHostSub')}</span>
                </Block>
                <Arrow />
                <Block tone="src">
                  {t('about.sfTinyUSB')}
                  <br />
                  <span className="text-[0.65rem] opacity-70">{t('about.sfTinyUSBSub')}</span>
                </Block>
                <Arrow />
                <Block tone="plain">
                  {t('about.sfRingBuffer')}
                  <br />
                  <span className="text-[0.65rem] opacity-70">{t('about.sfRingBufferSub')}</span>
                </Block>
                <Arrow />
                <Block tone="dsp">
                  {t('about.sfASRC')}
                  <br />
                  <span className="text-[0.65rem] opacity-70">{t('about.sfASRCSub')}</span>
                </Block>
                <Arrow />
                <Block tone="dsp">
                  {t('about.sfDspPipeline')}
                  <br />
                  <span className="text-[0.65rem] opacity-70">{t('about.sfDspPipelineSub')}</span>
                </Block>
                <Arrow />
                <Block tone="out">
                  {t('about.sfI2S')}
                  <br />
                  <span className="text-[0.65rem] opacity-70">{t('about.sfI2SSub')}</span>
                </Block>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Block tone="ctrl">{t('about.sfWebUI')}</Block>
                <Arrow />
                <Block tone="ctrl">
                  {t('about.sfWebSerial')}
                  <br />
                  <span className="text-[0.65rem] opacity-70">{t('about.sfWebSerialSub')}</span>
                </Block>
                <Arrow />
                <Block tone="ctrl">
                  {t('about.sfSerialServer')}
                  <br />
                  <span className="text-[0.65rem] opacity-70">{t('about.sfSerialServerSub')}</span>
                </Block>
                <Arrow />
                <Block tone="dsp">
                  {t('about.sfParamEngine')}
                  <br />
                  <span className="text-[0.65rem] opacity-70">{t('about.sfParamEngineSub')}</span>
                </Block>
                <Arrow />
                <Block tone="dsp">
                  {t('about.sfDspPipeline')}
                  <br />
                  <span className="text-[0.65rem] opacity-70">{t('about.sfDspPipelineSub')}</span>
                </Block>
              </div>
            </Card>
          </section>

          {/* DSP Pipeline Detail */}
          <section>
            <h2 className="section-label mb-3" style={{ color: 'var(--color-output-3)' }}>
              {t('about.pipelineDetailTitle')}
            </h2>
            <Card full>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <Block tone="src">
                  {t('about.pdStereoIn')}
                  <br />
                  <span className="text-[0.65rem] opacity-70">{t('about.pdStereoInSub')}</span>
                </Block>
                <Arrow />
                <Block tone="dsp">
                  {t('about.pdInputGain')}
                  <br />
                  {t('about.pdInputGainSub')}
                </Block>
                <Arrow />
                <Block tone="dsp">
                  {t('about.pdRoomEq')}
                  <br />
                  <span className="text-[0.65rem] opacity-70">{t('about.pdRoomEqSub')}</span>
                </Block>
                <Arrow />
                <Block tone="dsp">
                  {t('about.pdInputPeq')}
                  <br />
                  <span className="text-[0.65rem] opacity-70">{t('about.pdInputPeqSub')}</span>
                </Block>
                <Arrow />
                <Block tone="dsp">
                  {t('about.pdRouting')}
                  <br />
                  {t('about.pdRoutingSub')}
                </Block>
                <Arrow />
                <Block tone="dsp">
                  {t('about.pdOutputPeq')}
                  <br />
                  <span className="text-[0.65rem] opacity-70">{t('about.pdOutputPeqSub')}</span>
                </Block>
                <Arrow />
                <Block tone="dsp">
                  {t('about.pdCrossover')}
                  <br />
                  {t('about.pdCrossoverSub')}
                </Block>
                <Arrow />
                <Block tone="dsp">
                  {t('about.pdGainDelay')}
                  <br />
                  {t('about.pdGainDelaySub')}
                </Block>
                <Arrow />
                <Block tone="out">
                  {t('about.pdOutputs')}
                  <br />
                  <span className="text-[0.65rem] opacity-70">{t('about.pdOutputsSub')}</span>
                </Block>
              </div>
              <div
                className="text-xs text-text-secondary leading-relaxed bg-surface-bg/30 rounded p-3 border-l-2"
                style={{ borderLeftColor: 'var(--color-output-2)' }}
              >
                <strong className="text-text-primary">{t('about.pdTypical21Title')}</strong>{' '}
                {t('about.pdTypical21')}
                <br />
                <strong className="text-text-primary">{t('about.pdTypicalBiampTitle')}</strong>{' '}
                {t('about.pdTypicalBiamp')}
              </div>
            </Card>
          </section>

          {/* Wiring Diagram */}
          <section>
            <h2 className="section-label mb-3" style={{ color: 'var(--color-output-3)' }}>
              {t('about.wiringTitle')}
            </h2>
            <Card full>
              <PinDiagram />
              <div className="text-xs text-text-secondary mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div
                  className="bg-surface-bg/30 rounded p-3 border-l-2"
                  style={{ borderLeftColor: 'var(--color-output-2)' }}
                >
                  <Trans i18nKey="about.wiringBoard" />
                </div>
                <div
                  className="bg-surface-bg/30 rounded p-3 border-l-2"
                  style={{ borderLeftColor: 'var(--color-meter-normal)' }}
                >
                  <Trans i18nKey="about.wiringPower" />
                </div>
              </div>
            </Card>
          </section>

          {/* ASRC algorithm */}
          <section>
            <h2 className="section-label mb-3" style={{ color: 'var(--color-output-3)' }}>
              {t('about.asrcTitle')}
            </h2>
            <Card full>
              <p className="text-sm text-text-primary leading-relaxed mb-3">
                {t('about.asrcIntro')}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4">
                <Block tone="src">
                  {t('about.asrcBlockUsb')}
                  <br />
                  <span className="text-[0.65rem] opacity-70">{t('about.asrcBlockUsbSub')}</span>
                </Block>
                <Block tone="dsp">
                  {t('about.asrcBlockPi')}
                  <br />
                  <span className="text-[0.65rem] opacity-70">{t('about.asrcBlockPiSub')}</span>
                </Block>
                <Block tone="out">
                  {t('about.asrcBlockI2s')}
                  <br />
                  <span className="text-[0.65rem] opacity-70">{t('about.asrcBlockI2sSub')}</span>
                </Block>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-surface-bg/30 rounded p-3 text-xs">
                  <div
                    className="section-label mb-2"
                    style={{ color: 'var(--color-meter-normal)' }}
                  >
                    {t('about.asrcControlLaw')}
                  </div>
                  <p className="text-text-secondary mb-2">{t('about.asrcControlLawText')}</p>
                  <pre className="value-mono text-text-primary text-[0.7rem] bg-app-bg/40 p-2 rounded">{`error = fill − targetFill
integral += error · dt
ratio = 1 + Kp·error + Ki·integral
ratio = clamp(ratio, ±maxPpm)`}</pre>
                  <p className="text-text-dimmed mt-2 italic">{t('about.asrcDefaults')}</p>
                </div>
                <div className="bg-surface-bg/30 rounded p-3 text-xs">
                  <div className="section-label mb-2" style={{ color: 'var(--color-output-3)' }}>
                    {t('about.asrcTuning')}
                  </div>
                  <ul className="text-text-secondary space-y-1.5 list-disc list-inside">
                    <li>
                      <Trans i18nKey="about.asrcTuning1" />
                    </li>
                    <li>
                      <Trans i18nKey="about.asrcTuning2" />
                    </li>
                    <li>
                      <Trans i18nKey="about.asrcTuning3" />
                    </li>
                    <li>
                      <Trans i18nKey="about.asrcTuning4" />
                    </li>
                  </ul>
                  <p className="text-text-dimmed mt-2 italic">{t('about.asrcTuningTip')}</p>
                </div>
              </div>
            </Card>
          </section>

          {/* Software Architecture */}
          <section>
            <h2 className="section-label mb-3" style={{ color: 'var(--color-output-3)' }}>
              {t('about.softwareTitle')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card title={t('about.cardCore0')}>
                <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                  <li>
                    <Trans i18nKey="about.swCore0List1" />
                  </li>
                  <li>
                    <Trans i18nKey="about.swCore0List2" />
                  </li>
                  <li>
                    <Trans i18nKey="about.swCore0List3" />
                  </li>
                  <li>
                    <Trans i18nKey="about.swCore0List4" />
                  </li>
                </ul>
              </Card>
              <Card title={t('about.cardCore1')}>
                <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                  <li>
                    <Trans i18nKey="about.swCore1List1" />
                  </li>
                  <li>
                    <Trans i18nKey="about.swCore1List2" />
                  </li>
                  <li>{t('about.swCore1List3')}</li>
                  <li>{t('about.swCore1List4')}</li>
                </ul>
              </Card>
              <Card title={t('about.cardParamFlow')}>
                <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                  <li>{t('about.swParamFlow1')}</li>
                  <li>
                    <Trans i18nKey="about.swParamFlow2" />
                  </li>
                  <li>{t('about.swParamFlow3')}</li>
                  <li>{t('about.swParamFlow4')}</li>
                  <li>
                    <Trans i18nKey="about.swParamFlow5" />
                  </li>
                  <li>
                    <Trans i18nKey="about.swParamFlow6" />
                  </li>
                </ul>
              </Card>
              <Card title={t('about.cardKeyFiles')}>
                <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside font-mono">
                  <li>
                    <code className="value-mono">firmware-s3/main/main.c</code>
                  </li>
                  <li>
                    <code className="value-mono">firmware-s3/main/usb_audio.c</code>
                  </li>
                  <li>
                    <code className="value-mono">firmware-s3/main/i2s_audio.c</code>
                  </li>
                  <li>
                    <code className="value-mono">firmware-s3/main/dsp_pipeline.c</code>
                  </li>
                  <li>
                    <code className="value-mono">firmware-s3/main/dsp_param_update.c</code>
                  </li>
                  <li>
                    <code className="value-mono">firmware-s3/main/serial_server.c</code>
                  </li>
                  <li>
                    <code className="value-mono">src/store/dsp-store.ts</code>
                  </li>
                  <li>
                    <code className="value-mono">src/serial/serial-middleware.ts</code>
                  </li>
                </ul>
              </Card>
            </div>
          </section>

          {/* Quick Test Checklist */}
          <section>
            <h2 className="section-label mb-3" style={{ color: 'var(--color-output-3)' }}>
              {t('about.checklistTitle')}
            </h2>
            <Card full>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left border-b border-surface-bg/50">
                    <th className="py-1.5 px-2 text-accent font-semibold w-8">#</th>
                    <th className="py-1.5 px-2 text-accent font-semibold">
                      {t('about.checklistTest')}
                    </th>
                    <th className="py-1.5 px-2 text-accent font-semibold">
                      {t('about.checklistExpected')}
                    </th>
                  </tr>
                </thead>
                <tbody className="text-text-secondary">
                  {[
                    ['1', 'about.check1Test', 'about.check1Exp'],
                    ['2', 'about.check2Test', 'about.check2Exp'],
                    ['3', 'about.check3Test', 'about.check3Exp'],
                    ['4', 'about.check4Test', 'about.check4Exp'],
                    ['5', 'about.check5Test', 'about.check5Exp'],
                    ['6', 'about.check6Test', 'about.check6Exp'],
                    ['7', 'about.check7Test', 'about.check7Exp'],
                    ['8', 'about.check8Test', 'about.check8Exp'],
                    ['9', 'about.check9Test', 'about.check9Exp'],
                    ['10', 'about.check10Test', 'about.check10Exp'],
                  ].map(([n, testKey, expKey]) => (
                    <tr key={n} className="border-b border-surface-bg/30 last:border-0">
                      <td className="py-1.5 px-2 font-mono text-text-dimmed">{n}</td>
                      <td className="py-1.5 px-2">{t(testKey)}</td>
                      <td className="py-1.5 px-2 text-text-dimmed">{t(expKey)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>
        </div>

        {/* Footer — version + author */}
        <div className="px-6 py-3 border-t border-surface-bg/50 flex items-center justify-between text-xs text-text-dimmed gap-4 flex-wrap">
          <span>DQ-DSP — ESP32-S3 + USB UAC + 2× PCM5102A</span>
          <span className="flex items-center gap-3 value-mono">
            <Tooltip
              content={t('footer.buildCommit', {
                commit: __APP_COMMIT__,
                date: __APP_BUILD_DATE__,
              })}
              placement="top"
            >
              <span>
                v{__APP_VERSION__}
                <span className="text-text-dimmed/60 ml-1">
                  ({__APP_COMMIT__} · {__APP_BUILD_DATE__})
                </span>
              </span>
            </Tooltip>
            <a
              href="https://tamduongs.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              tamduongs.com
            </a>
          </span>
        </div>
      </div>
    </div>
  )
}
