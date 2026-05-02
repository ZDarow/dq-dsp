import type { StateCreator } from 'zustand';
import type { DSPStore } from '../dsp-store';
import type { DSPTelemetry } from '../../types/serial-protocol';

const TELEMETRY_HISTORY_MAX = 60;

export interface SerialSlice {
  serialConnected: boolean;
  serialConnecting: boolean;
  serialPortName: string;
  serialError: string | null;
  serialLatency: number;
  serialConsoleOpen: boolean;
  serialLogs: string[];
  serialTelemetry: DSPTelemetry | null;
  serialTelemetryHistory: DSPTelemetry[];

  setSerialConnected: (connected: boolean) => void;
  setSerialConnecting: (connecting: boolean) => void;
  setSerialPortName: (name: string) => void;
  setSerialError: (error: string | null) => void;
  setSerialLatency: (latency: number) => void;
  clearSerialState: () => void;
  toggleSerialConsole: () => void;
  setSerialConsoleOpen: (open: boolean) => void;
  addSerialLog: (text: string) => void;
  clearSerialLogs: () => void;
  setSerialTelemetry: (data: DSPTelemetry | null) => void;
  clearSerialTelemetryHistory: () => void;
}

export const createSerialSlice: StateCreator<DSPStore, [], [], SerialSlice> = (set) => ({
  serialConnected: false,
  serialConnecting: false,
  serialPortName: '',
  serialError: null,
  serialLatency: 0,
  serialConsoleOpen: false,
  serialLogs: [],
  serialTelemetry: null,
  serialTelemetryHistory: [],

  setSerialConnected: (connected) => set({ serialConnected: connected }),
  setSerialConnecting: (connecting) => set({ serialConnecting: connecting }),
  setSerialPortName: (name) => set({ serialPortName: name }),
  setSerialError: (error) => set({ serialError: error }),
  setSerialLatency: (latency) => set({ serialLatency: latency }),
  clearSerialState: () =>
    set({
      serialConnected: false,
      serialConnecting: false,
      serialPortName: '',
      serialError: null,
      serialLatency: 0,
      serialTelemetryHistory: [],
    }),
  toggleSerialConsole: () => set((s) => ({ serialConsoleOpen: !s.serialConsoleOpen })),
  setSerialConsoleOpen: (open) => set({ serialConsoleOpen: open }),
  addSerialLog: (text) => set((s) => ({
    serialLogs: [...s.serialLogs.slice(-(500 - 1)), text],
  })),
  clearSerialLogs: () => set({ serialLogs: [] }),
  setSerialTelemetry: (data) => set((s) => ({
    serialTelemetry: data,
    serialTelemetryHistory: data
      ? [...s.serialTelemetryHistory.slice(-(TELEMETRY_HISTORY_MAX - 1)), data]
      : s.serialTelemetryHistory,
  })),
  clearSerialTelemetryHistory: () => set({ serialTelemetryHistory: [] }),
});
