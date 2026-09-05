import { useEffect } from 'react'
import { useDSPStore } from '../store/dsp-store'

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const state = useDSPStore.getState()
      const { selectedBlock } = state

      // Ctrl+Z / Cmd+Z: Undo (handled by temporal middleware if added)
      // Ctrl+Shift+Z / Cmd+Shift+Z: Redo

      // Space: Toggle mute on selected channel
      if (e.code === 'Space' && !isInputElement(e) && selectedBlock) {
        e.preventDefault()
        if (selectedBlock.type === 'input') {
          state.toggleInputMute(selectedBlock.index)
        } else if (selectedBlock.type === 'output') {
          state.toggleOutputMute(selectedBlock.index)
        }
      }

      // M: Toggle mute on selected block
      if (e.key === 'm' && !isInputElement(e)) {
        e.preventDefault()
        if (selectedBlock?.type === 'input') {
          state.toggleInputMute(selectedBlock.index)
        } else if (selectedBlock?.type === 'output') {
          state.toggleOutputMute(selectedBlock.index)
        }
      }

      // P: Toggle phase on selected block
      if (e.key === 'p' && !isInputElement(e)) {
        e.preventDefault()
        if (selectedBlock?.type === 'input') {
          state.toggleInputPhase(selectedBlock.index)
        } else if (selectedBlock?.type === 'output') {
          state.toggleOutputPhase(selectedBlock.index)
        }
      }

      // 1-4: Select output 1-4
      if (e.key >= '1' && e.key <= '4' && !isInputElement(e) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        state.setSelectedBlock({ type: 'output', index: parseInt(e.key) - 1 })
      }

      // Q/W: Select input 1/2
      if (e.key === 'q' && !isInputElement(e)) {
        e.preventDefault()
        state.setSelectedBlock({ type: 'input', index: 0 })
      }
      if (e.key === 'w' && !isInputElement(e)) {
        e.preventDefault()
        state.setSelectedBlock({ type: 'input', index: 1 })
      }

      // R: Select routing matrix
      if (e.key === 'r' && !isInputElement(e)) {
        e.preventDefault()
        state.setSelectedBlock({ type: 'routing' })
      }

      // Ctrl+E / Cmd+E: Export
      if (e.key === 'e' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        // Export is handled via UI state, dispatch a custom event
        window.dispatchEvent(new CustomEvent('dsp-export'))
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}

function isInputElement(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}
