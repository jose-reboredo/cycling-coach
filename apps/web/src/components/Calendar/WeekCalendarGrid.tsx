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
  formatDuration,
  getEventPillClass,
  isSameDay,
  todayUTC,
  weekDates,
  weekStart,
  groupByDay,
} from './types';
import styles from './Calendar.module.css';
import {
  HOUR_PX,
  FALLBACK_EVENT_DURATION_MINUTES,
  computeOverlapColumns,
} from './layout';

interface WeekCalendarGridProps {
  date: CalendarDate; // any date within the week to display
  events: CalendarEvent[];
  activeFilters: Set<ClubEventType>;
  onEventClick: (event: CalendarEvent) => void;
  /** v10.10.0 — quick-add. Fires when an empty hour slot is clicked.
   *  Receives YYYY-MM-DD + HH:MM (the slot's start hour). Caller
   *  navigates to /dashboard/schedule-new prefilled. */
  onCellClick?: (dateStr: string, timeStr: string) => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeekCalendarGrid({
  date,
  events,
  activeFilters,
  onEventClick,
  onCellClick,
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
              {hours.slice(0, -1).map((h) => {
                // v10.10.0 — clickable hour slot for quick-add.
                const handleSlotClick = () => {
                  if (!onCellClick) return;
                  const dateStr = `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
                  const timeStr = `${String(h).padStart(2, '0')}:00`;
                  onCellClick(dateStr, timeStr);
                };
                return (
                  <div
                    key={h}
                    className={`${styles.weekHourSlot} ${onCellClick ? styles.weekHourSlotClickable : ''}`}
                    onClick={onCellClick ? handleSlotClick : undefined}
                    role={onCellClick ? 'button' : undefined}
                    aria-label={onCellClick ? `Add session at ${h}:00` : undefined}
                    tabIndex={onCellClick ? 0 : -1}
                  />
                );
              })}
              {(() => {
                // v10.12.0 (GH #80) — px-based positioning + overlap-aware
                // columns. Compute layout once per render so all events in
                // a transitive-overlap group know their colCount.
                const layoutMap = computeOverlapColumns(dayEvents);
                return dayEvents.map((e) => {
                  const dt = new Date(e.event_date * 1000);
                  // v9.12.4 — render in viewer's local TZ (was UTC). DB stays UTC.
                  const hh = dt.getHours() + dt.getMinutes() / 60;
                  if (hh < TIME_GRID_START_HOUR || hh >= TIME_GRID_START_HOUR + TIME_GRID_HOURS) {
                    return null; // outside the 06:00–22:00 band
                  }
                  const topPx = (hh - TIME_GRID_START_HOUR) * HOUR_PX;
                  // v9.12.3 — block height proportional to actual duration so
                  // a 15:00 + 2h event visually books 15:00–17:00 on the grid.
                  const durationMin = e.duration_minutes ?? FALLBACK_EVENT_DURATION_MINUTES;
                  const heightPx = (durationMin / 60) * HOUR_PX;
                  const lay = layoutMap.get(e.id) ?? { col: 0, total: 1 };
                  const widthPct = 100 / lay.total;
                  const leftPct = lay.col * widthPct;
                  const durStr = formatDuration(e.duration_minutes);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      className={`${styles.weekEvent} ${getEventPillClass(e, styles)} ${e.cancelled_at ? styles.cancelled : ''}`}
                      style={{
                        top: `${topPx}px`,
                        height: `${heightPx}px`,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        right: 'auto',
                      }}
                      onClick={() => onEventClick(e)}
                    >
                    <span className={styles.pillTime}>
                      {String(dt.getHours()).padStart(2, '0')}
                      :
                      {String(dt.getMinutes()).padStart(2, '0')}
                    </span>
                    <span className={styles.pillTitle}>{e.title}</span>
                    {durStr && <span className={styles.weekEventDur}>{durStr}</span>}
                  </button>
                );
                });
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
