import { useTranslation } from 'react-i18next'
import { Tooltip } from '../ui/Tooltip'

/**
 * Always-visible thin footer at the bottom of the main column. Shows the
 * current version + commit so users know which build is running, with a
 * subtle author link. Build constants are injected by Vite at compile time
 * (see vite.config.ts).
 */
export function AppFooter() {
  const { t } = useTranslation()
  return (
    <div className="px-4 py-2 mt-2 mb-3 border-t border-surface-bg/40 text-[0.7rem] text-text-dimmed flex items-center justify-between gap-3 flex-wrap">
      <span>DQ-DSP — ESP32-S3 + USB UAC + 2× PCM5102A</span>
      <span className="flex items-center gap-3 value-mono">
        <Tooltip
          content={t('footer.buildCommit', { commit: __APP_COMMIT__, date: __APP_BUILD_DATE__ })}
          placement="top"
        >
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
  )
}
