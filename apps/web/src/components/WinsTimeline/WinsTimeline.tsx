import { Eyebrow } from '../Eyebrow/Eyebrow';
import { Pill } from '../Pill/Pill';
import { ZonePill } from '../ZonePill/ZonePill';
import type { Win } from '../../lib/wins';
import { fmtKm, fmtDurationShort, fmtRelative } from '../../lib/format';
import type { Zone } from '../ZonePill/ZonePill';
import styles from './WinsTimeline.module.css';

interface WinsTimelineProps {
  wins: Win[];
  /** show this many — caller controls limit */
  limit?: number;
}

/** WinsTimeline — feed of recent PRs / achievements. */
export function WinsTimeline({ wins, limit = 6 }: WinsTimelineProps) {
  const visible = wins.slice(0, limit);
  return (
    <section className={styles.root}>
      <header className={styles.head}>
        <Eyebrow rule>Wins · last 90 days</Eyebrow>
        <Pill tone="success">{wins.length} PR{wins.length === 1 ? '' : 's'}</Pill>
      </header>

      {visible.length === 0 ? (
        <p className={styles.empty}>
          No PRs in the last 90 days. <span>Time to set new ones.</span>
        </p>
      ) : (
        <ol className={styles.list}>
          {visible.map((w) => (
            <li key={w.rideId} className={styles.item}>
              <span className={styles.rank} aria-hidden="true">★</span>
              <div className={styles.body}>
                <p className={styles.name}>{w.rideName}</p>
                <div className={styles.meta}>
                  <ZonePill zone={w.primaryZone as Zone} size="sm" />
                  <span>{fmtKm(w.distanceKm * 1000)} km</span>
                  <span>·</span>
                  <span>{fmtDurationShort(w.durationSec)}</span>
                  <span>·</span>
                  <span>{fmtRelative(w.date)}</span>
                </div>
              </div>
              <span className={styles.badge}>
                {w.prCount}
                <span className={styles.badgeUnit}>PR</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
