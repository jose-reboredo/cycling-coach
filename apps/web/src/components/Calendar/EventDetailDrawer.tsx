// EventDetailDrawer — Sprint 5 / v9.7.1 → v9.12.5.
// Mobile (≤ 600px): bottom-sheet sliding up from bottom.
// Desktop (≥ 601px): right-side panel sliding in from right.
//
// State machine — `confirm` drives the footer:
//   null              → show primary actions
//   'cancel-club'     → confirm club-event cancel (existing v9.7.3)
//   'cancel-personal' → confirm personal-session cancel (v9.12.5)
//   'mark-done'       → confirm Mark done on personal session (v9.12.5)
//   'unsubscribe'     → confirm RSVP withdrawal from a club event (v9.12.5)
//
// Action gating:
//   event.cancelled_at   → cancelled banner; no actions
//   event.completed_at   → ✓ completed banner; no actions (personal only)
//   is_personal          → Edit / Mark done / Cancel  (own — server enforces)
//   !is_personal & creator → Edit / Cancel (existing club creator/admin path)
//   !is_personal & RSVP'd & not creator → Unsubscribe (v9.12.5)

import { useEffect, useState } from 'react';
import type { CalendarEvent } from './types';
import { TYPE_LABEL } from './types';
import {
  useCancelClubEvent,
  useCancelPlannedSession,
  usePatchPlannedSession,
  useRsvp,
} from '../../hooks/useClubs';
import { RideIcon, SocialIcon, RaceIcon, SessionIcon } from '../../design/icons';
import { SessionRoutePicker } from '../SessionRoutePicker/SessionRoutePicker';
import styles from './Calendar.module.css';

const TYPE_ICON = { ride: RideIcon, social: SocialIcon, race: RaceIcon } as const;

const ZONE_LABEL: Record<number, string> = {
  1: 'Z1 · Recovery',
  2: 'Z2 · Endurance',
  3: 'Z3 · Tempo',
  4: 'Z4 · Threshold',
  5: 'Z5 · VO2 max',
  6: 'Z6 · Anaerobic',
  7: 'Z7 · Neuromuscular',
};

type ConfirmKind = null | 'cancel-club' | 'cancel-personal' | 'mark-done' | 'unsubscribe';

interface EventDetailDrawerProps {
  event: CalendarEvent | null;
  onClose: () => void;
  /** Required for club-event Cancel + RSVP mutations. Absent for the personal
   *  scheduler aggregation when the event is a personal session. */
  clubId?: number | null;
  /** Caller's athlete_id — used for creator/RSVP gating. */
  callerAthleteId?: number | null;
  /** Caller's role in this club ('admin' | 'member' | other). */
  callerRole?: string | null;
  /** Edit click handler. When absent, button is hidden. */
  onEdit?: (event: CalendarEvent) => void;
}

export function EventDetailDrawer({ event, onClose, clubId, callerAthleteId, callerRole, onEdit }: EventDetailDrawerProps) {
  const cancelClub = useCancelClubEvent(clubId ?? 0);
  const cancelPersonal = useCancelPlannedSession();
  const patchPersonal = usePatchPlannedSession();
  // useRsvp wants stable clubId+eventId. Personal sessions don't use it but
  // we still need to instantiate the hook unconditionally (Rules of Hooks);
  // pass 0/0 placeholders when not applicable — the mutation only fires
  // through the Unsubscribe button which is gated by !is_personal && clubId.
  const rsvp = useRsvp(clubId ?? 0, event && !event.is_personal ? event.id : 0);

  const [confirm, setConfirm] = useState<ConfirmKind>(null);

  // Reset confirm state when event changes (so reopening doesn't surface
  // a stale confirmation from a previous drawer open).
  useEffect(() => {
    setConfirm(null);
  }, [event?.id]);

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
  });
  const timeStr = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;

  // Header pill: SessionIcon for personal, type icon for club events.
  const HeaderIcon = event.is_personal ? SessionIcon : TYPE_ICON[event.event_type];
  const headerLabel = event.is_personal ? 'Session' : TYPE_LABEL[event.event_type];
  const headerPillClass = event.is_personal
    ? `${styles.drawerType} ${styles.pill_personal_drawer}`
    : `${styles.drawerType} ${styles[`pill_${event.event_type}`]}`;

  // Mode line for personal sessions can show zone when set.
  const personalModeLabel = event.is_personal && event.zone != null && ZONE_LABEL[event.zone]
    ? `Solo session · ${ZONE_LABEL[event.zone]}`
    : 'Solo session';

  // dashboard.schedule.tsx negates session ids for React-key safety; the
  // mutation wants the original positive id.
  const sessionIdForMutation = event.is_personal ? Math.abs(event.id) : event.id;

  const isCancelled = !!event.cancelled_at;
  const isCompleted = event.is_personal && !!event.completed_at;

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
          <span className={headerPillClass}>
            <HeaderIcon size={14} />
            <span>{headerLabel}</span>
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
            <dd>{dateStr} · {timeStr}</dd>
          </div>
          {event.location && (
            <div className={styles.drawerMetaRow}>
              <dt>Where</dt>
              <dd>{event.location}</dd>
            </div>
          )}
          {event.is_personal ? (
            <div className={styles.drawerMetaRow}>
              <dt>Mode</dt>
              <dd>{personalModeLabel}</dd>
            </div>
          ) : (
            <div className={styles.drawerMetaRow}>
              <dt>RSVP</dt>
              <dd>{event.confirmed_count} going</dd>
            </div>
          )}
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

        {/* v10.5.0 — Route picker for personal sessions only. Hidden once
            cancelled or completed (no need to plan a route afterwards).
            Club events use captain-defined routes; no picker there.
            v10.8.0: pass AI plan elevation/surface targets so the picker
            defaults to the right band/cycling type. */}
        {event.is_personal && !isCancelled && !isCompleted && (
          <SessionRoutePicker
            sessionId={sessionIdForMutation}
            zone={event.zone ?? null}
            durationMinutes={event.duration_minutes ?? null}
            targetElevationM={event.elevation_gained ?? null}
            targetSurface={event.session_surface ?? null}
          />
        )}

        <footer className={styles.drawerFooter}>
          {renderFooter()}
        </footer>
      </div>
    </div>
  );

  function renderFooter() {
    if (isCancelled) {
      return (
        <p className={styles.drawerCancelled}>
          This event was cancelled on{' '}
          {new Date((event!.cancelled_at as number) * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}.
        </p>
      );
    }

    if (isCompleted) {
      return (
        <p className={styles.drawerCompleted}>
          ✓ Completed on{' '}
          {new Date((event!.completed_at as number) * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}.
        </p>
      );
    }

    // ===== PERSONAL SESSION ACTIONS =====
    if (event!.is_personal) {
      if (confirm === 'cancel-personal') {
        return (
          <>
            <p className={styles.drawerConfirmText}>
              Cancel <strong>{event!.title}</strong>?
            </p>
            <button type="button" className={styles.drawerBtn} onClick={() => setConfirm(null)} disabled={cancelPersonal.isPending}>
              Keep session
            </button>
            <button
              type="button"
              className={`${styles.drawerBtn} ${styles.drawerBtnDanger}`}
              disabled={cancelPersonal.isPending}
              onClick={() => {
                cancelPersonal.mutate(sessionIdForMutation, {
                  onSuccess: () => { setConfirm(null); onClose(); },
                });
              }}
            >
              {cancelPersonal.isPending ? 'Cancelling…' : 'Yes, cancel'}
            </button>
            {cancelPersonal.isError && <p className={styles.drawerError}>Couldn't cancel — try again.</p>}
          </>
        );
      }
      if (confirm === 'mark-done') {
        return (
          <>
            <p className={styles.drawerConfirmText}>
              Mark <strong>{event!.title}</strong> as completed?
            </p>
            <button type="button" className={styles.drawerBtn} onClick={() => setConfirm(null)} disabled={patchPersonal.isPending}>
              Not yet
            </button>
            <button
              type="button"
              className={styles.drawerBtn}
              disabled={patchPersonal.isPending}
              onClick={() => {
                patchPersonal.mutate(
                  { sessionId: sessionIdForMutation, input: { completed_at: Math.floor(Date.now() / 1000) } },
                  { onSuccess: () => { setConfirm(null); onClose(); } },
                );
              }}
            >
              {patchPersonal.isPending ? 'Saving…' : '✓ Mark done'}
            </button>
            {patchPersonal.isError && <p className={styles.drawerError}>Couldn't save — try again.</p>}
          </>
        );
      }
      // Default personal actions
      return (
        <>
          {onEdit && (
            <button type="button" className={styles.drawerBtn} onClick={() => onEdit(event!)}>
              Edit
            </button>
          )}
          <button type="button" className={styles.drawerBtn} onClick={() => setConfirm('mark-done')}>
            ✓ Mark done
          </button>
          <button type="button" className={`${styles.drawerBtn} ${styles.drawerBtnDanger}`} onClick={() => setConfirm('cancel-personal')}>
            Cancel
          </button>
        </>
      );
    }

    // ===== CLUB EVENT ACTIONS =====
    const callerInfoKnown = callerAthleteId != null || callerRole != null;
    const isCreator = !!callerAthleteId && event!.created_by === callerAthleteId;
    const isAdmin = callerRole === 'admin';
    const canManage = !!clubId && (callerInfoKnown ? (isCreator || isAdmin) : true);
    // Unsubscribe shown when caller is RSVP'd (which they are if event is in
    // their personal schedule) and not the creator. Server enforces final
    // permissions.
    const canUnsubscribe = !!clubId && callerAthleteId != null && !isCreator && !canManage;

    if (confirm === 'cancel-club') {
      return (
        <>
          <p className={styles.drawerConfirmText}>
            Cancel <strong>{event!.title}</strong>? Members will see it as cancelled.
          </p>
          <button type="button" className={styles.drawerBtn} onClick={() => setConfirm(null)} disabled={cancelClub.isPending}>
            Keep event
          </button>
          <button
            type="button"
            className={`${styles.drawerBtn} ${styles.drawerBtnDanger}`}
            disabled={cancelClub.isPending}
            onClick={() => {
              cancelClub.mutate(event!.id, {
                onSuccess: () => { setConfirm(null); onClose(); },
              });
            }}
          >
            {cancelClub.isPending ? 'Cancelling…' : 'Yes, cancel event'}
          </button>
          {cancelClub.isError && <p className={styles.drawerError}>Couldn't cancel — try again.</p>}
        </>
      );
    }
    if (confirm === 'unsubscribe') {
      return (
        <>
          <p className={styles.drawerConfirmText}>
            Unsubscribe from <strong>{event!.title}</strong>? You'll be removed from the going list.
          </p>
          <button type="button" className={styles.drawerBtn} onClick={() => setConfirm(null)} disabled={rsvp.isPending}>
            Stay
          </button>
          <button
            type="button"
            className={`${styles.drawerBtn} ${styles.drawerBtnDanger}`}
            disabled={rsvp.isPending}
            onClick={() => {
              rsvp.mutate('not_going', {
                onSuccess: () => { setConfirm(null); onClose(); },
              });
            }}
          >
            {rsvp.isPending ? 'Saving…' : 'Yes, unsubscribe'}
          </button>
          {rsvp.isError && <p className={styles.drawerError}>Couldn't update RSVP — try again.</p>}
        </>
      );
    }

    if (canManage) {
      return (
        <>
          {onEdit && (
            <button type="button" className={styles.drawerBtn} onClick={() => onEdit(event!)}>
              Edit
            </button>
          )}
          <button type="button" className={`${styles.drawerBtn} ${styles.drawerBtnDanger}`} onClick={() => setConfirm('cancel-club')}>
            Cancel event
          </button>
        </>
      );
    }

    if (canUnsubscribe) {
      return (
        <button type="button" className={`${styles.drawerBtn} ${styles.drawerBtnDanger}`} onClick={() => setConfirm('unsubscribe')}>
          Unsubscribe
        </button>
      );
    }

    return null;
  }
}
