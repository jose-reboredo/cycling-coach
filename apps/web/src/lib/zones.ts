// Coggan power-zone model — derived from FTP.
// Marco lives by these. The dashboard renders every interval colored by zone.
//
// TODO(zones): Strava uses a 7-zone model (Z1–Z7, the 7th being
// "Neuromuscular Power" >150% FTP). When we ingest Strava-side power-zone
// metadata for activities, we'll extend Zone to 1..7 and add a Z7 token to
// tokens.{ts,css} (provisional: deeper purple #6b21a8). Currently using
// Coggan's 6 because TrainingPeaks/TrainerRoad — Marco's tools — use 6.

import type { Zone } from '../components/ZonePill/ZonePill';

interface ZoneRange {
  zone: Zone;
  /** lower bound, % of FTP */
  pctLow: number;
  /** upper bound, % of FTP */
  pctHigh: number;
  label: string;
}

export const COGGAN_ZONES: ZoneRange[] = [
  { zone: 1, pctLow: 0,    pctHigh: 0.55, label: 'Active recovery' },
  { zone: 2, pctLow: 0.55, pctHigh: 0.75, label: 'Endurance' },
  { zone: 3, pctLow: 0.76, pctHigh: 0.90, label: 'Tempo' },
  { zone: 4, pctLow: 0.91, pctHigh: 1.05, label: 'Threshold' },
  { zone: 5, pctLow: 1.06, pctHigh: 1.20, label: 'VO₂ max' },
  { zone: 6, pctLow: 1.21, pctHigh: 999,  label: 'Anaerobic' },
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
    high: Math.round(z.pctHigh === 999 ? ftp * 1.5 : z.pctHigh * ftp),
  };
}
