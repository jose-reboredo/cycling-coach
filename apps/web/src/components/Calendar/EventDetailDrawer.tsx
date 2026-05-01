// EventDetailDrawer — Sprint 5 / v9.7.1.
// Mobile (≤ 600px): bottom-sheet sliding up from bottom.
// Desktop (≥ 601px): right-side panel sliding in from right.
// Tap pill in any view → opens this drawer with full event detail.
// Edit / Cancel buttons stub here; wired to creator/admin gating in v9.7.3.

import { useEffect } from 'react';
import type { CalendarEvent } from './types';
import { TYPE_LABEL } from './types';
import styles from './Calendar.module.css';

interface EventDetailDrawerProps {
  event: CalendarEvent | null;
  onClose: () => void;
}

export function EventDetailDrawer({ event, onClose }: EventDetailDrawerProps) {
  // Lock body scroll while open + handle Escape key.
  useEffect(() => {
    if (!event) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [event, onClose]);

  if (!event) return null;

  const dt = new Date(event.event_date * 1000);
  const dateStr = dt.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const timeStr = `${String(dt.getUTCHours()).padStart(2, '0')}:${String(dt.getUTCMinutes()).padStart(2, '0')}`;

  return (
    <div className={styles.drawerBackdrop} onClick={onClose} role="presentation">
      <div
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.drawerHead}>
          <span className={`${styles.drawerType} ${styles[`pill_${event.event_type}`]}`}>
            {TYPE_LABEL[event.event_type]}
          </span>
          <button
            type="button"
            className={styles.drawerClose}
            onClick={onClose}
            aria-label="Close event details"
          >
            ×
          </button>
        </header>

        <h2 id="event-drawer-title" className={styles.drawerTitle}>
          {event.title}
        </h2>

        <dl className={styles.drawerMeta}>
          <div className={styles.drawerMetaRow}>
            <dt>When</dt>
            <dd>{dateStr} · {timeStr} UTC</dd>
          </div>
          {event.location && (
            <div className={styles.drawerMetaRow}>
              <dt>Where</dt>
              <dd>{event.location}</dd>
            </div>
          )}
          <div className={styles.drawerMetaRow}>
            <dt>RSVP</dt>
            <dd>{event.confirmed_count} going</dd>
          </div>
          {(event.creator_firstname || event.creator_lastname) && (
            <div className={styles.drawerMetaRow}>
              <dt>Organiser</dt>
              <dd>
                {[event.creator_firstname, event.creator_lastname]
                  .filter(Boolean)
                  .join(' ')}
              </dd>
            </div>
          )}
          {event.club_name && (
            <div className={styles.drawerMetaRow}>
              <dt>Club</dt>
              <dd>{event.club_name}</dd>
            </div>
          )}
        </dl>

        {event.description && (
          <p className={styles.drawerDesc}>{event.description}</p>
        )}

        <footer className={styles.drawerFooter}>
          <button type="button" className={styles.drawerBtn} disabled>
            Edit
          </button>
          <button
            type="button"
            className={`${styles.drawerBtn} ${styles.drawerBtnDanger}`}
            disabled
          >
            Cancel event
          </button>
          <p className={styles.drawerNote}>
            Edit / Cancel ship in v9.7.3 (event lifecycle).
          </p>
        </footer>
      </div>
    </div>
  );
}
