import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useVisualViewportHeight } from '../../hooks/useVisualViewportHeight';
import { Button } from '../Button/Button';
import { useCreateClubEvent, useDraftEventDescription, usePatchClubEvent } from '../../hooks/useClubs';
import { RideIcon, SocialIcon, RaceIcon } from '../../design/icons';
import type { ClubEvent, ClubEventSurface, ClubEventType } from '../../lib/clubsApi';
import styles from './ClubEventModal.module.css';

interface ClubEventModalProps {
  open: boolean;
  clubId: number;
  onClose: () => void;
  onCreated?: (event: ClubEvent) => void;
  /** v9.9.0 (#60) — Edit mode. When provided, the modal pre-fills with the
   *  event's values + submits via PATCH instead of POST. Title, button
   *  label, and the AI-draft state all adapt. */
  event?: ClubEvent | null;
  onUpdated?: () => void;
}

// v9.7.4 (#66) — branded SVG icons replace the emoji placeholders.
const FORMATS: { id: ClubEventType; label: string; Icon: typeof RideIcon }[] = [
  { id: 'ride', label: 'Ride', Icon: RideIcon },
  { id: 'social', label: 'Social', Icon: SocialIcon },
  { id: 'race', label: 'Race', Icon: RaceIcon },
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
export function ClubEventModal({ open, clubId, onClose, onCreated, event, onUpdated }: ClubEventModalProps) {
  const isEdit = !!event;
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
  const patchEvent = usePatchClubEvent(clubId);
  const draftDescription = useDraftEventDescription(clubId);
  // v9.7.5 (#69) — track visual viewport so modal stays inside the
  // visible area when the iOS keyboard opens.
  const vvh = useVisualViewportHeight();
  // v9.8.0 — AI-draft state. Set to true once user accepts an AI draft
  // without further edits; passed to backend as `description_ai_generated`.
  const [descIsAi, setDescIsAi] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);

    if (event) {
      // v9.9.0 (#60) — Edit mode: pre-fill from event values.
      setTitle(event.title || '');
      setDescription(event.description || '');
      setLocation(event.location || '');
      setEventType((event.event_type as ClubEventType) || 'ride');
      setDistanceKm(event.distance_km != null ? String(event.distance_km) : '');
      setSpeedKmh(event.expected_avg_speed_kmh != null ? String(event.expected_avg_speed_kmh) : '');
      setSurface((event.surface as ClubEventSurface) || '');
      setStartPoint(event.start_point || '');
      setDescIsAi(!!event.description_ai_generated);
      const dt = new Date((event.event_date || 0) * 1000);
      setDate(Number.isFinite(dt.getTime()) ? dt.toISOString().slice(0, 10) : '');
      setTime(
        Number.isFinite(dt.getTime())
          ? `${String(dt.getUTCHours()).padStart(2, '0')}:${String(dt.getUTCMinutes()).padStart(2, '0')}`
          : '09:00',
      );
    } else {
      // Create mode: empty fields, default Saturday 09:00.
      setTitle('');
      setDescription('');
      setLocation('');
      setEventType('ride');
      setDistanceKm('');
      setSpeedKmh('');
      setSurface('');
      setStartPoint('');
      setDescIsAi(false);
      const now = new Date();
      const day = now.getDay();
      const offsetToSat = (6 - day + 7) % 7 || 7;
      const sat = new Date(now);
      sat.setDate(now.getDate() + offsetToSat);
      setDate(sat.toISOString().slice(0, 10));
      setTime('09:00');
    }

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

    const fields = {
      title: trimmedTitle,
      description: description.trim() || null,
      location: location.trim() || null,
      event_date: Math.floor(eventDateMs / 1000),
      event_type: eventType,
      // Athletic fields cleared (set null) when format = social so we don't
      // leave stale data on a Ride→Social toggle in edit mode.
      distance_km: showAthleticFields && distanceParsed !== null ? distanceParsed : null,
      expected_avg_speed_kmh: showAthleticFields && speedParsed !== null ? speedParsed : null,
      surface: showAthleticFields && surface ? surface : null,
      start_point: startPoint.trim() || null,
      // v9.8.0 — AI authorship flag: only sent on CREATE; PATCH preserves
      // existing flag (server-side patches don't accept this field).
      description_ai_generated: descIsAi,
    } as const;

    if (isEdit && event) {
      // v9.9.0 (#60) — PATCH path. Server-side allowlist ignores unknown
      // fields; we send everything the user might have changed.
      try {
        await patchEvent.mutateAsync({
          eventId: event.id,
          input: {
            title: fields.title,
            description: fields.description ?? '',
            location: fields.location ?? '',
            event_date: fields.event_date,
            event_type: fields.event_type,
            distance_km: fields.distance_km,
            expected_avg_speed_kmh: fields.expected_avg_speed_kmh,
            surface: fields.surface,
            start_point: fields.start_point ?? '',
          },
        });
        onClose();
        onUpdated?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save changes.');
      }
      return;
    }

    // Create path
    try {
      const created = await createEvent.mutateAsync({
        title: fields.title,
        description: fields.description ?? undefined,
        location: fields.location ?? undefined,
        event_date: fields.event_date,
        event_type: fields.event_type,
        ...(fields.distance_km !== null ? { distance_km: fields.distance_km } : {}),
        ...(fields.expected_avg_speed_kmh !== null ? { expected_avg_speed_kmh: fields.expected_avg_speed_kmh } : {}),
        ...(fields.surface ? { surface: fields.surface } : {}),
        ...(fields.start_point ? { start_point: fields.start_point } : {}),
        ...(fields.description_ai_generated ? { description_ai_generated: true } : {}),
      });
      onClose();
      onCreated?.(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create event.');
    }
  }

  /** v9.8.0 — call the backend draft endpoint, populate the textarea. */
  async function handleGenerateAi() {
    setError(null);
    if (!title.trim()) {
      setError('Add a title before generating a description.');
      return;
    }
    try {
      const distanceParsed = distanceKm ? Number(distanceKm) : null;
      const speedParsed = speedKmh ? Number(speedKmh) : null;
      const result = await draftDescription.mutateAsync({
        title: title.trim(),
        event_type: eventType,
        ...(showAthleticFields && distanceParsed !== null ? { distance_km: distanceParsed } : {}),
        ...(showAthleticFields && speedParsed !== null ? { expected_avg_speed_kmh: speedParsed } : {}),
        ...(showAthleticFields && surface ? { surface } : {}),
        ...(startPoint.trim() ? { start_point: startPoint.trim() } : {}),
        ...(location.trim() ? { location: location.trim() } : {}),
      });
      setDescription(result.description);
      setDescIsAi(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate description.');
    }
  }

  // v9.8.1 (#70) — portal to document.body to escape parent stacking
  // context. Same fix as ClubCreateModal; preventive for the case where
  // ClubEventModal opens from the Schedule tab "+" button.
  if (typeof document === 'undefined') return null;

  return createPortal(
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
            // v9.7.5 (#69) — clamp to visual viewport when iOS keyboard opens.
            style={vvh != null ? { maxHeight: `${vvh - 16}px` } : undefined}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            <h2 id="club-event-title" className={styles.title}>
              {isEdit ? <>Edit <em>event</em>.</> : <>Create an <em>event</em>.</>}
            </h2>
            <p className={styles.lede}>
              {isEdit
                ? 'Update the details. Members see the changes immediately.'
                : 'Any member can post a ride. Your circle sees it on the calendar.'}
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
                  {FORMATS.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={eventType === id}
                      className={`${styles.chip} ${eventType === id ? styles.chipActive : ''}`}
                      onClick={() => setEventType(id)}
                    >
                      <Icon size={16} />
                      <span>{label}</span>
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
                <div className={styles.fieldLabelRow}>
                  <label className={styles.fieldLabel} htmlFor="ev-description">Notes</label>
                  <button
                    type="button"
                    className={styles.aiDraftBtn}
                    onClick={handleGenerateAi}
                    disabled={draftDescription.isPending || !title.trim()}
                  >
                    {draftDescription.isPending ? 'Drafting…' : 'Generate with AI ✨'}
                  </button>
                </div>
                <textarea
                  id="ev-description"
                  className={styles.textarea}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (descIsAi) setDescIsAi(false); // user edited → no longer purely AI
                  }}
                  maxLength={2000}
                  placeholder="Pace, regroup points, coffee stop — whatever the circle should know."
                />
                <span className={styles.fieldHint}>
                  Optional. Up to 2,000 characters.
                  {descIsAi && ' AI-drafted — edit to refine.'}
                </span>
              </div>

              {error && <div className={styles.error} role="alert">{error}</div>}

              <div className={styles.actions}>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={createEvent.isPending || patchEvent.isPending}
                >
                  {isEdit
                    ? (patchEvent.isPending ? 'Saving…' : 'Save changes')
                    : (createEvent.isPending ? 'Posting…' : 'Post event')}
                </Button>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={onClose}
                  disabled={createEvent.isPending || patchEvent.isPending}
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
