import { useTranslation } from 'react-i18next'
import { useDSPStore } from '../../store/dsp-store'
import { CUSTOM_SUM_COLORS } from '../../types/custom-sum'
import { OUTPUT_COLORS } from '../../utils/colors'
import { Tooltip } from '../ui/Tooltip'

interface Props {
  onClose: () => void
}

const NUM_OUTPUTS = 4

export function CustomSumEditor({ onClose }: Props) {
  const { t } = useTranslation()
  const customSums = useDSPStore((s) => s.customSums)
  const addCustomSum = useDSPStore((s) => s.addCustomSum)
  const removeCustomSum = useDSPStore((s) => s.removeCustomSum)
  const updateCustomSum = useDSPStore((s) => s.updateCustomSum)

  const handleToggleOutput = (id: string, outputIdx: number, currentList: number[]) => {
    const has = currentList.includes(outputIdx)
    const next = has
      ? currentList.filter((i) => i !== outputIdx)
      : [...currentList, outputIdx].sort((a, b) => a - b)
    updateCustomSum(id, { outputIndices: next })
  }

  const handleAdd = () => {
    // Pick a color not currently in use, or cycle through palette.
    const used = new Set(customSums.map((s) => s.color))
    const color =
      CUSTOM_SUM_COLORS.find((c) => !used.has(c)) ??
      CUSTOM_SUM_COLORS[customSums.length % CUSTOM_SUM_COLORS.length]
    addCustomSum({
      name: `Σ ${t('customSum.sum')} ${customSums.length + 1}`,
      color,
      outputIndices: [],
      enabled: true,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-panel-bg border border-surface-bg rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-bg">
          <h2 className="text-sm font-semibold text-text-primary">{t('customSum.title')}</h2>
          <div className="flex items-center gap-2">
            <Tooltip content={t('customSum.addTooltip')}>
              <button
                onClick={handleAdd}
                className="text-xs px-3 py-1 rounded border border-accent text-accent hover:bg-accent/20 transition-colors"
              >
                + {t('customSum.add')}
              </button>
            </Tooltip>
            <Tooltip content={t('about.closeTooltip')}>
              <button
                onClick={onClose}
                className="text-text-dimmed hover:text-text-primary text-lg leading-none px-2"
                aria-label={t('common.close')}
              >
                ×
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Sums list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {customSums.length === 0 && (
            <div className="text-center text-text-dimmed text-sm py-8">
              {t('customSum.empty')} <span className="text-accent">+ {t('customSum.add')}</span>
            </div>
          )}

          {customSums.map((sum) => (
            <div
              key={sum.id}
              className="border border-surface-bg rounded p-3 space-y-2"
              style={{ borderLeft: `3px solid ${sum.color}` }}
            >
              {/* Top row: name + color + delete */}
              <div className="flex items-center gap-2">
                <Tooltip content={t('customSum.nameTooltip')} wrapperClassName="flex-1">
                  <input
                    type="text"
                    value={sum.name}
                    onChange={(e) => updateCustomSum(sum.id, { name: e.target.value })}
                    className="w-full bg-surface-bg/50 border border-surface-bg rounded px-2 py-1 text-sm text-text-primary focus:outline-none focus:border-accent"
                    placeholder={t('customSum.namePlaceholder')}
                  />
                </Tooltip>

                {/* Color swatches */}
                <div className="flex items-center gap-1">
                  {CUSTOM_SUM_COLORS.map((c) => (
                    <Tooltip key={c} content={t('customSum.colorTooltip', { color: c })}>
                      <button
                        onClick={() => updateCustomSum(sum.id, { color: c })}
                        className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                        style={{
                          backgroundColor: c,
                          borderColor: sum.color === c ? '#ffffff' : 'transparent',
                        }}
                        aria-label={t('customSum.pickColor', { color: c })}
                      />
                    </Tooltip>
                  ))}
                </div>

                <Tooltip content={t('customSum.deleteTooltip')}>
                  <button
                    onClick={() => removeCustomSum(sum.id)}
                    className="text-text-dimmed hover:text-red-400 transition-colors px-2"
                    aria-label={t('customSum.delete')}
                  >
                    🗑
                  </button>
                </Tooltip>
              </div>

              {/* Output checkboxes */}
              <div className="flex items-center gap-3 text-xs">
                <span className="text-text-dimmed uppercase tracking-wider">
                  {t('customSum.outputs')}:
                </span>
                {Array.from({ length: NUM_OUTPUTS }, (_, oi) => {
                  const checked = sum.outputIndices.includes(oi)
                  return (
                    <Tooltip
                      key={oi}
                      content={t('customSum.toggleOutput', {
                        action: checked ? t('customSum.remove') : t('customSum.include'),
                        n: oi + 1,
                      })}
                    >
                      <label
                        className="flex items-center gap-1 cursor-pointer select-none"
                        style={{ color: checked ? OUTPUT_COLORS[oi] : 'var(--color-text-dimmed)' }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleOutput(sum.id, oi, sum.outputIndices)}
                          className="accent-current"
                          aria-label={t('customSum.includeOutput', { n: oi + 1 })}
                        />
                        {t('nav.output', { n: oi + 1 })}
                      </label>
                    </Tooltip>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer help */}
        <div className="px-4 py-2 border-t border-surface-bg text-xs text-text-dimmed">
          {t('customSum.footer')}
        </div>
      </div>
    </div>
  )
}
