// Sprint 5 / v9.12.0 (#77) — Add personal training session page.
// Page-pattern (not modal) per Rule #17 lesson from v9.8.2 — modals on
// multi-platform are fragile and we want this flow rock-solid.

import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Container } from '../components/Container/Container';
import { Eyebrow } from '../components/Eyebrow/Eyebrow';
import { Button } from '../components/Button/Button';
import { useCreatePlannedSession } from '../hooks/useClubs';
import styles from './dashboard.schedule-new.module.css';

// v9.12.1 (#80) — flat path /dashboard/schedule-new so it doesn't nest
// under dashboard.schedule.tsx (which has no <Outlet />). Original path
// /dashboard/schedule/new failed silently — parent loaded, child Outlet
// missing, child never mounted.
export const Route = createFileRoute('/dashboard/schedule-new')({
  component: NewSessionPage,
});

const ZONE_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Z1 — Recovery' },
  { value: 2, label: 'Z2 — Endurance' },
  { value: 3, label: 'Z3 — Tempo' },
  { value: 4, label: 'Z4 — Sweet spot / threshold' },
  { value: 5, label: 'Z5 — VO2 max' },
  { value: 6, label: 'Z6 — Anaerobic' },
  { value: 7, label: 'Z7 — Neuromuscular' },
];

function NewSessionPage() {
  const navigate = useNavigate();
  const createSession = useCreatePlannedSession();

  // Default = today at 18:00.
  const todayDate = (() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  })();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayDate);
  const [time, setTime] = useState('18:00');
  const [zone, setZone] = useState<string>('');
  const [duration, setDuration] = useState('');
  const [watts, setWatts] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title is required.');
      return;
    }
    if (trimmed.length > 200) {
      setError('Title must be 200 characters or fewer.');
      return;
    }
    if (!date) {
      setError('Pick a date.');
      return;
    }
    const isoLocal = `${date}T${time || '18:00'}:00`;
    const sessionMs = new Date(isoLocal).getTime();
    if (!Number.isFinite(sessionMs)) {
      setError('Date/time is not valid.');
      return;
    }
    const zoneNum = zone ? parseInt(zone, 10) : null;
    // v9.12.3 — input is in hours (cycling convention); converted to minutes
    // for DB storage. step=0.5 in input gives 0.5h / 1h / 1.5h granularity.
    const durationHours = duration ? Number(duration) : null;
    const durationNum = durationHours != null && Number.isFinite(durationHours)
      ? Math.round(durationHours * 60) : null;
    const wattsNum = watts ? parseInt(watts, 10) : null;
    if (durationNum == null) {
      setError('Duration is required.');
      return;
    }
    if (durationNum < 0 || durationNum > 600) {
      setError('Duration must be 0–10 hours.');
      return;
    }
    if (wattsNum != null && (wattsNum < 0 || wattsNum > 2000)) {
      setError('Target watts must be 0–2000.');
      return;
    }
    try {
      await createSession.mutateAsync({
        title: trimmed,
        session_date: Math.floor(sessionMs / 1000),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(zoneNum != null ? { zone: zoneNum } : {}),
        ...(durationNum != null ? { duration_minutes: durationNum } : {}),
        ...(wattsNum != null ? { target_watts: wattsNum } : {}),
      });
      navigate({ to: '/dashboard/schedule' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create session.');
    }
  }

  return (
    <main id="main" className={styles.page}>
      <Container width="narrow">
        <header className={styles.head}>
          <Eyebrow rule tone="accent">New session</Eyebrow>
          <h1 className={styles.title}>Plan a <em>session</em>.</h1>
          <p className={styles.lede}>
            Block out a workout. It'll show up on your personal calendar
            alongside club rides you've RSVP'd to.
          </p>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="s-title">Title<span className={styles.required}>*</span></label>
            <input
              id="s-title"
              className={styles.input}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              autoFocus
              placeholder="e.g. Sweet-spot intervals · 3×12"
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="s-date">Date<span className={styles.required}>*</span></label>
              <input
                id="s-date"
                className={styles.input}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="s-time">Time<span className={styles.required}>*</span></label>
              <input
                id="s-time"
                className={styles.input}
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="s-zone">Target zone</label>
            <select
              id="s-zone"
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
              <label className={styles.fieldLabel} htmlFor="s-duration">Duration (hours)<span className={styles.required}>*</span></label>
              <input
                id="s-duration"
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
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="s-watts">Target watts</label>
              <input
                id="s-watts"
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
            <label className={styles.fieldLabel} htmlFor="s-desc">Notes</label>
            <textarea
              id="s-desc"
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              placeholder="Sets, recovery, pacing — whatever helps you remember the brief."
            />
            <span className={styles.fieldHint}>Optional. Up to 2,000 characters.</span>
          </div>

          <p className={styles.formLegend}>* Required</p>

          {error && <div className={styles.error} role="alert">{error}</div>}

          <div className={styles.actions}>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={createSession.isPending}
            >
              {createSession.isPending ? 'Saving…' : 'Save session'}
            </Button>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => navigate({ to: '/dashboard/schedule' })}
              disabled={createSession.isPending}
            >
              Cancel
            </button>
          </div>
        </form>
      </Container>
    </main>
  );
}
