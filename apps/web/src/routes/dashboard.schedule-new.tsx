// Sprint 5 / v9.12.0 (#77) — Add personal training session page.
// v9.12.5: also handles ?id=N&range=YYYY-MM for edit mode (PATCH).
// Page-pattern (not modal) per Rule #17 lesson from v9.8.2 — modals on
// multi-platform are fragile and we want this flow rock-solid.

import { useEffect, useMemo, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Container } from '../components/Container/Container';
import { Eyebrow } from '../components/Eyebrow/Eyebrow';
import { Button } from '../components/Button/Button';
import {
  useCreatePlannedSession,
  useMyScheduleByMonth,
  usePatchPlannedSession,
} from '../hooks/useClubs';
import styles from './dashboard.schedule-new.module.css';

interface SchedNewSearch {
  /** v9.12.5 — when present, page enters Edit mode for that session id. */
  id?: number;
  /** v9.12.5 — month range (YYYY-MM) used to fetch the session via the
   *  cached `useMyScheduleByMonth` query. Drawer Edit-click computes this
   *  from the event's date so the lookup is cache-friendly. */
  range?: string;
}

// v9.12.1 (#80) — flat path /dashboard/schedule-new so it doesn't nest
// under dashboard.schedule.tsx (which has no <Outlet />). Original path
// /dashboard/schedule/new failed silently — parent loaded, child Outlet
// missing, child never mounted.
export const Route = createFileRoute('/dashboard/schedule-new')({
  validateSearch: (search: Record<string, unknown>): SchedNewSearch => ({
    id: search.id != null && Number.isFinite(Number(search.id)) ? Number(search.id) : undefined,
    range: typeof search.range === 'string' && /^\d{4}-\d{2}$/.test(search.range) ? search.range : undefined,
  }),
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
  const { id: editId, range: editRange } = Route.useSearch();
  const isEdit = editId != null;

  const createSession = useCreatePlannedSession();
  const patchSession = usePatchPlannedSession();
  const scheduleQuery = useMyScheduleByMonth(editRange ?? '');
  const editingSession = useMemo(() => {
    if (!isEdit || !scheduleQuery.data) return null;
    return scheduleQuery.data.planned_sessions.find((s) => s.id === editId) ?? null;
  }, [isEdit, editId, scheduleQuery.data]);

  // Default = today at 18:00.
  const todayDate = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayDate);
  const [time, setTime] = useState('18:00');
  const [zone, setZone] = useState<string>('');
  const [duration, setDuration] = useState('');
  const [watts, setWatts] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  // v9.12.5 — Edit mode: populate form once the session arrives from cache/fetch.
  useEffect(() => {
    if (!editingSession || prefilled) return;
    const dt = new Date(editingSession.session_date * 1000);
    setTitle(editingSession.title);
    setDate(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`);
    setTime(`${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`);
    setZone(editingSession.zone != null ? String(editingSession.zone) : '');
    // DB stores minutes; UI works in hours (0.5 step).
    setDuration(editingSession.duration_minutes != null ? String(editingSession.duration_minutes / 60) : '');
    setWatts(editingSession.target_watts != null ? String(editingSession.target_watts) : '');
    setDescription(editingSession.description ?? '');
    setPrefilled(true);
  }, [editingSession, prefilled]);

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
      if (isEdit && editId != null) {
        // v9.12.5 — PATCH path. Send all fields (PATCH supports nullable clear).
        await patchSession.mutateAsync({
          sessionId: editId,
          input: {
            title: trimmed,
            session_date: Math.floor(sessionMs / 1000),
            description: description.trim() || null,
            zone: zoneNum,
            duration_minutes: durationNum,
            target_watts: wattsNum,
          },
        });
      } else {
        await createSession.mutateAsync({
          title: trimmed,
          session_date: Math.floor(sessionMs / 1000),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(zoneNum != null ? { zone: zoneNum } : {}),
          ...(durationNum != null ? { duration_minutes: durationNum } : {}),
          ...(wattsNum != null ? { target_watts: wattsNum } : {}),
        });
      }
      navigate({ to: '/dashboard/schedule' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save session.');
    }
  }

  // Loading state for Edit mode while we wait for the schedule query.
  const isLoadingEdit = isEdit && !editingSession && (scheduleQuery.isPending || scheduleQuery.isFetching);
  const isSaving = isEdit ? patchSession.isPending : createSession.isPending;

  return (
    <main id="main" className={styles.page}>
      <Container width="narrow">
        <header className={styles.head}>
          <Eyebrow rule tone="accent">{isEdit ? 'Edit session' : 'New session'}</Eyebrow>
          <h1 className={styles.title}>
            {isEdit ? <>Edit your <em>session</em>.</> : <>Plan a <em>session</em>.</>}
          </h1>
          <p className={styles.lede}>
            {isEdit
              ? 'Change anything below — the calendar updates as soon as you save.'
              : "Block out a workout. It'll show up on your personal calendar alongside club rides you've RSVP'd to."}
          </p>
        </header>

        {isLoadingEdit ? (
          <p className={styles.lede}>Loading session…</p>
        ) : (
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
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : (isEdit ? 'Save changes' : 'Save session')}
            </Button>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => navigate({ to: '/dashboard/schedule' })}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        </form>
        )}
      </Container>
    </main>
  );
}
