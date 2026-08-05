import { useTranslation } from 'react-i18next';
import { useSerialSupport, useBannerDismissed } from '../../hooks/useSerialSupport';

/**
 * Top-of-app warning banner for browsers / environments that can't use
 * Web Serial. Renders nothing on supported browsers; on unsupported ones
 * the banner is dismissible per session.
 */
export function BrowserSupportBanner() {
  const { t } = useTranslation();
  const support = useSerialSupport();
  const [dismissed, dismiss] = useBannerDismissed();

  if (support.supported) return null;
  if (dismissed) return null;

  return (
    <div
      role="status"
      className="px-4 py-2 flex items-start gap-3 text-xs"
      style={{
        background: 'color-mix(in srgb, var(--color-meter-caution) 18%, transparent)',
        borderBottom: '1px solid color-mix(in srgb, var(--color-meter-caution) 35%, transparent)',
        color: 'var(--color-text-primary)',
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 mt-0.5"
        style={{ color: 'var(--color-meter-caution)' }}
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div className="flex-1 min-w-0">
        <div className="font-semibold" style={{ color: 'var(--color-meter-caution)' }}>
          {support.headline}
        </div>
        <div className="text-text-secondary mt-0.5 leading-snug">
          {support.message} {t('banner.messageSuffix')}
        </div>
      </div>
      <button
        onClick={dismiss}
        className="text-text-dimmed hover:text-text-primary text-sm leading-none px-2 shrink-0 transition-colors"
        aria-label={t('banner.dismiss')}
      >
        ×
      </button>
    </div>
  );
}
