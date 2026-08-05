/** Format dB value for display */
export function formatDb(db: number): string {
  if (db <= -72) return '-inf';
  const sign = db > 0 ? '+' : '';
  return `${sign}${db.toFixed(1)} dB`;
}

/** Format frequency for display */
export function formatFrequency(hz: number): string {
  if (hz >= 1000) {
    return `${(hz / 1000).toFixed(hz >= 10000 ? 0 : 1)} kHz`;
  }
  return `${Math.round(hz)} Hz`;
}

/** Format milliseconds for display */
export function formatMs(ms: number): string {
  return `${ms.toFixed(2)} ms`;
}

/** Format Q value for display */
export function formatQ(q: number): string {
  return q.toFixed(2);
}

/** Format linear gain as percentage */
export function formatGainPercent(linear: number): string {
  return `${Math.round(linear * 100)}%`;
}
