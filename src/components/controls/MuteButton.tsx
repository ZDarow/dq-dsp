import { Tooltip } from '../ui/Tooltip';

interface MuteButtonProps {
  muted: boolean;
  onClick: () => void;
  size?: 'sm' | 'md';
}

export function MuteButton({ muted, onClick, size = 'md' }: MuteButtonProps) {
  const px = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1';
  const text = size === 'sm' ? 'text-xs' : 'text-xs';

  return (
    <Tooltip content={muted ? 'Channel muted — click to unmute' : 'Mute this channel (silences audio)'}>
      <button
        onClick={onClick}
        aria-label={muted ? 'Unmute channel' : 'Mute channel'}
        className={`${px} ${text} font-bold rounded transition-colors ${
          muted
            ? 'bg-mute text-white'
            : 'bg-control-bg text-text-secondary hover:text-text-primary border border-surface-bg'
        }`}
      >
        M
      </button>
    </Tooltip>
  );
}
