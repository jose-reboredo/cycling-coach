// Tanstack Query hooks for athlete + activities. Pulls from /api/* via the
// Worker proxy, which already handles refresh on 401 and the Strangler-Fig
// dual-write to D1.

import { useQuery } from '@tanstack/react-query';
import { stravaApi, type StravaAthlete, type StravaActivity } from '../lib/api';
import { stravaToActivity, isRide } from '../lib/stravaConvert';
import type { MockActivity } from '../lib/mockMarco';
import { readTokens, clearTokens } from '../lib/auth';

export function useAthlete(enabled = true) {
  const tokens = readTokens();
  return useQuery<StravaAthlete>({
    queryKey: ['athlete'],
    queryFn: () => stravaApi.athlete(),
    enabled: enabled && !!tokens,
    retry: 1,
    staleTime: 5 * 60_000,
  });
}

export function useActivities(enabled = true) {
  const tokens = readTokens();
  return useQuery<StravaActivity[]>({
    queryKey: ['activities'],
    // Pull a generous slab for PMC math (~6 months covers the heatmap + chart)
    queryFn: () => stravaApi.activities(1, 200),
    enabled: enabled && !!tokens,
    retry: 1,
    staleTime: 5 * 60_000,
  });
}

/**
 * Combined hook — returns the converted activities (rides only), filtered to
 * 90 days for our widgets. Falls back to [] while loading.
 */
export function useRides(opts?: { ftp?: number; enabled?: boolean }): {
  rides: MockActivity[];
  loading: boolean;
  error: Error | null;
  /** athlete profile */
  athlete: StravaAthlete | undefined;
} {
  const enabled = opts?.enabled ?? true;
  const athleteQ = useAthlete(enabled);
  const actsQ = useActivities(enabled);

  const rides = (actsQ.data ?? [])
    .filter(isRide)
    .map((a) => stravaToActivity(a, opts?.ftp))
    // Only the last 120 days — keeps the heatmap + chart honest
    .filter((a) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 120);
      return a.date >= cutoff.toISOString().slice(0, 10);
    });

  // If the request 401s after refresh, clear tokens so the user re-authenticates
  if (actsQ.error?.message?.includes('not_authenticated')) {
    clearTokens();
  }

  return {
    rides,
    loading: athleteQ.isLoading || actsQ.isLoading,
    error: (athleteQ.error as Error | null) ?? (actsQ.error as Error | null),
    athlete: athleteQ.data,
  };
}
