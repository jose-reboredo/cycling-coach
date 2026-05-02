// Tanstack Query hooks for club endpoints. Same staleTime / cache pattern
// as useStravaData hooks (5 min stale, 30 min gc).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clubsApi, type CancelClubEventResponse, type Club, type ClubEvent, type ClubEventsRangeResponse, type ClubMember, type ClubOverview, type CreatePlannedSessionInput, type CreateClubEventInput, type CreateClubInput, type CreateClubResponse, type DraftEventDescriptionInput, type JoinClubResponse, type MyScheduleResponse, type PatchClubEventInput, type PatchPlannedSessionInput, type PlannedSession, type ProfilePatchInput, type ProfilePatchResponse, type RsvpResponse } from '../lib/clubsApi';

const FIVE_MIN = 5 * 60 * 1000;
const THIRTY_MIN = 30 * 60 * 1000;

export function useClubs() {
  return useQuery<Club[]>({
    queryKey: ['clubs', 'mine'],
    queryFn: () => clubsApi.list(),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
  });
}

export function useClubMembers(clubId: number | null) {
  return useQuery<ClubMember[]>({
    queryKey: ['clubs', clubId, 'members'],
    queryFn: () => clubsApi.members(clubId as number),
    enabled: clubId != null,
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
  });
}

export function useCreateClub() {
  const qc = useQueryClient();
  return useMutation<CreateClubResponse, Error, CreateClubInput>({
    mutationFn: (input) => clubsApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clubs', 'mine'] });
    },
  });
}

export function useJoinClub() {
  const qc = useQueryClient();
  return useMutation<JoinClubResponse, Error, string>({
    mutationFn: (code) => clubsApi.join(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clubs', 'mine'] });
    },
  });
}

export function useClubEvents(clubId: number | null, opts: { includePast?: boolean } = {}) {
  return useQuery<ClubEvent[]>({
    queryKey: ['clubs', clubId, 'events', opts.includePast ? 'all' : 'upcoming'],
    queryFn: () => clubsApi.events(clubId as number, opts),
    enabled: clubId != null,
    // Events are time-sensitive; refetch more aggressively than other club data.
    staleTime: 60 * 1000,        // 1 min stale
    gcTime: 10 * 60 * 1000,      // 10 min gc
  });
}

// Sprint 5 Phase 3 (v9.7.0) — Schedule tab month view.
// `range` is 'YYYY-MM' (e.g. '2026-05'). Returns events with event_type +
// confirmed_count for the entire UTC month, ordered by event_date ASC.
export function useClubEventsByMonth(clubId: number | null, range: string) {
  return useQuery<ClubEventsRangeResponse>({
    queryKey: ['clubs', clubId, 'events', 'range', range],
    queryFn: () => clubsApi.eventsByMonth(clubId as number, range),
    enabled: clubId != null && /^\d{4}-\d{2}$/.test(range),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    // v10.11.0 — force a fresh fetch every time the calendar mounts.
    // The calendar surface mutates frequently (create/edit/cancel/RSVP);
    // a 5-min stale window meant users saw stale data after navigating
    // back from the edit form. Mount-refetch keeps the calendar honest
    // without thrashing the cache during the same session.
    refetchOnMount: 'always',
  });
}

/** v9.12.0 (#76) — Personal session CRUD. Used by the Add Session form +
 *  drawer Edit/Cancel buttons in the personal scheduler. */
export function useCreatePlannedSession() {
  const qc = useQueryClient();
  return useMutation<PlannedSession, Error, CreatePlannedSessionInput>({
    mutationFn: (input) => clubsApi.createSession(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me', 'schedule'] });
      qc.invalidateQueries({ queryKey: ['me', 'sessions'] });
    },
  });
}

export function usePatchPlannedSession() {
  const qc = useQueryClient();
  return useMutation<{ id: number }, Error, { sessionId: number; input: PatchPlannedSessionInput }>({
    mutationFn: ({ sessionId, input }) => clubsApi.patchSession(sessionId, input),
    // v10.11.0 — await invalidation. mutateAsync resolves only after
    // onSuccess settles, so awaiting here means the caller's subsequent
    // navigate() fires AFTER refetch completes. Avoids stale-cache races
    // where the user re-opens the edit form and sees pre-edit values.
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['me', 'schedule'] }),
        qc.invalidateQueries({ queryKey: ['me', 'sessions'] }),
      ]);
    },
  });
}

export function useCancelPlannedSession() {
  const qc = useQueryClient();
  return useMutation<{ id: number; cancelled_at: number }, Error, number>({
    mutationFn: (sessionId) => clubsApi.cancelSession(sessionId),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['me', 'schedule'] }),
        qc.invalidateQueries({ queryKey: ['me', 'sessions'] }),
      ]);
    },
  });
}

/** v9.11.0 (#61) — Personal scheduler. Aggregates events from all clubs the
 *  caller is a member of, filtered to events they're going to OR created.
 *  Cancelled events excluded. 5-min stale, 30-min gc.
 *  v9.12.0 (#76): response now includes planned_sessions stream. */
export function useMyScheduleByMonth(range: string) {
  return useQuery<MyScheduleResponse>({
    queryKey: ['me', 'schedule', range],
    queryFn: () => clubsApi.mySchedule(range),
    enabled: /^\d{4}-\d{2}$/.test(range),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    // v10.11.0 — force a fresh fetch every time the calendar mounts
    // (e.g. user navigated to schedule-new, edited, came back). Without
    // this, the 5-min stale window showed old data until refetch.
    refetchOnMount: 'always',
  });
}

export function useClubOverview(clubId: number | null) {
  return useQuery<ClubOverview>({
    queryKey: ['clubs', clubId, 'overview'],
    queryFn: () => clubsApi.overview(clubId as number),
    enabled: clubId != null,
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
  });
}

export function useCreateClubEvent(clubId: number) {
  const qc = useQueryClient();
  return useMutation<ClubEvent, Error, CreateClubEventInput>({
    mutationFn: (input) => clubsApi.createEvent(clubId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clubs', clubId, 'events'] });
    },
  });
}

/**
 * useRsvp — mutation for POST /api/clubs/:id/events/:eventId/rsvp.
 * Invalidates the overview query on success so confirmed_count refreshes.
 * Optimistic update is handled at the call site (UpcomingEventRow) for
 * fine-grained control over the UI revert-on-error pattern.
 */
export function useRsvp(clubId: number, eventId: number) {
  const qc = useQueryClient();
  return useMutation<RsvpResponse, Error, 'going' | 'not_going'>({
    mutationFn: (status) => clubsApi.rsvp(clubId, eventId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clubs', clubId, 'overview'] });
      // v9.12.5 — Unsubscribe path: drop event from caller's personal schedule.
      qc.invalidateQueries({ queryKey: ['me', 'schedule'] });
    },
  });
}

/** v9.7.3 (#60) — PATCH /api/clubs/:id/events/:eventId. Creator/admin only.
 *  Invalidates the event range query so the calendar refetches on success.
 *  v10.11.0 — also invalidates ['me','schedule'] so club-event edits made
 *  visible to the personal scheduler are reflected immediately (founder
 *  bug: "edit again duration is still 0 hours" — stale cache). */
export function usePatchClubEvent(clubId: number) {
  const qc = useQueryClient();
  return useMutation<{ id: number }, Error, { eventId: number; input: PatchClubEventInput }>({
    mutationFn: ({ eventId, input }) => clubsApi.patchEvent(clubId, eventId, input),
    onSuccess: async () => {
      // Await the invalidations so the next form-mount sees fresh data.
      // Without await, navigate() can fire before the refetch completes
      // and the form re-hydrates from the stale cache.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['clubs', clubId, 'events'] }),
        qc.invalidateQueries({ queryKey: ['clubs', clubId, 'overview'] }),
        qc.invalidateQueries({ queryKey: ['me', 'schedule'] }),
      ]);
    },
  });
}

/** v9.8.0 (#60) — AI-drafted event description (system-paid Haiku).
 *  Returns the draft string; caller decides whether to populate the form
 *  with it or discard. No cache invalidation (read-only generation). */
export function useDraftEventDescription(clubId: number) {
  return useMutation<{ description: string }, Error, DraftEventDescriptionInput>({
    mutationFn: (input) => clubsApi.draftEventDescription(clubId, input),
  });
}

/** v9.7.3 (#60) — POST /api/clubs/:id/events/:eventId/cancel. Soft-delete.
 *  Creator/admin only. Invalidates calendar caches on success.
 *  v10.10.3 — also invalidates ['me','schedule'] so cancellations made
 *  from the personal scheduler drawer remove the event from the user's
 *  personal calendar immediately (without this, stale data persists for
 *  up to 5 minutes — founder bug: "events i cancel don't disappear"). */
export function useCancelClubEvent(clubId: number) {
  const qc = useQueryClient();
  return useMutation<CancelClubEventResponse, Error, number>({
    mutationFn: (eventId) => clubsApi.cancelEvent(clubId, eventId),
    onSuccess: async () => {
      // v10.11.0 — await all invalidations (mirrors usePatchClubEvent).
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['clubs', clubId, 'events'] }),
        qc.invalidateQueries({ queryKey: ['clubs', clubId, 'overview'] }),
        qc.invalidateQueries({ queryKey: ['me', 'schedule'] }),
      ]);
    },
  });
}

/**
 * useUpdateProfile — mutation for PATCH /api/users/me/profile.
 * Used for the ftp_visibility toggle (backend wired; UI deferred until
 * users.ftp_w column ships in #52 / Sprint 5).
 */
export function useUpdateProfile() {
  return useMutation<ProfilePatchResponse, Error, ProfilePatchInput>({
    mutationFn: (input) => clubsApi.updateProfile(input),
  });
}
