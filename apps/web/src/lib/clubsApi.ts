// Club API client — talks to /api/clubs* endpoints on the Worker, which
// resolve identity server-side via Strava /athlete and gate reads by membership.

import { ensureValidToken } from './auth';

// ---- Phase 2 types ----

export interface RsvpResponse {
  status: 'going' | 'not_going';
  confirmed_count: number;
}

export interface RsvpAvatar {
  athlete_id: number;
  firstname: string | null;
  profile_url: string | null;
}

export interface RsvpAvatarsResponse {
  confirmed_count: number;
  avatars: RsvpAvatar[];
}

export interface ProfilePatchInput {
  ftp_visibility?: 'private' | 'public';
}

export interface ProfilePatchResponse {
  athlete_id: number;
  ftp_visibility: 'private' | 'public';
}

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
  // Phase 2: server-side FTP mask per ADR-S4.4. ftp_w null until #52 ships.
  ftp_w: number | null;
  // Phase 4: cron-populated trend arrow. Null until Phase 4 ships.
  trend_arrow: string | null;
  trend_updated_at: number | null;
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

export type ClubEventType = 'ride' | 'social' | 'race';
export type ClubEventSurface = 'road' | 'gravel' | 'mixed';

export interface ClubEvent {
  id: number;
  club_id: number;
  created_by: number;
  title: string;
  description: string | null;
  location: string | null;
  event_date: number; // unix epoch seconds
  event_type: ClubEventType; // v9.7.0 (migration 0006) — defaults to 'ride'
  created_at: number;
  // v9.7.3 (migration 0007) — event model expansion + lifecycle.
  distance_km?: number | null;
  expected_avg_speed_kmh?: number | null;
  surface?: ClubEventSurface | null;
  start_point?: string | null;
  route_strava_id?: string | null;
  description_ai_generated?: number | null;
  cancelled_at?: number | null;
  /** v9.12.2 (migration 0009) — event duration; required app-side on POST. */
  duration_minutes?: number | null;
  creator_firstname?: string | null;
  creator_lastname?: string | null;
}

// Sprint 5 Phase 3 (v9.7.0) — Schedule tab month-range query.
export interface ClubEventsRangeResponse {
  club_id: number;
  range: { year: number; month: number; start: number; end: number };
  events: Array<ClubEvent & { confirmed_count: number }>;
}

export interface CreateClubEventInput {
  title: string;
  description?: string;
  location?: string;
  /** ISO 8601 string OR unix epoch seconds. */
  event_date: string | number;
  /** v9.12.2 (#79) — required at server; UI marks as mandatory. */
  duration_minutes: number;
  // v9.7.3 — Migration 0007 fields.
  event_type?: ClubEventType;
  distance_km?: number | null;
  expected_avg_speed_kmh?: number | null;
  surface?: ClubEventSurface | null;
  start_point?: string | null;
  route_strava_id?: string | null;
  description_ai_generated?: boolean;
}

/** v9.7.3 — partial update; only present keys are applied server-side. */
export type PatchClubEventInput = Partial<Omit<CreateClubEventInput, 'event_date'>> & {
  event_date?: string | number;
};

export interface CancelClubEventResponse {
  id: number;
  club_id: number;
  cancelled_at: number;
  already_cancelled?: boolean;
}

/** v9.8.0 (#60) — AI description draft input. All fields optional except
 *  title; the LLM uses whatever the form has filled in so far. */
export interface DraftEventDescriptionInput {
  title: string;
  event_type?: ClubEventType;
  distance_km?: number | null;
  expected_avg_speed_kmh?: number | null;
  surface?: ClubEventSurface | null;
  start_point?: string | null;
  location?: string | null;
}

// ---- /overview endpoint types (Phase 1) ----

export interface ClubStatTiles {
  hours_28d: number;
  distance_28d: number;
  ride_count_28d: number;
  new_members_28d: number;
}

/** v9.11.0 (#75) — expanded to full event shape so the EventDetailDrawer
 *  can render Edit/Cancel from the Club Overview tab too. Compatible
 *  with `ClubEvent` shape. */
export interface UpcomingEvent {
  id: number;
  club_id: number;
  created_by: number;
  title: string;
  description: string | null;
  location: string | null;
  event_date: number; // unix epoch seconds
  event_type: ClubEventType;
  created_at: number;
  distance_km: number | null;
  expected_avg_speed_kmh: number | null;
  surface: ClubEventSurface | null;
  start_point: string | null;
  route_strava_id: string | null;
  description_ai_generated: number | null;
  cancelled_at: number | null;
  /** v9.12.2 — duration in minutes; null for legacy events. */
  duration_minutes: number | null;
  confirmed_count: number;
}

/** v9.11.0 (#61) — Personal scheduler aggregation event shape. */
export interface MyScheduleEvent extends UpcomingEvent {
  club_name: string | null;
  is_creator: boolean;
  is_going: boolean;
}

/** v9.12.0 (#76) — Personal training session row from `planned_sessions`. */
export type PlannedSessionSource = 'manual' | 'ai-coach' | 'imported';

export interface PlannedSession {
  id: number;
  athlete_id: number;
  session_date: number;        // unix epoch seconds
  title: string;
  description: string | null;
  zone: number | null;          // 1-7 Coggan
  duration_minutes: number | null;
  target_watts: number | null;
  source: PlannedSessionSource;
  ai_report_id: number | null;
  completed_at: number | null;
  cancelled_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface CreatePlannedSessionInput {
  title: string;
  /** ISO 8601 string OR unix epoch seconds. */
  session_date: string | number;
  description?: string;
  zone?: number | null;
  duration_minutes?: number | null;
  target_watts?: number | null;
  source?: PlannedSessionSource;
}

/** v9.12.5 — describe each PATCH field explicitly so callers can clear
 *  nullable columns by sending null. Worker allowlist accepts null on all
 *  optional fields (description/zone/duration_minutes/target_watts) per
 *  worker.js:1665-1674. */
export interface PatchPlannedSessionInput {
  title?: string;
  session_date?: string | number;
  description?: string | null;
  zone?: number | null;
  duration_minutes?: number | null;
  target_watts?: number | null;
  source?: PlannedSessionSource;
  /** Mark complete (epoch seconds) or null to un-complete. */
  completed_at?: number | null;
}

export interface MyScheduleResponse {
  athlete_id: number;
  range: { year: number; month: number; start: number; end: number };
  /** v9.12.0 rename: was `events` in v9.11.0. */
  club_events: MyScheduleEvent[];
  /** v9.12.0 (#76) — personal training sessions in the same range. */
  planned_sessions: PlannedSession[];
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
  // Sprint 5 Phase 3 (v9.7.0) — Schedule tab month view.
  // range: 'YYYY-MM' (e.g. '2026-05'). Returns events with event_type +
  // confirmed_count, ordered by event_date ASC.
  eventsByMonth: (clubId: number, range: string) =>
    call<ClubEventsRangeResponse>(
      `/api/clubs/${clubId}/events?range=${encodeURIComponent(range)}`,
    ),
  createEvent: (clubId: number, input: CreateClubEventInput) =>
    call<ClubEvent>(`/api/clubs/${clubId}/events`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  // v9.7.3 (#60) — partial update; creator OR admin only.
  patchEvent: (clubId: number, eventId: number, input: PatchClubEventInput) =>
    call<{ id: number; club_id: number } & Partial<ClubEvent>>(`/api/clubs/${clubId}/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  // v9.11.0 (#61) — Personal scheduler aggregation across user's clubs.
  // v9.12.0 (#76): now also returns planned_sessions in the same response.
  mySchedule: (range: string) =>
    call<MyScheduleResponse>(`/api/me/schedule?range=${encodeURIComponent(range)}`),
  // v9.12.0 (#76) — personal session CRUD.
  mySessions: (range: string) =>
    call<{ athlete_id: number; range: { year: number; month: number; start: number; end: number }; sessions: PlannedSession[] }>(
      `/api/me/sessions?range=${encodeURIComponent(range)}`,
    ),
  createSession: (input: CreatePlannedSessionInput) =>
    call<PlannedSession>('/api/me/sessions', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  patchSession: (sessionId: number, input: PatchPlannedSessionInput) =>
    call<{ id: number } & Partial<PlannedSession>>(`/api/me/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  cancelSession: (sessionId: number) =>
    call<{ id: number; cancelled_at: number; already_cancelled?: boolean }>(
      `/api/me/sessions/${sessionId}/cancel`,
      { method: 'POST', body: '{}' },
    ),
  uncancelSession: (sessionId: number) =>
    call<{ id: number; cancelled_at: null }>(
      `/api/me/sessions/${sessionId}/uncancel`,
      { method: 'POST', body: '{}' },
    ),
  // v9.7.3 (#60) — soft-cancel; creator OR admin only.
  cancelEvent: (clubId: number, eventId: number) =>
    call<CancelClubEventResponse>(`/api/clubs/${clubId}/events/${eventId}/cancel`, {
      method: 'POST',
      body: '{}',
    }),
  // v9.8.0 (#60) — AI-drafted event description. System-paid Haiku.
  // Members of the club only; rate-limit 5/min/athlete on event-ai-draft scope.
  draftEventDescription: (clubId: number, input: DraftEventDescriptionInput) =>
    call<{ description: string }>(`/api/clubs/${clubId}/events/draft-description`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  overview: (clubId: number) =>
    call<ClubOverview>(`/api/clubs/${clubId}/overview`),
  // Phase 2 additions
  rsvp: (clubId: number, eventId: number, status: 'going' | 'not_going') =>
    call<RsvpResponse>(`/api/clubs/${clubId}/events/${eventId}/rsvp`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  rsvpAvatars: (clubId: number, eventId: number) =>
    call<RsvpAvatarsResponse>(`/api/clubs/${clubId}/events/${eventId}/rsvps`),
  updateProfile: (input: ProfilePatchInput) =>
    call<ProfilePatchResponse>('/api/users/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
};
