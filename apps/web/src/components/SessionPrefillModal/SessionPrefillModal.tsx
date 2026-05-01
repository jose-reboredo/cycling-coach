// SessionPrefillModal — Sprint 5 / v10.2.0.
// Lightweight confirmation modal opened when the user clicks "+ Schedule"
// on a Train tab AI weekly-plan day. Pre-fills title / date / time / zone /
// duration / watts from the AI brief; user reviews + adjusts before save.
//
// Design intent: small, scoped, single-use. Not a general-purpose event
// editor (that's /dashboard/schedule-new). Just a "review what we parsed
// and pick the time" interstitial. ~200 lines, locally-scoped state.

import { useEffect, useState } from 'react';
import { Button } from '../Button/Button';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import { Pill } from '../Pill/Pill';
import styles from './SessionPrefillModal.module.css';

export interface SessionPrefillData {
  /** Parsed title from AI brief; user can edit. */
  title: string;
  /** YYYY-MM-DD in viewer's local timezone. */
  dateStr: string;
  /** HH:MM in viewer's local timezone. */
  timeStr: string;
  /** Coggan zone 1-7 or null when not detected. */
  zone: number | null;
  /** Hours, decimal (cycling convention). null prompts user to fill. */
  durationHours: number | null;
  /** Watts target or null. */
  watts: number | null;
  /** Full AI brief text, displayed read-only as context. */
  description: string;
  /** v10.2.0 — true when durationHours was estimated from distance × pace
   *  rather than read from the brief literally. UI shows an "Estimated"
   *  hint so the user knows to verify before save. */
  durationEstimated: boolean;
  /** Optional: distance from the brief, shown as context. */
  distanceKm: number | null;
}

export interface SessionPrefillResult {
  title: string;
  /** Unix epoch seconds. */
  sessionDate: number;
  zone: number | null;
  durationMin: number;
  watts: number | null;
  description: string;
}

interface SessionPrefillModalProps {
  open: boolean;
  prefill: SessionPrefillData | null;
  onClose: () => void;
  onSave: (result: SessionPrefillResult) => void;
  isPending: boolean;
  error: string | null;
}

const ZONE_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Z1 — Recovery' },
  { value: 2, label: 'Z2 — Endurance' },
  { value: 3, label: 'Z3 — Tempo' },
  { value: 4, label: 'Z4 — Sweet spot / threshold' },
  { value: 5, label: 'Z5 — VO2 max' },
  { value: 6, label: 'Z6 — Anaerobic' },
  { value: 7, label: 'Z7 — Neuromuscular' },
];

export function SessionPrefillModal({
  open,
  prefill,
  onClose,
  onSave,
  isPending,
  error,
}: SessionPrefillModalProps) {
  const [title, setTitle] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('18:00');
  const [zone, setZone] = useState<string>('');
  const [duration, setDuration] = useState('');
  const [watts, setWatts] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // Hydrate fields when prefill changes (modal opening with new day's data).
  useEffect(() => {
    if (!prefill) return;
    setTitle(prefill.title);
    setDateStr(prefill.dateStr);
    setTimeStr(prefill.timeStr);
    setZone(prefill.zone != null ? String(prefill.zone) : '');
    setDuration(prefill.durationHours != null ? String(prefill.durationHours) : '');
    setWatts(prefill.watts != null ? String(prefill.watts) : '');
    setLocalError(null);
  }, [prefill]);

  // Lock body scroll + Escape to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, isPending, onClose]);

  if (!open || !prefill) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setLocalError('Title is required.');
      return;
    }
    if (trimmedTitle.length > 200) {
      setLocalError('Title must be 200 characters or fewer.');
      return;
    }
    if (!dateStr) {
      setLocalError('Date is required.');
      return;
    }
    const isoLocal = `${dateStr}T${timeStr || '18:00'}:00`;
    const sessionMs = new Date(isoLocal).getTime();
    if (!Number.isFinite(sessionMs)) {
      setLocalError('Date or time is invalid.');
      return;
    }
    const durationHours = duration ? Number(duration) : NaN;
    const durationMin = Number.isFinite(durationHours) ? Math.round(durationHours * 60) : NaN;
    if (!Number.isFinite(durationMin) || durationMin <= 0) {
      setLocalError('Duration is required.');
      return;
    }
    if (durationMin > 600) {
      setLocalError('Duration must be 0–10 hours.');
      return;
    }
    const wattsNum = watts ? parseInt(watts, 10) : null;
    if (wattsNum != null && (wattsNum < 0 || wattsNum > 2000)) {
      setLocalError('Target watts must be 0–2000.');
      return;
    }
    const zoneNum = zone ? parseInt(zone, 10) : null;
    onSave({
      title: trimmedTitle,
      sessionDate: Math.floor(sessionMs / 1000),
      zone: zoneNum,
      durationMin,
      watts: wattsNum,
      description: prefill.description,
    });
  };

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-prefill-title"
      >
        <header className={styles.head}>
          <Eyebrow rule tone="accent">From your AI plan</Eyebrow>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            disabled={isPending}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <h2 id="session-prefill-title" className={styles.title}>
          Confirm your <em>session</em>.
        </h2>
        <p className={styles.lede}>
          We've parsed what we can from the coach. Review the details, adjust the time, and save to your calendar.
          {prefill.distanceKm != null && (
            <> Brief mentions <strong>{prefill.distanceKm} km</strong>.</>
          )}
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="prefill-title">Title<span className={styles.required}>*</span></label>
            <input
              id="prefill-title"
              className={styles.input}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              autoFocus
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="prefill-date">Date<span className={styles.required}>*</span></label>
              <input
                id="prefill-date"
                className={styles.input}
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="prefill-time">Time<span className={styles.required}>*</span></label>
              <input
                id="prefill-time"
                className={styles.input}
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="prefill-zone">Target zone</label>
            <select
              id="prefill-zone"
              className={styles.input}
              value={zone}
              onChange={(e) => setZone(e.target.value)}
            >
              <option value="">Any / no specific target</option>
              {ZONE_OPTIONS.map((z) => (
                <option key={z.value} value={z.value}>{z.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="prefill-duration">
                Duration (hours)<span className={styles.required}>*</span>
                {prefill.durationEstimated && (
                  <Pill tone="warn">Estimated</Pill>
                )}
              </label>
              <input
                id="prefill-duration"
                className={styles.input}
                type="number"
                inputMode="decimal"
                min={0}
                max={10}
                step={0.5}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
                placeholder="1.5"
              />
              {prefill.durationEstimated && prefill.distanceKm != null && (
                <span className={styles.fieldHint}>
                  Estimated from {prefill.distanceKm} km at zone-typical pace. Adjust if you ride faster or slower.
                </span>
              )}
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="prefill-watts">Target watts</label>
              <input
                id="prefill-watts"
                className={styles.input}
                type="number"
                inputMode="numeric"
                min={0}
                max={2000}
                value={watts}
                onChange={(e) => setWatts(e.target.value)}
                placeholder="252"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Coach brief</label>
            <p className={styles.briefText}>{prefill.description}</p>
          </div>

          {(localError || error) && (
            <div className={styles.error} role="alert">
              {localError ?? error}
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isPending}
            >
              {isPending ? 'Saving…' : 'Add to calendar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
