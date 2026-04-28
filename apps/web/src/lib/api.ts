// Strava API client — proxies through the Worker to keep secrets server-side.
// All requests carry the access token from auth.ts.

import { ensureValidToken } from './auth';

export interface StravaAthlete {
  id: number;
  firstname: string;
  lastname: string;
  profile: string;
  city?: string;
  country?: string;
  weight?: number; // kg
  ftp?: number;
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date_local: string;
  distance: number; // meters
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  average_speed: number;
  average_watts?: number;
  weighted_average_watts?: number;
  kilojoules?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  pr_count?: number;
  achievement_count?: number;
  map?: { summary_polyline: string };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const tokens = await ensureValidToken();
  if (!tokens) throw new Error('not_authenticated');
  const res = await fetch(`/api/${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${tokens.access_token}`,
    },
  });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return (await res.json()) as T;
}

export interface StravaSplit {
  distance: number;
  elapsed_time: number;
  elevation_difference: number;
  moving_time: number;
  split: number;
  average_speed: number;
  average_heartrate?: number;
}

export interface StravaBestEffort {
  name: string;
  elapsed_time: number;
  distance: number;
  pr_rank?: number | null;
}

export interface StravaSegmentEffort {
  id: number;
  name: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  achievement_count: number;
  pr_rank?: number | null;
  segment?: { id: number; name: string };
}

export interface StravaPhoto {
  primary?: {
    urls?: { '100'?: string; '600'?: string };
  };
  count: number;
}

export interface StravaActivityDetail
  extends Omit<StravaActivity, 'map'> {
  description?: string;
  max_speed?: number;
  max_watts?: number;
  splits_metric?: StravaSplit[];
  best_efforts?: StravaBestEffort[];
  segment_efforts?: StravaSegmentEffort[];
  photos?: StravaPhoto;
  /** detail endpoint returns both the encoded full polyline and the summary */
  map?: { polyline?: string; summary_polyline?: string };
  device_name?: string;
  trainer?: boolean;
  commute?: boolean;
}

export const stravaApi = {
  athlete: () => call<StravaAthlete>('athlete'),
  activities: (page = 1, perPage = 100) =>
    call<StravaActivity[]>(`athlete/activities?per_page=${perPage}&page=${page}`),
  activityDetail: (id: number | string) =>
    call<StravaActivityDetail>(`activities/${id}`),
};
