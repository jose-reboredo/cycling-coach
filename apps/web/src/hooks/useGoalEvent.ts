// Goal-event persistence — localStorage-backed; will sync to D1 `goals` table
// once schema v2 is applied (event_name, event_type, target_date are already in
// migrations/0001_pmc_and_events.sql).

import { useCallback, useState } from 'react';
import { storage } from '../lib/storage';

const KEY = 'goalEvent';

export type EventType = 'gran_fondo' | 'race' | 'tt' | 'crit' | 'volume' | 'tour' | 'other';

export interface GoalEvent {
  name: string;
  type: EventType;
  /** ISO YYYY-MM-DD */
  date: string;
  distanceKm: number;
  elevationM: number;
  location: string;
  /** 1=A race, 2=B, 3=C — used for taper logic later */
  priority: 1 | 2 | 3;
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  gran_fondo: 'Gran Fondo',
  race: 'Race',
  tt: 'Time Trial',
  crit: 'Criterium',
  volume: 'Volume goal',
  tour: 'Tour',
  other: 'Other',
};

const DEFAULT: GoalEvent = {
  name: 'Etape du Tour 2026',
  type: 'gran_fondo',
  date: '2026-07-12',
  distanceKm: 168,
  elevationM: 4200,
  location: 'Albertville → La Plagne',
  priority: 1,
};

export function useGoalEvent() {
  const [event, setEvent] = useState<GoalEvent | null>(() => {
    const stored = storage.get<GoalEvent>(KEY);
    return stored ?? DEFAULT;
  });

  const save = useCallback((next: GoalEvent) => {
    storage.set(KEY, next);
    setEvent(next);
  }, []);

  const clear = useCallback(() => {
    storage.del(KEY);
    setEvent(null);
  }, []);

  const reset = useCallback(() => {
    storage.set(KEY, DEFAULT);
    setEvent(DEFAULT);
  }, []);

  return { event, save, clear, reset };
}
