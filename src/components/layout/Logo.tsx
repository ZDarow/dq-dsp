/**
 * DQ-DSP wordmark — the "DQ" letterforms ARE the EQ line:
 *   • D's right belly is shaped like a wide-band shelving filter response.
 *   • Q's ring is a narrow-Q resonant peak (with the classic Q "tail").
 * A faint dashed 0 dB reference line cuts across the chassis to reinforce
 * the "you're looking at an EQ chart" reading.
 */
export function Logo() {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <svg
        width="40"
        height="40"
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="dq-brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5ea8d6" />
            <stop offset="55%" stopColor="#b48cd6" />
            <stop offset="100%" stopColor="#e06caf" />
          </linearGradient>
        </defs>

        {/* Rounded chassis */}
        <rect
          x="4"
          y="4"
          width="56"
          height="56"
          rx="14"
          fill="color-mix(in srgb, var(--color-panel-bg) 80%, transparent)"
          stroke="url(#dq-brand-grad)"
          strokeWidth="2.5"
        />

        {/* 0 dB reference line — sells the "EQ chart" framing */}
        <line
          x1="9"
          y1="32"
          x2="55"
          y2="32"
          stroke="url(#dq-brand-grad)"
          strokeWidth="0.6"
          strokeDasharray="2 2"
          opacity="0.35"
        />

        {/* DQ letterforms as EQ curves */}
        <g
          stroke="url(#dq-brand-grad)"
          strokeWidth="4.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* D — vertical reference edge + wide-shelf belly that bulges
              past the centre, like a broad parametric peak at +6 dB */}
          <path d="M 14 17 L 14 47" />
          <path d="M 14 17 Q 24 16 29 22 Q 33 28 31 32 Q 33 36 29 42 Q 24 48 14 47" />
          {/* Horizontal cross-bar — anchors the "D" reading and doubles as
              the 0 dB axis through the letter (nod to "Đ" too). */}
          <path d="M 14 32 L 30 32" />

          {/* Q — bell ring, sized to match D's footprint */}
          <path d="M 35 32 Q 35 17 44 17 Q 54 17 54 32 Q 54 47 44 47 Q 35 47 35 32 Z" />
          {/* Q "tail" — the resonance overshoot */}
          <path d="M 50 41 L 55 47" />
        </g>

        {/* EQ-band handles on each peak — small dots that say
            "these curves are interactive bands, just like the PEQ editor" */}
        <circle cx="31" cy="32" r="2.6" fill="url(#dq-brand-grad)" />
        <circle cx="44" cy="17" r="2.6" fill="url(#dq-brand-grad)" />
      </svg>

      <div className="flex flex-col leading-none">
        <span
          className="font-mono font-bold tracking-[0.18em]"
          style={{
            fontSize: '1.35rem',
            background: 'linear-gradient(110deg, #5ea8d6, #b48cd6 55%, #e06caf)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          DQ-DSP
        </span>
        <span className="section-label" style={{ fontSize: '0.7rem', letterSpacing: '0.22em', marginTop: '4px' }}>
          2 in · 4 out
        </span>
      </div>
    </div>
  );
}
