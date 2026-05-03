# Sprint 5 — Architecture Changes (Shipped)

Status: **closed**. This document is the post-sprint snapshot; it reflects what actually shipped, not what was planned.

## Schema

| Migration | Version | Change |
|---|---|---|
| `0006_club_events_lifecycle.sql` | v9.7.3 | Added 7 columns to `club_events`: `distance_km`, `expected_avg_speed_kmh`, `surface`, `start_point`, `route_strava_id`, `cancelled_at`, plus tightened FK on `created_by`. |
| `0007_club_events_duration.sql` | v9.12.2 (boundary into Sprint 6) | Added `duration_minutes` to `club_events`. |

Cumulative `schema.sql` updated in same commit per the v9.2.0 process rule.

## Endpoints (new + modified)

### New
- `GET /api/clubs/:id/events?range=YYYY-MM` — month-bounded event list for the Schedule tab; powers Month/Week/Day grids via client-side grouping (v9.7.0–v9.7.1).
- `PATCH /api/clubs/:id/events/:eventId` — event edit; allowlist-bound column updates (v9.9.0).
- `POST /api/clubs/:id/events/:eventId/cancel` — soft-delete via `cancelled_at` epoch (v9.9.0).
- `POST /api/clubs/:id/events/draft-description` — AI description draft (v9.7.3 / v9.8.0). Rate-limited 5/60s per athlete.
- `POST /api/routes/discover` — AI route discovery (v9.11.0). Rate-limited 10/3600s per athlete.
- `GET /api/me/schedule?range=YYYY-MM` — first cut of the personal scheduler aggregator (v9.11.0). Joins `club_events` (via membership) with future personal sessions surface.

### Modified
- All `/api/clubs/:id/events*` handlers now scope reads/writes by club_id + member-or-admin pre-check.
- All event reads include `cancelled_at` so the frontend can render cancelled state.

## Frontend

### New components
- `apps/web/src/components/Calendar/MonthCalendarGrid.tsx` (v9.7.0)
- `apps/web/src/components/Calendar/WeekCalendarGrid.tsx` (v9.7.1)
- `apps/web/src/components/Calendar/DayCalendarGrid.tsx` (v9.7.1)
- `apps/web/src/components/Calendar/EventDetailDrawer.tsx` (v9.7.1)
- `apps/web/src/components/Calendar/types.ts` (shared types — `CalendarEvent`, `CalendarView`)
- Line-icon library under `apps/web/src/design/icons/` (v9.7.2): `RideIcon`, `SocialIcon`, `RaceIcon`, `BikeIcon`, etc.

### New routes
- `/clubs/new` (v9.8.2) — page-route Create Club replacing the v9.8.0 modal that hit a stacking-context bug on iOS Safari (`#71`/`#72`).

### Reorganised
- `<TopNav />` and `<BottomNav />` unified into a single responsive nav contract (v9.7.2). `useViewport` hook drives the breakpoint; tabs auto-pick orientation.

## Infra

- **No new Worker secrets.** AI description and route discovery reuse `SYSTEM_ANTHROPIC_KEY` / per-user `ANTHROPIC_API_KEY` from Sprint 1.
- **No new third-party APIs.** Strava / Anthropic only.
- **CSP** — no changes this sprint; v9.5.x set the baseline.

## Observability

- Added `safeWarn` calls on every cancelled event filter so silently-hidden cancelled events log a count (helped catch a v9.11.0 cache-invalidation regression that was caught + fixed in Sprint 6).
- iOS Safari `viewport-fit=cover` + `env(safe-area-inset-bottom)` instrumentation in the BottomNav (v9.7.5) — no log emissions, but worth noting as a hardening surface.

## Smoke-check ladder (used for v9.7.x → v9.11.0)

| Check | Surface |
|---|---|
| Footer reads target version | Every page |
| `/api/clubs/:id/events?range` returns `cancelled_at` field | Network tab |
| Month/Week/Day toggle preserves selected date | Calendar |
| Drawer opens + closes without scroll-lock leak | Calendar |
| Create Club page route navigates back cleanly | iPhone Safari (PWA) |
| Cancelled events hidden by default + visible behind toggle | Schedule + Overview |

## Tech debt accrued

- v9.10.x slot intentionally skipped (experimental cuts). Future-self: do not reuse the slot — leave the gap as a marker.
- Drawer + grids share types but each grid duplicates date-math helpers. Refactor candidate: hoist `weekStart`, `eventDateToCalendar`, `groupByDay` into `Calendar/types.ts` (done partially — full hoist deferred).
- Personal scheduler aggregator (v9.11.0 cut) only reads club events. The full data layer lands in Sprint 6 (v9.12.0).
