import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tooltip } from '../ui/Tooltip'

interface LinkPickerProps {
  others: number[]
  linkedPartners: number[]
  onToggle: (other: number) => void
  channelLabel: string // "Out" or "In"
}

export function LinkPicker({ others, linkedPartners, onToggle, channelLabel }: LinkPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const isActive = linkedPartners.length > 0
  const summary = isActive
    ? `${t('linkPicker.linked')}: ${linkedPartners.map((p) => `${channelLabel} ${p + 1}`).join(', ')}`
    : t('linkPicker.linkWith')

  return (
    <div ref={wrapperRef} className="relative">
      <Tooltip content={t('linkPicker.tooltip', { channels: channelLabel.toLowerCase() })}>
        <button
          onClick={() => setOpen((v) => !v)}
          className={`text-xs px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
            isActive
              ? 'bg-accent/20 text-accent border-accent/40'
              : 'bg-control-bg text-text-dimmed border-surface-bg hover:text-text-secondary'
          }`}
          aria-expanded={open}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6.5 9.5l3-3" />
            <path d="M4.5 8.5l-1.3 1.3a2.5 2.5 0 0 0 3.5 3.5L8 12" />
            <path d="M11.5 7.5l1.3-1.3a2.5 2.5 0 0 0-3.5-3.5L8 4" />
          </svg>
          {summary}
          <span className="opacity-60">▾</span>
        </button>
      </Tooltip>

      {open && (
        <div
          className="glass-panel-strong absolute z-30 mt-1 left-0 min-w-[10rem] py-1"
          style={{ borderRadius: 'var(--radius-panel)' }}
        >
          <div className="px-3 py-1 section-label">{t('linkPicker.mirrorWith')}</div>
          {others.map((i) => {
            const isLinked = linkedPartners.includes(i)
            return (
              <label
                key={i}
                className="flex items-center gap-2 px-3 py-1 cursor-pointer hover:bg-surface-bg/50 text-xs"
              >
                <input
                  type="checkbox"
                  checked={isLinked}
                  onChange={() => onToggle(i)}
                  className="accent-accent"
                />
                {channelLabel} {i + 1}
              </label>
            )
          })}
          <div className="px-3 pt-1.5 pb-1 text-[0.65rem] text-text-dimmed border-t border-surface-bg/40 mt-1">
            {t('linkPicker.tip', { channel: channelLabel })}
          </div>
        </div>
      )}
    </div>
  )
}
