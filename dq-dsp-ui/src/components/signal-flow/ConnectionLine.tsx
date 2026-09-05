interface ConnectionLineProps {
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  active?: boolean
}

export function ConnectionLine({ x1, y1, x2, y2, color, active = true }: ConnectionLineProps) {
  const midX = (x1 + x2) / 2

  return (
    <path
      d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
      fill="none"
      stroke={color}
      strokeWidth={active ? 1.5 : 0.5}
      opacity={active ? 0.6 : 0.15}
    />
  )
}
