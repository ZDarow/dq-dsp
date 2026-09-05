import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDSPStore } from '../../store/dsp-store'
import { downloadPreset, readPresetFiles } from '../../utils/preset-io'
import type { PresetData } from '../../store/slices/preset-slice'
import { Tooltip } from '../ui/Tooltip'

export function PresetManager() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const presets = useDSPStore((s) => s.presets)
  const presetIndex = useDSPStore((s) => s.presetIndex)
  const presetName = useDSPStore((s) => s.presetName)
  const setPresetName = useDSPStore((s) => s.setPresetName)
  const loadPreset = useDSPStore((s) => s.loadPreset)
  const saveCurrentAsPreset = useDSPStore((s) => s.saveCurrentAsPreset)
  const savePreset = useDSPStore((s) => s.savePreset)
  const deletePreset = useDSPStore((s) => s.deletePreset)
  const renamePreset = useDSPStore((s) => s.renamePreset)
  const addPresets = useDSPStore((s) => s.addPresets)
  const exportConfig = useDSPStore((s) => s.exportConfig)

  // Dirty detection — current state vs the loaded preset's snapshot. We
  // compute it as a Zustand selector so it re-evaluates on any store
  // change but only triggers re-render when the boolean flips.
  // `presetIndex`/`presetName` are excluded from the diff: renaming or
  // selecting a preset shouldn't mark the config as modified.
  const dirty = useDSPStore((s) => {
    if (s.presetIndex < 0) return true
    const saved = s.presets[s.presetIndex]?.config
    if (!saved) return true
    const current = s.exportConfig()
    const stripped = (c: typeof current) => {
      const { presetIndex: _i, presetName: _n, ...rest } = c
      return rest
    }
    return JSON.stringify(stripped(current)) !== JSON.stringify(stripped(saved))
  })

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setEditingIndex(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleFileImport = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      const imported = await readPresetFiles(files)
      if (imported.length === 0) {
        alert(t('preset.noValidFiles'))
        return
      }
      const presetData: PresetData[] = imported.map((p) => ({
        name: p.name,
        config: p.config,
      }))
      addPresets(presetData)
    },
    [addPresets, t],
  )

  const handleSaveToFile = () => {
    const config = exportConfig()
    downloadPreset(presetName, config)
  }

  const handleStartRename = (index: number, name: string) => {
    setEditingIndex(index)
    setEditName(name)
  }

  const handleFinishRename = () => {
    if (editingIndex !== null && editName.trim()) {
      renamePreset(editingIndex, editName.trim())
    }
    setEditingIndex(null)
  }

  const selectedLabel =
    presetIndex >= 0 && presets[presetIndex]
      ? presets[presetIndex].name
      : presetName || t('preset.unsaved')

  // Status pill — three states:
  //   • Saved      — preset loaded, no diff
  //   • Modified   — preset loaded, current state differs
  //   • Unsaved    — no preset selected (everything is unsaved)
  const status: 'saved' | 'modified' | 'unsaved' =
    presetIndex >= 0 && !dirty ? 'saved' : presetIndex >= 0 ? 'modified' : 'unsaved'
  const statusColor =
    status === 'saved'
      ? 'var(--color-meter-normal)'
      : status === 'modified'
        ? 'var(--color-meter-caution)'
        : 'var(--color-mute)'
  const statusLabel =
    status === 'saved'
      ? t('preset.statusSaved')
      : status === 'modified'
        ? t('preset.statusModified')
        : t('preset.unsaved')
  const statusTitle =
    status === 'saved'
      ? t('preset.savedTitle')
      : status === 'modified'
        ? t('preset.modifiedTitle')
        : t('preset.unsavedTitle')

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <div className="flex items-center gap-1">
        <label className="text-text-secondary text-xs">{t('preset.label')}</label>
        <Tooltip content={statusTitle}>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 bg-control-bg text-text-primary text-xs px-2 py-1 rounded border border-surface-bg hover:border-mute focus:border-accent focus:outline-none min-w-[8.75rem] text-left"
          >
            <span
              className="status-dot shrink-0"
              style={{ backgroundColor: statusColor, marginRight: 0 }}
            />
            <span className="flex-1 truncate">{selectedLabel}</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="currentColor"
              className="text-text-dimmed shrink-0"
            >
              <path d="M2 3.5L5 7L8 3.5" stroke="currentColor" fill="none" strokeWidth="1.5" />
            </svg>
          </button>
        </Tooltip>
      </div>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-panel-bg border border-surface-bg rounded-lg shadow-xl w-[20rem] max-h-[26.25rem] flex flex-col">
          {/* Current preset name editor + status badge */}
          <div className="px-3 py-2 border-b border-surface-bg">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-text-dimmed">{t('preset.currentName')}</label>
              <Tooltip content={statusTitle}>
                <span className="pill-badge" style={{ ['--pill-color' as string]: statusColor }}>
                  <span
                    className="status-dot"
                    style={{ backgroundColor: statusColor, marginRight: 0 }}
                  />
                  {statusLabel}
                </span>
              </Tooltip>
            </div>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="w-full bg-control-bg text-text-primary text-xs px-2 py-1 rounded border border-surface-bg focus:border-accent focus:outline-none"
              placeholder={t('preset.placeholder')}
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-1 px-3 py-2 border-b border-surface-bg flex-wrap">
            <Tooltip content={t('preset.saveNewTooltip')}>
              <button
                onClick={() => {
                  saveCurrentAsPreset()
                  setOpen(false)
                }}
                className="text-xs px-2 py-1 rounded bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors"
              >
                {t('preset.saveNew')}
              </button>
            </Tooltip>
            {presetIndex >= 0 && (
              <Tooltip
                content={
                  dirty
                    ? t('preset.saveTooltipDirty', { name: presets[presetIndex]?.name ?? '' })
                    : t('preset.saveTooltipClean')
                }
              >
                <button
                  onClick={() => {
                    savePreset(presetIndex)
                    setOpen(false)
                  }}
                  disabled={!dirty}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    dirty
                      ? 'bg-accent/10 text-accent border-accent/20 hover:bg-accent/20'
                      : 'bg-control-bg text-text-dimmed border-surface-bg cursor-not-allowed opacity-60'
                  }`}
                >
                  {t('preset.save')}
                </button>
              </Tooltip>
            )}
            <Tooltip content={t('preset.saveToFileTooltip')}>
              <button
                onClick={handleSaveToFile}
                className="text-xs px-2 py-1 rounded bg-control-bg text-text-secondary border border-surface-bg hover:border-mute transition-colors"
              >
                {t('preset.saveToFile')}
              </button>
            </Tooltip>
            <div className="w-px h-4 bg-surface-bg self-center" />
            <Tooltip content={t('preset.loadFilesTooltip')}>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs px-2 py-1 rounded bg-control-bg text-text-secondary border border-surface-bg hover:border-mute transition-colors"
              >
                {t('preset.loadFiles')}
              </button>
            </Tooltip>
            <Tooltip content={t('preset.loadFolderTooltip')}>
              <button
                onClick={() => folderInputRef.current?.click()}
                className="text-xs px-2 py-1 rounded bg-control-bg text-text-secondary border border-surface-bg hover:border-mute transition-colors"
              >
                {t('preset.loadFolder')}
              </button>
            </Tooltip>
          </div>

          {/* Preset list */}
          <div className="flex-1 overflow-y-auto">
            {presets.length === 0 ? (
              <div className="px-3 py-4 text-xs text-text-dimmed text-center">
                {t('preset.empty')}
              </div>
            ) : (
              presets.map((preset, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-1 px-3 py-1.5 group hover:bg-surface-bg/50 transition-colors ${
                    i === presetIndex ? 'bg-accent/5' : ''
                  }`}
                >
                  {editingIndex === i ? (
                    <input
                      autoFocus
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={handleFinishRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleFinishRename()
                        if (e.key === 'Escape') setEditingIndex(null)
                      }}
                      className="flex-1 bg-control-bg text-text-primary text-xs px-1.5 py-0.5 rounded border border-accent focus:outline-none"
                    />
                  ) : (
                    <Tooltip
                      content={t('preset.loadTooltip', { name: preset.name })}
                      wrapperClassName="flex-1 inline-flex"
                    >
                      <button
                        onClick={() => {
                          loadPreset(i)
                          setOpen(false)
                        }}
                        className="flex-1 text-left text-xs text-text-primary truncate"
                      >
                        {i === presetIndex && <span className="text-accent mr-1">&#x2713;</span>}
                        {preset.name}
                      </button>
                    </Tooltip>
                  )}

                  {/* Row actions — visible on hover */}
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Tooltip content={t('preset.downloadTooltip')}>
                      <button
                        onClick={() => downloadPreset(preset.name, preset.config)}
                        className="text-text-dimmed hover:text-text-secondary p-0.5"
                        aria-label={t('preset.downloadAria')}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path d="M8 2v8M5 7l3 3 3-3M3 12h10" />
                        </svg>
                      </button>
                    </Tooltip>
                    <Tooltip content={t('preset.renameTooltip')}>
                      <button
                        onClick={() => handleStartRename(i, preset.name)}
                        className="text-text-dimmed hover:text-text-secondary p-0.5"
                        aria-label={t('preset.renameAria')}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path d="M10 3l3 3-8 8H2v-3l8-8z" />
                        </svg>
                      </button>
                    </Tooltip>
                    <Tooltip content={t('preset.deleteTooltip')}>
                      <button
                        onClick={() => deletePreset(i)}
                        className="text-text-dimmed hover:text-mute p-0.5"
                        aria-label={t('preset.deleteAria')}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path d="M4 4l8 8M12 4l-8 8" />
                        </svg>
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Preset count */}
          {presets.length > 0 && (
            <div className="px-3 py-1.5 border-t border-surface-bg text-xs text-text-dimmed">
              {presets.length === 1
                ? t('preset.count', { count: 1 })
                : t('preset.countPlural', { count: presets.length })}
            </div>
          )}
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFileImport(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        accept=".json"
        className="hidden"
        // @ts-expect-error webkitdirectory is non-standard but widely supported
        webkitdirectory=""
        onChange={(e) => {
          handleFileImport(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
