import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import styles from './BottomNav.module.css';
import { useTabsEnabled } from '../../lib/featureFlags';

// Bottom-nav tabs are scroll-to-section anchors rather than routes — the
// dashboard renders all sections in one scroll. When/if the dashboard splits
// into sub-routes (Phase 6), swap these for Tanstack Link with `to` props.
const ITEMS = [
  { id: 'today', label: 'Today', icon: <TodayIcon />, hash: '#today' },
  { id: 'train', label: 'Train', icon: <TrainIcon />, hash: '#train' },
  { id: 'stats', label: 'Rides', icon: <StatsIcon />, hash: '#stats' },
  { id: 'you', label: 'You', icon: <YouIcon />, hash: '#you' },
] as const;

// Tabs used when cc_tabsEnabled is on. Third tab is 'rides' (BA FB-5, #stats → rides).
const LINK_ITEMS = [
  { id: 'today', label: 'Today', icon: <TodayIcon />, to: '/dashboard/today' },
  { id: 'train', label: 'Train', icon: <TrainIcon />, to: '/dashboard/train' },
  { id: 'rides', label: 'Rides', icon: <StatsIcon />, to: '/dashboard/rides' },
  { id: 'you', label: 'You', icon: <YouIcon />, to: '/dashboard/you' },
] as const;

/** BottomNav — mobile authenticated tab bar. Hidden on desktop (≥1024px).
 *  When cc_tabsEnabled is on, renders Tanstack Links to sub-routes.
 *  When off, active tab is synced to the section currently in view via
 *  IntersectionObserver (no longer just last-clicked). */
export function BottomNav() {
  const tabsEnabled = useTabsEnabled();

  if (tabsEnabled) {
    return (
      <nav className={styles.root} aria-label="Primary">
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

function TodayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <circle cx={12} cy={12} r={9} />
      <path d="M12 7v5l3 3" strokeLinecap="round" />
    </svg>
  );
}
function TrainIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M3 17l5-9 4 5 4-7 5 11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function StatsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x={3} y={13} width={4} height={8} rx={1} />
      <rect x={10} y={8} width={4} height={13} rx={1} />
      <rect x={17} y={4} width={4} height={17} rx={1} />
    </svg>
  );
}
function YouIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <circle cx={12} cy={8} r={4} />
      <path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" strokeLinecap="round" />
    </svg>
  );
}
