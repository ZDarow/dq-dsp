import { useTranslation } from 'react-i18next';
import { Tooltip } from '../ui/Tooltip';

interface PhaseButtonProps {
  inverted: boolean;
  onClick: () => void;
  size?: 'sm' | 'md';
}

export function PhaseButton({ inverted, onClick, size = 'md' }: PhaseButtonProps) {
  const { t } = useTranslation();
  const px = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1';
  const text = size === 'sm' ? 'text-xs' : 'text-xs';

  return (
    <Tooltip content={inverted
      ? t('controls.phaseRestoreTooltip')
      : t('controls.phaseInvertTooltip')}>
      <button
        onClick={onClick}
        aria-label={inverted ? t('controls.phaseRestore') : t('controls.phaseInvert')}
        className={`${px} ${text} rounded transition-colors flex items-center justify-center ${
          inverted
            ? 'bg-phase text-black'
            : 'bg-control-bg text-text-secondary hover:text-text-primary border border-surface-bg'
        }`}
      >
        {/* Two sine humps — second one mirrored vertically when inverted, conveys
         * polarity flip more obviously than a bare "Ø" symbol. */}
        <svg width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 5 Q 3 1, 5 5 T 9 5" />
          {inverted ? (
            <path d="M9 5 Q 11 9, 13 5 T 17 5" />
          ) : (
            <path d="M9 5 Q 11 1, 13 5 T 17 5" opacity="0.45" strokeDasharray="2 1.5" />
          )}
        </svg>
      </button>
    </Tooltip>
  );
}
