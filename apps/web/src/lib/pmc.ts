// Performance Management Chart math.
// CTL = Chronic Training Load (42-day exponentially-weighted average TSS) — fitness.
// ATL = Acute Training Load (7-day exponentially-weighted average TSS) — fatigue.
// TSB = Training Stress Balance = CTL - ATL — form.
//
// Reference: Joe Friel / Andy Coggan (TrainingPeaks). Implementation uses
// exponential moving average with the standard tau values 42 and 7 days.

const CTL_TC = 42;
const ATL_TC = 7;

export interface DailyLoad {
  /** ISO date YYYY-MM-DD */
  date: string;
  /** sum of TSS for that day (0 = rest day) */
  tss: number;
}

export interface PmcPoint {
  date: string;
  tss: number;
  ctl: number;
  atl: number;
  tsb: number;
}

/**
 * Compute PMC series from a chronological list of daily TSS sums.
 * The first point seeds CTL/ATL with the first TSS value to avoid a long
 * "warm-up" zero plateau (TrainingPeaks seeds with day-0 TSS as well).
 */
export function computePmc(daily: DailyLoad[]): PmcPoint[] {
  if (daily.length === 0) return [];

  const out: PmcPoint[] = [];
  // Seed with the first day's TSS (avoids cold-start trough).
  let ctl = daily[0]?.tss ?? 0;
  let atl = daily[0]?.tss ?? 0;

  for (const d of daily) {
    const tss = d.tss;
    ctl = ctl + (tss - ctl) / CTL_TC;
    atl = atl + (tss - atl) / ATL_TC;
    out.push({
      date: d.date,
      tss,
      ctl: Number(ctl.toFixed(1)),
      atl: Number(atl.toFixed(1)),
      tsb: Number((ctl - atl).toFixed(1)),
    });
  }
  return out;
}

/** Convert duration + IF (intensity factor = NP/FTP) into a TSS estimate. */
export function tssFromIntensity(durationSec: number, intensityFactor: number): number {
  const hours = durationSec / 3600;
  return Math.round(hours * intensityFactor * intensityFactor * 100);
}

/** TSS from average watts (less accurate than NP but fine when NP missing). */
export function tssFromAvgWatts(durationSec: number, avgWatts: number, ftp: number): number {
  if (ftp <= 0) return 0;
  const intensityFactor = avgWatts / ftp;
  return tssFromIntensity(durationSec, intensityFactor);
}

/**
 * Build PMC + 7-day delta from a list of activities. Used by both the mock
 * data path and the real-Strava path. Returns null when activities is empty.
 */
export function computePmcDelta(
  activities: { date: string; tss: number }[],
  windowDays = 90,
): {
  ctl: number;
  atl: number;
  tsb: number;
  ctlDelta: number;
  atlDelta: number;
  tsbDelta: number;
} | null {
  if (activities.length === 0) return null;

  // Build a zero-filled daily TSS rollup for the last `windowDays` (today inclusive).
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const map = new Map<string, number>();
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  for (const a of activities) {
    if (map.has(a.date)) map.set(a.date, (map.get(a.date) ?? 0) + a.tss);
  }
  const daily: DailyLoad[] = Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, tss]) => ({ date, tss }));

  const series = computePmc(daily);
  const last = series[series.length - 1];
  const week = series[series.length - 8];
  if (!last) return null;
  return {
    ctl: last.ctl,
    atl: last.atl,
    tsb: last.tsb,
    ctlDelta: week ? Number((last.ctl - week.ctl).toFixed(1)) : 0,
    atlDelta: week ? Number((last.atl - week.atl).toFixed(1)) : 0,
    tsbDelta: week ? Number((last.tsb - week.tsb).toFixed(1)) : 0,
  };
}
