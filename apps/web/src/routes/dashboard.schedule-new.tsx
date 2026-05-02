// Sprint 5 / v9.12.0 (#77) — Add personal training session page.
// v9.12.5: also handles ?id=N&range=YYYY-MM for edit mode (PATCH).
// Page-pattern (not modal) per Rule #17 lesson from v9.8.2 — modals on
// multi-platform are fragile and we want this flow rock-solid.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Container } from '../components/Container/Container';
import { Eyebrow } from '../components/Eyebrow/Eyebrow';
import { Button } from '../components/Button/Button';
import {
  useCreatePlannedSession,
  useMyScheduleByMonth,
  usePatchPlannedSession,
} from '../hooks/useClubs';
import { useQueryClient } from '@tanstack/react-query';
import { clubsApi } from '../lib/clubsApi';
import styles from './dashboard.schedule-new.module.css';

interface SchedNewSearch {
  /** v9.12.5 — when present, page enters Edit mode for that session id. */
  id?: number;
  /** v9.12.5 — month range (YYYY-MM) used to fetch the session via the
   *  cached `useMyScheduleByMonth` query. Drawer Edit-click computes this
   *  from the event's date so the lookup is cache-friendly. */
  range?: string;
  /** v10.10.0 — quick-add prefill from clicking an empty calendar cell.
   *  ISO date YYYY-MM-DD. */
  date?: string;
  /** v10.10.0 — quick-add prefill time HH:MM. Only set from Week/Day cells. */
  time?: string;
}

// v9.12.1 (#80) — flat path /dashboard/schedule-new so it doesn't nest
// under dashboard.schedule.tsx (which has no <Outlet />). Original path
// /dashboard/schedule/new failed silently — parent loaded, child Outlet
// missing, child never mounted.
export const Route = createFileRoute('/dashboard/schedule-new')({
  validateSearch: (search: Record<string, unknown>): SchedNewSearch => ({
    id: search.id != null && Number.isFinite(Number(search.id)) ? Number(search.id) : undefined,
    range: typeof search.range === 'string' && /^\d{4}-\d{2}$/.test(search.range) ? search.range : undefined,
    date: typeof search.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? search.date : undefined,
    time: typeof search.time === 'string' && /^\d{2}:\d{2}$/.test(search.time) ? search.time : undefined,
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
  const queryClient = useQueryClient();
  const { id: editId, range: editRange, date: prefillDate, time: prefillTime } = Route.useSearch();
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

  // v10.10.0 — quick-add prefill from calendar cell click.
  const initialDate = prefillDate ?? todayDate;
  const initialTime = prefillTime ?? '18:00';

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [zone, setZone] = useState<string>('');
  const [duration, setDuration] = useState('');
  const [watts, setWatts] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  // v10.10.0 — repeat-weekly toggle. Off in Edit mode (one row at a time).
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState('4');
  const [repeatProgress, setRepeatProgress] = useState<{ current: number; total: number } | null>(null);

  // v9.12.5 — Edit mode: populate form when the session arrives.
  // v10.11.0 — re-hydrate when the underlying session data changes
  // (e.g., refetchOnMount: 'always' brought fresh data after the user
  // saved earlier). Previously gated by `prefilled` which left the form
  // showing stale values from the first fetch — the founder bug
  // "edit again duration is still 0 hours" came from this. Trade-off: a
  // background refetch arriving while the user is mid-edit overrides
  // their unsaved changes; acceptable since refetch only fires on mount,
  // not on focus or interval (so this only happens on form-mount, not
  // mid-edit). Tracks the loaded session id in a ref so we don't keep
  // overwriting after the initial mount-driven hydration.
  const lastHydratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!editingSession) return;
    // Re-key on (id, updated_at) so a refetch with the same id but newer
    // data re-hydrates, while a stable read after hydration leaves the
    // form alone for in-progress edits.
    const hydrationKey = `${editingSession.id}:${editingSession.updated_at ?? 0}`;
    if (lastHydratedRef.current === hydrationKey) return;
    lastHydratedRef.current = hydrationKey;
    const dt = new Date(editingSession.session_date * 1000);
    setTitle(editingSession.title);
    setDate(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`);
    setTime(`${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`);
    setZone(editingSession.zone != null ? String(editingSession.zone) : '');
    setDuration(editingSession.duration_minutes != null ? String(editingSession.duration_minutes / 60) : '');
    setWatts(editingSession.target_watts != null ? String(editingSession.target_watts) : '');
    setDescription(editingSession.description ?? '');
  }, [editingSession]);

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
        // v10.10.0 — Repeat-weekly multi-session creation.
        // v10.10.2 — third attempt at making this reliable. Uses Promise
        // .allSettled so each iteration runs independently and we get a
        // clear success/failure breakdown. Per-iteration date math kept
        // simple (baseDateSec + i × 604800), no shared state across calls.
        // If any iteration fails, surface the count + error and don't
        // navigate so the user can retry.
        const repetitions = repeatWeekly
          ? Math.max(1, Math.min(12, Number(repeatWeeks) || 1))
          : 1;
        const baseDateSec = Math.floor(sessionMs / 1000);
        if (repetitions === 1) {
          await createSession.mutateAsync({
            title: trimmed,
            session_date: baseDateSec,
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(zoneNum != null ? { zone: zoneNum } : {}),
            ...(durationNum != null ? { duration_minutes: durationNum } : {}),
            ...(wattsNum != null ? { target_watts: wattsNum } : {}),
          });
        } else {
          setRepeatProgress({ current: 0, total: repetitions });
          // Build the request payloads up-front so each fetch sees a
          // distinct, fully-resolved object. Avoids any sharing of
          // mutable state across the in-flight requests.
          const payloads = Array.from({ length: repetitions }, (_, i) => ({
            title: trimmed,
            session_date: baseDateSec + i * 7 * 86400,
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(zoneNum != null ? { zone: zoneNum } : {}),
            ...(durationNum != null ? { duration_minutes: durationNum } : {}),
            ...(wattsNum != null ? { target_watts: wattsNum } : {}),
          }));
          // Fire all in parallel. Worker handles them in any order; the
          // sessions table has no UNIQUE constraint that would conflict.
          const results = await Promise.allSettled(
            payloads.map((p) => clubsApi.createSession(p)),
          );
          const successes = results.filter((r) => r.status === 'fulfilled').length;
          const failures = results.length - successes;
          // Always invalidate — if even one succeeded, the cache should
          // reflect it. Wait for invalidation so the navigation lands on
          // a fresh schedule view (some users complained about stale views).
          await queryClient.invalidateQueries({ queryKey: ['me', 'schedule'] });
          await queryClient.invalidateQueries({ queryKey: ['me', 'sessions'] });
          setRepeatProgress(null);
          if (successes === 0) {
            const firstErr = results.find((r) => r.status === 'rejected');
            const reason = firstErr && firstErr.status === 'rejected'
              ? (firstErr.reason instanceof Error ? firstErr.reason.message : String(firstErr.reason))
              : 'unknown';
            setError(`Couldn't save any sessions — ${reason}`);
            return;
          }
          if (failures > 0) {
            // Partial success — keep the user on this page so they can see
            // the message + retry the missing weeks if desired.
            setError(`Saved ${successes} of ${repetitions} sessions. ${failures} failed — refresh and try again.`);
            return;
          }
        }
      }
      navigate({ to: '/dashboard/schedule' });
    } catch (err) {
      setRepeatProgress(null);
      setError(err instanceof Error ? err.message : 'Could not save session.');
    }
  }

  // Loading state for Edit mode while we wait for the schedule query.
  const isLoadingEdit = isEdit && !editingSession && (scheduleQuery.isPending || scheduleQuery.isFetching);
  // v10.10.1 — also block during repeat-weekly direct-API loop.
  const isSaving = isEdit
    ? patchSession.isPending
    : createSession.isPending || repeatProgress != null;

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

          {/* v10.10.0 — Repeat-weekly toggle. Only visible in create mode
              (Edit operates on a single session). When checked, the form
              creates N sessions, one per week starting at the chosen date. */}
          {!isEdit && (
            <div className={styles.repeatBlock}>
              <label className={styles.repeatLabel}>
                <input
                  type="checkbox"
                  checked={repeatWeekly}
                  onChange={(e) => setRepeatWeekly(e.target.checked)}
                />
                <span>Repeat weekly</span>
              </label>
              {repeatWeekly && (
                <div className={styles.repeatControls}>
                  <label className={styles.fieldLabel} htmlFor="s-repeat-weeks">For</label>
                  <input
                    id="s-repeat-weeks"
                    className={styles.input}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={12}
                    value={repeatWeeks}
                    onChange={(e) => setRepeatWeeks(e.target.value)}
                    style={{ width: '5em' }}
                  />
                  <span className={styles.fieldHint}>weeks (1–12)</span>
                </div>
              )}
            </div>
          )}

          <p className={styles.formLegend}>* Required</p>

          {error && <div className={styles.error} role="alert">{error}</div>}

          <div className={styles.actions}>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSaving}
            >
              {repeatProgress
                ? `Saving session ${repeatProgress.current} of ${repeatProgress.total}…`
                : isSaving
                  ? 'Saving…'
                  : (isEdit ? 'Save changes' : repeatWeekly ? `Save ${repeatWeeks} sessions` : 'Save session')}
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
