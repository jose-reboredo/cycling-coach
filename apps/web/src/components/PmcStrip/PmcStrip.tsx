import { motion } from 'motion/react';
import styles from './PmcStrip.module.css';

interface PmcStripProps {
  /** Chronic Training Load — long-term fitness (42-day exp avg) */
  ctl: number;
  /** Acute Training Load — recent fatigue (7-day exp avg) */
  atl: number;
  /** Training Stress Balance — form (CTL - ATL) */
  tsb: number;
  /** trend deltas vs 7 days ago (optional) */
  ctlDelta?: number;
  atlDelta?: number;
  tsbDelta?: number;
}

/**
 * PmcStrip — Performance Management Chart at-a-glance.
 * Three numerals with their labels, plus trend arrows. The single most
 * important number Marco scans first thing in the morning.
 */
export function PmcStrip({ ctl, atl, tsb, ctlDelta, atlDelta, tsbDelta }: PmcStripProps) {
  const tsbState = tsb > 5 ? 'fresh' : tsb < -15 ? 'overreached' : tsb < -5 ? 'fatigued' : 'productive';
  return (
    <div className={styles.root}>
      <Cell label="Fitness · CTL" value={ctl} delta={ctlDelta} accent="default" />
      <Divider />
      <Cell label="Fatigue · ATL" value={atl} delta={atlDelta} accent="warn" />
      <Divider />
      <Cell label="Form · TSB" value={tsb} signed delta={tsbDelta} accent={tsbState} />
    </div>
  );
}

function Divider() {
  return <span className={styles.divider} aria-hidden="true" />;
}

interface CellProps {
  label: string;
  value: number;
  delta: number | undefined;
  signed?: boolean;
  accent: 'default' | 'fresh' | 'productive' | 'fatigued' | 'overreached' | 'warn';
}

function Cell({ label, value, delta, signed, accent }: CellProps) {
  const display = signed && value > 0 ? `+${Math.round(value)}` : Math.round(value).toString();
  return (
    <div className={styles.cell}>
      <span className={styles.label}>{label}</span>
      <motion.span
        className={`${styles.value} ${styles[`accent-${accent}`]}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      >
        {display}
      </motion.span>
      {typeof delta === 'number' ? (
        <span className={`${styles.delta} ${delta > 0 ? styles.deltaUp : delta < 0 ? styles.deltaDown : ''}`}>
          {delta > 0 ? '↑' : delta < 0 ? '↓' : '·'} {Math.abs(Math.round(delta))} <span className={styles.deltaUnit}>7d</span>
        </span>
      ) : null}
    </div>
  );
}
