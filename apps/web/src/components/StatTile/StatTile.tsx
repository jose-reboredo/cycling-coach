import type { ReactNode } from 'react';
import styles from './StatTile.module.css';

interface StatTileProps {
  label: string;
  /** value rendered in mono — string so caller controls formatting */
  value: ReactNode;
  unit?: string;
  /** small trend / delta line under the unit */
  delta?: ReactNode;
  /** color the value with a zone token (z1..z6) or status (success/warn/danger) */
  tone?: 'default' | 'accent' | 'success' | 'warn' | 'danger' | 'z1' | 'z2' | 'z3' | 'z4' | 'z5' | 'z6';
  /** size scale: sm = secondary stats, md = primary stats, lg = hero */
  size?: 'sm' | 'md' | 'lg';
}

/** StatTile — primary data display. Mono numerals, eyebrow label, optional unit + delta. */
export function StatTile({ label, value, unit, delta, tone = 'default', size = 'md' }: StatTileProps) {
  return (
    <div className={`${styles.root} ${styles[`size-${size}`]}`}>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.value} ${styles[`tone-${tone}`]}`}>
        {value}
        {unit ? <span className={styles.unit}>{unit}</span> : null}
      </span>
      {delta ? <span className={styles.delta}>{delta}</span> : null}
    </div>
  );
}
