// Sprint 5 / v9.11.0 (#61) — Personal scheduler.
// Aggregates upcoming events across ALL the user's clubs. Reuses the
// Calendar primitives (Month/Week/Day grids + EventDetailDrawer) so the
// look is consistent with the per-club Schedule tab.
//
// v9.11.0 ships clubs-only aggregation (Streams 1+2 from #61 spec).
// Streams 3+4 (AI plan items + goals) deferred — schemas not yet stable.

import { useEffect, useMemo, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Container } from '../components/Container/Container';
import { Eyebrow } from '../components/Eyebrow/Eyebrow';
import { Button } from '../components/Button/Button';
import { MonthCalendarGrid } from '../components/Calendar/MonthCalendarGrid';
import { WeekCalendarGrid } from '../components/Calendar/WeekCalendarGrid';
import { DayCalendarGrid } from '../components/Calendar/DayCalendarGrid';
import { EventDetailDrawer } from '../components/Calendar/EventDetailDrawer';
import {
  type CalendarEvent,
  type CalendarDate,
  type CalendarView,
  type ClubEventType,
  TYPE_LABEL,
  todayUTC,
  weekStart,
} from '../components/Calendar/types';
import { RideIcon, SocialIcon, RaceIcon } from '../design/icons';
import { useMyScheduleByMonth } from '../hooks/useClubs';
import styles from './dashboard.schedule.module.css';

export const Route = createFileRoute('/dashboard/schedule')({
  component: PersonalSchedule,
});

const ALL_TYPES: ClubEventType[] = ['ride', 'social', 'race'];
const TYPE_ICON: Record<ClubEventType, typeof RideIcon> = {
  ride: RideIcon,
  social: SocialIcon,
  race: RaceIcon,
};

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

function PersonalSchedule() {
  const navigate = useNavigate();
  const today = todayUTC();
  const [view, setView] = useState<CalendarView>(
    () => readViewFromHash() ?? defaultViewForViewport(),
  );
  const [date, setDate] = useState<CalendarDate>(today);
  const [activeFilters, setActiveFilters] = useState<Set<ClubEventType>>(new Set(ALL_TYPES));
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);

  // Hash sync
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const target = `#${view}`;
    if (window.location.hash !== target) {
      window.history.replaceState(null, '', target);
    }
  }, [view]);
  useEffect(() => {
    const onHash = () => {
      const fromHash = readViewFromHash();
      if (fromHash) setView(fromHash);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const range = monthToRange(date.year, date.month);
  const { data, isLoading, error } = useMyScheduleByMonth(range);

  // v9.12.0 (#77): merge club_events + planned_sessions into one CalendarEvent
  // stream. Personal sessions surface as event_type='ride' with a synthetic
  // negative ID so they don't collide with real club_event IDs (the personal
  // scheduler distinguishes via event_source field — added in v9.12.x visual
  // layer follow-up).
  const events: CalendarEvent[] = useMemo(() => {
    const club: CalendarEvent[] = (data?.club_events ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      event_date: e.event_date,
      event_type: e.event_type,
      confirmed_count: e.confirmed_count,
      location: e.location,
      description: e.description,
      created_by: e.created_by,
      cancelled_at: e.cancelled_at,
      distance_km: e.distance_km,
      expected_avg_speed_kmh: e.expected_avg_speed_kmh,
      surface: e.surface,
      start_point: e.start_point,
      // v9.12.3 — duration drives Week/Day calendar block height.
      duration_minutes: e.duration_minutes,
      club_name: e.club_name ?? undefined,
    }));
    // Personal sessions render as 'ride' (existing color/icon). Visual diff
    // (zone color + SessionIcon) is v9.12.4 follow-up. Negative ID prevents
    // collision with club_event IDs in the calendar grid's React keys.
    const personal: CalendarEvent[] = (data?.planned_sessions ?? []).map((s) => ({
      id: -s.id,
      title: s.title,
      event_date: s.session_date,
      event_type: 'ride' as const,
      confirmed_count: 0,
      location: null,
      description: s.description,
      cancelled_at: s.cancelled_at,
      // v9.12.3 — session duration → calendar block height.
      duration_minutes: s.duration_minutes,
    }));
    return [...club, ...personal].sort((a, b) => a.event_date - b.event_date);
  }, [data]);

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
    if (view === 'month') return `${MONTH_NAMES[date.month - 1]} ${date.year}`;
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

  const toggleFilter = (t: ClubEventType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  return (
    <main id="main" className={styles.page}>
      <Container width="wide">
        <header className={styles.head}>
          <Eyebrow rule tone="accent">Personal · all clubs + sessions</Eyebrow>
          <h1 className={styles.title}>Your <em>schedule</em>.</h1>
          <p className={styles.lede}>
            Events you've RSVP'd to or created across every club, plus your
            personal training sessions. Cancelled rides excluded.
          </p>
          <div className={styles.headActions}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate({ to: '/dashboard/schedule-new' })}
              withArrow
            >
              + Add session
            </Button>
          </div>
        </header>

        <div className={styles.controls}>
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
            <button type="button" className={styles.navBtn} onClick={() => stepDate(-1)} aria-label={`Previous ${view}`}>←</button>
            <h3 className={styles.dateLabel}>{dateLabel}</h3>
            <button type="button" className={styles.navBtn} onClick={() => stepDate(1)} aria-label={`Next ${view}`}>→</button>
          </div>
        </div>

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

        {error ? (
          <p className={styles.empty}>Couldn't load your schedule.</p>
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
          <p className={styles.empty}>
            Nothing on the calendar for {MONTH_NAMES[date.month - 1]} {date.year}.
            RSVP to a club ride or create your own to see it here.
          </p>
        )}

        {isLoading && <p className={styles.loading}>Loading your schedule…</p>}

        {/* Drawer is read-only for the personal scheduler in v9.11.0 — the
         *  Edit/Cancel UX needs to know which club to PATCH against, and
         *  cross-club editing requires more thought (creator vs admin role
         *  is per-club). Defer to v9.11.x or v9.12.x. */}
        <EventDetailDrawer
          event={activeEvent}
          onClose={() => setActiveEvent(null)}
        />
      </Container>
    </main>
  );
}
