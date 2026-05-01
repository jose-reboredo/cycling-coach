import { useEffect, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import styles from './BottomNav.module.css';
import { useTabsEnabled } from '../../lib/featureFlags';
import {
  TodayIcon,
  TrainIcon,
  RidesIcon,
  YouIcon,
} from '../../design/icons';

export interface BottomNavItem {
  id: string;
  label: string;
  icon: ReactNode;
  to?: string; // tanstack Link
  hash?: string; // anchor link
  onClick?: () => void; // state-setter
  active?: boolean; // for state-setter mode
}

// Bottom-nav tabs are scroll-to-section anchors rather than routes — the
// dashboard renders all sections in one scroll. When/if the dashboard splits
// into sub-routes (Phase 6), swap these for Tanstack Link with `to` props.
const ITEMS: ReadonlyArray<{ id: string; label: string; icon: ReactNode; hash: string }> = [
  { id: 'today', label: 'Today', icon: <TodayIcon />, hash: '#today' },
  { id: 'train', label: 'Train', icon: <TrainIcon />, hash: '#train' },
  { id: 'stats', label: 'Rides', icon: <RidesIcon />, hash: '#stats' },
  { id: 'you', label: 'You', icon: <YouIcon />, hash: '#you' },
];

const LINK_ITEMS: ReadonlyArray<{ id: string; label: string; icon: ReactNode; to: string }> = [
  { id: 'today', label: 'Today', icon: <TodayIcon />, to: '/dashboard/today' },
  { id: 'train', label: 'Train', icon: <TrainIcon />, to: '/dashboard/train' },
  { id: 'rides', label: 'Rides', icon: <RidesIcon />, to: '/dashboard/rides' },
  { id: 'you', label: 'You', icon: <YouIcon />, to: '/dashboard/you' },
];

interface BottomNavProps {
  /** If provided, overrides the default individual items. Used by club mode
   *  (v9.7.2 — Sprint 5 #59) to render Overview/Schedule/Members/Metrics. */
  items?: BottomNavItem[];
  ariaLabel?: string;
}

/** BottomNav — mobile authenticated tab bar. Hidden on desktop (≥600px).
 *  v9.7.2 (#59): accepts optional `items` prop for club-mode variant.
 *  When omitted, falls back to existing individual nav (Tanstack Links
 *  if cc_tabsEnabled flag, hash anchors otherwise). */
export function BottomNav({ items, ariaLabel = 'Primary' }: BottomNavProps = {}) {
  const tabsEnabled = useTabsEnabled();

  // Custom items provided by parent (club mode) — render those.
  if (items) {
    return (
      <nav className={styles.root} aria-label={ariaLabel}>
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id}>
              {item.to ? (
                <Link
                  to={item.to}
                  className={styles.item}
                  activeProps={{ className: `${styles.item} ${styles.active}`, 'aria-current': 'page' as const }}
                >
                  <span className={styles.icon}>{item.icon}</span>
                  <span className={styles.label}>{item.label}</span>
                </Link>
              ) : (
                <button
                  type="button"
                  className={`${styles.item} ${item.active ? styles.active : ''}`}
                  onClick={item.onClick}
                  aria-current={item.active ? 'page' : undefined}
                >
                  <span className={styles.icon}>{item.icon}</span>
                  <span className={styles.label}>{item.label}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  if (tabsEnabled) {
    return (
      <nav className={styles.root} aria-label={ariaLabel}>
        <ul className={styles.list}>
          {LINK_ITEMS.map((item) => (
            <li key={item.id}>
              <Link
                to={item.to}
                className={styles.item}
                activeProps={{ className: `${styles.item} ${styles.active}`, 'aria-current': 'page' as const }}
              >
                <span className={styles.icon}>{item.icon}</span>
                <span className={styles.label}>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  // Flag off — fall through to original hash-anchor + IntersectionObserver behaviour.
  return <BottomNavHashAnchors />;
}

function BottomNavHashAnchors() {
  const [activeId, setActiveId] = useState<string>('today');

  useEffect(() => {
    const ids = ITEMS.map((i) => i.id);
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      { threshold: [0.25, 0.5, 0.75], rootMargin: '-30% 0px -30% 0px' },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <nav className={styles.root} aria-label="Primary">
      <ul className={styles.list}>
        {ITEMS.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <a
                href={item.hash}
                className={`${styles.item} ${active ? styles.active : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => setActiveId(item.id)}
              >
                <span className={styles.icon}>{item.icon}</span>
                <span className={styles.label}>{item.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
