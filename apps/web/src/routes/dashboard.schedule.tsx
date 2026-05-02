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

// v10.11.0 — persist view preference in localStorage so navigating to
// schedule-new (the edit/create form) and back doesn't drop the user
// on the desktop default 'month' view. Founder bug:
// "i was in the weekly calendar, click on edit, redirected to monthly".
const VIEW_STORAGE_KEY = 'cc_schedule_view';
function readViewFromStorage(): CalendarView | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (v === 'month' || v === 'week' || v === 'day') return v;
  } catch {
    /* localStorage may be disabled — fall through */
  }
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
    // Priority: URL hash > localStorage > viewport default. Hash wins so
    // a deliberate share link with #week still works.
    () => readViewFromHash() ?? readViewFromStorage() ?? defaultViewForViewport(),
  );
  const [date, setDate] = useState<CalendarDate>(today);
  const [activeFilters, setActiveFilters] = useState<Set<ClubEventType>>(new Set(ALL_TYPES));
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);

  // Hash sync — keep URL #view in sync with state.
  // v10.11.0: also write to localStorage so cross-navigation (e.g. to
  // /dashboard/schedule-new and back) restores the user's last view.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const target = `#${view}`;
    if (window.location.hash !== target) {
      window.history.replaceState(null, '', target);
    }
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      /* localStorage may be disabled — best effort */
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
      // v9.12.5 — owning club drives Cancel/Unsubscribe mutations in drawer.
      club_id: e.club_id,
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
      // v9.12.4 — discriminator: hides RSVP chip, shows "Solo session" copy.
      is_personal: true,
      // v9.12.5 — zone drives pill color; completed_at drives drawer "✓" banner.
      zone: s.zone,
      completed_at: s.completed_at,
      // v10.8.0 — AI plan targets carry into the route picker.
      elevation_gained: s.elevation_gained,
      session_surface: s.surface,
    }));
    return [...club, ...personal].sort((a, b) => a.event_date - b.event_date);
  }, [data]);

  // v10.10.0 — Week / Day summary footer. Computes totals across the
  // visible date window. TSS is a rough proxy: durationMin × IF², where IF
  // is zone-derived (Z2 ≈ 0.65, Z3 ≈ 0.78, Z4 ≈ 0.91, Z5 ≈ 1.05). Plenty
  // accurate for a "weekly volume" sanity check; not a coaching tool.
  const visibleWindow = useMemo(() => {
    if (view === 'month') return null; // footer hidden in month view
    let startSec: number;
    let endSec: number;
    if (view === 'week') {
      const start = weekStart(date);
      const startDate = new Date(start.year, start.month - 1, start.day, 0, 0, 0);
      const endDate = new Date(start.year, start.month - 1, start.day + 7, 0, 0, 0);
      startSec = Math.floor(startDate.getTime() / 1000);
      endSec = Math.floor(endDate.getTime() / 1000);
    } else {
      const startDate = new Date(date.year, date.month - 1, date.day, 0, 0, 0);
      const endDate = new Date(date.year, date.month - 1, date.day + 1, 0, 0, 0);
      startSec = Math.floor(startDate.getTime() / 1000);
      endSec = Math.floor(endDate.getTime() / 1000);
    }
    return { startSec, endSec };
  }, [view, date]);

  const summary = useMemo(() => {
    if (!visibleWindow) return null;
    const inWindow = events.filter(
      (e) => !e.cancelled_at && e.event_date >= visibleWindow.startSec && e.event_date < visibleWindow.endSec,
    );
    const ifByZone: Record<number, number> = { 1: 0.5, 2: 0.65, 3: 0.78, 4: 0.91, 5: 1.05, 6: 1.1, 7: 1.15 };
    let totalMin = 0;
    let totalTss = 0;
    let clubRides = 0;
    let personalRides = 0;
    for (const e of inWindow) {
      const dur = e.duration_minutes ?? 0;
      totalMin += dur;
      const intensity = e.zone != null ? ifByZone[e.zone] ?? 0.65 : 0.65;
      totalTss += dur * intensity * intensity;
      if (e.is_personal) personalRides++;
      else clubRides++;
    }
    return {
      hours: Math.round((totalMin / 60) * 10) / 10,
      tss: Math.round(totalTss),
      clubRides,
      personalRides,
      total: inWindow.length,
    };
  }, [events, visibleWindow]);

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
                /* v10.10.0 — quick-add: clicking an empty Month cell
                 * navigates to schedule-new prefilled with that date. */
                onCellClick={(dateStr) =>
                  navigate({
                    to: '/dashboard/schedule-new',
                    search: { date: dateStr },
                  })
                }
              />
            )}
            {view === 'week' && (
              <WeekCalendarGrid
                date={date}
                events={events}
                activeFilters={activeFilters}
                onEventClick={setActiveEvent}
                /* v10.10.0 — quick-add: empty hour slot → schedule-new prefilled. */
                onCellClick={(dateStr, timeStr) =>
                  navigate({
                    to: '/dashboard/schedule-new',
                    search: { date: dateStr, time: timeStr },
                  })
                }
              />
            )}
            {view === 'day' && (
              <DayCalendarGrid
                date={date}
                events={events}
                activeFilters={activeFilters}
                onEventClick={setActiveEvent}
                onCellClick={(dateStr, timeStr) =>
                  navigate({
                    to: '/dashboard/schedule-new',
                    search: { date: dateStr, time: timeStr },
                  })
                }
              />
            )}
          </div>
        )}

        {/* v10.10.0 — Week / Day summary footer. Hidden on Month view
            (too much data to summarise meaningfully). */}
        {summary && summary.total > 0 && (
          <footer className={styles.summary} aria-label={`${view === 'week' ? 'Week' : 'Day'} summary`}>
            <span className={styles.summaryStat}>
              <strong>{summary.hours}</strong> h planned
            </span>
            <span className={styles.summaryStat}>
              <strong>~{summary.tss}</strong> TSS
            </span>
            <span className={styles.summaryStat}>
              <strong>{summary.total}</strong> ride{summary.total === 1 ? '' : 's'}
              {summary.clubRides > 0 && summary.personalRides > 0 && (
                <span className={styles.summaryDetail}>
                  {' '}({summary.personalRides} solo · {summary.clubRides} club)
                </span>
              )}
            </span>
          </footer>
        )}

        {!isLoading && !error && events.length === 0 && (
          <p className={styles.empty}>
            Nothing on the calendar for {MONTH_NAMES[date.month - 1]} {date.year}.
            RSVP to a club ride or create your own to see it here.
          </p>
        )}

        {isLoading && <p className={styles.loading}>Loading your schedule…</p>}

        {/* v9.12.5 — drawer is now action-bearing for personal sessions
         *  (Edit / Mark done / Cancel) and Unsubscribe for club events.
         *  Per-event club_id flows through CalendarEvent.club_id so each
         *  open targets the right club. Edit for club events still routes
         *  through ClubDashboard's modal (not from this surface). */}
        <EventDetailDrawer
          event={activeEvent}
          onClose={() => setActiveEvent(null)}
          clubId={activeEvent && !activeEvent.is_personal ? activeEvent.club_id ?? null : null}
          callerAthleteId={data?.athlete_id ?? null}
          onEdit={(e) => {
            if (e.is_personal) {
              const dt = new Date(e.event_date * 1000);
              const r = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
              navigate({
                to: '/dashboard/schedule-new',
                search: { id: Math.abs(e.id), range: r },
              });
              setActiveEvent(null);
            }
            // Club-event edit not exposed from personal scheduler — caller
            // must edit from the club's own /clubs/:id/schedule surface.
          }}
        />
      </Container>
    </main>
  );
}
