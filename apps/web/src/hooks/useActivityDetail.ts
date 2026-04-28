import { useQuery } from '@tanstack/react-query';
import { stravaApi, type StravaActivityDetail } from '../lib/api';
import { readTokens } from '../lib/auth';

/**
 * useActivityDetail — lazy-fetches the rich activity payload from
 * Strava (`/api/activities/{id}`). Cached forever per-id by Tanstack
 * Query — re-opening the same ride is instant.
 *
 * `enabled` should be set true only when the user has expanded the row.
 */
export function useActivityDetail(id: number | string | null, enabled = true) {
  const tokens = readTokens();
  return useQuery<StravaActivityDetail>({
    queryKey: ['activity', id],
    queryFn: () => stravaApi.activityDetail(id as number | string),
    enabled: enabled && !!tokens && id != null,
    staleTime: Infinity, // ride detail never changes after upload
    gcTime: 30 * 60_000,
    retry: 1,
  });
}
