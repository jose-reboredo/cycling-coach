import { useState } from 'react';
import styles from './BottomNav.module.css';

// Bottom-nav tabs are scroll-to-section anchors rather than routes — the
// dashboard renders all sections in one scroll. When/if the dashboard splits
// into sub-routes (Phase 6), swap these for Tanstack Link with `to` props.
const ITEMS = [
  { id: 'today', label: 'Today', icon: <TodayIcon />, hash: '#today' },
  { id: 'train', label: 'Train', icon: <TrainIcon />, hash: '#train' },
  { id: 'stats', label: 'Stats', icon: <StatsIcon />, hash: '#stats' },
  { id: 'you', label: 'You', icon: <YouIcon />, hash: '#you' },
] as const;

/** BottomNav — mobile authenticated tab bar. Hidden on desktop (≥1024px). */
export function BottomNav() {
  const [activeId, setActiveId] = useState<string>('today');
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
