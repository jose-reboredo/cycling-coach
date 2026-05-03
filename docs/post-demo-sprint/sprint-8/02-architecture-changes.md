# Sprint 8 — Architecture Changes (Shipped)

Status: **closed**. Snapshot.

## Schema

| Migration | Version | Change |
|---|---|---|
| `0010_rwgps_tokens.sql` | v10.6.0 | NEW table `rwgps_tokens(athlete_id PK, access_token, refresh_token, auth_token, rwgps_user_id, expires_at, created_at, updated_at)` + `idx_rwgps_tokens_user`. Server-side OAuth (no browser-side token exposure). |
| `0011_ai_plan_sessions.sql` | v10.8.0 | NEW table `ai_plan_sessions(id, athlete_id, athletes_target_event_id, week_offset, day_of_week, archetype, suggested_duration_min, suggested_zone, suggested_focus, generated_at, prompt_version, model_used)`. ALTER `planned_sessions` ADD `ai_plan_session_id` (FK to `ai_plan_sessions.id`, ON DELETE SET NULL) + `elevation_gained` + `surface` + `user_edited_at`. New indexes on athlete+week and on the link column. |

Cumulative `schema.sql` updated each time — though `idx_planned_sessions_ai_plan` from migration 0011 was missed on first cut (caught and fixed by Sprint 11's migration-discipline contract test).

## Endpoints (new)

### RWGPS OAuth (v10.6.0)
- `GET /authorize-rwgps` — initiates RWGPS OAuth handshake.
- `GET /callback-rwgps` — OAuth code exchange. Stores tokens server-side in `rwgps_tokens`. Redirects back to the picker.
- `GET /api/rwgps/status` — auth-gated; returns `{ connected, rwgps_user_id, expires_at }`.
- `POST /api/rwgps/disconnect` — auth-gated; deletes the token row.
- `GET /api/routes/rwgps-saved` — auth-gated; lists the user's RWGPS saved routes (filtered + ranked by training prefs).

### Route picker (v10.6.0)
- `GET /api/routes/saved` — Strava saved-routes proxy (existed earlier; this sprint added filter + ranking).

### Goal-driven AI plan (v10.8.0)
- `POST /api/plan/generate` — auth-gated; rate-limited 5 / 3600s per athlete. Reads goals from `goals` table; outputs `ai_plan_sessions` rows for the next 4 weeks.
- `GET /api/plan/current` — returns latest week's plan rows for the user.
- `POST /api/plan/schedule` — when a user clicks "+ Schedule" on an AI plan row, this endpoint creates a `planned_sessions` row pre-filled from the AI plan's archetype and links via `ai_plan_session_id`.

## Frontend

### New
- `apps/web/src/components/SessionRoutePicker/` (refactored heavily for three-tab; was monolithic).
- `apps/web/src/lib/routesApi.ts` (split out from inline drawer fetches).

### Modified
- `EventDetailDrawer.tsx` — embeds `SessionRoutePicker` with three tabs.
- `dashboard.train.tsx` — wires goal-driven plan generation; `+ Schedule` per row.

## Infra

- **New Worker secrets:**
  - `RWGPS_CLIENT_ID`
  - `RWGPS_CLIENT_SECRET`
  - `RWGPS_REDIRECT_URI`
  - `RWGPS_AUTH_TOKEN_ENCRYPTION_KEY` (for at-rest token encryption — actually shipped as plain in v10.6.0; encrypted-at-rest hardening is backlog).
- **No new third-party API beyond RWGPS itself.** ORS, Anthropic, Strava already integrated.
- **No CSP changes.**

## Observability

- New rate limits:
  - `rwgps-write` — 10 / 60s per athlete (disconnect endpoint).
  - `rwgps-read` — 30 / 60s per athlete.
  - `plan-gen` — 5 / 3600s per athlete (expensive Anthropic call).
  - `plan-schedule` — 30 / 60s per athlete.
- `safeLog` on RWGPS callback errors — surfaces token-exchange failures without leaking the auth_token.

## Smoke-check ladder (used for v10.6 → v10.8)

| Check | Surface |
|---|---|
| Footer reads target version | Every page |
| RWGPS Connect button → callback completes → "Connected" state | Route picker |
| Three tabs in route picker; each shows source-specific routes | Route picker |
| GPX download has correct route | Generated tab |
| Strava saved route opens in Strava app | Strava tab |
| RWGPS saved route opens in RWGPS app | RWGPS tab |
| `POST /api/plan/generate` with goal → returns `ai_plan_sessions` rows for 4 weeks | Train tab |
| Edit a session's duration → `user_edited_at` set; re-run plan → row not overwritten | Drawer + Train |

## Tech debt accrued

- RWGPS auth tokens stored in plain text in D1 (despite the secret name). Encrypted-at-rest is backlog.
- The "two cascade paths" risk crystallizes: `ai_plan_session_id` cascade now coexists with cancelled-events cache invalidation; later compounds with `recurring_group_id` (Sprint 10) and the AI-plan auto-regen webhook (Sprint 9).
- `SessionRoutePicker` is large (~700 lines after refactor). Reasonable for a complex 3-tab picker but watch for further bloat.
- `idx_planned_sessions_ai_plan` from migration 0011 missing from `schema.sql` cumulative — caught by Sprint 11's `migration-discipline.test.ts`.
