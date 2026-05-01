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
  /** v9.12.3 — event duration. Used for calendar time-blocking on Week
   *  and Day grids: block height = duration_minutes / 60 / TIME_GRID_HOURS.
   *  Falls back to 90-min default for legacy events without duration. */
  duration_minutes?: number | null;
  // Optional badge — for personal scheduler multi-club view.
  club_name?: string;
  /** v9.12.4 — discriminator for personal (planned_sessions) vs club events.
   *  Set true when mapping a planned_session into CalendarEvent. Drives:
   *  - hide "X going" RSVP chip (Day grid + Drawer + Month tooltip)
   *  - show "Solo session" copy in drawer instead
   *  Negative `id` is also used as a soft-discriminator (mappers convention)
   *  but this flag is the source of truth. */
  is_personal?: boolean;
  /** v9.12.5 — Coggan zone 1-7 for personal sessions. Drives pill color
   *  (`.pill_personal_z{n}`) so cyclists can read intensity at a glance.
   *  null/undefined → grey neutral (untargeted session). Club events
   *  ignore this field. */
  zone?: number | null;
  /** v9.12.5 — completion timestamp (epoch sec). When set, drawer shows
   *  "✓ Completed on [date]" banner instead of action buttons. PATCH'd
   *  via usePatchPlannedSession({ completed_at: now }). */
  completed_at?: number | null;
  /** v10.8.0 — target elevation gain (m) carried from AI plan or user
   *  edit. The route picker uses this as a signal to bias generated
   *  routes toward the right terrain band. */
  elevation_gained?: number | null;
  /** v10.8.0 — preferred surface for personal sessions (Paved | Mixed |
   *  Gravel | Any) carried from AI plan / planned_sessions. Drives the
   *  route picker's default cycling type. Distinct from the existing
   *  club-event `surface` enum (road | gravel | mixed) above. */
  session_surface?: string | null;
  /** v9.12.5 — owning club id for club events (so the personal scheduler
   *  can wire Cancel / Unsubscribe mutations against the right club). Set
   *  by the dashboard.schedule.tsx mapper from `MyScheduleEvent.club_id`.
   *  Undefined for personal sessions. */
  club_id?: number;
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

// v9.7.4 (#66) — emoji removed; consumers render the matching SVG icon
// from `apps/web/src/design/icons/` next to the label (RideIcon /
// SocialIcon / RaceIcon).
export const TYPE_LABEL: Record<ClubEventType, string> = {
  ride: 'Ride',
  social: 'Social',
  race: 'Race',
};

/** v9.12.5 — Resolves the CSS-module pill class for an event. Personal
 *  sessions get zone-colored class (`pill_personal_z{n}`) when zone is set,
 *  else neutral grey. Club events keep their event-type class. Centralised
 *  here so all 3 grids + drawer pick consistent styling. */
export function getEventPillClass(
  e: CalendarEvent,
  styles: Record<string, string>,
): string {
  if (e.is_personal) {
    const z = e.zone;
    if (z != null && z >= 1 && z <= 7) {
      return styles[`pill_personal_z${z}`] ?? styles.pill_personal_default ?? '';
    }
    return styles.pill_personal_default ?? '';
  }
  return styles[`pill_${e.event_type}`] ?? '';
}

/** v9.12.7 — duration_minutes → cyclist-canon decimal hours.
 *  90 → "1.5h", 60 → "1h", 45 → "0.75h", 120 → "2h", 75 → "1.25h".
 *  Returns null when input is null/undefined/<=0 so callers can
 *  conditionally render the chip. Used in calendar pills to mirror
 *  the SchedulePreview marketing visual. */
export function formatDuration(mins: number | null | undefined): string | null {
  if (mins == null || !Number.isFinite(mins) || mins <= 0) return null;
  const h = mins / 60;
  // Half-hour and quarter-hour increments produce clean strings; fallback
  // to 2-decimal precision for legacy non-canonical values.
  if (Number.isInteger(h * 4)) return `${h}h`;
  return `${h.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}h`;
}

/** v9.12.4 — Returns "today" in the viewer's local timezone. Name kept for
 *  call-site stability; the function previously used UTC accessors which
 *  caused day-shifting bugs in non-UTC zones (e.g. Europe/Zurich after
 *  22:00 local would render tomorrow as today). All Calendar grids highlight
 *  the cell that matches the viewer's wall-clock day. */
export function todayUTC(): CalendarDate {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
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

/** v9.12.4 — Returns the calendar day (year/month/day) for a stored UTC
 *  epoch event_date, **in the viewer's local timezone**. Required so that
 *  events stored as UTC group under the correct local day cell. */
export function eventDateToCalendar(event_date: number): CalendarDate {
  const d = new Date(event_date * 1000);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  };
}

/** v9.12.4 — HH:MM in the viewer's local timezone (was UTC). */
export function formatHHMM(event_date: number): string {
  const d = new Date(event_date * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
