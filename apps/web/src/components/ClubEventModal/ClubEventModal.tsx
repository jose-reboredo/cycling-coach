import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { Button } from '../Button/Button';
import { useCreateClubEvent } from '../../hooks/useClubs';
import type { ClubEvent } from '../../lib/clubsApi';
import styles from './ClubEventModal.module.css';

interface ClubEventModalProps {
  open: boolean;
  clubId: number;
  onClose: () => void;
  onCreated?: (event: ClubEvent) => void;
}

/**
 * ClubEventModal — any club member can create events (per v9.1.3 BA spec).
 * Form: title (required, ≤200) + description (optional, ≤2000) + location
 * (optional, ≤200) + date + time (combined to ISO + sent to API).
 *
 * Defaults: date = next Saturday morning at 09:00 (matches the wireframe's
 * "Saturday Morning Crew" mental model and the most common group-ride slot).
 */
export function ClubEventModal({ open, clubId, onClose, onCreated }: ClubEventModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [error, setError] = useState<string | null>(null);
  const modalRef = useFocusTrap<HTMLDivElement>(open);
  const createEvent = useCreateClubEvent(clubId);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setLocation('');
    setError(null);
    // Default = next Saturday at 09:00
    const now = new Date();
    const day = now.getDay(); // 0 Sun, 6 Sat
    const offsetToSat = (6 - day + 7) % 7 || 7; // always at least 1 day ahead
    const sat = new Date(now);
    sat.setDate(now.getDate() + offsetToSat);
    setDate(sat.toISOString().slice(0, 10));
    setTime('09:00');

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Title is required.');
      return;
    }
    if (trimmedTitle.length > 200) {
      setError('Title must be 200 characters or fewer.');
      return;
    }
    if (!date) {
      setError('Pick a date.');
      return;
    }
    const isoLocal = `${date}T${time || '09:00'}:00`;
    const eventDateMs = new Date(isoLocal).getTime();
    if (!Number.isFinite(eventDateMs)) {
      setError('Date is not valid.');
      return;
    }
    try {
      const event = await createEvent.mutateAsync({
        title: trimmedTitle,
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        event_date: Math.floor(eventDateMs / 1000),
      });
      onClose();
      onCreated?.(event);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create event.');
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.backdrop}
          onClick={(e) => e.target === e.currentTarget && onClose()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            ref={modalRef}
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-event-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            <h2 id="club-event-title" className={styles.title}>
              Create an <em>event</em>.
            </h2>
            <p className={styles.lede}>
              Any member can post a ride. Your circle sees it on the dashboard;
              RSVPs ship in a future release.
            </p>

            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="ev-title">Title</label>
                <input
                  id="ev-title"
                  className={styles.input}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  required
                  autoFocus
                  placeholder="e.g. Saturday Morning Spin"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="ev-location">Location</label>
                <input
                  id="ev-location"
                  className={styles.input}
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Richmond Park · Sheen Gate"
                />
                <span className={styles.fieldHint}>Optional. Free text.</span>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="ev-date">Date</label>
                  <input
                    id="ev-date"
                    className={styles.input}
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="ev-time">Time</label>
                  <input
                    id="ev-time"
                    className={styles.input}
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="ev-description">Notes</label>
                <textarea
                  id="ev-description"
                  className={styles.textarea}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  placeholder="Pace, distance, coffee stop — whatever the circle should know."
                />
                <span className={styles.fieldHint}>Optional. Up to 2,000 characters.</span>
              </div>

              {error && <div className={styles.error} role="alert">{error}</div>}

              <div className={styles.actions}>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={createEvent.isPending}
                >
                  {createEvent.isPending ? 'Posting…' : 'Post event'}
                </Button>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={onClose}
                  disabled={createEvent.isPending}
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
