// Month view — 6×7 grid, Monday-start, today highlighted.
// Extracted from ScheduleTab.tsx (v9.7.0 → v9.7.1 refactor).

import { useMemo } from 'react';
import {
  type CalendarEvent,
  type CalendarDate,
  type ClubEventType,
  groupByDay,
  isSameDay,
  todayUTC,
} from './types';
import styles from './Calendar.module.css';

interface MonthCalendarGridProps {
  year: number;
  month: number; // 1-indexed
  events: CalendarEvent[];
  activeFilters: Set<ClubEventType>;
  onEventClick: (event: CalendarEvent) => void;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function buildGrid(
  year: number,
  month: number,
): Array<{ year: number; month: number; day: number; inMonth: boolean }> {
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const firstWeekday = (firstDay.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<{ year: number; month: number; day: number; inMonth: boolean }> = [];
  for (let i = 0; i < firstWeekday; i++) {
    const d = new Date(Date.UTC(year, month - 1, -firstWeekday + i + 1));
    cells.push({
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      inMonth: false,
    });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ year, month, day, inMonth: true });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1]!;
    const d = new Date(Date.UTC(last.year, last.month - 1, last.day + 1));
    cells.push({
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      inMonth: false,
    });
  }
  return cells;
}

export function MonthCalendarGrid({
  year,
  month,
  events,
  activeFilters,
  onEventClick,
}: MonthCalendarGridProps) {
  const today = todayUTC();
  const grid = useMemo(() => buildGrid(year, month), [year, month]);
  const eventsByDay = useMemo(() => groupByDay(events, activeFilters), [events, activeFilters]);

  return (
    <>
      <div className={styles.weekdayRow} aria-hidden="true">
        {DAY_LABELS.map((d, i) => (
          <span key={i} className={styles.weekdayCell}>{d}</span>
        ))}
      </div>
      <div className={styles.monthGrid}>
        {grid.map((cell, idx) => {
          const key = `${cell.year}-${cell.month}-${cell.day}`;
          const dayEvents = eventsByDay.get(key) ?? [];
          const visibleEvents = dayEvents.slice(0, 2);
          const overflow = dayEvents.length - visibleEvents.length;
          const isToday = isSameDay(cell as CalendarDate, today);
          return (
            <div
              key={`${idx}-${key}`}
              className={[
                styles.cell,
                cell.inMonth ? '' : styles.cellOut,
                isToday ? styles.cellToday : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className={styles.dayNum}>{cell.day}</span>
              {visibleEvents.map((e) => {
                // v9.12.4 — render in viewer's local TZ (was UTC); hide RSVP
                // count in tooltip on personal sessions.
                const dt = new Date(e.event_date * 1000);
                const titleSuffix = e.is_personal
                  ? ' · solo session'
                  : ` · ${e.confirmed_count} going`;
                return (
                  <button
                    key={e.id}
                    type="button"
                    className={`${styles.pill} ${styles[`pill_${e.event_type}`]} ${e.cancelled_at ? styles.cancelled : ''}`}
                    onClick={() => onEventClick(e)}
                    title={`${e.title}${e.cancelled_at ? ' · cancelled' : ''}${titleSuffix}`}
                  >
                    <span className={styles.pillTime}>
                      {String(dt.getHours()).padStart(2, '0')}
                      :
                      {String(dt.getMinutes()).padStart(2, '0')}
                    </span>
                    <span className={styles.pillTitle}>{e.title}</span>
                  </button>
                );
              })}
              {overflow > 0 && (
                <span className={styles.overflow}>+{overflow} more</span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
