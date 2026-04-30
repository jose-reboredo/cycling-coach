// Anthropic Claude proxy — talks to the Worker's /coach + /coach-ride endpoints.
// BYOK: every request carries the user's own Anthropic API key.

import { ensureValidToken } from './auth';

export type DayName =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export const DAY_KEYS: DayName[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export interface AiReport {
  summary: string;
  strengths: string[];
  areasToImprove: string[];
  weeklyPlan: Record<DayName, string>;
  sessions_per_week: number;
  motivation: string;
  _adjusted?: boolean;
  /** stamped client-side after fetch */
  generated_at: number;
}

export interface RideFeedback {
  verdict: string;
  feedback: string;
  next: string;
  generated_at: number;
}

export interface CoachStats {
  rideCount: number;
  totalDistance: number;
  totalElevation: number;
  avgSpeed: number;
  longestRide: number;
  fastestRide: number;
  yearDistance: number;
  recentRideCount: number;
  recentDistance: number;
}

export interface CoachRecentRide {
  name: string;
  distance_km: number;
  duration_min: number;
  elevation_m: number;
  avg_speed_kmh: number;
  date: string;
}

export interface RideForCoach {
  name: string;
  distance_km: number;
  duration_min: number;
  elevation_m: number;
  avg_speed_kmh: number;
  heartrate?: number;
  suffer_score?: number;
  pr_count?: number;
}

export interface RideContext {
  totalRides: number;
  avgDistance: number;
  longestRide: number;
  avgSpeed: number;
}

export class CoachError extends Error {
  invalidKey: boolean;
  stravaExpired: boolean;
  constructor(message: string, invalidKey = false, stravaExpired = false) {
    super(message);
    this.invalidKey = invalidKey;
    this.stravaExpired = stravaExpired;
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const tokens = await ensureValidToken();          // from auth.ts:49
  if (!tokens) {
    throw new CoachError('strava-session-expired', false, true);
  }
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokens.access_token}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new CoachError(
      (data.error as string) || `Request failed (${res.status})`,
      Boolean(data.invalid_key),
    );
  }
  return data as T;
}

export async function generateWeeklyReport(args: {
  athlete: { firstname: string };
  stats: CoachStats;
  recent: CoachRecentRide[];
  apiKey: string;
  sessionsPerWeek: number;
}): Promise<AiReport> {
  const data = await postJson<Omit<AiReport, 'generated_at'>>('/coach', {
    athlete: args.athlete,
    stats: args.stats,
    recent: args.recent,
    api_key: args.apiKey,
    prefs: { sessions_per_week: args.sessionsPerWeek },
  });
  return { ...data, generated_at: Date.now() };
}

export async function generateRideFeedback(args: {
  ride: RideForCoach;
  athlete: { firstname: string };
  context: RideContext;
  apiKey: string;
}): Promise<RideFeedback> {
  const data = await postJson<Omit<RideFeedback, 'generated_at'>>('/coach-ride', {
    ride: args.ride,
    athlete: args.athlete,
    context: args.context,
    api_key: args.apiKey,
  });
  return { ...data, generated_at: Date.now() };
}
