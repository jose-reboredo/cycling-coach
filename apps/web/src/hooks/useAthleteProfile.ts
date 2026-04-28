// Athlete profile — FTP / weight / HR-max. localStorage-backed; will sync to
// D1 once `users.ftp_w / weight_kg / hr_max` columns from
// migrations/0001_pmc_and_events.sql are applied to remote D1.

import { useCallback, useState } from 'react';
import { storage } from '../lib/storage';

const KEY = 'athleteProfile';
const DISMISSED_KEY = 'onboardingDismissed';

export interface AthleteProfile {
  ftp: number | null;
  weight: number | null;
  hrMax: number | null;
  set_at: number | null;
}

const DEFAULT: AthleteProfile = {
  ftp: null,
  weight: null,
  hrMax: null,
  set_at: null,
};

export function useAthleteProfile() {
  const [profile, setProfile] = useState<AthleteProfile>(
    () => storage.get<AthleteProfile>(KEY) ?? DEFAULT,
  );
  const [dismissed, setDismissed] = useState<boolean>(
    () => storage.get<boolean>(DISMISSED_KEY) === true,
  );

  const save = useCallback((next: Partial<AthleteProfile>) => {
    setProfile((prev) => {
      const merged: AthleteProfile = {
        ftp: next.ftp ?? prev.ftp,
        weight: next.weight ?? prev.weight,
        hrMax: next.hrMax ?? prev.hrMax,
        set_at: Date.now(),
      };
      storage.set(KEY, merged);
      return merged;
    });
  }, []);

  const clear = useCallback(() => {
    storage.del(KEY);
    setProfile(DEFAULT);
  }, []);

  const dismissOnboarding = useCallback(() => {
    storage.set(DISMISSED_KEY, true);
    setDismissed(true);
  }, []);

  const resetDismissal = useCallback(() => {
    storage.del(DISMISSED_KEY);
    setDismissed(false);
  }, []);

  const isComplete = profile.ftp !== null && profile.weight !== null && profile.hrMax !== null;
  const needsOnboarding = !isComplete && !dismissed;

  return {
    profile,
    isComplete,
    dismissed,
    needsOnboarding,
    save,
    clear,
    dismissOnboarding,
    resetDismissal,
  };
}
