// EventDetailDrawer — Sprint 5 / v9.7.1 → v9.7.3 (#60).
// Mobile (≤ 600px): bottom-sheet sliding up from bottom.
// Desktop (≥ 601px): right-side panel sliding in from right.
// Tap pill in any view → opens this drawer with full event detail.
// v9.7.3: Cancel button wired to clubsApi.cancelEvent (creator/admin only).
// Edit (PATCH) UX deferred to v9.7.3.1.

import { useEffect, useState } from 'react';
import type { CalendarEvent } from './types';
import { TYPE_LABEL } from './types';
import { useCancelClubEvent } from '../../hooks/useClubs';
import { RideIcon, SocialIcon, RaceIcon } from '../../design/icons';
import styles from './Calendar.module.css';

const TYPE_ICON = { ride: RideIcon, social: SocialIcon, race: RaceIcon } as const;

interface EventDetailDrawerProps {
  event: CalendarEvent | null;
  onClose: () => void;
  /** v9.7.3 — required to wire Cancel mutation. Absent for the personal
   *  scheduler aggregation in v9.7.4 (read-only across clubs). */
  clubId?: number | null;
  /** v9.7.3 — caller's athlete_id to check creator/admin gating client-side. */
  callerAthleteId?: number | null;
  /** v9.7.3 — caller's role in this club ('admin' | 'member' | other). */
  callerRole?: string | null;
  /** v9.9.0 (#60) — Edit button click handler. When absent, button is hidden.
   *  Caller (ScheduleTab) maps CalendarEvent → ClubEvent and bubbles up to
   *  ClubDashboard which owns the modal. */
  onEdit?: (event: CalendarEvent) => void;
}

export function EventDetailDrawer({ event, onClose, clubId, callerAthleteId, callerRole, onEdit }: EventDetailDrawerProps) {
  const cancelMutation = useCancelClubEvent(clubId ?? 0);
  const [showConfirm, setShowConfirm] = useState(false);

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
            {(() => { const Icon = TYPE_ICON[event.event_type]; return <Icon size={14} />; })()}
            <span>{TYPE_LABEL[event.event_type]}</span>
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
          {(() => {
            const isCancelled = !!event.cancelled_at;
            // Permission gating: if caller info is provided, narrow to
            // creator OR admin. If not provided (e.g. personal scheduler
            // aggregation in v9.7.4 where role context is heterogeneous),
            // show the button anyway and let the server enforce 403.
            const callerInfoKnown = callerAthleteId != null || callerRole != null;
            const isCreator = !!callerAthleteId && event.created_by === callerAthleteId;
            const isAdmin = callerRole === 'admin';
            const canModify = !isCancelled && !!clubId && (callerInfoKnown ? (isCreator || isAdmin) : true);
            if (isCancelled) {
              return (
                <p className={styles.drawerCancelled}>
                  This event was cancelled on{' '}
                  {new Date((event.cancelled_at as number) * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}.
                </p>
              );
            }
            if (!canModify) {
              return null;
            }
            if (showConfirm) {
              return (
                <>
                  <p className={styles.drawerConfirmText}>
                    Cancel <strong>{event.title}</strong>? Members will see it as cancelled.
                  </p>
                  <button type="button" className={styles.drawerBtn} onClick={() => setShowConfirm(false)} disabled={cancelMutation.isPending}>
                    Keep event
                  </button>
                  <button
                    type="button"
                    className={`${styles.drawerBtn} ${styles.drawerBtnDanger}`}
                    disabled={cancelMutation.isPending}
                    onClick={() => {
                      cancelMutation.mutate(event.id, {
                        onSuccess: () => {
                          setShowConfirm(false);
                          onClose();
                        },
                      });
                    }}
                  >
                    {cancelMutation.isPending ? 'Cancelling…' : 'Yes, cancel event'}
                  </button>
                  {cancelMutation.isError && (
                    <p className={styles.drawerError}>Couldn't cancel — try again.</p>
                  )}
                </>
              );
            }
            return (
              <>
                {onEdit && (
                  <button
                    type="button"
                    className={styles.drawerBtn}
                    onClick={() => onEdit(event)}
                  >
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  className={`${styles.drawerBtn} ${styles.drawerBtnDanger}`}
                  onClick={() => setShowConfirm(true)}
                >
                  Cancel event
                </button>
              </>
            );
          })()}
        </footer>
      </div>
    </div>
  );
}
