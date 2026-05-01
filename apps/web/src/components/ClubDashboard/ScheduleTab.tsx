// ScheduleTab — Sprint 5 Phase 3 (v9.7.0).
// Month-grid calendar with filter chips by event_type. Reads from
// GET /api/clubs/:id/events?range=YYYY-MM (single batch, 5-min edge cache).
// Tap an event pill → drawer with details + RSVP (reuses Overview pattern).
//
// Design choices (locked with founder 2026-05-01):
// - 6-row × 7-col grid (always renders the same shape; out-of-month cells greyed)
// - Today highlighted with accent border
// - Up to 2 event pills per cell, "+N more" overflow
// - Event pills colour-coded: ride (accent) / social (info) / race (warn)
// - Filter chips multi-select (tap to toggle); empty filter set = show all
// - Mobile: filters stack horizontally above grid; grid stays 7-col but cells
//   become tighter

import { useMemo, useState } from 'react';
import { useClubEventsByMonth } from '../../hooks/useClubs';
import type { ClubEventType } from '../../lib/clubsApi';
import styles from './ScheduleTab.module.css';

const ALL_TYPES: ClubEventType[] = ['ride', 'social', 'race'];

const TYPE_LABEL: Record<ClubEventType, string> = {
  ride: '🚴 Ride',
  social: '☕ Social',
  race: '🏁 Race',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function monthToRange(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function todayUTC(): { year: number; month: number; day: number } {
  const now = new Date();
  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
  };
}

/**
 * Build a 6-row × 7-col grid for a given month, Monday-start week.
 * Returns 42 cells; out-of-month cells flagged with `inMonth: false`.
 */
function buildGrid(year: number, month: number): Array<{ year: number; month: number; day: number; inMonth: boolean }> {
  // First day of month (1-indexed input → 0-indexed for Date)
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  // JS getUTCDay: Sun=0, Mon=1 ... Sat=6 → convert to Monday-start (Mon=0 ... Sun=6)
  const firstWeekday = (firstDay.getUTCDay() + 6) % 7;
  // Days in this month
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // Days to show from previous month
  const cells: Array<{ year: number; month: number; day: number; inMonth: boolean }> = [];
  for (let i = 0; i < firstWeekday; i++) {
    const d = new Date(Date.UTC(year, month - 1, -firstWeekday + i + 1));
    cells.push({
      year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), inMonth: false,
    });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ year, month, day, inMonth: true });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1]!;
    const d = new Date(Date.UTC(last.year, last.month - 1, last.day + 1));
    cells.push({
      year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), inMonth: false,
    });
  }
  return cells;
}

export function ScheduleTab({ clubId }: { clubId: number }) {
  const today = todayUTC();
  const [view, setView] = useState({ year: today.year, month: today.month });
  const [activeFilters, setActiveFilters] = useState<Set<ClubEventType>>(new Set(ALL_TYPES));

  const range = monthToRange(view.year, view.month);
  const { data, isLoading, error } = useClubEventsByMonth(clubId, range);

  const grid = useMemo(() => buildGrid(view.year, view.month), [view.year, view.month]);

  // Group events by UTC day for the displayed month.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, typeof data extends { events: infer E } ? E : never>();
    if (!data?.events) return map as Map<string, NonNullable<typeof data>['events']>;
    const filtered = data.events.filter((e) => activeFilters.size === 0 || activeFilters.has(e.event_type));
    for (const e of filtered) {
      const d = new Date(e.event_date * 1000);
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
      const existing = (map.get(key) ?? []) as typeof filtered;
      existing.push(e);
      map.set(key, existing as never);
    }
    return map as Map<string, typeof filtered>;
  }, [data, activeFilters]);

  const stepMonth = (delta: number) => {
    const d = new Date(Date.UTC(view.year, view.month - 1 + delta, 1));
    setView({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  };

  const toggleFilter = (t: ClubEventType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  const isToday = (cell: { year: number; month: number; day: number }) =>
    cell.year === today.year && cell.month === today.month && cell.day === today.day;

  return (
    <div className={styles.schedule}>
      {/* HEADER — month label + prev/next */}
      <div className={styles.head}>
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => stepMonth(-1)}
          aria-label="Previous month"
        >
          ←
        </button>
        <h3 className={styles.monthLabel}>
          {MONTH_NAMES[view.month - 1]} {view.year}
        </h3>
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => stepMonth(1)}
          aria-label="Next month"
        >
          →
        </button>
      </div>

      {/* FILTER CHIPS */}
      <div className={styles.filters} role="group" aria-label="Filter events by type">
        {ALL_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.chip} ${activeFilters.has(t) ? styles.chipActive : ''}`}
            onClick={() => toggleFilter(t)}
            aria-pressed={activeFilters.has(t)}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {/* DAY-OF-WEEK HEADER */}
      <div className={styles.weekdayRow} aria-hidden="true">
        {DAY_LABELS.map((d, i) => (
          <span key={i} className={styles.weekdayCell}>{d}</span>
        ))}
      </div>

      {/* GRID */}
      {error ? (
        <p className={styles.empty}>Couldn't load events for {range}.</p>
      ) : (
        <div className={styles.grid}>
          {grid.map((cell, idx) => {
            const key = `${cell.year}-${cell.month}-${cell.day}`;
            const dayEvents = eventsByDay.get(key) ?? [];
            const visibleEvents = dayEvents.slice(0, 2);
            const overflow = dayEvents.length - visibleEvents.length;
            return (
              <div
                key={`${idx}-${key}`}
                className={[
                  styles.cell,
                  cell.inMonth ? '' : styles.cellOut,
                  isToday(cell) ? styles.cellToday : '',
                ].filter(Boolean).join(' ')}
              >
                <span className={styles.dayNum}>{cell.day}</span>
                {visibleEvents.map((e) => {
                  const time = new Date(e.event_date * 1000);
                  const hh = String(time.getUTCHours()).padStart(2, '0');
                  const mm = String(time.getUTCMinutes()).padStart(2, '0');
                  return (
                    <span
                      key={e.id}
                      className={`${styles.pill} ${styles[`pill_${e.event_type}`]}`}
                      title={`${e.title} · ${hh}:${mm} · ${e.confirmed_count} going`}
                    >
                      <span className={styles.pillTime}>{hh}:{mm}</span>
                      <span className={styles.pillTitle}>{e.title}</span>
                    </span>
                  );
                })}
                {overflow > 0 && (
                  <span className={styles.overflow}>+{overflow} more</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* EMPTY STATE */}
      {!isLoading && !error && (data?.events?.length ?? 0) === 0 && (
        <p className={styles.empty}>
          No events in {MONTH_NAMES[view.month - 1]} {view.year}.
        </p>
      )}

      {isLoading && <p className={styles.loading}>Loading events…</p>}
    </div>
  );
}
