import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { BikeMark } from '../BikeMark/BikeMark';
import styles from './TopBar.module.css';

interface TopBarProps {
  variant?: 'marketing' | 'app';
  /** rightmost content — usually a Button or icon */
  trailing?: ReactNode;
}

/**
 * TopBar — sticky brand bar.
 *  - marketing variant: light blur, brand mark + nav links + connect CTA
 *  - app variant: same brand chip, but the trailing slot is the app's header
 */
export function TopBar({ variant = 'marketing', trailing }: TopBarProps) {
  return (
    <header className={`${styles.root} ${styles[variant]}`}>
      <Link to="/" className={styles.brand}>
        <BikeMark size={24} className={styles.mark} />
        <span className={styles.brandName}>
          Cadence Club
          <span className={styles.brandBadge}>v9</span>
        </span>
      </Link>
      {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
    </header>
  );
}
