// Day view — single col × 06:00–22:00 (16h band). Sprint 5 / v9.7.1.
// Same time positioning as Week, just one column. Events render wider.

import { useMemo } from 'react';
import {
  type CalendarEvent,
  type CalendarDate,
  type ClubEventType,
  TIME_GRID_START_HOUR,
  TIME_GRID_HOURS,
  isSameDay,
  todayUTC,
  groupByDay,
} from './types';
import styles from './Calendar.module.css';

interface DayCalendarGridProps {
  date: CalendarDate;
  events: CalendarEvent[];
  activeFilters: Set<ClubEventType>;
  onEventClick: (event: CalendarEvent) => void;
}

// v9.12.3 — event blocks size to actual duration_minutes; legacy fallback.
const FALLBACK_EVENT_DURATION_MINUTES = 90;

export function DayCalendarGrid({
  date,
  events,
  activeFilters,
  onEventClick,
}: DayCalendarGridProps) {
  const today = todayUTC();
  const eventsByDay = useMemo(() => groupByDay(events, activeFilters), [events, activeFilters]);
  const hours = useMemo(
    () => Array.from({ length: TIME_GRID_HOURS + 1 }, (_, i) => TIME_GRID_START_HOUR + i),
    [],
  );
  const key = `${date.year}-${date.month}-${date.day}`;
  const dayEvents = eventsByDay.get(key) ?? [];
  const isToday = isSameDay(date, today);

  return (
    <div className={styles.dayWrap}>
      <div className={styles.dayBody}>
        {/* Hour gutter */}
        <div className={styles.weekHourCol}>
          {hours.map((h) => (
            <div key={h} className={styles.weekHourLabel}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Single day column */}
        <div className={`${styles.dayCol} ${isToday ? styles.weekDayColToday : ''}`}>
          {hours.slice(0, -1).map((h) => (
            <div key={h} className={styles.weekHourSlot} aria-hidden="true" />
          ))}
          {dayEvents.map((e) => {
            const dt = new Date(e.event_date * 1000);
            const hh = dt.getUTCHours() + dt.getUTCMinutes() / 60;
            if (hh < TIME_GRID_START_HOUR || hh >= TIME_GRID_START_HOUR + TIME_GRID_HOURS) {
              return null;
            }
            const topPct = ((hh - TIME_GRID_START_HOUR) / TIME_GRID_HOURS) * 100;
            // v9.12.3 — block height proportional to actual duration.
            const durationMin = e.duration_minutes ?? FALLBACK_EVENT_DURATION_MINUTES;
            const heightPct = (durationMin / 60 / TIME_GRID_HOURS) * 100;
            return (
              <button
                key={e.id}
                type="button"
                className={`${styles.dayEvent} ${styles[`pill_${e.event_type}`]} ${e.cancelled_at ? styles.cancelled : ''}`}
                style={{ top: `${topPct}%`, height: `${heightPct}%` }}
                onClick={() => onEventClick(e)}
              >
                <span className={styles.dayEventTime}>
                  {String(dt.getUTCHours()).padStart(2, '0')}
                  :
                  {String(dt.getUTCMinutes()).padStart(2, '0')}
                </span>
                <span className={styles.dayEventTitle}>{e.title}</span>
                {e.location && (
                  <span className={styles.dayEventLoc}>· {e.location}</span>
                )}
                <span className={styles.dayEventCount}>
                  {e.confirmed_count} going
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {dayEvents.length === 0 && (
        <p className={styles.emptyDay}>No events on this day.</p>
      )}
    </div>
  );
}
