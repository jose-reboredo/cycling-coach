# Sprint 11 — Architecture Changes (Shipped at v10.13.0)

Status: **in flight**. Snapshot covers the v10.13.0 cut.

## Schema

No new migrations this sprint. The only schema delta is:
- `schema.sql` cumulative gets the missing `idx_planned_sessions_ai_plan` (from Migration 0011, never reflected in the cumulative file). Caught + fixed by the new `migration-discipline.test.ts` contract test.

The `migration-discipline.test.ts` (60 cases, 1 known skip for `users.preferred_surface`) now mechanically blocks any future drift between migrations and `schema.sql`.

## Endpoints (modified)

### Security: 5 UPDATE statements scoped (security branch)
All five UPDATEs in `src/worker.js` hardened from `WHERE id = ?` to `WHERE id = ? AND athlete_id = ?` (planned_sessions) or `WHERE id = ? AND club_id = ?` (club_events):
- `PATCH /api/clubs/:id/events/:eventId`
- `POST /api/clubs/:id/events/:eventId/cancel`
- `POST /api/me/sessions/:id/cancel`
- `POST /api/me/sessions/:id/uncancel`
- `PATCH /api/me/sessions/:id`

No behavior change for legitimate callers (the prior pre-checks remain). Defense-in-depth against any future regression that loosens the pre-check.

### Bugs: route-gen anchor gates (bugs branch)
- `POST /api/routes/generate` (`src/routes/routeGen.js`) — added `CENTROID_MAX_KM = 2.0` post-generation gate. Cache prefix bumped `routes:v4` → `routes:v5`.
- `GET /api/routes/saved` (Strava saved-routes proxy) — added `type=1` filter (drops Run/Hike); reads optional `?lat=&lng=` and rejects routes more than 50 km from anchor.
- New shared module `apps/web/src/lib/geoMath.ts` (haversine, decode, centroid).

**⚠️ Founder reported post-deploy that the user-visible problem persists. See `project_route-generation-status.md` and Sprint 12 (planned dedicated route-gen sprint).**

### Docs: `documentRelease()` upgrade (docs branch)
`src/worker.js` `documentRelease()` now detects `Migration NNNN…` and `BREAKING` patterns in CHANGELOG entries and renders them as Confluence warning callouts at the top of each per-release child page. Adds a Verification section.

## Frontend

### Tests added
22 test files now (was 9). 200 passing + 1 intentional skip (was 42). Files:
- `worker-authn-contract.test.ts` (21)
- `worker-authz-contract.test.ts` (9 — UPDATE WHERE shape, security branch)
- `worker-authz-coverage.test.ts` (23 — ownership-guard placement, tests branch — renamed at merge to coexist with the security file)
- `migration-discipline.test.ts` (60, 1 skip)
- `worker-pure-helpers-contract.test.ts` (16)
- `worker-route-bug1-contract.test.ts` (4)
- `worker-route-bug2-contract.test.ts` (4)
- `geoMath.test.ts` (17)
- `lib-polyline.test.ts` (7)
- `lib-gpx.test.ts` (8)
- `lib-routeScoring.test.ts` (10)
- `lib-waypointGen.test.ts` (10)
- `lib-orsAdapter.test.ts` (4)
- (existing: cache-contract, changelog-parser, auth, coachApi, useFocusTrap, useCoachHooks, featureFlags, sentinel)

### RWGPS Settings
No change this sprint — already shipped in v10.12.0 (Sprint 10 close).

### README full rewrite (docs branch)
167 → 829 lines. 6 Mermaid diagrams. Source-of-truth tables (Routes from `worker.js` literals, Components from filesystem, ERD from `schema.sql`).

### Confluence content upgrade (docs branch, in `src/docs.js`)
- Architecture page: ASCII → Mermaid flowchart.
- Data Model: 12 → 17 tables.
- Migrations table: 2 → 12 entries.
- New Runbook spec page (deploy / rollback / secrets / alarms / log-tailing / D1 recipes / incident checklist).
- IA proposal: `docs/confluence-information-architecture.md`.

## Infra

- No new Worker secrets.
- SW cache name bumped `cycling-coach-v10.12.0` → `cycling-coach-v10.13.0`.
- No CSP changes.
- No new third-party APIs.

## Observability

- 7 items in `SPRINT_11_BACKLOG.md` requiring real harness (fuzzing, OAuth-replay, dependency-audit CI, OAuth-callback per-IP rate limit, `/refresh` table-scan rate limit, encrypted-at-rest token storage, security review entry in CONTRIBUTING.md).

## Smoke-check ladder (post-v10.13.0)

| Check | Surface |
|---|---|
| `/version` returns `v10.13.0` | curl |
| `/api/me/schedule` headers contain `Cache-Control: private, no-store` | curl -I |
| Founder smoke-test the calendar mutation roundtrip (edit → save → reopen) | Drawer flow |
| Founder smoke-test the route picker (Zurich → routes near Zurich) | **⚠️ FAILED — deferred to Sprint 12** |
| Founder smoke-test the Strava saved-routes (Zurich → no Path of Gods) | **⚠️ FAILED — deferred to Sprint 12** |

## Tech debt accrued

- Route-generation surface remains broken despite v10.13.0 patches. **Treated as known-broken pending Sprint 12.**
- `src/worker.js` is 4441 lines. Continued shard extraction overdue (clubs CRUD ~700, planned sessions CRUD ~400, training prefs + profile ~150). Pattern started with `src/routes/aiPlan.js` etc.
- `src/docs.js` is 1916 lines. Storage XHTML in JS template strings is fragile. Refactor candidate: split per-page storage into `src/docs/<slug>.html`.
- 7 backlog items in `SPRINT_11_BACKLOG.md` need a real harness to address properly.
