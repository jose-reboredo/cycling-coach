import type { ReactNode } from 'react';
import styles from './Eyebrow.module.css';

interface EyebrowProps {
  children: ReactNode;
  /** prefix dash + width (visual section marker) */
  rule?: boolean;
  tone?: 'muted' | 'accent' | 'success';
}

/**
 * Eyebrow — section label / metadata. Mono uppercase tracked.
 * Used everywhere a small contextual label is needed (No. 01, FOR YOU, etc.).
 */
export function Eyebrow({ children, rule = false, tone = 'muted' }: EyebrowProps) {
  return (
    <span className={`${styles.root} ${styles[tone]}`}>
      {rule ? <span className={styles.rule} aria-hidden="true" /> : null}
      <span>{children}</span>
    </span>
  );
}
