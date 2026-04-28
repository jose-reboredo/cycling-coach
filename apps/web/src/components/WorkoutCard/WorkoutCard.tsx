import type { Zone } from '../ZonePill/ZonePill';
import { ZonePill } from '../ZonePill/ZonePill';
import styles from './WorkoutCard.module.css';

export interface WorkoutSegment {
  zone: Zone;
  /** segment duration in seconds */
  duration: number;
  /** optional target watts for this segment */
  watts?: number;
  /** label override (e.g. "warm-up", "interval 1") */
  label?: string;
}

export interface Workout {
  /** "Sweet-spot intervals", "Endurance + 5×30s", etc. */
  title: string;
  /** total duration in seconds */
  duration: number;
  /** total TSS estimate */
  tss?: number;
  /** primary zone for the headline pill */
  primaryZone: Zone;
  segments: WorkoutSegment[];
  /** coach commentary — one line, italic */
  rationale?: string;
}

interface WorkoutCardProps {
  workout: Workout;
  /** day-of-week label rendered as eyebrow */
  day: string;
  /** "TODAY" / "TOMORROW" / specific date — secondary metadata */
  badge?: string;
  /** click handler for "start workout" */
  onStart?: () => void;
}

const ZONE_BG: Record<Zone, string> = {
  1: 'var(--c-z1)',
  2: 'var(--c-z2)',
  3: 'var(--c-z3)',
  4: 'var(--c-z4)',
  5: 'var(--c-z5)',
  6: 'var(--c-z6)',
  7: 'var(--c-z7)',
};

function fmtDur(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m.toString().padStart(2, '0')}`;
}

/** WorkoutCard — today's workout. Zone-stripe visual + start CTA. */
export function WorkoutCard({ workout, day, badge, onStart }: WorkoutCardProps) {
  const total = workout.duration || workout.segments.reduce((a, s) => a + s.duration, 0);
  return (
    <article className={styles.root}>
      <header className={styles.head}>
        <div className={styles.headLeft}>
          <span className={styles.day}>{day}</span>
          {badge ? <span className={styles.badge}>{badge}</span> : null}
        </div>
        <ZonePill zone={workout.primaryZone} />
      </header>

      <h3 className={styles.title}>{workout.title}</h3>

      {workout.rationale ? <p className={styles.rationale}>{workout.rationale}</p> : null}

      {/* Zone stripe — proportional segments */}
      <div className={styles.stripeWrap} aria-hidden="true">
        <div className={styles.stripe}>
          {workout.segments.map((s, i) => (
            <div
              key={i}
              className={styles.stripeSeg}
              style={{
                flex: s.duration,
                background: ZONE_BG[s.zone],
              }}
              title={`Z${s.zone} · ${fmtDur(s.duration)}${s.watts ? ` · ${s.watts}W` : ''}`}
            />
          ))}
        </div>
        <div className={styles.stripeAxis}>
          <span className={styles.stripeAxisStart}>0:00</span>
          <span className={styles.stripeAxisEnd}>{fmtDur(total)}</span>
        </div>
      </div>

      <div className={styles.meta}>
        <div className={styles.metaCell}>
          <span className={styles.metaLabel}>Duration</span>
          <span className={styles.metaValue}>{fmtDur(total)}</span>
        </div>
        {workout.tss !== undefined ? (
          <div className={styles.metaCell}>
            <span className={styles.metaLabel}>TSS</span>
            <span className={styles.metaValue}>{workout.tss}</span>
          </div>
        ) : null}
        <div className={styles.metaCell}>
          <span className={styles.metaLabel}>Intervals</span>
          <span className={styles.metaValue}>{workout.segments.filter((s) => s.zone >= 4).length}</span>
        </div>
      </div>

      {onStart ? (
        <button type="button" className={styles.startBtn} onClick={onStart}>
          <span>Start workout</span>
          <span className={styles.startBtnArrow}>→</span>
        </button>
      ) : null}
    </article>
  );
}
