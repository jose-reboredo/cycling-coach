import styles from './ZonePill.module.css';

export type Zone = 1 | 2 | 3 | 4 | 5 | 6;

const ZONE_LABEL: Record<Zone, string> = {
  1: 'Z1 · Recovery',
  2: 'Z2 · Endurance',
  3: 'Z3 · Tempo',
  4: 'Z4 · Threshold',
  5: 'Z5 · VO₂ Max',
  6: 'Z6 · Anaerobic',
};

interface ZonePillProps {
  zone: Zone;
  /** override label text (e.g. "Z2 · 60–90 min") */
  label?: string;
  /** small dot vs full pill */
  size?: 'sm' | 'md';
}

/** ZonePill — Coggan zone chip. Always carries the zone color token. */
export function ZonePill({ zone, label, size = 'md' }: ZonePillProps) {
  return (
    <span className={`${styles.root} ${styles[`z${zone}`]} ${styles[`size-${size}`]}`}>
      <span className={styles.dot} aria-hidden="true" />
      <span>{label ?? ZONE_LABEL[zone]}</span>
    </span>
  );
}
