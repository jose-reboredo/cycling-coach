// Strava 7-zone power model — Coggan's classic 6 plus Z7 Neuromuscular.
// Marco lives by these. The dashboard renders every interval colored by zone.

import type { Zone } from '../components/ZonePill/ZonePill';

interface ZoneRange {
  zone: Zone;
  /** lower bound, % of FTP */
  pctLow: number;
  /** upper bound, % of FTP */
  pctHigh: number;
  label: string;
}

/**
 * Boundaries follow the standard Coggan thresholds, with Z7 splitting off
 * everything above 150 % FTP (sprint efforts / neuromuscular power).
 * Z6 here = anaerobic capacity (1.21–1.50 × FTP).
 */
export const COGGAN_ZONES: ZoneRange[] = [
  { zone: 1, pctLow: 0,    pctHigh: 0.55, label: 'Active recovery' },
  { zone: 2, pctLow: 0.55, pctHigh: 0.75, label: 'Endurance' },
  { zone: 3, pctLow: 0.76, pctHigh: 0.90, label: 'Tempo' },
  { zone: 4, pctLow: 0.91, pctHigh: 1.05, label: 'Threshold' },
  { zone: 5, pctLow: 1.06, pctHigh: 1.20, label: 'VO₂ max' },
  { zone: 6, pctLow: 1.21, pctHigh: 1.50, label: 'Anaerobic capacity' },
  { zone: 7, pctLow: 1.51, pctHigh: 999,  label: 'Neuromuscular' },
];

export function zoneFor(watts: number, ftp: number): Zone {
  if (ftp <= 0) return 1;
  const pct = watts / ftp;
  for (const z of COGGAN_ZONES) {
    if (pct >= z.pctLow && pct <= z.pctHigh) return z.zone;
  }
  return 1;
}

export function wattsForZone(zone: Zone, ftp: number): { low: number; high: number } {
  const z = COGGAN_ZONES.find((c) => c.zone === zone);
  if (!z) return { low: 0, high: 0 };
  return {
    low: Math.round(z.pctLow * ftp),
    high: Math.round(z.pctHigh === 999 ? ftp * 2.5 : z.pctHigh * ftp),
  };
}
