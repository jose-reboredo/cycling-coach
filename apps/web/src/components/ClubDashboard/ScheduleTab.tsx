// ScheduleTab — Sprint 5 Phase 3 (v9.7.0) → multi-view refactor (v9.7.1).
// Orchestrates Month / Week / Day calendar views over the club's events.
// Tap any pill → EventDetailDrawer. View persists in URL hash.

import { useEffect, useMemo, useState } from 'react';
import { useClubEventsByMonth, useClubOverview } from '../../hooks/useClubs';
import type { ClubEvent } from '../../lib/clubsApi';
import { MonthCalendarGrid } from '../Calendar/MonthCalendarGrid';
import { WeekCalendarGrid } from '../Calendar/WeekCalendarGrid';
import { DayCalendarGrid } from '../Calendar/DayCalendarGrid';
import { EventDetailDrawer } from '../Calendar/EventDetailDrawer';
import { RideIcon, SocialIcon, RaceIcon } from '../../design/icons';
import {
  type CalendarEvent,
  type CalendarDate,
  type CalendarView,
  type ClubEventType,
  TYPE_LABEL,
  todayUTC,
  weekStart,
} from '../Calendar/types';

// v9.7.4 (#66) — branded SVG icons replace the emoji placeholders.
const TYPE_ICON: Record<ClubEventType, typeof RideIcon> = {
  ride: RideIcon,
  social: SocialIcon,
  race: RaceIcon,
};
import styles from './ScheduleTab.module.css';

const ALL_TYPES: ClubEventType[] = ['ride', 'social', 'race'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthToRange(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function readViewFromHash(): CalendarView | null {
  if (typeof window === 'undefined') return null;
  const h = window.location.hash.replace('#', '').toLowerCase();
  if (h === 'month' || h === 'week' || h === 'day') return h;
  return null;
}

function defaultViewForViewport(): CalendarView {
  if (typeof window === 'undefined') return 'month';
  return window.matchMedia('(max-width: 599px)').matches ? 'day' : 'month';
}

function useCalendarView(): [CalendarView, (v: CalendarView) => void] {
  const [view, setView] = useState<CalendarView>(
    () => readViewFromHash() ?? defaultViewForViewport(),
  );
  // Sync hash when view changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const target = `#${view}`;
    if (window.location.hash !== target) {
      // Use replaceState so back-button doesn't pile up history entries
      window.history.replaceState(null, '', target);
    }
  }, [view]);
  // Listen to external hash changes (back-button)
  useEffect(() => {
    const onHash = () => {
      const fromHash = readViewFromHash();
      if (fromHash) setView(fromHash);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return [view, setView];
}

interface ScheduleTabProps {
  clubId: number;
  /** v9.9.0 (#60) — drawer Edit button bubbles up to parent (ClubDashboard
   *  owns the modal so create + edit share one instance). */
  onEditEvent?: (event: ClubEvent) => void;
}

export function ScheduleTab({ clubId, onEditEvent }: ScheduleTabProps) {
  const today = todayUTC();
  const [view, setView] = useCalendarView();
  const [date, setDate] = useState<CalendarDate>(today);
  const [activeFilters, setActiveFilters] = useState<Set<ClubEventType>>(new Set(ALL_TYPES));
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);

  // The endpoint queries by month — for Week/Day views we still query the
  // month containing the displayed date (over-fetch is cheap; 5-min edge cache).
  // Future opt: when in Week view crossing a month boundary, query both months.
  const range = monthToRange(date.year, date.month);
  const { data, isLoading, error } = useClubEventsByMonth(clubId, range);
  const events: CalendarEvent[] = useMemo(() => data?.events ?? [], [data]);

  // v9.7.3 — pass caller's role to drawer for Cancel-button gating.
  // Athlete-id gating client-side requires another fetch; the server
  // enforces 403 if non-creator non-admin so we lean on that.
  const overview = useClubOverview(clubId);
  const callerRole = overview.data?.club.role ?? null;

  const toggleFilter = (t: ClubEventType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  const stepDate = (delta: number) => {
    if (view === 'month') {
      const d = new Date(Date.UTC(date.year, date.month - 1 + delta, 1));
      setDate({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: 1 });
    } else if (view === 'week') {
      const start = weekStart(date);
      const d = new Date(Date.UTC(start.year, start.month - 1, start.day + 7 * delta));
      setDate({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
    } else {
      const d = new Date(Date.UTC(date.year, date.month - 1, date.day + delta));
      setDate({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
    }
  };

  const dateLabel = useMemo(() => {
    if (view === 'month') {
      return `${MONTH_NAMES[date.month - 1]} ${date.year}`;
    }
    if (view === 'week') {
      const start = weekStart(date);
      const endDate = new Date(Date.UTC(start.year, start.month - 1, start.day + 6));
      const startStr = `${start.day} ${MONTH_NAMES[start.month - 1]?.slice(0, 3)}`;
      const endStr = `${endDate.getUTCDate()} ${MONTH_NAMES[endDate.getUTCMonth()]?.slice(0, 3)}`;
      return `${startStr} – ${endStr} ${endDate.getUTCFullYear()}`;
    }
    return new Date(Date.UTC(date.year, date.month - 1, date.day)).toLocaleDateString(undefined, {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    });
  }, [view, date]);

  return (
    <div className={styles.schedule}>
      {/* HEADER ROW — view toggle + date nav */}
      <div className={styles.head}>
        <div className={styles.viewToggle} role="tablist" aria-label="Calendar view">
          {(['month', 'week', 'day'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              className={`${styles.viewBtn} ${view === v ? styles.viewBtnActive : ''}`}
              onClick={() => setView(v)}
              aria-selected={view === v}
            >
              {v[0]?.toUpperCase()}{v.slice(1)}
            </button>
          ))}
        </div>
        <div className={styles.dateNav}>
          <button type="button" className={styles.navBtn} onClick={() => stepDate(-1)} aria-label={`Previous ${view}`}>
            ←
          </button>
          <h3 className={styles.dateLabel}>{dateLabel}</h3>
          <button type="button" className={styles.navBtn} onClick={() => stepDate(1)} aria-label={`Next ${view}`}>
            →
          </button>
        </div>
      </div>

      {/* FILTER CHIPS — v9.7.4 (#66): SVG icons replace emoji placeholders. */}
      <div className={styles.filters} role="group" aria-label="Filter events by type">
        {ALL_TYPES.map((t) => {
          const Icon = TYPE_ICON[t];
          return (
            <button
              key={t}
              type="button"
              className={`${styles.chip} ${activeFilters.has(t) ? styles.chipActive : ''}`}
              onClick={() => toggleFilter(t)}
              aria-pressed={activeFilters.has(t)}
            >
              <Icon size={16} />
              <span>{TYPE_LABEL[t]}</span>
            </button>
          );
        })}
      </div>

      {/* GRID — Month / Week / Day */}
      {error ? (
        <p className={styles.empty}>Couldn't load events.</p>
      ) : (
        <div className={styles.gridWrap}>
          {view === 'month' && (
            <MonthCalendarGrid
              year={date.year}
              month={date.month}
              events={events}
              activeFilters={activeFilters}
              onEventClick={setActiveEvent}
            />
          )}
          {view === 'week' && (
            <WeekCalendarGrid
              date={date}
              events={events}
              activeFilters={activeFilters}
              onEventClick={setActiveEvent}
            />
          )}
          {view === 'day' && (
            <DayCalendarGrid
              date={date}
              events={events}
              activeFilters={activeFilters}
              onEventClick={setActiveEvent}
            />
          )}
        </div>
      )}

      {!isLoading && !error && events.length === 0 && (
        <p className={styles.empty}>No events in {MONTH_NAMES[date.month - 1]} {date.year}.</p>
      )}

      {isLoading && <p className={styles.loading}>Loading events…</p>}

      {/* EVENT DETAIL DRAWER */}
      <EventDetailDrawer
        event={activeEvent}
        onClose={() => setActiveEvent(null)}
        clubId={clubId}
        callerRole={callerRole}
        onEdit={onEditEvent ? (e) => {
          // Map CalendarEvent → full ClubEvent. The drawer's `event` is a
          // subset (CalendarEvent); for PATCH we need the original ClubEvent
          // shape. The range query results ARE ClubEvent + confirmed_count;
          // they're typed wider than CalendarEvent in the hook, so cast via
          // unknown is honest about what we're doing.
          const full = events.find((x) => x.id === e.id);
          if (full) onEditEvent(full as unknown as ClubEvent);
          setActiveEvent(null);
        } : undefined}
      />
    </div>
  );
}
