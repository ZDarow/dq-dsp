import { useTranslation } from 'react-i18next';
import { Logo } from '../layout/Logo';
import { Tooltip } from '../ui/Tooltip';

interface AboutDialogProps {
  onClose: () => void;
}

function Block({ tone, children }: { tone: 'src' | 'dsp' | 'out' | 'out2' | 'ctrl' | 'plain'; children: React.ReactNode }) {
  const palette = {
    src: 'var(--color-accent)',
    dsp: 'var(--color-meter-normal)',
    out: 'var(--color-output-2)',
    out2: 'var(--color-output-3)',
    ctrl: 'var(--color-output-3)',
    plain: 'var(--color-text-dimmed)',
  } as const;
  const color = palette[tone];
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
  );
}

function Arrow() {
  return <span className="text-text-dimmed text-base">→</span>;
}

function Card({ title, children, full }: { title?: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div
      className={`glass-panel p-4 ${full ? 'col-span-full' : ''}`}
      style={{ borderRadius: 'var(--radius-panel)' }}
    >
      {title && <h3 className="section-label mb-3" style={{ color: 'var(--color-output-2)' }}>{title}</h3>}
      {children}
    </div>
  );
}

// SVG pin diagram — ESP32-S3 → 2× PCM5102A (TENSTAR ROBOT / GY-PCM5102 board).
// Pin order matches the silk-screen on the actual purple breakout: SCK, BCK,
// DIN, LCK, GND, VIN top-to-bottom on the front edge. SCK is tied to GND so
// the chip generates its master clock internally from BCK.

const PIN_I2S0 = 'var(--color-meter-normal)';
const PIN_I2S1 = 'var(--color-output-2)';
const PIN_PWR = 'var(--color-mute)';
const PIN_GND = 'var(--color-text-dimmed)';
const PIN_TEXT = 'var(--color-text-primary)';
const PIN_DIM = 'var(--color-text-secondary)';
const PIN_SURFACE = 'var(--color-surface-bg)';
const PIN_PANEL = 'color-mix(in srgb, var(--color-panel-bg) 80%, transparent)';

// DAC pin row — declared at module scope so React doesn't recreate the
// component on every render of <PinDiagram>.
function DacPins({ baseY, accent }: { baseY: number; accent: string }) {
  const rows: Array<{ y: number; label: string; tone: string; note?: string }> = [
    { y: 0, label: 'SCK', tone: PIN_GND, note: '→ GND (internal MCLK)' },
    { y: 22, label: 'BCK', tone: accent },
    { y: 44, label: 'DIN', tone: accent },
    { y: 66, label: 'LCK', tone: accent },
    { y: 88, label: 'GND', tone: PIN_GND },
    { y: 110, label: 'VIN', tone: PIN_PWR, note: '3.3 V' },
  ];
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
  );
}

function PinDiagram() {
  const I2S0 = PIN_I2S0;
  const I2S1 = PIN_I2S1;
  const PWR = PIN_PWR;
  const GND = PIN_GND;
  const TEXT = PIN_TEXT;
  const DIM = PIN_DIM;
  const SURFACE = PIN_SURFACE;
  const PANEL = PIN_PANEL;

  return (
    <svg viewBox="0 0 760 510" className="w-full" style={{ maxHeight: 600 }}>
      <defs>
        <marker id="arrow-i2s0" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill={I2S0} />
        </marker>
        <marker id="arrow-i2s1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill={I2S1} />
        </marker>
        <marker id="arrow-pwr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill={PWR} />
        </marker>
        <marker id="arrow-gnd" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill={GND} />
        </marker>
      </defs>

      {/* ESP32-S3 module */}
      <g>
        <rect x="30" y="50" width="200" height="400" rx="12" fill={PANEL} stroke={SURFACE} strokeWidth="1.5" />
        <text x="130" y="78" textAnchor="middle" fontSize="14" fontWeight="700" fill={TEXT}>ESP32-S3</text>
        <text x="130" y="94" textAnchor="middle" fontSize="10" fill={DIM}>USB-OTG (UAC) + UART0 (USB-CDC bridge)</text>

        {/* Power pins */}
        <circle cx="230" cy="140" r="4" fill={PWR} />
        <text x="220" y="144" textAnchor="end" fontSize="11" fontFamily="monospace" fill={TEXT}>3V3</text>
        <circle cx="230" cy="162" r="4" fill={GND} />
        <text x="220" y="166" textAnchor="end" fontSize="11" fontFamily="monospace" fill={TEXT}>GND</text>

        {/* I2S0 group */}
        <text x="40" y="210" fontSize="10" fill={I2S0} fontWeight="700" letterSpacing="0.05em">I2S0 → DAC #1</text>
        <circle cx="230" cy="226" r="4" fill={I2S0} />
        <text x="220" y="230" textAnchor="end" fontSize="11" fontFamily="monospace" fill={TEXT}>GPIO 4 · BCK</text>
        <circle cx="230" cy="248" r="4" fill={I2S0} />
        <text x="220" y="252" textAnchor="end" fontSize="11" fontFamily="monospace" fill={TEXT}>GPIO 5 · LCK</text>
        <circle cx="230" cy="270" r="4" fill={I2S0} />
        <text x="220" y="274" textAnchor="end" fontSize="11" fontFamily="monospace" fill={TEXT}>GPIO 6 · DIN</text>

        {/* I2S1 group */}
        <text x="40" y="320" fontSize="10" fill={I2S1} fontWeight="700" letterSpacing="0.05em">I2S1 → DAC #2</text>
        <circle cx="230" cy="336" r="4" fill={I2S1} />
        <text x="220" y="340" textAnchor="end" fontSize="11" fontFamily="monospace" fill={TEXT}>GPIO 16 · BCK</text>
        <circle cx="230" cy="358" r="4" fill={I2S1} />
        <text x="220" y="362" textAnchor="end" fontSize="11" fontFamily="monospace" fill={TEXT}>GPIO 17 · LCK</text>
        <circle cx="230" cy="380" r="4" fill={I2S1} />
        <text x="220" y="384" textAnchor="end" fontSize="11" fontFamily="monospace" fill={TEXT}>GPIO 18 · DIN</text>

        {/* USB connector indicator */}
        <rect x="60" y="10" width="60" height="22" rx="3" fill={SURFACE} stroke={DIM} strokeWidth="1" />
        <text x="90" y="25" textAnchor="middle" fontSize="9" fontFamily="monospace" fill={DIM}>USB-C</text>
        <line x1="90" y1="32" x2="90" y2="50" stroke={DIM} strokeWidth="1" strokeDasharray="2,2" />
      </g>

      {/* DAC #1 — PCM5102A (Left) */}
      <g>
        <rect x="500" y="50" width="240" height="180" rx="10" fill={PANEL} stroke={I2S0} strokeWidth="1.5" />
        <text x="620" y="76" textAnchor="middle" fontSize="14" fontWeight="700" fill={I2S0}>PCM5102A #1</text>
        <text x="620" y="92" textAnchor="middle" fontSize="10" fill={DIM}>Left speaker · Out 1+2</text>
        <text x="620" y="106" textAnchor="middle" fontSize="9" fill={DIM} fontStyle="italic">GY-PCM5102 · TENSTAR ROBOT</text>
        <DacPins baseY={120} accent={I2S0} />
        <text x="620" y="248" textAnchor="middle" fontSize="9" fill={DIM} fontStyle="italic" opacity="0.85">
          back-side jumpers: H3L XSMT → HIGH (un-mute)
        </text>
      </g>

      {/* DAC #2 — PCM5102A (Right) */}
      <g>
        <rect x="500" y="270" width="240" height="180" rx="10" fill={PANEL} stroke={I2S1} strokeWidth="1.5" />
        <text x="620" y="296" textAnchor="middle" fontSize="14" fontWeight="700" fill={I2S1}>PCM5102A #2</text>
        <text x="620" y="312" textAnchor="middle" fontSize="10" fill={DIM}>Right speaker · Out 3+4</text>
        <text x="620" y="326" textAnchor="middle" fontSize="9" fill={DIM} fontStyle="italic">GY-PCM5102 · TENSTAR ROBOT</text>
        <DacPins baseY={340} accent={I2S1} />
        <text x="620" y="468" textAnchor="middle" fontSize="9" fill={DIM} fontStyle="italic" opacity="0.85">
          back-side jumpers: H3L XSMT → HIGH (un-mute)
        </text>
      </g>

      {/* 3V3 → both VINs */}
      {/* VIN row sits at baseY+110 → DAC1: y=230, DAC2: y=450 */}
      <path d="M 230 140 L 360 140 L 360 230 L 510 230" fill="none" stroke={PWR} strokeWidth="2" markerEnd="url(#arrow-pwr)" />
      <path d="M 360 230 L 360 450 L 510 450" fill="none" stroke={PWR} strokeWidth="2" markerEnd="url(#arrow-pwr)" />

      {/* GND → DAC GND pads (at baseY+88) AND DAC SCK pads (at baseY+0) */}
      {/* DAC1 GND y=208, DAC1 SCK y=120, DAC2 GND y=428, DAC2 SCK y=340 */}
      <path d="M 230 162 L 380 162 L 380 208 L 510 208" fill="none" stroke={GND} strokeWidth="2" markerEnd="url(#arrow-gnd)" />
      <path d="M 380 162 L 380 120 L 510 120" fill="none" stroke={GND} strokeWidth="1.6" markerEnd="url(#arrow-gnd)" opacity="0.85" />
      <path d="M 380 208 L 380 428 L 510 428" fill="none" stroke={GND} strokeWidth="2" markerEnd="url(#arrow-gnd)" />
      <path d="M 380 428 L 380 340 L 510 340" fill="none" stroke={GND} strokeWidth="1.6" markerEnd="url(#arrow-gnd)" opacity="0.85" />

      {/* I2S0 → DAC #1 — three direct lines, each going to its specific pad */}
      {/* DAC1 BCK y=142, LCK y=186, DIN y=164 */}
      <path d="M 230 226 C 340 226, 420 142, 510 142" fill="none" stroke={I2S0} strokeWidth="2" markerEnd="url(#arrow-i2s0)" />
      <path d="M 230 248 C 340 248, 420 186, 510 186" fill="none" stroke={I2S0} strokeWidth="2" markerEnd="url(#arrow-i2s0)" />
      <path d="M 230 270 C 340 270, 420 164, 510 164" fill="none" stroke={I2S0} strokeWidth="2" markerEnd="url(#arrow-i2s0)" />

      {/* I2S1 → DAC #2 */}
      {/* DAC2 BCK y=362, LCK y=406, DIN y=384 */}
      <path d="M 230 336 C 340 336, 420 362, 510 362" fill="none" stroke={I2S1} strokeWidth="2" markerEnd="url(#arrow-i2s1)" />
      <path d="M 230 358 C 340 358, 420 406, 510 406" fill="none" stroke={I2S1} strokeWidth="2" markerEnd="url(#arrow-i2s1)" />
      <path d="M 230 380 C 340 380, 420 384, 510 384" fill="none" stroke={I2S1} strokeWidth="2" markerEnd="url(#arrow-i2s1)" />

      {/* Legend */}
      <g transform="translate(40 488)">
        <circle cx="0" cy="0" r="4" fill={I2S0} /><text x="10" y="4" fontSize="10" fill={DIM}>I2S0 → DAC #1</text>
        <circle cx="120" cy="0" r="4" fill={I2S1} /><text x="130" y="4" fontSize="10" fill={DIM}>I2S1 → DAC #2</text>
        <circle cx="240" cy="0" r="4" fill={PWR} /><text x="250" y="4" fontSize="10" fill={DIM}>3V3 power</text>
        <circle cx="340" cy="0" r="4" fill={GND} /><text x="350" y="4" fontSize="10" fill={DIM}>GND (incl. SCK tie)</text>
      </g>
    </svg>
  );
}

export function AboutDialog({ onClose }: AboutDialogProps) {
  const { t } = useTranslation();
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
            <h2 className="section-label mb-2" style={{ color: 'var(--color-accent)' }}>{t('about.title')}</h2>
            <p className="text-text-primary text-sm leading-relaxed">
              DQ-DSP is a flexible 2-in / 4-out audio DSP firmware-and-UI for the ESP32-S3, built around USB
              UAC class-compliant audio plus live serial control. The web UI streams every parameter
              tweak (gain, EQ, crossover, routing) to the device in real time, with bulk Apply for
              preset loads and Save-to-Device for NVS persistence.
            </p>
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
            <h2 className="section-label mb-3" style={{ color: 'var(--color-output-3)' }}>{t('about.featuresTitle')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card title={t('about.cardPerInput')}>
                <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                  <li>Gain (−72 to +12 dB), mute, polarity invert</li>
                  <li><strong className="text-text-primary">10-band parametric EQ</strong> — peak / shelf / HP / LP / notch</li>
                  <li><strong className="text-text-primary">10-band Room EQ stage</strong> with REW measurement import + auto-EQ against flat / Harman / tilt targets</li>
                  <li>Stereo link mirrors edits across both inputs</li>
                </ul>
              </Card>
              <Card title={t('about.cardRouting')}>
                <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                  <li>Per-crosspoint enable + linear gain (0–100 %)</li>
                  <li>Mono-sum, balance, route a single sub off both channels</li>
                  <li>Live diff-sent on every edit — no recompile, no reflash</li>
                </ul>
              </Card>
              <Card title={t('about.cardPerOutput')}>
                <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                  <li>Gain, mute, polarity invert, delay (0–10 ms, sample-accurate)</li>
                  <li><strong className="text-text-primary">10-band parametric EQ</strong> per output</li>
                  <li><strong className="text-text-primary">Crossover</strong> — HP + LP, Linkwitz-Riley or Butterworth, 6 / 12 / 18 / 24 dB/oct slopes</li>
                  <li>Flexible link groups — any-to-any output mirroring (stereo pairs, gang-summed subs, etc.)</li>
                  <li>One-shot copy from any output to any other</li>
                </ul>
              </Card>
              <Card title={t('about.cardMaster')}>
                <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                  <li>Master volume after all per-output processing</li>
                  <li>Soft-clip limiter on the final stage</li>
                  <li>Drift compensation (ASRC) tunable per device</li>
                  <li>Live CPU-load + buffer-fill telemetry charts</li>
                  <li>Acoustic-sum visualization — pick output groups, see their complex sum on the response chart</li>
                </ul>
              </Card>
              <Card title={t('about.cardWorkflow')}>
                <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                  <li>Browser preset library in localStorage + JSON import / export</li>
                  <li>Saved/Modified/Unsaved indicator vs the loaded preset</li>
                  <li><strong className="text-text-primary">Apply</strong> bulk-pushes the running config to ESP32 RAM</li>
                  <li><strong className="text-text-primary">Save to Device</strong> commits to NVS so it survives a power cycle</li>
                  <li>Light / dark theme; per-channel color identity across sidebar / chart / PEQ</li>
                </ul>
              </Card>
              <Card title={t('about.cardAudioPath')}>
                <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                  <li>USB Audio Class 1.0 — 2 ch in / out, 24-bit, 48 kHz</li>
                  <li>Dual I2S TX → 2 × PCM5102A (4 channels, 24-bit internal pipeline)</li>
                  <li>Sample-rate-agnostic biquads (coeffs recomputed if SR changes)</li>
                  <li>Atomic config swap — parameter updates never click or pop</li>
                </ul>
              </Card>
            </div>
          </section>

          {/* Signal Flow Overview */}
          <section>
            <h2 className="section-label mb-3" style={{ color: 'var(--color-output-3)' }}>{t('about.signalFlowTitle')}</h2>
            <Card full>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <Block tone="src">USB Host<br /><span className="text-[0.65rem] opacity-70">UAC class</span></Block>
                <Arrow />
                <Block tone="src">TinyUSB<br /><span className="text-[0.65rem] opacity-70">48 kHz I2S</span></Block>
                <Arrow />
                <Block tone="plain">Ring Buffer<br /><span className="text-[0.65rem] opacity-70">drift-corrected</span></Block>
                <Arrow />
                <Block tone="dsp">ASRC<br /><span className="text-[0.65rem] opacity-70">PI controller</span></Block>
                <Arrow />
                <Block tone="dsp">DSP Pipeline<br /><span className="text-[0.65rem] opacity-70">Core 1</span></Block>
                <Arrow />
                <Block tone="out">2× I2S TX → 2× PCM5102A<br /><span className="text-[0.65rem] opacity-70">Out 1–4</span></Block>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Block tone="ctrl">Web UI</Block>
                <Arrow />
                <Block tone="ctrl">Web Serial<br /><span className="text-[0.65rem] opacity-70">USB CDC 115200</span></Block>
                <Arrow />
                <Block tone="ctrl">Serial Server<br /><span className="text-[0.65rem] opacity-70">Core 0</span></Block>
                <Arrow />
                <Block tone="dsp">Param Engine<br /><span className="text-[0.65rem] opacity-70">atomic swap</span></Block>
                <Arrow />
                <Block tone="dsp">DSP Pipeline<br /><span className="text-[0.65rem] opacity-70">Core 1</span></Block>
              </div>
            </Card>
          </section>

          {/* DSP Pipeline Detail */}
          <section>
            <h2 className="section-label mb-3" style={{ color: 'var(--color-output-3)' }}>{t('about.pipelineDetailTitle')}</h2>
            <Card full>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <Block tone="src">Stereo In<br /><span className="text-[0.65rem] opacity-70">L + R float</span></Block>
                <Arrow />
                <Block tone="dsp">Input Gain<br />Phase / Mute</Block>
                <Arrow />
                <Block tone="dsp">10-band Room EQ<br /><span className="text-[0.65rem] opacity-70">×2 ch</span></Block>
                <Arrow />
                <Block tone="dsp">10-band Input PEQ<br /><span className="text-[0.65rem] opacity-70">×2 ch</span></Block>
                <Arrow />
                <Block tone="dsp">2×4 Routing<br />Matrix</Block>
                <Arrow />
                <Block tone="dsp">Output PEQ<br /><span className="text-[0.65rem] opacity-70">×4 ch</span></Block>
                <Arrow />
                <Block tone="dsp">Crossover<br />HP + LP</Block>
                <Arrow />
                <Block tone="dsp">Gain / Delay<br />Phase / Mute</Block>
                <Arrow />
                <Block tone="out">4 Outputs<br /><span className="text-[0.65rem] opacity-70">int16 to DAC</span></Block>
              </div>
              <div className="text-xs text-text-secondary leading-relaxed bg-surface-bg/30 rounded p-3 border-l-2"
                   style={{ borderLeftColor: 'var(--color-output-2)' }}>
                <strong className="text-text-primary">Typical 2.1 use:</strong> Out 1 = sub (LP 80 Hz),
                Out 2 = left main (HP 80 Hz), Out 3 = right main (HP 80 Hz), Out 4 = spare.<br />
                <strong className="text-text-primary">Typical bi-amp use:</strong> Out 1 = woofer (LP 2 kHz),
                Out 2 = tweeter (HP 2 kHz LR4), mirror for the other channel on Out 3 + 4.
              </div>
            </Card>
          </section>

          {/* Wiring Diagram */}
          <section>
            <h2 className="section-label mb-3" style={{ color: 'var(--color-output-3)' }}>{t('about.wiringTitle')}</h2>
            <Card full>
              <PinDiagram />
              <div className="text-xs text-text-secondary mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-surface-bg/30 rounded p-3 border-l-2" style={{ borderLeftColor: 'var(--color-output-2)' }}>
                  <strong className="text-text-primary">GY-PCM5102 / TENSTAR ROBOT board:</strong> front-edge pads in order are <code className="value-mono">SCK · BCK · DIN · LCK · GND · VIN</code>. Tie <code className="value-mono">SCK</code> to <code className="value-mono">GND</code> so the chip generates its own MCLK from BCK. On the back, bridge <code className="value-mono">H3L</code> (XSMT) to the <strong>HIGH</strong> side — default position is LOW (soft-mute = silence). Leave <code className="value-mono">H1L FLT</code>, <code className="value-mono">H2L DEMP</code>, <code className="value-mono">H4L FMT</code> in their default LOW positions.
                </div>
                <div className="bg-surface-bg/30 rounded p-3 border-l-2" style={{ borderLeftColor: 'var(--color-meter-normal)' }}>
                  <strong className="text-text-primary">Audio + power:</strong> 3.5 mm jack on the right edge carries L+R line-out (stereo per board). Two boards together draw ≈ 50 mA at 3V3 — comfortably inside the ESP32-S3 dev-board's 3V3 LDO budget. Star-tie GND at the DAC side to keep digital switching noise off the analog output.
                </div>
              </div>
            </Card>
          </section>

          {/* ASRC algorithm */}
          <section>
            <h2 className="section-label mb-3" style={{ color: 'var(--color-output-3)' }}>{t('about.asrcTitle')}</h2>
            <Card full>
              <p className="text-sm text-text-primary leading-relaxed mb-3">
                The USB host clock and the ESP32 I2S clock are independent — over minutes they drift apart by tens of PPM, which would either over-fill the input ring buffer (clicks from drops) or starve it (clicks from underruns). ASRC re-samples the incoming USB stream by a fractional ratio so the output rate exactly tracks the I2S clock, and a PI controller nudges that ratio to keep the buffer at a target fill.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4">
                <Block tone="src">USB stream<br /><span className="text-[0.65rem] opacity-70">drifts ±20–50 ppm</span></Block>
                <Block tone="dsp">PI controller<br /><span className="text-[0.65rem] opacity-70">monitors fill %</span></Block>
                <Block tone="out">I2S stream<br /><span className="text-[0.65rem] opacity-70">DAC clock-locked</span></Block>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-surface-bg/30 rounded p-3 text-xs">
                  <div className="section-label mb-2" style={{ color: 'var(--color-meter-normal)' }}>Control law</div>
                  <p className="text-text-secondary mb-2">
                    Each telemetry tick the controller computes the buffer error vs. target (50% fill by default):
                  </p>
                  <pre className="value-mono text-text-primary text-[0.7rem] bg-app-bg/40 p-2 rounded">{`error = fill − targetFill
integral += error · dt
ratio = 1 + Kp·error + Ki·integral
ratio = clamp(ratio, ±maxPpm)`}</pre>
                  <p className="text-text-dimmed mt-2 italic">
                    Defaults: Kp = 0.3, Ki = 0.05, target = 50%, max ±200 ppm.
                  </p>
                </div>
                <div className="bg-surface-bg/30 rounded p-3 text-xs">
                  <div className="section-label mb-2" style={{ color: 'var(--color-output-3)' }}>Tuning</div>
                  <ul className="text-text-secondary space-y-1.5 list-disc list-inside">
                    <li><strong className="text-text-primary">Kp too low</strong> → buffer drifts away from target slowly, eventually glitches.</li>
                    <li><strong className="text-text-primary">Kp too high</strong> → audible warble as the controller hunts.</li>
                    <li><strong className="text-text-primary">Ki</strong> kills steady-state offset; raise gently if buffer parks at the wrong fill.</li>
                    <li><strong className="text-text-primary">maxPpm</strong> caps the worst-case correction — set just above your measured drift band.</li>
                  </ul>
                  <p className="text-text-dimmed mt-2 italic">
                    Tune live in the System panel — drift + jitter charts show the loop converging.
                  </p>
                </div>
              </div>
            </Card>
          </section>

          {/* Software Architecture */}
          <section>
            <h2 className="section-label mb-3" style={{ color: 'var(--color-output-3)' }}>{t('about.softwareTitle')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card title={t('about.cardCore0')}>
                <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                  <li><strong className="text-text-primary">tinyusb_task</strong> — UAC class driver on the native USB-OTG port</li>
                  <li><strong className="text-text-primary">UART0 / USB-Serial-JTAG</strong> — separate USB-C port; carries the Web Serial control stream</li>
                  <li><strong className="text-text-primary">serial_rx</strong> — frame parser, dispatches to <code className="value-mono">dsp_param_apply()</code></li>
                  <li><strong className="text-text-primary">app_main</strong> — NVS init, DSP boot, idle</li>
                </ul>
              </Card>
              <Card title={t('about.cardCore1')}>
                <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                  <li><strong className="text-text-primary">audio_task</strong> — UAC ring buffer → ASRC → DSP → dual I2S</li>
                  <li>Polls <code className="value-mono">dsp_param_poll_update()</code> between blocks</li>
                  <li>Atomic config-pointer swap (lock-free)</li>
                  <li>Highest priority, pinned</li>
                </ul>
              </Card>
              <Card title={t('about.cardParamFlow')}>
                <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                  <li>Edit in UI → diff middleware → Web Serial frame</li>
                  <li><code className="value-mono">serial_server</code> parses → <code className="value-mono">dsp_param_apply()</code></li>
                  <li>Stage in shadow buffer, recalc biquad coeffs</li>
                  <li>Notify audio task → atomic swap on next block</li>
                  <li><strong className="text-text-primary">Apply</strong> button bulk-pushes everything at once</li>
                  <li><strong className="text-text-primary">Save to Device</strong> commits NVS (one-shot)</li>
                </ul>
              </Card>
              <Card title={t('about.cardKeyFiles')}>
                <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside font-mono">
                  <li><code className="value-mono">firmware-s3/main/main.c</code></li>
                  <li><code className="value-mono">firmware-s3/main/usb_audio.c</code></li>
                  <li><code className="value-mono">firmware-s3/main/i2s_audio.c</code></li>
                  <li><code className="value-mono">firmware-s3/main/dsp_pipeline.c</code></li>
                  <li><code className="value-mono">firmware-s3/main/dsp_param_update.c</code></li>
                  <li><code className="value-mono">firmware-s3/main/serial_server.c</code></li>
                  <li><code className="value-mono">src/store/dsp-store.ts</code></li>
                  <li><code className="value-mono">src/serial/serial-middleware.ts</code></li>
                </ul>
              </Card>
            </div>
          </section>

          {/* Quick Test Checklist */}
          <section>
            <h2 className="section-label mb-3" style={{ color: 'var(--color-output-3)' }}>{t('about.checklistTitle')}</h2>
            <Card full>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left border-b border-surface-bg/50">
                    <th className="py-1.5 px-2 text-accent font-semibold w-8">#</th>
                    <th className="py-1.5 px-2 text-accent font-semibold">{t('about.checklistTest')}</th>
                    <th className="py-1.5 px-2 text-accent font-semibold">{t('about.checklistExpected')}</th>
                  </tr>
                </thead>
                <tbody className="text-text-secondary">
                  {[
                    ['1', 'Wire both PCM5102A boards (XSMT=3.3V, SCK=GND)', '5 wires + 2 jumpers per board'],
                    ['2', 'Plug ESP32-S3 USB-C into Mac', 'macOS Audio MIDI Setup shows DQ-DSP as a 2-ch / 2-ch UAC device'],
                    ['3', 'Play music with the device selected as output', 'Audio comes out both DAC boards (default routing: In 1 → DAC #1, In 2 → DAC #2)'],
                    ['4', 'Open the web UI in Chrome → Connect Serial', `Status dot turns green, "DQ-DSP" port name shown`],
                    ['5', 'Edit master volume slider', 'Volume changes live (no Apply needed)'],
                    ['6', 'Adjust an EQ band', 'Frequency response audibly changes; chart trace updates'],
                    ['7', 'Click Apply', `Bulk push to RAM; "Applied!" flash`],
                    ['8', 'Click Save to Device', 'Config commits to NVS; survives unplug + replug'],
                    ['9', 'Set crossover on Out 1: LP 200 Hz, Out 2: HP 200 Hz', 'Bi-amp split: Out 1 carries bass, Out 2 carries treble'],
                    ['10', 'Open Console panel', 'CPU load + clock-drift charts populate at 1 Hz'],
                  ].map(([n, t, e]) => (
                    <tr key={n} className="border-b border-surface-bg/30 last:border-0">
                      <td className="py-1.5 px-2 font-mono text-text-dimmed">{n}</td>
                      <td className="py-1.5 px-2">{t}</td>
                      <td className="py-1.5 px-2 text-text-dimmed">{e}</td>
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
            <Tooltip content={t('footer.buildCommit', { commit: __APP_COMMIT__, date: __APP_BUILD_DATE__ })} placement="top">
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
  );
}
