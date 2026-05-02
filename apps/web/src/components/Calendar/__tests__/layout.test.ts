// v10.12.0 — overlap-layout regression guards (GH #80).
// Calendar bugs lived undetected through 6 hotfixes because we shipped UI
// math without contract tests. This file asserts the column-assignment
// behaviour stays fixed.

import { describe, expect, it } from 'vitest';
import { computeOverlapColumns } from '../layout';
import type { CalendarEvent } from '../types';

function ev(id: number, hh: number, mm: number, durMin: number): CalendarEvent {
  // Anchor at 2026-05-01 T00:00 UTC + the requested HH:MM.
  const base = Date.UTC(2026, 4, 1, hh, mm, 0) / 1000;
  return {
    id,
    title: `e${id}`,
    event_date: base,
    event_type: 'ride',
    confirmed_count: 0,
    duration_minutes: durMin,
  };
}

describe('computeOverlapColumns', () => {
  it('assigns col 0 / total 1 to a single event', () => {
    const map = computeOverlapColumns([ev(1, 9, 0, 60)]);
    expect(map.get(1)).toEqual({ col: 0, total: 1 });
  });

  it('keeps non-overlapping events in their own groups (total=1 each)', () => {
    const a = ev(1, 9, 0, 60); // 09:00-10:00
    const b = ev(2, 11, 0, 60); // 11:00-12:00
    const map = computeOverlapColumns([a, b]);
    expect(map.get(1)).toEqual({ col: 0, total: 1 });
    expect(map.get(2)).toEqual({ col: 0, total: 1 });
  });

  it('places two overlapping events side by side (total=2)', () => {
    const a = ev(1, 9, 0, 90); // 09:00-10:30
    const b = ev(2, 9, 30, 60); // 09:30-10:30
    const map = computeOverlapColumns([a, b]);
    expect(map.get(1)).toEqual({ col: 0, total: 2 });
    expect(map.get(2)).toEqual({ col: 1, total: 2 });
  });

  it('reuses a column once the prior event has ended (greedy packing)', () => {
    // a + b overlap, a + c overlap (transitively via b), but b ends before c
    // starts so c can reuse column 0.
    const a = ev(1, 9, 0, 60); // 09:00-10:00
    const b = ev(2, 9, 30, 90); // 09:30-11:00 (overlaps a)
    const c = ev(3, 10, 30, 60); // 10:30-11:30 (overlaps b only)
    const map = computeOverlapColumns([a, b, c]);
    expect(map.get(1)?.col).toBe(0);
    expect(map.get(2)?.col).toBe(1);
    // c can reuse col 0 because a (col 0) ended at 10:00, before c starts at 10:30.
    expect(map.get(3)?.col).toBe(0);
    // Group total stays 2 — max simultaneity is 2.
    expect(map.get(1)?.total).toBe(2);
    expect(map.get(2)?.total).toBe(2);
    expect(map.get(3)?.total).toBe(2);
  });

  it('handles a 3-way overlap with total=3', () => {
    const a = ev(1, 9, 0, 120); // 09:00-11:00
    const b = ev(2, 9, 30, 60); // 09:30-10:30
    const c = ev(3, 10, 0, 60); // 10:00-11:00
    const map = computeOverlapColumns([a, b, c]);
    expect(map.get(1)?.total).toBe(3);
    expect(map.get(2)?.total).toBe(3);
    expect(map.get(3)?.total).toBe(3);
    expect(map.get(1)?.col).toBe(0);
    expect(map.get(2)?.col).toBe(1);
    expect(map.get(3)?.col).toBe(2);
  });

  it('falls back to 90-minute duration when duration_minutes is missing', () => {
    const a: CalendarEvent = {
      id: 1,
      title: 'a',
      event_date: Date.UTC(2026, 4, 1, 9, 0, 0) / 1000,
      event_type: 'ride',
      confirmed_count: 0,
      duration_minutes: null,
    };
    const b = ev(2, 10, 0, 60); // 10:00 — falls inside the 90-min span
    const map = computeOverlapColumns([a, b]);
    expect(map.get(1)?.total).toBe(2);
    expect(map.get(2)?.total).toBe(2);
  });

  it('returns an empty map for an empty input', () => {
    expect(computeOverlapColumns([]).size).toBe(0);
  });
});
