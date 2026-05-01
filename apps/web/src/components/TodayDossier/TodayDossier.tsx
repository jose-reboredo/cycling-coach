// TodayDossier — Sprint 5 / v9.12.9.
// Today tab's central card: a today-only view of every session the user
// has on the calendar, regardless of source (personal planned_sessions,
// club rides they've RSVP'd to). Mirrors the SchedulePreview marketing
// visual (zone-coloured bordered pills, bold titles, mono duration tags)
// but constrained to today. Click a pill → opens EventDetailDrawer.
//
// Design intent (founder-locked 2026-05-01): Today tab shows only today
// info. Planning lives on Train; browsing the full calendar lives on
// Schedule. This component is the read surface for "what am I doing
// today, from any source?"

import { useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMyScheduleByMonth } from '../../hooks/useClubs';
import {
  type CalendarEvent,
  formatDuration,
  getEventPillClass,
} from '../Calendar/types';
import { EventDetailDrawer } from '../Calendar/EventDetailDrawer';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import { Pill } from '../Pill/Pill';
import calStyles from '../Calendar/Calendar.module.css';
import styles from './TodayDossier.module.css';

const ZONE_LABEL: Record<number, string> = {
  1: 'Z1 Recovery',
  2: 'Z2 Endurance',
  3: 'Z3 Tempo',
  4: 'Z4 Threshold',
  5: 'Z5 VO2',
  6: 'Z6 Anaerobic',
  7: 'Z7 Neuromuscular',
};

function todayRangeKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

interface TodayDossierProps {
  /** Optional caller athlete id to gate drawer Cancel/Unsubscribe buttons. */
  callerAthleteId?: number | null;
}

export function TodayDossier({ callerAthleteId }: TodayDossierProps = {}) {
  const navigate = useNavigate();
  const range = todayRangeKey();
  const { data, isPending, error } = useMyScheduleByMonth(range);
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);

  const todayEvents = useMemo<CalendarEvent[]>(() => {
    if (!data) return [];
    const now = new Date();
    const events: CalendarEvent[] = [];
    (data.club_events ?? []).forEach((e) => {
      const dt = new Date(e.event_date * 1000);
      if (!isSameLocalDay(dt, now)) return;
      events.push({
        id: e.id,
        title: e.title,
        event_date: e.event_date,
        event_type: e.event_type,
        confirmed_count: e.confirmed_count,
        location: e.location,
        description: e.description,
        created_by: e.created_by,
        cancelled_at: e.cancelled_at,
        duration_minutes: e.duration_minutes,
        club_name: e.club_name ?? undefined,
        club_id: e.club_id,
      });
    });
    (data.planned_sessions ?? []).forEach((s) => {
      const dt = new Date(s.session_date * 1000);
      if (!isSameLocalDay(dt, now)) return;
      events.push({
        id: -s.id,
        title: s.title,
        event_date: s.session_date,
        event_type: 'ride',
        confirmed_count: 0,
        location: null,
        description: s.description,
        cancelled_at: s.cancelled_at,
        duration_minutes: s.duration_minutes,
        is_personal: true,
        zone: s.zone,
        completed_at: s.completed_at,
      });
    });
    return events.sort((a, b) => a.event_date - b.event_date);
  }, [data]);

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <section className={styles.dossier} aria-label="Today's sessions">
      <header className={styles.head}>
        <Eyebrow rule tone="accent">Today's dossier</Eyebrow>
        <span className={styles.headDay}>{todayLabel.toUpperCase()}</span>
      </header>

      {error ? (
        <p className={styles.empty}>Couldn't load your schedule. Try again.</p>
      ) : isPending ? (
        <p className={styles.loading}>Loading…</p>
      ) : todayEvents.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Nothing scheduled today.</p>
          <p className={styles.emptyLede}>
            Plan a session in <Link to="/dashboard/train" className={styles.inlineLink}>Train</Link>,
            or browse club rides in <Link to="/dashboard/schedule" className={styles.inlineLink}>Schedule</Link>.
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {todayEvents.map((e) => {
            const dt = new Date(e.event_date * 1000);
            const hh = String(dt.getHours()).padStart(2, '0');
            const mm = String(dt.getMinutes()).padStart(2, '0');
            const dur = formatDuration(e.duration_minutes);
            const zoneLabel = e.zone != null ? ZONE_LABEL[e.zone] : null;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setActiveEvent(e)}
                  className={`${styles.pill} ${getEventPillClass(e, calStyles)} ${e.cancelled_at ? styles.cancelled : ''} ${e.completed_at ? styles.completed : ''}`}
                >
                  <span className={styles.pillTime}>{hh}:{mm}</span>
                  <span className={styles.pillTitle}>{e.title}</span>
                  <span className={styles.pillMeta}>
                    {dur && <span>{dur}</span>}
                    {zoneLabel && <span>{zoneLabel}</span>}
                    {e.is_personal ? (
                      <span>Solo</span>
                    ) : e.club_name ? (
                      <span>{e.club_name}</span>
                    ) : null}
                  </span>
                  {e.completed_at ? (
                    <Pill tone="success">Done</Pill>
                  ) : e.cancelled_at ? (
                    <Pill tone="neutral">Cancelled</Pill>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <footer className={styles.foot}>
        <Link to="/dashboard/schedule" className={styles.footLink}>
          See your full calendar →
        </Link>
      </footer>

      <EventDetailDrawer
        event={activeEvent}
        onClose={() => setActiveEvent(null)}
        clubId={activeEvent && !activeEvent.is_personal ? activeEvent.club_id ?? null : null}
        callerAthleteId={callerAthleteId ?? data?.athlete_id ?? null}
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
        }}
      />
    </section>
  );
}
