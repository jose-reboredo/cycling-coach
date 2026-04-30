// Club API client — talks to /api/clubs* endpoints on the Worker, which
// resolve identity server-side via Strava /athlete and gate reads by membership.

import { ensureValidToken } from './auth';

export interface Club {
  id: number;
  name: string;
  description: string | null;
  owner_athlete_id: number;
  invite_code: string | null;
  created_at: number;
  role: 'admin' | 'member' | string;
}

export interface ClubMember {
  athlete_id: number;
  firstname: string | null;
  lastname: string | null;
  profile_url: string | null;
  role: 'admin' | 'member' | string;
  joined_at: number;
}

export interface CreateClubInput {
  name: string;
  description?: string;
}

export interface CreateClubResponse {
  id: number;
  name: string;
  description: string | null;
  invite_code: string;
  role: 'admin';
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const tokens = await ensureValidToken();
  if (!tokens) throw new Error('not_authenticated');
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${tokens.access_token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `${path} ${res.status}`;
    try { msg = JSON.parse(text).error || msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export interface JoinClubResponse {
  id: number;
  name: string;
  description: string | null;
  role: 'admin' | 'member' | string;
}

export interface ClubEvent {
  id: number;
  club_id: number;
  created_by: number;
  title: string;
  description: string | null;
  location: string | null;
  event_date: number; // unix epoch seconds
  created_at: number;
  creator_firstname?: string | null;
  creator_lastname?: string | null;
}

export interface CreateClubEventInput {
  title: string;
  description?: string;
  location?: string;
  /** ISO 8601 string OR unix epoch seconds. */
  event_date: string | number;
}

// ---- /overview endpoint types (Phase 1) ----

export interface ClubStatTiles {
  hours_28d: number;
  distance_28d: number;
  ride_count_28d: number;
  new_members_28d: number;
}

export interface UpcomingEvent {
  id: number;
  title: string;
  event_date: number; // unix epoch seconds
  location: string | null;
  confirmed_count: number;
}

export interface ClubOverview {
  club: Club & { role: string };
  stat_tiles: ClubStatTiles;
  upcoming_events: UpcomingEvent[];
  circle_note: string | null;
}

export const clubsApi = {
  list: () => call<{ clubs: Club[] }>('/api/clubs').then((r) => r.clubs),
  create: (input: CreateClubInput) =>
    call<CreateClubResponse>('/api/clubs', { method: 'POST', body: JSON.stringify(input) }),
  members: (clubId: number) =>
    call<{ club_id: number; members: ClubMember[] }>(`/api/clubs/${clubId}/members`).then(
      (r) => r.members,
    ),
  join: (code: string) =>
    call<JoinClubResponse>(`/api/clubs/join/${encodeURIComponent(code)}`, { method: 'POST', body: '{}' }),
  events: (clubId: number, opts: { includePast?: boolean } = {}) =>
    call<{ club_id: number; events: ClubEvent[] }>(
      `/api/clubs/${clubId}/events${opts.includePast ? '?include=past' : ''}`,
    ).then((r) => r.events),
  createEvent: (clubId: number, input: CreateClubEventInput) =>
    call<ClubEvent>(`/api/clubs/${clubId}/events`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  overview: (clubId: number) =>
    call<ClubOverview>(`/api/clubs/${clubId}/overview`),
};
