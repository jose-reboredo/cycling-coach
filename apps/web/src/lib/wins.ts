// Extract PRs / achievements from the last 90 days into a feed.

import type { MockActivity } from './mockMarco';

export interface Win {
  rideId: number;
  rideName: string;
  date: string;
  prCount: number;
  distanceKm: number;
  durationSec: number;
  primaryZone: number;
}

export function extractWins(rides: MockActivity[], windowDays = 90): Win[] {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const sinceIso = since.toISOString().slice(0, 10);

  return rides
    .filter((r) => r.prCount > 0 && r.date >= sinceIso)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((r) => ({
      rideId: r.id,
      rideName: r.name,
      date: r.date,
      prCount: r.prCount,
      distanceKm: r.distanceKm,
      durationSec: r.durationSec,
      primaryZone: r.primaryZone,
    }));
}
