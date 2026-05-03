# Sprint 7 — Architecture Changes (Shipped)

Status: **closed**. Snapshot.

## Schema

| Migration | Version | Change |
|---|---|---|
| `0009_planned_sessions_user_edited.sql` | (Sprint 7 boundary, fully landed Sprint 8) | Adds `user_edited_at INTEGER` to `planned_sessions` so AI auto-regen respects user edits. Initial rev landed in this sprint; matures in v10.8.0. |

No new tables this sprint. The route generation backend uses KV for caching, not D1.

## Endpoints (new)

- `POST /api/routes/generate` (v10.4.0) — body `{ start_address, distance_km, surface, difficulty, count }`. Pipeline: Nominatim geocode → ORS waypoint scaffold → 3–5 candidates → score (distance fit, elevation match, surface preference, low-overlap) → return top N. KV-cached on the prompt hash; rate-limited 10 / 3600s per athlete.

## Frontend

### Major restructure (v10.0.0)
- `apps/web/src/routes/dashboard.today.tsx` — today-only dossier (was the planning surface).
- `apps/web/src/routes/dashboard.train.tsx` — owns AI weekly plan + planning surface that used to live on Today.
- `apps/web/src/routes/dashboard.schedule.tsx` — calendar surface unchanged structurally but moves to its own route.
- `apps/web/src/components/TodayDossier/` — new component, renders today's events from any source.

### New components
- `apps/web/src/components/SessionPrefillModal/` (v10.2.0) — the "+ Schedule" prefill confirmation. Includes smarter duration estimation: when AI plan row lacks explicit duration, compute from distance × zone-pace.
- `apps/web/src/components/SessionRoutePicker/` (v10.5.0) — drawer-embedded route picker with address input + 3 route cards.
- `apps/web/src/components/StreakChip/` (v10.1.0) — consecutive-scheduled-days counter on Today.

### Layout
- v10.3.0 lifted salutation + sync chip + streak chip above the TopTabs to match the club view's information hierarchy.

## Infra

- **CSP changes (v10.5.1 + v10.5.2):**
  - v10.5.1 (attempt 1): added CSP headers to dynamic Worker responses via `withSecurityHeaders()`.
  - v10.5.2 (the actual fix): also applied to the static-asset `_headers` file. The earlier omission meant `/callback` (a static-asset HTML) had no CSP and ran inline scripts blocked by some Strava redirect chains.
  - Pattern from this sprint: **two surfaces (Worker dynamic + static-asset `_headers`) need CSP coverage.**

- **New rate limit:** `routes-gen` — 10 / 3600s per athlete (`src/routes/routeGen.js`).

- **No new third-party API.** Nominatim (geocoding) + ORS (route scaffold + routing) — both already used in earlier sprints' AI route discovery.

## Observability

- KV cache hit/miss logged on `routes-gen` via `safeLog` (no PII; just keys).
- v10.5.3 fix (route generator returning 1 instead of 3) had no test catching it; led to invention of `feedback_pre-deploy-verification.md`.

## Smoke-check ladder (used for v10.x)

| Check | Surface |
|---|---|
| Footer reads target version | Every page |
| Today renders today-only dossier (no planning) | Today tab |
| Train renders AI weekly plan with per-day "+ Schedule" | Train tab |
| Click "+ Schedule" → prefill modal opens with the right defaults | Train tab |
| Save prefill modal → session appears on calendar | Schedule tab |
| Open drawer → enter "Bahnhofstrasse Zürich" → get 3 ranked routes | Drawer |
| GPX download + Strava handoff link present | Drawer |
| `/callback` CSP doesn't block inline scripts | OAuth flow |

## Tech debt accrued

- `EventDetailDrawer` is now ~30kB gzipped. The route picker is a fat dependency for a drawer used many ways.
- Four release attempts on CSP/routes (v10.5.1 → v10.5.4). Should have a single CSP test that exercises both surfaces (Worker + static).
- Route generator scoring has free constants (proximity gate at 45% of target distance, etc.). No test pins these. Bug 1 in Sprint 11 traces back to under-tested gates.
- The "salutation styling" trip (v10.3.0 polish + v10.5.0 alignment) suggests the layout shell doesn't have a single shared header component. Carry-forward.
