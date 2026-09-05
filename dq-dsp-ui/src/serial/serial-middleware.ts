import type { DSPStore } from '../store/dsp-store'
import { isApplyingDeviceConfig } from '../store/slices/global-slice'
import type { InputChannel, OutputChannel, RoutingMatrix } from '../types/dsp'
import type { EQBand, CrossoverFilter } from '../types/filter'
import { BLE_BLOCK_INPUT, BLE_BLOCK_OUTPUT } from '../types/ble-protocol'
import { encodeSerialFrame } from '../types/serial-protocol'
import {
  encodeGainUpdate,
  encodeMuteUpdate,
  encodePhaseUpdate,
  encodeEQBandEnable,
  encodeEQBandFreq,
  encodeEQBandGain,
  encodeEQBandQ,
  encodeEQBandType,
  encodeRoomEQBandEnable,
  encodeRoomEQBandFreq,
  encodeRoomEQBandGain,
  encodeRoomEQBandQ,
  encodeRoomEQBandType,
  encodeCrossoverUpdate,
  encodeDelayUpdate,
  encodeRoutingEnable,
  encodeRoutingGain,
  encodeMasterVolume,
} from '../ble/param-encoder'

type SendFn = (data: Uint8Array) => void

/**
 * Subscribes to Zustand store changes and sends serial parameter updates
 * for every individual parameter that changed. Wraps BLE-format payloads
 * in serial frames before sending.
 *
 * Returns an unsubscribe function.
 */
export function createSerialMiddleware(
  store: {
    subscribe: (listener: (state: DSPStore, prev: DSPStore) => void) => () => void
    getState: () => DSPStore
  },
  send: SendFn,
): () => void {
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const SLIDER_DEBOUNCE_MS = 50

  function sendDebounced(key: string, encode: () => Uint8Array) {
    const existing = debounceTimers.get(key)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      debounceTimers.delete(key)
      send(encodeSerialFrame(encode()))
    }, SLIDER_DEBOUNCE_MS)
    debounceTimers.set(key, timer)
  }

  function sendImmediate(encode: () => Uint8Array) {
    send(encodeSerialFrame(encode()))
  }

  function diffEQBands(
    block: typeof BLE_BLOCK_INPUT | typeof BLE_BLOCK_OUTPUT,
    channel: number,
    prev: EQBand[],
    curr: EQBand[],
  ) {
    for (let b = 0; b < curr.length; b++) {
      const p = prev[b]
      const c = curr[b]
      if (!p || !c) continue
      if (p === c) continue

      if (p.enabled !== c.enabled) {
        sendImmediate(() => encodeEQBandEnable(block, channel, b, c.enabled))
      }
      if (p.frequency !== c.frequency) {
        sendDebounced(`eq-${block}-${channel}-${b}-freq`, () =>
          encodeEQBandFreq(block, channel, b, c.frequency),
        )
      }
      if (p.gain !== c.gain) {
        sendDebounced(`eq-${block}-${channel}-${b}-gain`, () =>
          encodeEQBandGain(block, channel, b, c.gain),
        )
      }
      if (p.q !== c.q) {
        sendDebounced(`eq-${block}-${channel}-${b}-q`, () => encodeEQBandQ(block, channel, b, c.q))
      }
      if (p.filterType !== c.filterType) {
        sendImmediate(() => encodeEQBandType(block, channel, b, c.filterType))
      }
    }
  }

  function diffRoomEQBands(channel: number, prev: EQBand[], curr: EQBand[]) {
    for (let b = 0; b < curr.length; b++) {
      const p = prev[b]
      const c = curr[b]
      if (!p || !c) continue
      if (p === c) continue

      if (p.enabled !== c.enabled) {
        sendImmediate(() => encodeRoomEQBandEnable(channel, b, c.enabled))
      }
      if (p.frequency !== c.frequency) {
        sendDebounced(`room-eq-${channel}-${b}-freq`, () =>
          encodeRoomEQBandFreq(channel, b, c.frequency),
        )
      }
      if (p.gain !== c.gain) {
        sendDebounced(`room-eq-${channel}-${b}-gain`, () =>
          encodeRoomEQBandGain(channel, b, c.gain),
        )
      }
      if (p.q !== c.q) {
        sendDebounced(`room-eq-${channel}-${b}-q`, () => encodeRoomEQBandQ(channel, b, c.q))
      }
      if (p.filterType !== c.filterType) {
        sendImmediate(() => encodeRoomEQBandType(channel, b, c.filterType))
      }
    }
  }

  function diffCrossover(
    channel: number,
    hpOrLp: 'hp' | 'lp',
    prev: CrossoverFilter,
    curr: CrossoverFilter,
  ) {
    if (prev === curr) return

    if (prev.enabled !== curr.enabled) {
      sendImmediate(() => encodeCrossoverUpdate(channel, hpOrLp, 'enable', curr.enabled))
    }
    if (prev.frequency !== curr.frequency) {
      sendDebounced(`xo-${channel}-${hpOrLp}-freq`, () =>
        encodeCrossoverUpdate(channel, hpOrLp, 'freq', curr.frequency),
      )
    }
    if (prev.filterType !== curr.filterType) {
      sendImmediate(() => encodeCrossoverUpdate(channel, hpOrLp, 'type', curr.filterType))
    }
    if (prev.slope !== curr.slope) {
      sendImmediate(() => encodeCrossoverUpdate(channel, hpOrLp, 'slope', curr.slope))
    }
  }

  function diffInputChannel(index: number, prev: InputChannel, curr: InputChannel) {
    if (prev === curr) return

    if (prev.gain !== curr.gain) {
      sendDebounced(`in-${index}-gain`, () => encodeGainUpdate(BLE_BLOCK_INPUT, index, curr.gain))
    }
    if (prev.mute !== curr.mute) {
      sendImmediate(() => encodeMuteUpdate(BLE_BLOCK_INPUT, index, curr.mute))
    }
    if (prev.phaseInvert !== curr.phaseInvert) {
      sendImmediate(() => encodePhaseUpdate(BLE_BLOCK_INPUT, index, curr.phaseInvert))
    }
    if (prev.eqBands !== curr.eqBands) {
      diffEQBands(BLE_BLOCK_INPUT, index, prev.eqBands, curr.eqBands)
    }
  }

  function diffOutputChannel(index: number, prev: OutputChannel, curr: OutputChannel) {
    if (prev === curr) return

    if (prev.gain !== curr.gain) {
      sendDebounced(`out-${index}-gain`, () => encodeGainUpdate(BLE_BLOCK_OUTPUT, index, curr.gain))
    }
    if (prev.mute !== curr.mute) {
      sendImmediate(() => encodeMuteUpdate(BLE_BLOCK_OUTPUT, index, curr.mute))
    }
    if (prev.phaseInvert !== curr.phaseInvert) {
      sendImmediate(() => encodePhaseUpdate(BLE_BLOCK_OUTPUT, index, curr.phaseInvert))
    }
    if (prev.delaySamples !== curr.delaySamples) {
      sendDebounced(`out-${index}-delay`, () => encodeDelayUpdate(index, curr.delaySamples))
    }
    if (prev.eqBands !== curr.eqBands) {
      diffEQBands(BLE_BLOCK_OUTPUT, index, prev.eqBands, curr.eqBands)
    }
    if (prev.crossover !== curr.crossover) {
      diffCrossover(index, 'hp', prev.crossover.highPass, curr.crossover.highPass)
      diffCrossover(index, 'lp', prev.crossover.lowPass, curr.crossover.lowPass)
    }
  }

  function diffRouting(prev: RoutingMatrix, curr: RoutingMatrix) {
    if (prev === curr) return

    for (let i = 0; i < curr.length; i++) {
      for (let o = 0; o < curr[i].length; o++) {
        const p = prev[i]?.[o]
        const c = curr[i][o]
        if (!p || p === c) continue

        if (p.enabled !== c.enabled) {
          sendImmediate(() => encodeRoutingEnable(i, o, c.enabled))
        }
        if (p.gain !== c.gain) {
          sendDebounced(`route-${i}-${o}-gain`, () => encodeRoutingGain(i, o, c.gain))
        }
      }
    }
  }

  const unsubscribe = store.subscribe((state, prevState) => {
    // Only send when serial is connected — live streaming is always on now.
    if (!state.serialConnected) return

    // Don't echo back config that was just received from the device
    if (isApplyingDeviceConfig()) return

    // Diff inputs
    if (state.inputs !== prevState.inputs) {
      for (let i = 0; i < state.inputs.length; i++) {
        diffInputChannel(i, prevState.inputs[i], state.inputs[i])
      }
    }

    // Diff outputs
    if (state.outputs !== prevState.outputs) {
      for (let i = 0; i < state.outputs.length; i++) {
        diffOutputChannel(i, prevState.outputs[i], state.outputs[i])
      }
    }

    // Diff routing
    if (state.routing !== prevState.routing) {
      diffRouting(prevState.routing, state.routing)
    }

    // Diff room EQ bands
    if (state.roomEqBands !== prevState.roomEqBands) {
      for (let i = 0; i < state.roomEqBands.length; i++) {
        if (state.roomEqBands[i] !== prevState.roomEqBands[i]) {
          diffRoomEQBands(i, prevState.roomEqBands[i], state.roomEqBands[i])
        }
      }
    }

    // Diff master volume
    if (state.masterVolume !== prevState.masterVolume) {
      sendDebounced('master-vol', () => encodeMasterVolume(state.masterVolume))
    }
  })

  return () => {
    unsubscribe()
    for (const timer of debounceTimers.values()) {
      clearTimeout(timer)
    }
    debounceTimers.clear()
  }
}
