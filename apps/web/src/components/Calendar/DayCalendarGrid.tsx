// Day view — single col × 06:00–22:00 (16h band). Sprint 5 / v9.7.1.
// Same time positioning as Week, just one column. Events render wider.

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
  groupByDay,
} from './types';
import styles from './Calendar.module.css';
import {
  HOUR_PX,
  FALLBACK_EVENT_DURATION_MINUTES,
  computeOverlapColumns,
} from './layout';

interface DayCalendarGridProps {
  date: CalendarDate;
  events: CalendarEvent[];
  activeFilters: Set<ClubEventType>;
  onEventClick: (event: CalendarEvent) => void;
  /** v10.10.0 — quick-add. Fires when an empty hour slot is clicked. */
  onCellClick?: (dateStr: string, timeStr: string) => void;
}

export function DayCalendarGrid({
  date,
  events,
  activeFilters,
  onEventClick,
  onCellClick,
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
          {hours.slice(0, -1).map((h) => {
            // v10.10.0 — clickable hour slot for quick-add.
            const handleSlotClick = () => {
              if (!onCellClick) return;
              const dateStr = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
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
            // v10.12.0 (GH #80) — px-based positioning + overlap-aware columns.
            const layoutMap = computeOverlapColumns(dayEvents);
            return dayEvents.map((e) => {
            const dt = new Date(e.event_date * 1000);
            // v9.12.4 — render in viewer's local TZ (was UTC). DB stays UTC.
            const hh = dt.getHours() + dt.getMinutes() / 60;
            if (hh < TIME_GRID_START_HOUR || hh >= TIME_GRID_START_HOUR + TIME_GRID_HOURS) {
              return null;
            }
            const topPx = (hh - TIME_GRID_START_HOUR) * HOUR_PX;
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
                className={`${styles.dayEvent} ${getEventPillClass(e, styles)} ${e.cancelled_at ? styles.cancelled : ''}`}
                style={{
                  top: `${topPx}px`,
                  height: `${heightPx}px`,
                  left: `calc(${leftPct}% + 2px)`,
                  width: `calc(${widthPct}% - 4px)`,
                  right: 'auto',
                }}
                onClick={() => onEventClick(e)}
              >
                <span className={styles.dayEventTopRow}>
                  <span className={styles.dayEventTime}>
                    {String(dt.getHours()).padStart(2, '0')}
                    :
                    {String(dt.getMinutes()).padStart(2, '0')}
                  </span>
                  {durStr && <span className={styles.dayEventDur}>{durStr}</span>}
                </span>
                <span className={styles.dayEventTitle}>{e.title}</span>
                {e.location && (
                  <span className={styles.dayEventLoc}>· {e.location}</span>
                )}
                {/* v9.12.4 — hide RSVP chip on personal sessions (no attendees). */}
                {!e.is_personal && (
                  <span className={styles.dayEventCount}>
                    {e.confirmed_count} going
                  </span>
                )}
              </button>
            );
            });
          })()}
        </div>
      </div>
      {dayEvents.length === 0 && (
        <p className={styles.emptyDay}>No events on this day.</p>
      )}
    </div>
  );
}
