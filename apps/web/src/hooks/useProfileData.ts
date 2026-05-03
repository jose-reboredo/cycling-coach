// apps/web/src/hooks/useProfileData.ts
//
// Sprint 14 / v11.3.0 — Server-backed profile data hook.
// Wraps GET /api/me/profile (v11.2.0 endpoint) with TanStack Query.
// Used by /dashboard layout to render the user's name + city in the
// header from the user's database profile (not from Strava), per the
// founder's tester-readiness feedback.
import { useQuery } from '@tanstack/react-query';

export interface ProfileData {
  name: string | null;
  dob: number | null;
  gender: string | null;
  gender_self: string | null;
  city: string | null;
  country: string | null;
  ftp: number | null;
  weight_kg: number | null;
  hr_max: number | null;
  passphrase_set_at: number | null;
}

export function useProfileData(enabled = true) {
  return useQuery<ProfileData | null>({
    queryKey: ['me', 'profile'],
    queryFn: async () => {
      const r = await fetch('/api/me/profile');
      if (r.status === 401 || r.status === 404) return null;
      if (!r.ok) throw new Error(`profile_fetch_failed: ${r.status}`);
      return r.json();
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Splits `users.name` into firstName + lastName halves.
 * Falls back to Strava firstname/lastname when the DB name is null.
 */
export function resolveDisplayName(
  profileName: string | null,
  stravaFirst: string,
  stravaLast: string,
): { firstName: string; lastName: string } {
  if (profileName && profileName.trim()) {
    const parts = profileName.trim().split(/\s+/);
    return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
  }
  return { firstName: stravaFirst, lastName: stravaLast };
}
