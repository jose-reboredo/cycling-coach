// Seeded mock — Marco Bianchi, our persona. Used as the demo dashboard payload
// when no Strava tokens are present so the UI is always reviewable.

import { computePmc, type PmcPoint } from './pmc';
import type { Workout } from '../components/WorkoutCard/WorkoutCard';

export interface MockAthlete {
  firstName: string;
  lastName: string;
  city: string;
  country: string;
  ftp: number;
  weight: number;
  hrMax: number;
  avatar: string; // initials, used in lieu of photo
}

export const MARCO: MockAthlete = {
  firstName: 'Marco',
  lastName: 'Bianchi',
  city: 'Zürich',
  country: 'CH',
  ftp: 285,
  weight: 72,
  hrMax: 188,
  avatar: 'MB',
};

export interface MockActivity {
  id: number;
  date: string; // ISO YYYY-MM-DD
  name: string;
  distanceKm: number;
  durationSec: number;
  elevationM: number;
  avgWatts: number;
  npWatts: number;
  tss: number;
  primaryZone: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  prCount: number;
  type: 'Ride' | 'VirtualRide';
  hr: number;
}

// Generate 90 days of plausible Marco rides — Tue/Thu intervals, Sat long ride,
// Sun recovery, occasional rest. Distributed seasonality (more volume on weekends).
function seedActivities(): MockActivity[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: MockActivity[] = [];
  let id = 100_000;

  const rideTitles: Record<MockActivity['primaryZone'], string[]> = {
    1: ['Recovery spin', 'Easy commute', 'Cool-down ride'],
    2: ['Endurance ride', 'Long Z2', 'Aerobic base', 'Saturday endurance'],
    3: ['Tempo ride', 'Sweet-spot session', 'Tempo on the rollers'],
    4: ['Threshold intervals', '4×8 @ FTP', 'Sustained efforts'],
    5: ['VO₂ max repeats', '5×3 VO₂', 'Hill repeats'],
    6: ['Anaerobic capacity', 'Microbursts'],
    7: ['Sprint work', 'Neuromuscular drills'],
  };

  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

    let zone: MockActivity['primaryZone'] | null = null;
    let durationSec = 0;
    let avgPct = 0.65;
    let elevation = 0;
    let isVirtual = false;

    // Weekly pattern
    if (day === 1) {
      // Mon — rest 70% of the time
      if (Math.random() > 0.3) continue;
      zone = 1;
      durationSec = 45 * 60;
      avgPct = 0.5;
      isVirtual = true;
    } else if (day === 2) {
      // Tue — threshold intervals
      zone = 4;
      durationSec = 75 * 60;
      avgPct = 0.78;
      isVirtual = true;
    } else if (day === 3) {
      // Wed — endurance Z2
      zone = 2;
      durationSec = 90 * 60;
      avgPct = 0.66;
      elevation = 380;
    } else if (day === 4) {
      // Thu — VO₂ or sweet-spot
      zone = Math.random() > 0.5 ? 5 : 3;
      durationSec = 70 * 60;
      avgPct = zone === 5 ? 0.82 : 0.74;
      isVirtual = true;
    } else if (day === 5) {
      // Fri — rest
      if (Math.random() > 0.2) continue;
      zone = 1;
      durationSec = 30 * 60;
      avgPct = 0.45;
    } else if (day === 6) {
      // Sat — long ride
      zone = 2;
      durationSec = (3 + Math.random() * 1.5) * 3600;
      avgPct = 0.62;
      elevation = 800 + Math.random() * 1200;
    } else {
      // Sun — endurance or tempo
      if (Math.random() > 0.4) continue;
      zone = Math.random() > 0.5 ? 2 : 3;
      durationSec = (1.5 + Math.random()) * 3600;
      avgPct = zone === 3 ? 0.72 : 0.65;
      elevation = 400 + Math.random() * 600;
    }

    if (!zone) continue;

    const avgWatts = Math.round(MARCO.ftp * avgPct);
    const npWatts = Math.round(avgWatts * 1.06);
    const intensityFactor = npWatts / MARCO.ftp;
    const hours = durationSec / 3600;
    const tss = Math.round(hours * intensityFactor * intensityFactor * 100);
    const speedKph = isVirtual ? 32 : 28 + Math.random() * 6;
    const distanceKm = Math.round((speedKph * hours) * 10) / 10;
    const titles = rideTitles[zone];
    const titleIdx = Math.floor(Math.random() * titles.length);

    out.push({
      id: id++,
      date: d.toISOString().slice(0, 10),
      name: titles[titleIdx] ?? 'Ride',
      distanceKm,
      durationSec: Math.round(durationSec),
      elevationM: Math.round(elevation),
      avgWatts,
      npWatts,
      tss,
      primaryZone: zone,
      prCount: zone >= 4 && Math.random() > 0.7 ? Math.floor(Math.random() * 3) + 1 : 0,
      type: isVirtual ? 'VirtualRide' : 'Ride',
      hr: Math.round(MARCO.hrMax * (0.6 + avgPct * 0.3)),
    });
  }

  return out;
}

export const MOCK_ACTIVITIES = seedActivities();

// Daily TSS rollup (zero-fill rest days for proper PMC math)
function dailyTssRollup(activities: MockActivity[]): { date: string; tss: number }[] {
  const map = new Map<string, number>();
  // Pre-fill all 90 days with 0
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  for (const a of activities) {
    map.set(a.date, (map.get(a.date) ?? 0) + a.tss);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, tss]) => ({ date, tss }));
}

export const MOCK_PMC: PmcPoint[] = computePmc(dailyTssRollup(MOCK_ACTIVITIES));

// 7-day delta for PMC trend arrows
export function pmcWith7dDelta() {
  const series = MOCK_PMC;
  const last = series[series.length - 1];
  const week = series[series.length - 8];
  if (!last) return null;
  return {
    ctl: last.ctl,
    atl: last.atl,
    tsb: last.tsb,
    ctlDelta: week ? Number((last.ctl - week.ctl).toFixed(1)) : 0,
    atlDelta: week ? Number((last.atl - week.atl).toFixed(1)) : 0,
    tsbDelta: week ? Number((last.tsb - week.tsb).toFixed(1)) : 0,
  };
}

// Today's planned workout — coach-voice, structured.
export const TODAYS_WORKOUT: Workout = {
  title: 'Sweet-spot intervals · 3×12',
  duration: 75 * 60,
  tss: 78,
  primaryZone: 4,
  rationale:
    'Form is productive, not too fresh — perfect day to push the engine. Three blocks at 88–92% FTP, full recovery between.',
  segments: [
    { zone: 1, duration: 10 * 60, watts: 140, label: 'warm-up' },
    { zone: 2, duration: 5 * 60, watts: 180, label: 'progression' },
    { zone: 4, duration: 12 * 60, watts: 252, label: 'block 1' },
    { zone: 1, duration: 5 * 60, watts: 140, label: 'recovery' },
    { zone: 4, duration: 12 * 60, watts: 252, label: 'block 2' },
    { zone: 1, duration: 5 * 60, watts: 140, label: 'recovery' },
    { zone: 4, duration: 12 * 60, watts: 255, label: 'block 3' },
    { zone: 1, duration: 14 * 60, watts: 130, label: 'cool-down' },
  ],
};

// Mock event — Etape du Tour 2026
export const MOCK_EVENT = {
  name: 'Etape du Tour 2026',
  type: 'Gran Fondo',
  date: '2026-07-12',
  distanceKm: 168,
  elevationM: 4200,
  location: 'Albertville → La Plagne',
};

// Mock weekly plan — for the "where am I in my plan" section
export interface PlannedDay {
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  zone: 1 | 2 | 3 | 4 | 5 | 6;
  /** rest = 0 */
  durationMin: number;
  title: string;
  done?: boolean;
}

export const WEEK_PLAN: PlannedDay[] = [
  { day: 'Mon', zone: 1, durationMin: 0, title: 'Rest', done: true },
  { day: 'Tue', zone: 4, durationMin: 75, title: 'Threshold 4×8', done: true },
  { day: 'Wed', zone: 2, durationMin: 90, title: 'Endurance Z2', done: true },
  { day: 'Thu', zone: 4, durationMin: 75, title: 'Sweet-spot 3×12' /* today */ },
  { day: 'Fri', zone: 1, durationMin: 0, title: 'Rest' },
  { day: 'Sat', zone: 2, durationMin: 240, title: 'Long endurance · 3,500m' },
  { day: 'Sun', zone: 3, durationMin: 120, title: 'Tempo over 40min hill' },
];

// Ytd totals + goal progress
export const MOCK_GOAL = {
  yearKm: 4823,
  goalKm: 8000,
  pace: 'on_track' as const,
};
