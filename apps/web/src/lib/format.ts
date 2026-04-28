// Display formatters. Tabular nums are enforced via mono font.

export function fmtKm(meters: number): string {
  return (meters / 1000).toLocaleString('en-GB', { maximumFractionDigits: 1 });
}

export function fmtKmInt(meters: number): string {
  return Math.round(meters / 1000).toLocaleString('en-GB');
}

export function fmtMeters(m: number): string {
  return Math.round(m).toLocaleString('en-GB');
}

export function fmtDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function fmtDurationShort(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m.toString().padStart(2, '0')}`;
}

export function fmtPace(secondsPerKm: number): string {
  if (!secondsPerKm) return '—';
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function fmtSpeedKph(metersPerSec: number): string {
  return (metersPerSec * 3.6).toFixed(1);
}

export function fmtRelative(when: Date | string): string {
  const d = typeof when === 'string' ? new Date(when) : when;
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function fmtDate(when: Date | string): string {
  const d = typeof when === 'string' ? new Date(when) : when;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDayShort(when: Date | string): string {
  const d = typeof when === 'string' ? new Date(when) : when;
  return d.toLocaleDateString('en-GB', { weekday: 'short' });
}

export function daysBetween(a: Date | string, b: Date | string): number {
  const da = typeof a === 'string' ? new Date(a) : a;
  const db = typeof b === 'string' ? new Date(b) : b;
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}
