// Calendar event layout — Sprint 5 / v10.12.0 (GH #80).
// Replaces the % positioning that drifted by ~1px/hour due to
// .weekHourSlot's border-bottom inflating column height past the
// 40-px-per-hour math. Also adds overlap detection so two
// concurrent events render side-by-side instead of stacking on
// top of each other.

import type { CalendarEvent } from './types';

export const HOUR_PX = 40;
export const FALLBACK_EVENT_DURATION_MINUTES = 90;

export interface EventLayout {
  /** 0-based column index inside the overlap group. */
  col: number;
  /** Total columns in the overlap group (1 when no overlap). */
  total: number;
}

/**
 * Greedy left-to-right column assignment for overlapping events.
 *
 * - Events are grouped by transitive overlap (any pair that shares
 *   any second of clock time joins the same group).
 * - Within a group each event is placed in the leftmost column whose
 *   previous occupant has already ended.
 * - The group's total column count = max columns it required.
 *
 * Output: Map keyed by event.id with the per-event {col, total}.
 */
export function computeOverlapColumns(
  events: CalendarEvent[],
): Map<number, EventLayout> {
  const result = new Map<number, EventLayout>();
  if (events.length === 0) return result;

  const sorted = [...events].sort((a, b) => a.event_date - b.event_date);

  // Step 1: bucket events into transitive-overlap groups.
  const groups: CalendarEvent[][] = [];
  let curr: CalendarEvent[] = [];
  let currEnd = -Infinity;
  for (const e of sorted) {
    const start = e.event_date;
    const end =
      start + (e.duration_minutes ?? FALLBACK_EVENT_DURATION_MINUTES) * 60;
    if (start < currEnd) {
      curr.push(e);
      if (end > currEnd) currEnd = end;
    } else {
      if (curr.length > 0) groups.push(curr);
      curr = [e];
      currEnd = end;
    }
  }
  if (curr.length > 0) groups.push(curr);

  // Step 2: per group, greedy column assignment.
  for (const group of groups) {
    const colEnds: number[] = []; // last-end-time per column
    const localCol = new Map<number, number>();
    for (const e of group) {
      const start = e.event_date;
      const end =
        start + (e.duration_minutes ?? FALLBACK_EVENT_DURATION_MINUTES) * 60;
      let placed = -1;
      for (let i = 0; i < colEnds.length; i++) {
        const ce = colEnds[i];
        if (ce !== undefined && ce <= start) {
          placed = i;
          break;
        }
      }
      if (placed === -1) {
        colEnds.push(end);
        placed = colEnds.length - 1;
      } else {
        colEnds[placed] = end;
      }
      localCol.set(e.id, placed);
    }
    const total = colEnds.length;
    for (const e of group) {
      result.set(e.id, { col: localCol.get(e.id)!, total });
    }
  }

  return result;
}
