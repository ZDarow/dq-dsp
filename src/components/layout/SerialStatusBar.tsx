import { useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDSPStore } from '../../store/dsp-store';
import { useWebSerial } from '../../hooks/useWebSerial';
import { createSerialMiddleware } from '../../serial/serial-middleware';
import { encodeSerialFrame, SERIAL_MSG_SAVE_CONFIG } from '../../types/serial-protocol';
import type { DSPConfig } from '../../types/dsp';
import { Tooltip } from '../ui/Tooltip';
import { useSerialSupport } from '../../hooks/useSerialSupport';

export function SerialStatusBar() {
  const { t } = useTranslation();
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
        setSerialError(t('serial.deviceError', { code: msg.statusCode }));
      }
    });
  }, [onStatus, setSerialError, t]);

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
      addSerialLog(t('serial.syncAppliedLog'));
    });
  }, [onConfig, applyDeviceConfig, addSerialLog, t]);

  // Manual sync only — auto-pull on connect raced with user actions
  // (Load Preset, in-flight tweaks) and overwrote local state with the
  // device's stale RAM. The user pulls explicitly via the Sync button.
  const handleSync = useCallback(() => {
    requestConfig();
    addSerialLog(t('serial.syncLog'));
  }, [requestConfig, addSerialLog, t]);

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
          ? serialPortName || t('serial.connected')
          : serialConnecting
            ? t('serial.connecting')
            : t('serial.serial')}
      </span>

      {/* Latency display */}
      {serialConnected && (
        <span className="text-text-dimmed text-xs font-mono">
          {serialLatency}ms
        </span>
      )}

      {/* Sync — pull the device's current config into the UI. Use this
       * after Connect (or after an external change) so the UI reflects
       * the firmware's actual state, including device-fixed fields like
       * sample rate. */}
      {serialConnected && (
        <Tooltip content={t('serial.syncTooltip')}>
          <button
            onClick={handleSync}
            className="text-xs px-2 py-0.5 rounded border bg-control-bg text-text-secondary border-surface-bg hover:text-text-primary hover:border-mute transition-colors"
          >
            {t('serial.sync')}
          </button>
        </Tooltip>
      )}

      {/* Apply config — bulk-push the entire current configuration to the
       * device's running RAM. Useful after loading a preset; individual
       * tweaks already auto-stream live. Does NOT persist across reboot. */}
      {serialConnected && (
        <Tooltip content={t('serial.applyTooltip')}>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
              uploadSuccess
                ? 'bg-green-500/20 text-green-400 border-green-500/40'
                : 'bg-accent text-white border-accent hover:brightness-110'
            } disabled:opacity-50`}
          >
            {uploading ? t('common.applying') : uploadSuccess ? t('common.applied') : t('common.apply')}
          </button>
        </Tooltip>
      )}

      {/* Save to Device — write current device-side RAM config into NVS
       * flash so it survives a power cycle. May briefly interrupt audio. */}
      {serialConnected && (
        <Tooltip content={t('serial.saveTooltip')}>
          <button
            onClick={() => sendParam(encodeSerialFrame(new Uint8Array([SERIAL_MSG_SAVE_CONFIG])))}
            className="text-xs px-2 py-0.5 rounded border bg-control-bg text-text-secondary border-surface-bg hover:text-text-primary hover:border-mute transition-colors"
          >
            {t('serial.saveToDevice')}
          </button>
        </Tooltip>
      )}

      {/* Console toggle */}
      {serialConnected && (
        <Tooltip content={t('serial.consoleTooltip')}>
          <button
            onClick={toggleSerialConsole}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
              serialConsoleOpen
                ? 'bg-accent/20 text-accent border-accent/40'
                : 'bg-control-bg text-text-dimmed border-surface-bg'
            }`}
          >
            {t('serial.console')}
          </button>
        </Tooltip>
      )}

      {/* Connect / Disconnect button */}
      {serialConnected ? (
        <Tooltip content={t('serial.disconnectTooltip')}>
          <button
            onClick={handleDisconnect}
            className="text-xs px-2 py-0.5 rounded bg-control-bg text-text-secondary border border-surface-bg hover:text-text-primary hover:border-mute transition-colors"
          >
            {t('serial.disconnect')}
          </button>
        </Tooltip>
      ) : (
        <Tooltip
          content={
            serialSupport.supported
              ? t('serial.connectTooltip')
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
              ? t('serial.unavailable')
              : serialConnecting
                ? t('serial.connecting')
                : t('serial.connect')}
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
