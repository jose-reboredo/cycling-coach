// Week view — 7-col × 06:00–22:00 (16h band). Sprint 5 / v9.7.1.
// Events positioned by time. Default block height = 90 minutes (covers
// most cycling events; refined when v9.7.3 adds duration_minutes).

import { useMemo } from 'react';
import {
  type CalendarEvent,
  type CalendarDate,
  type ClubEventType,
  TIME_GRID_START_HOUR,
  TIME_GRID_HOURS,
  isSameDay,
  todayUTC,
  weekDates,
  weekStart,
  groupByDay,
} from './types';
import styles from './Calendar.module.css';

interface WeekCalendarGridProps {
  date: CalendarDate; // any date within the week to display
  events: CalendarEvent[];
  activeFilters: Set<ClubEventType>;
  onEventClick: (event: CalendarEvent) => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DEFAULT_EVENT_DURATION_MINUTES = 90;

export function WeekCalendarGrid({
  date,
  events,
  activeFilters,
  onEventClick,
}: WeekCalendarGridProps) {
  const today = todayUTC();
  const start = useMemo(() => weekStart(date), [date]);
  const days = useMemo(() => weekDates(start), [start]);
  const eventsByDay = useMemo(() => groupByDay(events, activeFilters), [events, activeFilters]);

  // Hour markers — TIME_GRID_START_HOUR (6) → END (22)
  const hours = useMemo(
    () =>
      Array.from({ length: TIME_GRID_HOURS + 1 }, (_, i) => TIME_GRID_START_HOUR + i),
    [],
  );

  return (
    <div className={styles.weekWrap}>
      {/* Column headers — Mon Tue Wed ... */}
      <div className={styles.weekHeader}>
        <div className={styles.weekHourGutter} aria-hidden="true" />
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={`h-${d.year}-${d.month}-${d.day}`}
              className={`${styles.weekDayHeader} ${isToday ? styles.weekDayHeaderToday : ''}`}
            >
              <span className={styles.weekDayLabel}>
                {DAY_LABELS[(new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay() + 6) % 7]}
              </span>
              <span className={styles.weekDayNum}>{d.day}</span>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className={styles.weekBody}>
        {/* Hour gutter */}
        <div className={styles.weekHourCol}>
          {hours.map((h) => (
            <div key={h} className={styles.weekHourLabel}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* 7 day columns with positioned events */}
        {days.map((d) => {
          const key = `${d.year}-${d.month}-${d.day}`;
          const dayEvents = eventsByDay.get(key) ?? [];
          const isToday = isSameDay(d, today);
          return (
            <div
              key={`col-${key}`}
              className={`${styles.weekDayCol} ${isToday ? styles.weekDayColToday : ''}`}
            >
              {hours.slice(0, -1).map((h) => (
                <div key={h} className={styles.weekHourSlot} aria-hidden="true" />
              ))}
              {dayEvents.map((e) => {
                const dt = new Date(e.event_date * 1000);
                const hours = dt.getUTCHours() + dt.getUTCMinutes() / 60;
                if (hours < TIME_GRID_START_HOUR || hours >= TIME_GRID_START_HOUR + TIME_GRID_HOURS) {
                  return null; // outside the 06:00–22:00 band
                }
                const topPct = ((hours - TIME_GRID_START_HOUR) / TIME_GRID_HOURS) * 100;
                const heightPct = (DEFAULT_EVENT_DURATION_MINUTES / 60 / TIME_GRID_HOURS) * 100;
                return (
                  <button
                    key={e.id}
                    type="button"
                    className={`${styles.weekEvent} ${styles[`pill_${e.event_type}`]}`}
                    style={{ top: `${topPct}%`, height: `${heightPct}%` }}
                    onClick={() => onEventClick(e)}
                  >
                    <span className={styles.pillTime}>
                      {String(dt.getUTCHours()).padStart(2, '0')}
                      :
                      {String(dt.getUTCMinutes()).padStart(2, '0')}
                    </span>
                    <span className={styles.pillTitle}>{e.title}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
