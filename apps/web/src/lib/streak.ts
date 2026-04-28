// Streak + heatmap math.
// Builds a 12-week × 7-day grid ending today, current streak, best streak.

export interface DayCell {
  date: string; // YYYY-MM-DD
  count: number;
  /** intensity bucket 0..4 */
  level: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
}

export interface StreakData {
  current: number;
  best: number;
  totalDays: number;
  cells: DayCell[]; // 84 days, oldest first
}

export function buildStreak(rides: { date: string }[]): StreakData {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tIso = today.toISOString().slice(0, 10);

  const counts = new Map<string, number>();
  for (const r of rides) counts.set(r.date, (counts.get(r.date) ?? 0) + 1);

  const cells: DayCell[] = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const count = counts.get(iso) ?? 0;
    const level: DayCell['level'] = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 3 : 4;
    cells.push({ date: iso, count, level, isToday: iso === tIso });
  }

  let current = 0;
  for (let i = cells.length - 1; i >= 0; i--) {
    if ((cells[i]?.count ?? 0) > 0) current++;
    else break;
  }

  let best = 0;
  let run = 0;
  for (const c of cells) {
    if (c.count > 0) {
      run++;
      best = Math.max(best, run);
    } else run = 0;
  }

  const totalDays = cells.filter((c) => c.count > 0).length;
  return { current, best, totalDays, cells };
}
