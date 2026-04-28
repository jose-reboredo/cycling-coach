// Convert Strava API activities → the internal MockActivity shape used by all
// dashboard widgets. One mapper, one place. When schema v2 is applied and we
// have real FTP, the TSS/zone math here flips from proxy to truth.

import type { StravaActivity } from './api';
import type { MockActivity } from './mockMarco';
import { zoneFor } from './zones';

const RIDE_TYPES = new Set(['Ride', 'VirtualRide', 'EBikeRide', 'GravelRide']);

/**
 * Strava → MockActivity. If FTP is known, computes real TSS + primary zone
 * from weighted-average watts. If not, falls back to a duration-based load
 * proxy (≈70 TSS/hour) and Z2 default — clearly tagged in the UI.
 */
export function stravaToActivity(s: StravaActivity, ftp?: number): MockActivity {
  const distanceKm = s.distance / 1000;
  const durationSec = s.moving_time;
  const hours = durationSec / 3600;
  const elevationM = s.total_elevation_gain ?? 0;
  const avgWatts = s.average_watts ?? 0;
  const npWatts = s.weighted_average_watts ?? avgWatts;

  let tss: number;
  let primaryZone: 1 | 2 | 3 | 4 | 5 | 6 = 2;

  if (ftp && ftp > 0 && npWatts > 0) {
    const intensityFactor = npWatts / ftp;
    tss = Math.round(hours * intensityFactor * intensityFactor * 100);
    primaryZone = zoneFor(npWatts, ftp);
  } else {
    // Time-based proxy until the user sets FTP.
    tss = Math.round(hours * 70);
  }

  const ttype: MockActivity['type'] = s.type === 'VirtualRide' ? 'VirtualRide' : 'Ride';

  return {
    id: s.id,
    date: s.start_date_local.slice(0, 10),
    name: s.name,
    distanceKm: Math.round(distanceKm * 10) / 10,
    durationSec,
    elevationM: Math.round(elevationM),
    avgWatts: Math.round(avgWatts),
    npWatts: Math.round(npWatts),
    tss,
    primaryZone,
    prCount: s.pr_count ?? 0,
    type: ttype,
    hr: Math.round(s.average_heartrate ?? 0),
  };
}

export function isRide(s: StravaActivity): boolean {
  return RIDE_TYPES.has(s.type) || RIDE_TYPES.has(s.sport_type);
}
