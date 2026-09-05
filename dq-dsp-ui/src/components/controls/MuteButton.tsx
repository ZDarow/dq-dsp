import { useTranslation } from 'react-i18next'
import { Tooltip } from '../ui/Tooltip'

interface MuteButtonProps {
  muted: boolean
  onClick: () => void
  size?: 'sm' | 'md'
}

export function MuteButton({ muted, onClick, size = 'md' }: MuteButtonProps) {
  const { t } = useTranslation()
  const px = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1'
  const text = size === 'sm' ? 'text-xs' : 'text-xs'

  return (
    <Tooltip content={muted ? t('controls.unmuteTooltip') : t('controls.muteTooltip')}>
      <button
        onClick={onClick}
        aria-label={muted ? t('controls.unmute') : t('controls.mute')}
        className={`${px} ${text} font-bold rounded transition-colors ${
          muted
            ? 'bg-mute text-white'
            : 'bg-control-bg text-text-secondary hover:text-text-primary border border-surface-bg'
        }`}
      >
        M
      </button>
    </Tooltip>
  )
}
