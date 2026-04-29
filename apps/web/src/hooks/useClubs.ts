// Tanstack Query hooks for club endpoints. Same staleTime / cache pattern
// as useStravaData hooks (5 min stale, 30 min gc).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clubsApi, type Club, type ClubMember, type CreateClubInput, type CreateClubResponse } from '../lib/clubsApi';

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
