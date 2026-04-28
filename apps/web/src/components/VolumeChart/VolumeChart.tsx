import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import { bucketize, type VolumeBucket, type VolumeMode } from '../../lib/volume';
import type { MockActivity } from '../../lib/mockMarco';
import styles from './VolumeChart.module.css';

interface VolumeChartProps {
  rides: MockActivity[];
}

const MODES: { id: VolumeMode; label: string }[] = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

export function VolumeChart({ rides }: VolumeChartProps) {
  const [mode, setMode] = useState<VolumeMode>('weekly');
  const buckets = useMemo(() => bucketize(rides, mode), [rides, mode]);
  // Cap to last 12 buckets for readability
  const visible = buckets.slice(-12);

  const max = useMemo(() => {
    const m = Math.max(...visible.map((b) => b.distanceKm), 1);
    return Math.ceil(m / 50) * 50;
  }, [visible]);

  const elevMax = useMemo(() => {
    const m = Math.max(...visible.map((b) => b.elevationM), 1);
    return Math.ceil(m / 500) * 500;
  }, [visible]);

  const total = useMemo(
    () => visible.reduce((a, b) => a + b.distanceKm, 0),
    [visible],
  );
  const totalElev = useMemo(
    () => visible.reduce((a, b) => a + b.elevationM, 0),
    [visible],
  );

  return (
    <section className={styles.root}>
      <header className={styles.head}>
        <div>
          <Eyebrow rule>Volume — distance & elevation</Eyebrow>
          <p className={styles.totals}>
            <span>
              <strong>{total.toLocaleString()}</strong> km
            </span>
            <span className={styles.dotSep} aria-hidden="true">·</span>
            <span>
              <strong>{totalElev.toLocaleString()}</strong> m
            </span>
            <span className={styles.dotSep} aria-hidden="true">·</span>
            <span className={styles.totalsHint}>last {visible.length} {mode === 'weekly' ? 'weeks' : 'months'}</span>
          </p>
        </div>
        <div className={styles.toggle} role="tablist" aria-label="Aggregation">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              className={`${styles.toggleBtn} ${mode === m.id ? styles.toggleActive : ''}`}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.chart}>
        {visible.map((b) => (
          <ChartBar key={b.key} bucket={b} max={max} elevMax={elevMax} />
        ))}
      </div>

      <div className={styles.axis}>
        {visible.map((b, i) => (
          <span key={b.key} className={`${styles.axisLabel} ${i % 2 === 1 && visible.length > 8 ? styles.axisSkip : ''}`}>
            {b.label}
          </span>
        ))}
      </div>

      <footer className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendDist}`} />
          Distance · km
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.legendElev}`} />
          Elevation · m
        </span>
      </footer>
    </section>
  );
}

function ChartBar({
  bucket,
  max,
  elevMax,
}: {
  bucket: VolumeBucket;
  max: number;
  elevMax: number;
}) {
  const distPct = (bucket.distanceKm / max) * 100;
  const elevPct = (bucket.elevationM / elevMax) * 100;
  return (
    <div
      className={styles.barCol}
      title={`${bucket.label} — ${bucket.distanceKm} km, ${bucket.elevationM} m, ${bucket.rides} ride${bucket.rides === 1 ? '' : 's'}, ${bucket.tss} TSS`}
    >
      <div className={styles.barStack}>
        <motion.div
          className={`${styles.bar} ${styles.barDistance}`}
          initial={{ height: 0 }}
          whileInView={{ height: `${distPct}%` }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
        />
        <motion.div
          className={`${styles.bar} ${styles.barElevation}`}
          initial={{ height: 0 }}
          whileInView={{ height: `${elevPct}%` }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
        />
      </div>
      <span className={styles.barValue}>{bucket.distanceKm}</span>
    </div>
  );
}
