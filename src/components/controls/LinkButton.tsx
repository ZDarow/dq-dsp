import { useTranslation } from 'react-i18next';
import { Tooltip } from '../ui/Tooltip';

interface LinkButtonProps {
  linked: boolean;
  onClick: () => void;
  label?: string;
  title?: string;
}

export function LinkButton({ linked, onClick, label, title }: LinkButtonProps) {
  const { t } = useTranslation();
  return (
    <Tooltip content={title ?? label ?? (linked ? t('linkButton.unlinkChannels') : t('linkButton.linkChannels'))}>
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border transition-all ${
        linked
          ? 'bg-accent/20 text-accent border-accent/40 hover:bg-accent/30'
          : 'bg-control-bg text-text-dimmed border-surface-bg hover:text-text-secondary hover:border-mute'
      }`}
    >
      {/* Chain link SVG icon */}
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        {linked ? (
          <>
            <path d="M6.5 9.5l3-3" />
            <path d="M4.5 8.5l-1.3 1.3a2.5 2.5 0 0 0 3.5 3.5L8 12" />
            <path d="M11.5 7.5l1.3-1.3a2.5 2.5 0 0 0-3.5-3.5L8 4" />
          </>
        ) : (
          <>
            <path d="M4.5 8.5l-1.3 1.3a2.5 2.5 0 0 0 3.5 3.5L8.5 11.5" />
            <path d="M11.5 7.5l1.3-1.3a2.5 2.5 0 0 0-3.5-3.5L7.5 4.5" />
            <path d="M3 3l10 10" strokeOpacity="0.5" />
          </>
        )}
      </svg>
      {label ?? (linked ? t('linkButton.linked') : t('linkButton.link'))}
    </button>
    </Tooltip>
  );
}
