import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { Button } from '../Button/Button';
import { useCreateClubEvent } from '../../hooks/useClubs';
import type { ClubEvent, ClubEventSurface, ClubEventType } from '../../lib/clubsApi';
import styles from './ClubEventModal.module.css';

interface ClubEventModalProps {
  open: boolean;
  clubId: number;
  onClose: () => void;
  onCreated?: (event: ClubEvent) => void;
}

const FORMATS: { id: ClubEventType; label: string }[] = [
  { id: 'ride', label: '🚴 Ride' },
  { id: 'social', label: '☕ Social' },
  { id: 'race', label: '🏁 Race' },
];

const SURFACES: { id: ClubEventSurface; label: string }[] = [
  { id: 'road', label: 'Road' },
  { id: 'gravel', label: 'Gravel' },
  { id: 'mixed', label: 'Mixed' },
];

/**
 * ClubEventModal — any club member can create events. Sprint 5 / v9.7.3 (#60)
 * extends the form with the Migration 0007 model: format chips (event_type),
 * distance, expected speed, surface, and start point. Distance / speed /
 * surface auto-hide when format = social per founder lock 2026-05-01
 * (persona-aware hiding).
 */
export function ClubEventModal({ open, clubId, onClose, onCreated }: ClubEventModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [eventType, setEventType] = useState<ClubEventType>('ride');
  const [distanceKm, setDistanceKm] = useState('');
  const [speedKmh, setSpeedKmh] = useState('');
  const [surface, setSurface] = useState<ClubEventSurface | ''>('');
  const [startPoint, setStartPoint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const modalRef = useFocusTrap<HTMLDivElement>(open);
  const createEvent = useCreateClubEvent(clubId);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setLocation('');
    setEventType('ride');
    setDistanceKm('');
    setSpeedKmh('');
    setSurface('');
    setStartPoint('');
    setError(null);
    // Default = next Saturday at 09:00
    const now = new Date();
    const day = now.getDay();
    const offsetToSat = (6 - day + 7) % 7 || 7;
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

  const showAthleticFields = eventType !== 'social';

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
    const distanceParsed = distanceKm ? Number(distanceKm) : null;
    const speedParsed = speedKmh ? Number(speedKmh) : null;
    if (distanceKm && (!Number.isFinite(distanceParsed) || distanceParsed! < 0 || distanceParsed! >= 1000)) {
      setError('Distance must be 0–999 km.');
      return;
    }
    if (speedKmh && (!Number.isFinite(speedParsed) || speedParsed! <= 0 || speedParsed! >= 100)) {
      setError('Speed must be 0–99 km/h.');
      return;
    }

    try {
      const event = await createEvent.mutateAsync({
        title: trimmedTitle,
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        event_date: Math.floor(eventDateMs / 1000),
        event_type: eventType,
        // Athletic fields only sent when not social.
        ...(showAthleticFields && distanceParsed !== null ? { distance_km: distanceParsed } : {}),
        ...(showAthleticFields && speedParsed !== null ? { expected_avg_speed_kmh: speedParsed } : {}),
        ...(showAthleticFields && surface ? { surface } : {}),
        ...(startPoint.trim() ? { start_point: startPoint.trim() } : {}),
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
              Any member can post a ride. Your circle sees it on the calendar.
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

              {/* v9.7.3 — Format chips. Drives persona-aware field visibility. */}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Format</label>
                <div className={styles.chipRow} role="radiogroup" aria-label="Event format">
                  {FORMATS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      role="radio"
                      aria-checked={eventType === f.id}
                      className={`${styles.chip} ${eventType === f.id ? styles.chipActive : ''}`}
                      onClick={() => setEventType(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
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

              {/* v9.7.3 — Athletic fields hidden when format = social. */}
              {showAthleticFields && (
                <>
                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel} htmlFor="ev-distance">Distance (km)</label>
                      <input
                        id="ev-distance"
                        className={styles.input}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={999}
                        step={1}
                        value={distanceKm}
                        onChange={(e) => setDistanceKm(e.target.value)}
                        placeholder="62"
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel} htmlFor="ev-speed">Avg speed (km/h)</label>
                      <input
                        id="ev-speed"
                        className={styles.input}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={99}
                        step={0.5}
                        value={speedKmh}
                        onChange={(e) => setSpeedKmh(e.target.value)}
                        placeholder="28"
                      />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Surface</label>
                    <div className={styles.chipRow} role="radiogroup" aria-label="Surface">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={surface === ''}
                        className={`${styles.chip} ${surface === '' ? styles.chipActive : ''}`}
                        onClick={() => setSurface('')}
                      >
                        Any
                      </button>
                      {SURFACES.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          role="radio"
                          aria-checked={surface === s.id}
                          className={`${styles.chip} ${surface === s.id ? styles.chipActive : ''}`}
                          onClick={() => setSurface(s.id)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="ev-startpoint">Start point</label>
                <input
                  id="ev-startpoint"
                  className={styles.input}
                  type="text"
                  value={startPoint}
                  onChange={(e) => setStartPoint(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Bürkliplatz fountain"
                />
                <span className={styles.fieldHint}>Where members meet. Optional.</span>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="ev-location">Location / area</label>
                <input
                  id="ev-location"
                  className={styles.input}
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Albis Loop"
                />
                <span className={styles.fieldHint}>Where the ride happens. Optional.</span>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="ev-description">Notes</label>
                <textarea
                  id="ev-description"
                  className={styles.textarea}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  placeholder="Pace, regroup points, coffee stop — whatever the circle should know."
                />
                <span className={styles.fieldHint}>Optional. Up to 2,000 characters. (AI-draft button ships in v9.7.3.1.)</span>
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
