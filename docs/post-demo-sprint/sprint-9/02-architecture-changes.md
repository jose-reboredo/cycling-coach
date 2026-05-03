# Sprint 9 — Architecture Changes (Shipped)

Status: **closed**. Snapshot.

## Schema

| Migration | Version | Change |
|---|---|---|
| `0012_strava_tokens.sql` | v10.9.0 | NEW table `strava_tokens(athlete_id PK, access_token, refresh_token, expires_at, scope, created_at, updated_at)`. Mirrors the `rwgps_tokens` shape from Migration 0010. ALTER `users` ADD COLUMN `preferred_surface TEXT` (intentional ALTER-only — known gap in `schema.sql`, documented as a 1-line skip in Sprint 11's migration-discipline test). |

## Endpoints (new + modified)

### New
- `POST /webhook/<STRAVA_WEBHOOK_PATH_SECRET>` — Strava activity webhook. Triggers AI plan auto-regen for the affected athlete. (Already existed in earlier sprints for activity ingestion; this sprint extended it to fire `regeneratePlanForAthlete()` when applicable.)

### Modified
- `GET /api/auth/strava-status` — auth-gated; reports server-side connection status (replaces the prior browser-only check).
- `POST /refresh` — server-side refresh-token swap; the browser never sees the refresh_token after this.
- `POST /api/plan/generate` — extended to accept `regen_reason` (webhook | user-trigger) and to honour `user_edited_at` per row when cascading.

## Frontend

### Modified
- `apps/web/src/lib/auth.ts` — short-lived access_token only in localStorage; refresh round-trips to `/refresh` server-side.
- `apps/web/src/components/Calendar/WeekCalendarGrid.tsx` + `DayCalendarGrid.tsx` — empty hour-slot click handler (`onCellClick`) wires into `dashboard.schedule-new` route with `?dateStr=...&timeStr=...` prefill.
- `apps/web/src/routes/dashboard.schedule-new.tsx` — repeat-weekly toggle + count input.
- `apps/web/src/components/SessionRoutePicker/SessionRoutePicker.tsx` — match-reason chips on each route card.

### New
- `apps/web/src/lib/geocode.ts` (extended) — diacritic-tolerant geocoding (NFD normalise → strip combining marks → forward to Nominatim).

## Infra

- **No new Worker secrets.** Strava client_id/secret already existed.
- **Webhook subscription.** `STRAVA_VERIFY_TOKEN` was already configured. Webhook delivery now triggers regen, not just activity ingestion.
- **Rate limit on `/refresh` revisited** (no per-user limit; bounded by `LIKE` pre-check on `credentials_json`). Sprint 11 audit later flags this as LOW (table-scan soft-DoS).

## Observability

- `safeWarn` on every `regeneratePlanForAthlete()` call with reason + athlete_id (no PII in webhook payload anyway).
- `safeWarn` count on cascade-skipped rows (where `user_edited_at IS NOT NULL`) so we can verify the lock is firing.

## Smoke-check ladder (used for v10.9 → v10.10)

| Check | Surface |
|---|---|
| Footer reads target version | Every page |
| `GET /api/auth/strava-status` returns `connected: true` for a logged-in user | Profile / You |
| Browser localStorage contains short-lived access_token only (no refresh_token) | DevTools |
| Riding (or simulated webhook hit) triggers regen visible on Train tab | Train tab |
| Manually edited session not overwritten on regen | Drawer flow |
| Clicking empty 9:00 slot on Tuesday opens schedule-new prefilled | Calendar |
| Repeat-weekly with count=4 creates 4 sibling rows | Schedule |
| Route card chips show distance / elevation / surface match reasons | Drawer |

## Tech debt accrued

- **Webhook regen + user_edited_at + cascade-by-ai_plan_session_id forms a third cascade path** through `planned_sessions`. Sprint 10's `recurring_group_id` becomes the fourth. The cascade-clarity backlog grew here.
- **Repeat-weekly v1 → v3 across 2 hotfixes**: v10.10.0 created sibling rows but didn't share an id; founder asked for "edit all upcoming" later (v10.12.0 introduces `recurring_group_id`). The original v10.10.0 design was incomplete.
- **`useCancelClubEvent` cache invalidation gap.** v10.10.3 hotfix added invalidation but didn't centralise the pattern across personal + club cancel hooks. Same pattern lives in two places.
- **Hotfix-cluster signal**: 3 hotfixes on the same release without a structural review was the open-loop signal that Sprint 10 then closed.
