import { motion } from 'motion/react';
import { useActivityDetail } from '../../hooks/useActivityDetail';
import { polylineToSvg } from '../../lib/polyline';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import { Pill } from '../Pill/Pill';
import { fmtDurationShort, fmtKm } from '../../lib/format';
import styles from './RideDetail.module.css';

interface RideDetailProps {
  /** ride id; null collapses the panel */
  rideId: number | null;
  /** controls whether we should fetch (set true while expanded) */
  enabled: boolean;
  /** mock fallback rendered when no real data path (demo / no tokens) */
  fallback?: {
    name: string;
    distanceKm: number;
    durationSec: number;
    elevationM: number;
    avgWatts: number;
    npWatts: number;
    hr: number;
    tss: number;
  };
}

export function RideDetail({ rideId, enabled, fallback }: RideDetailProps) {
  const { data, isLoading, error } = useActivityDetail(rideId, enabled && !!rideId && !fallback);

  return (
    <motion.div
      className={styles.root}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className={styles.inner}>
        {fallback ? (
          <FallbackBody fallback={fallback} />
        ) : isLoading ? (
          <div className={styles.loading}>
            <span className={styles.spinner} aria-hidden="true" />
            <span>Loading ride detail…</span>
          </div>
        ) : error ? (
          <p className={styles.error}>Couldn't load ride detail. Try syncing or reconnecting.</p>
        ) : data ? (
          <RealBody data={data} />
        ) : null}
      </div>
    </motion.div>
  );
}

/* ----- Body for real Strava data ----- */
function RealBody({ data }: { data: NonNullable<ReturnType<typeof useActivityDetail>['data']> }) {
  const polyEncoded = data.map?.summary_polyline ?? data.map?.polyline ?? '';
  const poly = polyEncoded ? polylineToSvg(polyEncoded, 320, 140) : null;
  const photo = data.photos?.primary?.urls?.['600'];

  return (
    <>
      {data.description ? (
        <section className={styles.section}>
          <Eyebrow rule>Description</Eyebrow>
          <p className={styles.desc}>{data.description}</p>
        </section>
      ) : null}

      {photo ? (
        <section className={styles.section}>
          <img src={photo} alt={data.name} className={styles.photo} loading="lazy" />
        </section>
      ) : null}

      {poly ? (
        <section className={styles.section}>
          <Eyebrow rule>Route shape</Eyebrow>
          <svg className={styles.map} viewBox={poly.viewBox} aria-hidden="true">
            <path
              d={poly.d}
              fill="none"
              stroke="var(--c-accent)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: 'drop-shadow(0 0 6px rgba(255,77,0,.4))' }}
            />
            <circle cx={poly.start.x} cy={poly.start.y} r={4} fill="var(--c-text)" />
            <circle cx={poly.end.x} cy={poly.end.y} r={4} fill="var(--c-accent)" />
          </svg>
        </section>
      ) : null}

      <section className={styles.section}>
        <Eyebrow rule>Stats</Eyebrow>
        <div className={styles.statsGrid}>
          <Stat label="Distance" value={fmtKm(data.distance)} unit="km" />
          <Stat label="Moving" value={fmtDurationShort(data.moving_time)} />
          {data.elapsed_time ? (
            <Stat label="Elapsed" value={fmtDurationShort(data.elapsed_time)} />
          ) : null}
          <Stat label="Elevation" value={Math.round(data.total_elevation_gain ?? 0)} unit="m" />
          {data.average_speed ? (
            <Stat
              label="Avg speed"
              value={(data.average_speed * 3.6).toFixed(1)}
              unit="kph"
            />
          ) : null}
          {data.max_speed ? (
            <Stat label="Max speed" value={(data.max_speed * 3.6).toFixed(1)} unit="kph" />
          ) : null}
          {data.average_watts ? (
            <Stat label="Avg power" value={Math.round(data.average_watts)} unit="W" />
          ) : null}
          {data.weighted_average_watts ? (
            <Stat
              label="Norm. power"
              value={Math.round(data.weighted_average_watts)}
              unit="W"
            />
          ) : null}
          {data.max_watts ? (
            <Stat label="Max power" value={Math.round(data.max_watts)} unit="W" />
          ) : null}
          {data.average_heartrate ? (
            <Stat label="Avg HR" value={Math.round(data.average_heartrate)} unit="bpm" />
          ) : null}
          {data.max_heartrate ? (
            <Stat label="Max HR" value={Math.round(data.max_heartrate)} unit="bpm" />
          ) : null}
          {data.kilojoules ? (
            <Stat label="Energy" value={Math.round(data.kilojoules)} unit="kJ" />
          ) : null}
        </div>
      </section>

      {data.best_efforts && data.best_efforts.length > 0 ? (
        <section className={styles.section}>
          <Eyebrow rule>Best efforts</Eyebrow>
          <ul className={styles.list}>
            {data.best_efforts.map((b, i) => (
              <li key={i} className={styles.listItem}>
                <span className={styles.listLabel}>{b.name}</span>
                <span className={styles.listValue}>{fmtDurationShort(b.elapsed_time)}</span>
                {b.pr_rank ? <Pill tone="accent">PR #{b.pr_rank}</Pill> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.segment_efforts && data.segment_efforts.length > 0 ? (
        <section className={styles.section}>
          <Eyebrow rule>Segments</Eyebrow>
          <ul className={styles.list}>
            {data.segment_efforts.slice(0, 8).map((s) => (
              <li key={s.id} className={styles.listItem}>
                <span className={styles.listLabel}>{s.name}</span>
                <span className={styles.listValue}>
                  {fmtKm(s.distance)} km · {fmtDurationShort(s.elapsed_time)}
                </span>
                {s.achievement_count > 0 ? (
                  <Pill tone="accent">★ {s.achievement_count}</Pill>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.splits_metric && data.splits_metric.length > 0 ? (
        <section className={styles.section}>
          <Eyebrow rule>Splits · per km</Eyebrow>
          <SplitsList splits={data.splits_metric} />
        </section>
      ) : null}

      <footer className={styles.foot}>
        <a
          className={styles.outLink}
          href={`https://www.strava.com/activities/${data.id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open on Strava ↗
        </a>
      </footer>
    </>
  );
}

/* ----- Body for mock / demo (no real fetch possible) ----- */
function FallbackBody({ fallback }: { fallback: NonNullable<RideDetailProps['fallback']> }) {
  return (
    <>
      <p className={styles.demoNote}>
        Demo data — connect Strava to see splits, segments, photos, and the route polyline.
      </p>
      <section className={styles.section}>
        <Eyebrow rule>Stats</Eyebrow>
        <div className={styles.statsGrid}>
          <Stat label="Distance" value={fallback.distanceKm.toFixed(1)} unit="km" />
          <Stat label="Moving" value={fmtDurationShort(fallback.durationSec)} />
          <Stat label="Elevation" value={fallback.elevationM} unit="m" />
          <Stat label="Avg power" value={fallback.avgWatts} unit="W" />
          <Stat label="Norm. power" value={fallback.npWatts} unit="W" />
          <Stat label="Avg HR" value={fallback.hr} unit="bpm" />
          <Stat label="TSS" value={fallback.tss} />
        </div>
      </section>
    </>
  );
}

function Stat({ label, value, unit }: { label: string; value: number | string; unit?: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>
        {value}
        {unit ? <span className={styles.statUnit}>{unit}</span> : null}
      </span>
    </div>
  );
}

function SplitsList({ splits }: { splits: NonNullable<NonNullable<ReturnType<typeof useActivityDetail>['data']>['splits_metric']> }) {
  const maxTime = Math.max(...splits.map((s) => s.moving_time));
  return (
    <ol className={styles.splits}>
      {splits.map((s, i) => (
        <li key={i} className={styles.splitRow}>
          <span className={styles.splitNum}>km {s.split}</span>
          <div className={styles.splitBar}>
            <div
              className={styles.splitFill}
              style={{ width: `${Math.min(100, (s.moving_time / maxTime) * 100)}%` }}
            />
          </div>
          <span className={styles.splitTime}>{fmtDurationShort(s.moving_time)}</span>
          <span
            className={`${styles.splitElev} ${s.elevation_difference > 0 ? styles.splitElevUp : ''}`}
          >
            {s.elevation_difference > 0 ? '+' : ''}
            {Math.round(s.elevation_difference)}m
          </span>
        </li>
      ))}
    </ol>
  );
}
