import type { ReactNode } from 'react';
import styles from './Pill.module.css';

type Tone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger';

interface PillProps {
  children: ReactNode;
  tone?: Tone;
  /** dot at the start (e.g. live indicator, status) */
  dot?: boolean;
}

/** Pill — small status / metadata chip. Mono, uppercase, tracked. */
export function Pill({ children, tone = 'neutral', dot = false }: PillProps) {
  return (
    <span className={`${styles.root} ${styles[tone]}`}>
      {dot ? <span className={styles.dot} aria-hidden="true" /> : null}
      <span>{children}</span>
    </span>
  );
}
