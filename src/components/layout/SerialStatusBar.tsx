import { useEffect, useRef, useCallback, useState } from 'react';
import { useDSPStore } from '../../store/dsp-store';
import { useWebSerial } from '../../hooks/useWebSerial';
import { createSerialMiddleware } from '../../serial/serial-middleware';
import { encodeSerialFrame, SERIAL_MSG_SAVE_CONFIG } from '../../types/serial-protocol';
import type { DSPConfig } from '../../types/dsp';
import { Tooltip } from '../ui/Tooltip';
import { useSerialSupport } from '../../hooks/useSerialSupport';

export function SerialStatusBar() {
  const serialConnected = useDSPStore((s) => s.serialConnected);
  const serialConnecting = useDSPStore((s) => s.serialConnecting);
  const serialPortName = useDSPStore((s) => s.serialPortName);
  const serialError = useDSPStore((s) => s.serialError);
  const serialLatency = useDSPStore((s) => s.serialLatency);

  const setSerialConnected = useDSPStore((s) => s.setSerialConnected);
  const setSerialConnecting = useDSPStore((s) => s.setSerialConnecting);
  const setSerialPortName = useDSPStore((s) => s.setSerialPortName);
  const setSerialError = useDSPStore((s) => s.setSerialError);
  const setSerialLatency = useDSPStore((s) => s.setSerialLatency);
  const clearSerialState = useDSPStore((s) => s.clearSerialState);

  const serialConsoleOpen = useDSPStore((s) => s.serialConsoleOpen);
  const toggleSerialConsole = useDSPStore((s) => s.toggleSerialConsole);
  const setSerialConsoleOpen = useDSPStore((s) => s.setSerialConsoleOpen);
  const addSerialLog = useDSPStore((s) => s.addSerialLog);
  const setSerialTelemetry = useDSPStore((s) => s.setSerialTelemetry);

  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const serialSupport = useSerialSupport();

  const { state: serialState, connect: serialConnect, disconnect: serialDisconnect, sendParam, sendBulkConfig, onStatus, onLog, onTelemetry, onConfig, requestConfig } = useWebSerial();
  const middlewareCleanupRef = useRef<(() => void) | null>(null);

  // Sync serial hook state -> store
  useEffect(() => {
    setSerialConnected(serialState.connected);
    setSerialConnecting(serialState.connecting);
    setSerialError(serialState.error);
    setSerialLatency(serialState.latency);
    if (serialState.portName) {
      setSerialPortName(serialState.portName);
    }
  }, [
    serialState.connected,
    serialState.connecting,
    serialState.portName,
    serialState.error,
    serialState.latency,
    setSerialConnected,
    setSerialConnecting,
    setSerialPortName,
    setSerialError,
    setSerialLatency,
  ]);

  // Setup/teardown serial middleware when connected + auto-open console
  useEffect(() => {
    if (serialState.connected) {
      middlewareCleanupRef.current = createSerialMiddleware(useDSPStore, sendParam);
      setSerialConsoleOpen(true);
    } else {
      middlewareCleanupRef.current?.();
      middlewareCleanupRef.current = null;
    }
    return () => {
      middlewareCleanupRef.current?.();
      middlewareCleanupRef.current = null;
    };
  }, [serialState.connected, sendParam, setSerialConsoleOpen]);

  // Subscribe to status messages for error display
  useEffect(() => {
    return onStatus((msg) => {
      if (msg.msgType === 0x82) {
        setSerialError(`Device error: code ${msg.statusCode}`);
      }
    });
  }, [onStatus, setSerialError]);

  // Subscribe to ESP_LOG messages
  useEffect(() => {
    return onLog((text) => addSerialLog(text));
  }, [onLog, addSerialLog]);

  // Subscribe to DSP telemetry
  useEffect(() => {
    return onTelemetry((data) => setSerialTelemetry(data));
  }, [onTelemetry, setSerialTelemetry]);

  // Subscribe to device config sync
  const applyDeviceConfig = useDSPStore((s) => s.applyDeviceConfig);
  useEffect(() => {
    return onConfig((config) => {
      applyDeviceConfig(config);
      addSerialLog('[sync] Device config applied to UI');
    });
  }, [onConfig, applyDeviceConfig, addSerialLog]);

  // Auto-sync from device on connect — pull current sample rate, EQ, XO,
  // gain, etc. so the UI reflects the firmware's actual state instead of
  // whatever was cached in localStorage. Single shot, ~250 ms after connect
  // gives the device time to finish enumerating and the read loop to be up.
  useEffect(() => {
    if (!serialConnected) return;
    const t = setTimeout(() => {
      addSerialLog('[sync] Requesting current config from device…');
      requestConfig();
    }, 250);
    return () => clearTimeout(t);
  }, [serialConnected, requestConfig, addSerialLog]);

  const handleConnect = useCallback(async () => {
    await serialConnect();
  }, [serialConnect]);

  const handleDisconnect = useCallback(async () => {
    await serialDisconnect();
    clearSerialState();
  }, [serialDisconnect, clearSerialState]);

  const handleUpload = useCallback(async () => {
    const state = useDSPStore.getState();
    const config: DSPConfig = {
      inputs: state.inputs,
      routing: state.routing,
      outputs: state.outputs,
      masterVolume: state.masterVolume,
      sampleRate: state.sampleRate,
      presetIndex: state.presetIndex,
      presetName: state.presetName,
      inputsLinked: state.inputsLinked,
      outputLinkGroups: state.outputLinkGroups,
    };
    setUploading(true);
    setUploadSuccess(false);
    const ok = await sendBulkConfig(config);
    setUploading(false);
    if (ok) {
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 2000);
    }
  }, [sendBulkConfig]);

  // Status dot — DSPi uses a small colored dot inline with the label
  let dotColorVar = 'var(--color-mute)';
  if (serialConnected) dotColorVar = 'var(--color-meter-normal)';
  else if (serialConnecting) dotColorVar = 'var(--color-meter-caution)';

  return (
    <div className="flex items-center gap-2">
      {/* Connection indicator */}
      <span className="status-dot" style={{ backgroundColor: dotColorVar, marginRight: 0 }} />

      {/* Port name or status */}
      <span className="text-text-secondary text-xs truncate max-w-[6.25rem]">
        {serialConnected
          ? serialPortName || 'Connected'
          : serialConnecting
            ? 'Connecting...'
            : 'Serial'}
      </span>

      {/* Latency display */}
      {serialConnected && (
        <span className="text-text-dimmed text-xs font-mono">
          {serialLatency}ms
        </span>
      )}

      {/* Apply config — bulk-push the entire current configuration to the
       * device's running RAM. Useful after loading a preset; individual
       * tweaks already auto-stream live. Does NOT persist across reboot. */}
      {serialConnected && (
        <Tooltip content="Apply: push the entire current configuration to the device's runtime RAM. Live for as long as the ESP32 is powered. Use after loading a preset; individual edits already stream automatically.">
          <button
            onClick={handleUpload}
            disabled={uploading}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
              uploadSuccess
                ? 'bg-green-500/20 text-green-400 border-green-500/40'
                : 'bg-accent text-white border-accent hover:brightness-110'
            } disabled:opacity-50`}
          >
            {uploading ? 'Applying…' : uploadSuccess ? 'Applied!' : 'Apply'}
          </button>
        </Tooltip>
      )}

      {/* Save to Device — write current device-side RAM config into NVS
       * flash so it survives a power cycle. May briefly interrupt audio. */}
      {serialConnected && (
        <Tooltip content="Save to Device: commit the running configuration into the ESP32's flash so it survives reboot/power-cycle. Audio may stutter briefly during the write.">
          <button
            onClick={() => sendParam(encodeSerialFrame(new Uint8Array([SERIAL_MSG_SAVE_CONFIG])))}
            className="text-xs px-2 py-0.5 rounded border bg-control-bg text-text-secondary border-surface-bg hover:text-text-primary hover:border-mute transition-colors"
          >
            Save to Device
          </button>
        </Tooltip>
      )}

      {/* Console toggle */}
      {serialConnected && (
        <Tooltip content="Toggle the serial console panel — shows ESP_LOG output from the device plus CPU load and clock-drift charts.">
          <button
            onClick={toggleSerialConsole}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
              serialConsoleOpen
                ? 'bg-accent/20 text-accent border-accent/40'
                : 'bg-control-bg text-text-dimmed border-surface-bg'
            }`}
          >
            Console
          </button>
        </Tooltip>
      )}

      {/* Connect / Disconnect button */}
      {serialConnected ? (
        <Tooltip content="Close the serial port. The device keeps running with its last applied config; reconnect any time to resume live control.">
          <button
            onClick={handleDisconnect}
            className="text-xs px-2 py-0.5 rounded bg-control-bg text-text-secondary border border-surface-bg hover:text-text-primary hover:border-mute transition-colors"
          >
            Disconnect
          </button>
        </Tooltip>
      ) : (
        <Tooltip
          content={
            serialSupport.supported
              ? 'Open a Web Serial connection to the ESP32 (Chrome/Edge only). Once connected, parameter edits stream to the device live.'
              : `${serialSupport.headline} — ${serialSupport.message}`
          }
        >
          <button
            onClick={handleConnect}
            disabled={serialConnecting || !serialSupport.supported}
            className={`text-xs px-2 py-0.5 rounded transition-all disabled:cursor-not-allowed ${
              serialSupport.supported
                ? 'bg-accent text-white hover:brightness-110 disabled:opacity-50'
                : 'bg-control-bg text-text-dimmed border border-surface-bg opacity-70'
            }`}
          >
            {!serialSupport.supported
              ? 'Serial unavailable'
              : serialConnecting
                ? 'Connecting...'
                : 'Connect Serial'}
          </button>
        </Tooltip>
      )}

      {/* Error display */}
      {serialError && !serialConnecting && (
        <Tooltip content={serialError}>
          <span className="text-red-400 text-xs truncate max-w-[9.375rem]">
            {serialError}
          </span>
        </Tooltip>
      )}
    </div>
  );
}
