interface ProcessingBlockProps {
  x: number
  y: number
  width: number
  height: number
  label: string
  sublabel?: string
  color: string
  selected: boolean
  muted?: boolean
  onClick: () => void
}

export function ProcessingBlock({
  x,
  y,
  width,
  height,
  label,
  sublabel,
  color,
  selected,
  muted,
  onClick,
}: ProcessingBlockProps) {
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <title>{`${label}${sublabel ? ` — ${sublabel}` : ''}${muted ? ' (muted)' : ''}. Click to open this stage's detail panel.`}</title>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        fill={selected ? 'var(--color-surface-bg)' : 'var(--color-panel-bg)'}
        stroke={selected ? color : 'var(--color-control-bg)'}
        strokeWidth={selected ? 2 : 1}
        opacity={muted ? 0.4 : 1}
      />
      <text
        x={x + width / 2}
        y={y + height / 2 - (sublabel ? 4 : 0)}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontSize={11}
        fontWeight={600}
      >
        {label}
      </text>
      {sublabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 10}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--color-text-secondary)"
          fontSize={9}
        >
          {sublabel}
        </text>
      )}
      {muted && (
        <text
          x={x + width - 8}
          y={y + 12}
          textAnchor="middle"
          fill="var(--color-mute)"
          fontSize={9}
          fontWeight={700}
        >
          M
        </text>
      )}
    </g>
  )
}
