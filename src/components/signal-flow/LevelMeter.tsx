interface LevelMeterProps {
  x: number;
  y: number;
  height: number;
  level: number; // 0..1
  color: string;
}

export function LevelMeter({ x, y, height, level, color }: LevelMeterProps) {
  const segments = 8;
  const segHeight = (height - (segments - 1) * 1) / segments;
  const activeSegs = Math.round(level * segments);

  return (
    <g>
      {Array.from({ length: segments }, (_, i) => {
        const segIdx = segments - 1 - i;
        const isActive = segIdx < activeSegs;
        let fillColor = color;
        if (segIdx >= segments - 1) fillColor = '#ff3333';
        else if (segIdx >= segments - 2) fillColor = '#ffcc00';

        return (
          <rect
            key={i}
            x={x}
            y={y + i * (segHeight + 1)}
            width={4}
            height={segHeight}
            rx={1}
            fill={isActive ? fillColor : '#1a1a26'}
            opacity={isActive ? 1 : 0.3}
          />
        );
      })}
    </g>
  );
}
