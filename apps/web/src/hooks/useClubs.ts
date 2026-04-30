// Tanstack Query hooks for club endpoints. Same staleTime / cache pattern
// as useStravaData hooks (5 min stale, 30 min gc).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clubsApi, type Club, type ClubEvent, type ClubMember, type ClubOverview, type CreateClubEventInput, type CreateClubInput, type CreateClubResponse, type JoinClubResponse, type ProfilePatchInput, type ProfilePatchResponse, type RsvpResponse } from '../lib/clubsApi';

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
