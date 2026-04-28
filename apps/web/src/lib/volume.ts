// Bucket activities into weekly / monthly aggregates for the volume chart.

import type { MockActivity } from './mockMarco';

export type VolumeMode = 'weekly' | 'monthly';

export interface VolumeBucket {
  /** display label (e.g. "Apr 14" for week starting, "Apr 2026" for month) */
  label: string;
  /** sortable key for ordering */
  key: string;
  distanceKm: number;
  elevationM: number;
  rides: number;
  /** total TSS for the bucket */
  tss: number;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function isoWeekStart(d: Date): Date {
  // Monday-start week
  const day = (d.getDay() + 6) % 7; // 0=Mon..6=Sun
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day);
  return start;
}

export function bucketize(rides: MockActivity[], mode: VolumeMode): VolumeBucket[] {
  const map = new Map<string, VolumeBucket>();

  for (const r of rides) {
    const d = new Date(r.date);
    let key: string;
    let label: string;
    if (mode === 'weekly') {
      const ws = isoWeekStart(d);
      key = ws.toISOString().slice(0, 10);
      label = `${MONTH_NAMES[ws.getMonth()]} ${ws.getDate()}`;
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    }
    const cur = map.get(key) ?? {
      label,
      key,
      distanceKm: 0,
      elevationM: 0,
      rides: 0,
      tss: 0,
    };
    cur.distanceKm += r.distanceKm;
    cur.elevationM += r.elevationM;
    cur.rides += 1;
    cur.tss += r.tss;
    map.set(key, cur);
  }

  return Array.from(map.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((b) => ({
      ...b,
      distanceKm: Math.round(b.distanceKm),
      elevationM: Math.round(b.elevationM),
      tss: Math.round(b.tss),
    }));
}
