// Helpers for going from raw activities → the shapes /coach + /coach-ride expect.

import type { CoachRecentRide, CoachStats, DayName } from './coachApi';
import { DAY_KEYS } from './coachApi';

interface RideLike {
  name: string;
  date: string; // ISO YYYY-MM-DD
  distanceKm: number;
  durationSec: number;
  elevationM: number;
  /** kph if computed externally — not on the mock; we'll compute from distance/time */
  avgSpeedKmh?: number;
}

const KM_PER_M = 0.001;

export function computeStats(rides: RideLike[], yearDistanceKm: number): CoachStats {
  if (rides.length === 0) {
    return {
      rideCount: 0,
      totalDistance: 0,
      totalElevation: 0,
      avgSpeed: 0,
      longestRide: 0,
      fastestRide: 0,
      yearDistance: 0,
      recentRideCount: 0,
      recentDistance: 0,
    };
  }
  const totalDistance = Math.round(rides.reduce((a, r) => a + r.distanceKm, 0));
  const totalElevation = Math.round(rides.reduce((a, r) => a + r.elevationM, 0));
  const avgSpeed = Number(
    (
      rides.reduce((a, r) => a + (r.avgSpeedKmh ?? (r.distanceKm / Math.max(r.durationSec / 3600, 0.001))), 0) /
      rides.length
    ).toFixed(1),
  );
  const longestRide = Math.round(Math.max(...rides.map((r) => r.distanceKm)));
  const fastestRide = Number(
    Math.max(...rides.map((r) => r.avgSpeedKmh ?? (r.distanceKm / Math.max(r.durationSec / 3600, 0.001)))).toFixed(1),
  );

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const recentSinceISO = since.toISOString().slice(0, 10);
  const recent = rides.filter((r) => r.date >= recentSinceISO);
  return {
    rideCount: rides.length,
    totalDistance,
    totalElevation,
    avgSpeed,
    longestRide,
    fastestRide,
    yearDistance: Math.round(yearDistanceKm),
    recentRideCount: recent.length,
    recentDistance: Math.round(recent.reduce((a, r) => a + r.distanceKm, 0)),
  };
}

export function recentForCoach(rides: RideLike[], n = 10): CoachRecentRide[] {
  return rides
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n)
    .map((r) => ({
      name: r.name,
      distance_km: Math.round(r.distanceKm * 10) / 10,
      duration_min: Math.round(r.durationSec / 60),
      elevation_m: Math.round(r.elevationM),
      avg_speed_kmh:
        r.avgSpeedKmh ?? Number((r.distanceKm / Math.max(r.durationSec / 3600, 0.001)).toFixed(1)),
      date: r.date,
    }));
}

/** Day index in JS Date.getDay(): 0=Sun..6=Sat. Map to our DayName order (mon-first). */
export function todayKey(): DayName {
  const idx = (new Date().getDay() + 6) % 7; // shift Sunday from 0 → 6
  return DAY_KEYS[idx]!;
}

export function isRestText(text: string | undefined | null): boolean {
  if (!text) return true;
  const w = text.trim().toLowerCase();
  if (!w) return true;
  if (/^rest\b/.test(w)) return true;
  if (/^active recovery:?\s*(20|30)?\s*min\s*walk/.test(w)) return true;
  if (/^active recovery:?\s*(yoga|stretch|walk)/.test(w)) return true;
  return false;
}

export function bytesToMeters() {} // unused export guard — keep tree-shaker happy on partial builds

/** Light Strava-meta extractor for sample (kept for /api/strava-side conversion later) */
export function metersToKm(m: number): number {
  return m * KM_PER_M;
}
