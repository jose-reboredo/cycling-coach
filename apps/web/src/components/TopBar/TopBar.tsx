import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { BikeMark } from '../BikeMark/BikeMark';
import styles from './TopBar.module.css';

interface TopBarProps {
  variant?: 'marketing' | 'app';
  /** rightmost content — usually a Button or icon */
  trailing?: ReactNode;
  /** Sprint 14 / v11.3.0 — where the logo links. Defaults to '/' (marketing).
   *  The dashboard layout passes '/dashboard/today' so signed-in users
   *  go to their main surface, not the marketing landing. */
  homePath?: string;
  /** Sprint 14 / v11.4.2 — callback fired when the logo is clicked,
   *  before navigation. The dashboard layout uses this to reset the
   *  app-context scope to 'individual' so users in a club view exit
   *  back to personal home (founder feedback: 'when in a club tab,
   *  clicking the header logo is not redirecting as expected'). */
  onHomeClick?: () => void;
}

/**
 * TopBar — sticky brand bar.
 *  - marketing variant: light blur, brand mark + nav links + connect CTA
 *  - app variant: same brand chip, but the trailing slot is the app's header
 */
export function TopBar({ variant = 'marketing', trailing, homePath = '/', onHomeClick }: TopBarProps) {
  return (
    <header className={`${styles.root} ${styles[variant]}`}>
      <Link to={homePath} className={styles.brand} onClick={onHomeClick}>
        <BikeMark size={24} className={styles.mark} />
        <span className={styles.brandName}>Cadence Club</span>
      </Link>
      {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
    </header>
  );
}
