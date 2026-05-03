# Sprint 6 — Architecture Changes (Shipped)

Status: **closed**. Snapshot.

## Schema

| Migration | Version | Change |
|---|---|---|
| `0008_planned_sessions.sql` | v9.12.0 | NEW table `planned_sessions(id, athlete_id, session_date, title, description, zone, duration_minutes, target_watts, source, ai_report_id, completed_at, cancelled_at, created_at, updated_at)` + index `idx_planned_sessions_athlete_date(athlete_id, session_date)` + partial index `idx_planned_sessions_ai_report(ai_report_id) WHERE ai_report_id IS NOT NULL`. Cumulative `schema.sql` updated. |
| `0007_club_events_duration.sql` (closed-out) | v9.12.2 | `club_events.duration_minutes` (Sprint 5 boundary; finished here). |

## Endpoints (new)

5 endpoints land in v9.12.0 plus expansion through v9.12.x:

- `GET /api/me/sessions?range=YYYY-MM` — list personal sessions for the month, scoped by `athlete_id` from token.
- `POST /api/me/sessions` — create a planned session. Allowlist-bound columns. Zone validated 1..7. Duration validated 0..600 min.
- `PATCH /api/me/sessions/:id` — edit. Pre-check ownership via SELECT then `WHERE id = ?` (Sprint 11 hardens to `WHERE id = ? AND athlete_id = ?`).
- `POST /api/me/sessions/:id/cancel` — soft-delete via `cancelled_at`.
- `POST /api/me/sessions/:id/uncancel` — restore.

The aggregator from Sprint 5 (`GET /api/me/schedule?range=YYYY-MM`) now returns both `planned_sessions` and `club_events` in one payload; client groups by day.

## Frontend

### New routes
- `/dashboard/schedule-new` (v9.12.0) — Add Session form.

### New components
- `apps/web/src/components/SessionPrefillModal/` (v9.12.5) — used by the AI brief → schedule bridge.
- `apps/web/src/components/SchedulePreview/` (v9.12.6) — marketing landing visual; later mirrored in-app (v9.12.7).
- `apps/web/src/components/SessionIcon/` (v9.12.5) — replaces emojis with line icon.

### CalendarEvent type extensions
- `is_personal: boolean` — discriminator for personal vs club (drives RSVP-chip hide on Day grid + Drawer).
- `zone: number | null` — Coggan 1..7 for pill colour.
- `completed_at: number | null` — drives the "✓ Completed on …" banner.

### Cycling-canon time units
- `formatDuration(mins) → "1.5h" | "0.75h"` etc. (v9.12.3, in `Calendar/types.ts`). 1.5h = 90 min; 0.5h-aligned values render cleanly; non-aligned fall back to two-decimal precision.

### Calendar timezone fix (v9.12.4)
Eight call sites switched from `getUTC*` to local accessors:
- `eventDateToCalendar()` — for grouping events under the right local day.
- `formatHHMM()` — drawer + pill time chip.
- `Day grid` `dt.getHours()`/`getMinutes()` — for vertical placement.
- `Week grid` same.
- `todayUTC()` (kept the name for call-site stability — body uses local now; v9.12.4 inline-comment documents this).
- `Month grid` cell highlight.

DB stays UTC. Conversion is read-side only.

## Infra

- No new Worker secrets.
- No new third-party APIs.
- KV / D1 / CSP unchanged.

## Observability

- New rate limit: `me-sessions-write` — 30/60s per athlete on POST/PATCH/cancel/uncancel.
- `safeWarn` on cancel-uncancel paths to track soft-delete activity (no PII).

## Smoke-check ladder (used for v9.12.x)

| Check | Surface |
|---|---|
| Footer reads target version | Every page |
| `POST /api/me/sessions` with valid body returns 201 + the row | `/dashboard/schedule-new` |
| Calendar pill renders at correct local time | Week / Day grids |
| Edit duration → reopen drawer → new value | Drawer flow |
| Mark done → banner replaces action buttons | Drawer |
| AI brief "+ Add to schedule" navigates with prefill state | Train tab |
| Marketing landing SchedulePreview matches in-app pill style | Landing + Calendar |

## Tech debt accrued

- `EventDetailDrawer` discriminator now reads `e.is_personal` AND uses negative `id` as soft-discriminator (mappers convention from v9.12.4). The flag is the source of truth but the negative-id convention persisted; pick one in a future cleanup.
- `useCancelClubEvent` and `useCancelPlannedSession` are independent hooks but invalidate similar query keys. Consolidating them came up in Sprint 9–10 (see `feedback_pre-deploy-verification.md`); not done.
- The "two cascade paths" risk emerged here: AI plan link via `ai_report_id` was scaffolded but the cascade was simple. Sprint 7 expanded it (`ai_plan_session_id` + auto-regen) and Sprint 10's `recurring_group_id` added a second cascade vector. The architecture deserves consolidation.
