// Calendar primitive shared types — Sprint 5 / v9.7.1.
// Subset of clubsApi.ClubEvent so the Calendar grids are reusable by the
// personal scheduler in v9.7.4 (which aggregates events from multiple
// sources with the same minimal shape).

import type { ClubEventType } from '../../lib/clubsApi';

export type { ClubEventType };

export type CalendarView = 'month' | 'week' | 'day';

export interface CalendarEvent {
  id: number;
  title: string;
  event_date: number; // unix epoch seconds
  event_type: ClubEventType;
  confirmed_count: number;
  location?: string | null;
  description?: string | null;
  creator_firstname?: string | null;
  creator_lastname?: string | null;
  // v9.7.3 (#60) — event-model expansion + lifecycle.
  created_by?: number;
  cancelled_at?: number | null;
  distance_km?: number | null;
  expected_avg_speed_kmh?: number | null;
  surface?: 'road' | 'gravel' | 'mixed' | null;
  start_point?: string | null;
  // Optional badge — for personal scheduler multi-club view.
  club_name?: string;
}

export interface CalendarDate {
  year: number;
  month: number; // 1-indexed
  day: number;
}

/** Day-grid + week-grid display band — locked at 06:00–22:00 by founder
 *  decision 2026-05-01 (16h band; covers 99% of cycling events). */
export const TIME_GRID_START_HOUR = 6;
export const TIME_GRID_END_HOUR = 22;
export const TIME_GRID_HOURS = TIME_GRID_END_HOUR - TIME_GRID_START_HOUR;

export const TYPE_LABEL: Record<ClubEventType, string> = {
  ride: '🚴 Ride',
  social: '☕ Social',
  race: '🏁 Race',
};

export function todayUTC(): CalendarDate {
  const now = new Date();
  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
  };
}

export function isSameDay(a: CalendarDate, b: CalendarDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/** Monday-start weekday index for a CalendarDate. Monday=0 ... Sunday=6. */
export function mondayStartWeekday(d: CalendarDate): number {
  const date = new Date(Date.UTC(d.year, d.month - 1, d.day));
  return (date.getUTCDay() + 6) % 7;
}

/** Returns the Monday of the week containing `d`, in CalendarDate form. */
export function weekStart(d: CalendarDate): CalendarDate {
  const offset = mondayStartWeekday(d);
  const date = new Date(Date.UTC(d.year, d.month - 1, d.day - offset));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

/** Returns 7 consecutive CalendarDates starting at `start`. */
export function weekDates(start: CalendarDate): CalendarDate[] {
  const out: CalendarDate[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(Date.UTC(start.year, start.month - 1, start.day + i));
    out.push({
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
    });
  }
  return out;
}

export function eventDateToCalendar(event_date: number): CalendarDate {
  const d = new Date(event_date * 1000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

export function formatHHMM(event_date: number): string {
  const d = new Date(event_date * 1000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** Group events by day key 'YYYY-M-D'. Filters by activeFilters set
 *  (empty set treated as "show all" for ergonomic toggle UX). */
export function groupByDay(
  events: CalendarEvent[],
  activeFilters: Set<ClubEventType>,
): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  const filtered = events.filter(
    (e) => activeFilters.size === 0 || activeFilters.has(e.event_type),
  );
  for (const e of filtered) {
    const cd = eventDateToCalendar(e.event_date);
    const key = `${cd.year}-${cd.month}-${cd.day}`;
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  // Sort each day's events by time
  for (const list of map.values()) {
    list.sort((a, b) => a.event_date - b.event_date);
  }
  return map;
}
