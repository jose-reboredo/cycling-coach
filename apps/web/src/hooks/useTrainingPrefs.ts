import { useState, useCallback } from 'react';
import { storage, KEYS } from '../lib/storage';

export interface TrainingPrefs {
  /** 1..7 — how many cycling sessions per week the rider can commit to */
  sessions_per_week: number;
  /** 'paved' | 'dirt' | 'any' — surface preference for the route picker */
  surface_pref?: 'paved' | 'dirt' | 'any';
  /** city / area string — used to ground the route picker */
  start_address?: string;
}

const DEFAULT_PREFS: TrainingPrefs = {
  sessions_per_week: 3,
  surface_pref: 'any',
};

export function useTrainingPrefs() {
  const [prefs, setPrefs] = useState<TrainingPrefs>(() => {
    return storage.get<TrainingPrefs>(KEYS.trainingPrefs) ?? DEFAULT_PREFS;
  });

  const update = useCallback((patch: Partial<TrainingPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      storage.set(KEYS.trainingPrefs, next);
      return next;
    });
  }, []);

  return { prefs, update };
}
