// TopTabs — Sprint 5 / v9.7.2 (#59).
// Desktop horizontal tab bar. Hidden below 600px (BottomNav covers mobile).
// Used by ClubDashboard (existing top-tabs migrated) and individual
// dashboard route shell (new).
//
// Design rule (founder lock 2026-05-01): desktop = top tabs always;
// mobile = BottomNav always. Both contexts.

import { Link } from '@tanstack/react-router';
import styles from './TopTabs.module.css';

export interface TopTabItem {
  id: string;
  label: string;
  to?: string; // Tanstack Link target
  onClick?: () => void; // state-setter mode
  active?: boolean; // for state-setter mode
}

interface TopTabsProps {
  items: TopTabItem[];
  ariaLabel?: string;
}

export function TopTabs({ items, ariaLabel = 'Tabs' }: TopTabsProps) {
  return (
    <nav className={styles.root} aria-label={ariaLabel}>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id}>
            {item.to ? (
              <Link
                to={item.to}
                className={styles.tab}
                activeProps={{
                  className: `${styles.tab} ${styles.active}`,
                  'aria-current': 'page' as const,
                }}
              >
                {item.label}
              </Link>
            ) : (
              <button
                type="button"
                className={`${styles.tab} ${item.active ? styles.active : ''}`}
                onClick={item.onClick}
                aria-pressed={item.active}
              >
                {item.label}
              </button>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
