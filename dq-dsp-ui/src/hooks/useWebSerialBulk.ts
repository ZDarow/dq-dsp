import { useCallback, useRef } from 'react'
import { decodeDSPConfig } from '../export/binary-decoder'
import type { DSPConfig } from '../types/dsp'

export interface BulkCallbacks {
  onConfig: (config: DSPConfig) => void
}

export function useWebSerialBulk(callbacks: BulkCallbacks) {
  const bulkRxBufferRef = useRef<Uint8Array | null>(null)
  const bulkRxExpectedSizeRef = useRef(0)
  const bulkRxOffsetRef = useRef(0)
  const bulkRxStartedAtRef = useRef(0)

  const completeBulkReceive = useCallback(() => {
    const buf = bulkRxBufferRef.current
    bulkRxBufferRef.current = null
    bulkRxOffsetRef.current = 0
    bulkRxExpectedSizeRef.current = 0

    if (!buf) return
    try {
      const config = decodeDSPConfig(buf.buffer as ArrayBuffer)
      if (config) {
        callbacks.onConfig(config)
      }
    } catch (err) {
      console.error('[Serial] Bulk config decode failed, discarding buffer', err)
    }
  }, [callbacks])

  const handleBulkStart = useCallback((payload: Uint8Array) => {
    if (payload.length < 4) return null
    const totalSize = payload[2] | (payload[3] << 8)
    if (totalSize <= 0 || totalSize >= 65536) return null

    const buffer = new Uint8Array(totalSize)
    const chunk = payload.slice(4)
    if (chunk.length > 0) {
      buffer.set(chunk, 0)
    }

    bulkRxBufferRef.current = buffer
    bulkRxExpectedSizeRef.current = totalSize
    bulkRxOffsetRef.current = chunk.length
    bulkRxStartedAtRef.current = performance.now()

    return { totalSize, offset: chunk.length }
  }, [])

  const handleBulkContinuation = useCallback(
    (payload: Uint8Array): boolean => {
      if (!bulkRxBufferRef.current) return false

      if (performance.now() - bulkRxStartedAtRef.current > 5000) {
        console.warn('[Serial] Bulk receive timed out, discarding partial buffer')
        bulkRxBufferRef.current = null
        bulkRxOffsetRef.current = 0
        bulkRxExpectedSizeRef.current = 0
        return false
      }

      const remaining = bulkRxExpectedSizeRef.current - bulkRxOffsetRef.current
      const chunk = payload.slice(0, Math.min(payload.length, remaining))
      bulkRxBufferRef.current.set(chunk, bulkRxOffsetRef.current)
      bulkRxOffsetRef.current += chunk.length

      if (bulkRxOffsetRef.current >= bulkRxExpectedSizeRef.current) {
        completeBulkReceive()
      }
      return true
    },
    [completeBulkReceive],
  )

  const isBulkActive = useCallback(() => {
    return bulkRxBufferRef.current !== null
  }, [])

  const reset = useCallback(() => {
    bulkRxBufferRef.current = null
    bulkRxOffsetRef.current = 0
    bulkRxExpectedSizeRef.current = 0
  }, [])

  return {
    handleBulkStart,
    handleBulkContinuation,
    isBulkActive,
    completeBulkReceive,
    reset,
  }
}
