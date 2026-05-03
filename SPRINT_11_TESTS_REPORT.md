# Sprint 11 — API contract regression suite

**Branch:** `sprint-11-tests` (worktree branch name preserved as-is — see "Notes" below)
**Cut against:** main @ v10.12.0
**Author:** Sprint 11 autonomous agent
**Run date:** 2026-05-03

---

## Headline numbers

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| Test files | 9 | 18 | +9 |
| Tests passing | 42 | 200 | **+158** |
| Tests skipped | 0 | 1 | +1 (intentional KNOWN_GAP) |
| `test:unit -- --run` wall-clock | 0.96s | 1.58s | +0.62s |
| `tsc -b` (typecheck) | clean | clean | — |

Target was +30; landed +158 because the static-scan pattern multiplies cheaply
across endpoint inventories and migration entities.

---

## Per-layer breakdown

### Layer A — static contract guards (94 tests across 4 files)

All cheap, all run in <10ms total.

#### `worker-authn-contract.test.ts` — 21 tests
Asserts every user-data handler invokes `resolveAthleteId(request)` BEFORE any
`db.prepare()` call. Coverage:
- All `/api/me/*` handlers (3+).
- All `/api/clubs/:id/*` handlers (8 — events list/create, edit, cancel,
  draft-description, overview, members, RSVP write/read, join).
- `/api/users/me/profile`, `/api/training-prefs`.
- All exported `handleX` functions in `src/routes/*.js` that touch the DB
  (`handlePlanGenerate`, `handlePlanCurrent`, `handlePlanSchedule`,
  `handleRwgpsRoutes`, `handleRwgpsStatus`, `handleRwgpsDisconnect`,
  `handleAuthorizeRwgps`, `handleCallbackRwgps`).
- `resolveAthleteId` itself — guards the missing-Authorization → 401
  short-circuit and the single `{ athleteId }` success-return shape.

How it works: parses `src/worker.js` as text, locates each `if (...) {`
handler block by braces, then asserts `resolveAthleteId(` appears before
the first `db.prepare(`.

#### `worker-authz-contract.test.ts` — 23 tests
Pins ownership-check discipline on owned-resource handlers. Coverage:
- `/api/me/sessions/:id` PATCH/POST cancel/uncancel (5 tests):
  - SELECT runs before UPDATE.
  - `existing.athlete_id !== authResult.athleteId` check exists.
  - Mismatch returns 404 (OWASP — don't leak existence).
  - Mismatch does NOT return 403.
  - Cascade UPDATE (`WHERE recurring_group_id`) is scoped by `athlete_id`.
  - Per-row UPDATE in the cascade fallback path is scoped by `id` AND
    `athlete_id` (defends against IDOR even with the prior 404 guard).
- `/api/clubs/:id/events/:eventId` PATCH and `/cancel` (8 tests, 4 per handler):
  - `isAdmin || isCreator` check exists.
  - Permission mismatch returns 403, member-or-event-missing returns 404
    (different leak posture from the sessions surface — membership has
    already been verified by the time the 403 fires).
  - SELECT runs before UPDATE.
- `/api/users/me/profile` UPDATE scopes by `athlete_id`.
- `GET /api/me/sessions` and `/api/me/schedule` (4 tests):
  - SELECT scopes by `authResult.athleteId`.
  - No `searchParams.get('athlete_id')` (smell — only legitimate athlete
    is the authenticated one).

#### `migration-discipline.test.ts` — 60 tests (1 skipped)
Walks every `migrations/*.sql` file, extracts every CREATE TABLE / CREATE
INDEX / ALTER TABLE ADD COLUMN, and asserts each is reflected in
`schema.sql`. Plus filename + numbering invariants.

**1 known gap** documented as `it.skip` with a comment pointing at
schema.sql line 320 (`users.preferred_surface` is intentionally noted as
ALTER-only in a schema.sql comment).

#### `worker-cache-contract.test.ts` — 8 tests (PRE-EXISTING, untouched)
The v10.11.3 baseline. Verified its `KNOWN_API_GET_PATHS` inventory still
matches the literal `===` GET pathnames in `src/worker.js` (8 paths today).
No new endpoints needed adding to that list.

### Layer B — pure-helper unit tests (55 tests across 5 files)

Direct `import` of exported helpers from `src/lib/*.js`. No D1, no fetch.

| File | Helper(s) | Tests |
|---|---|---:|
| `lib-polyline.test.ts` | `decodePolyline`, `encodePolyline` | 7 |
| `lib-gpx.test.ts` | `buildGpx` (and its XML-escape branch) | 8 |
| `lib-routeScoring.test.ts` | `scoreCandidate` (gates, weights, breakdown shape) | 10 |
| `lib-waypointGen.test.ts` | `generateLoopCandidates`, `makeRng` (determinism) | 10 |
| `lib-orsAdapter.test.ts` | `profileForCyclingType` | 4 |
| `worker-pure-helpers-contract.test.ts` | static-scan presence/shape for `redactSensitive`, `safeLog/Warn/Error`, `mapSessionRow`, `userOrigin`, `SECURITY_HEADERS`, `zoneLabelToInt`, `clamp`, `mondayOf`, `validateSession`, `ZONE_LABELS`, `SURFACE_LABELS` | 16 |

The `worker-pure-helpers-contract.test.ts` is hybrid (static-scan rather
than direct import) because the helpers live inline in `src/worker.js` /
`src/routes/aiPlan.js` and aren't exported. Hoisting them is a refactor
flagged for a future sprint; this test pins their presence + key shape so
a silent rename or signature change is caught at PR time.

### Layer C — endpoint shape via miniflare/wrangler-dev

**Skipped by design.** Per the brief: "ONLY if you can stand up wrangler
dev or miniflare cleanly in the test runner — many node-toolchain combos
hit Cloudflare-binding issues here. If it works in under 30 minutes, do
it; if it's flaky, drop Layer C entirely and document in the report.
Don't fight infra."

Decision: Layers A + B alone landed +158 tests (~5× target). Layer C
adds infra fragility in exchange for one round-trip behavior class
(network → handler → response) that the static guards already cover at
the source-text level. Better return on the next sprint where infra
setup can be its own task.

---

## Bugs caught during writing

### 1. Schema drift — `idx_planned_sessions_ai_plan` missing from `schema.sql`

**Severity:** Low (correctness/process discipline; not a runtime hazard
because production runs with all migrations applied, not from
`schema.sql`).

**Caught by:** the new `migration-discipline.test.ts` on its first run.

**Detail:** `migrations/0011_ai_plan_sessions.sql` line 62 creates
`idx_planned_sessions_ai_plan` on `planned_sessions(ai_plan_session_id)
WHERE ai_plan_session_id IS NOT NULL`, but the corresponding line was
missing from `schema.sql` (which only had `idx_planned_sessions_ai_report`
and `idx_planned_sessions_recurring_group` on the same table).

**Fix:** `schema.sql` updated in this branch — `CREATE INDEX
idx_planned_sessions_ai_plan` added with a comment crediting the test.
This is the kind of drift the v9.2.0 CONTRIBUTING.md rule was supposed to
prevent; the test now enforces the rule mechanically.

### 2. None other.

The authn / authz / cache contract scans found no real defects on main —
which is good news. v10.11.3 already centralised the cache fix at the
entry filter; v9.12.0+ has been disciplined about `resolveAthleteId`
ordering; v10.12.0's cascade UPDATE correctly scopes by `athlete_id`.

---

## What I deliberately did NOT cover (and why)

1. **Layer C — live worker round-trips.** See above. ~30-60 min of infra
   setup with high regression risk on the `wrangler dev` toolchain;
   incremental coverage value over Layer A is small for the time cost in
   a one-night run.

2. **SQL CHECK constraint / type / default parity in the migration
   discipline test.** The current test only asserts an entity (table /
   index / column) appears in `schema.sql` by name. Type drift,
   constraint drift, and DEFAULT drift are NOT caught. Adding a real SQL
   parser (e.g. `node-sql-parser`) would catch these, but the false-
   positive rate on D1's SQLite dialect is meaningful — out of scope for
   one night.

3. **`/admin/*` admin-secret discipline.** The handoff brief flagged
   `requireAdmin` as in-scope for the security branch (`sprint-11-security`),
   so I left it alone here to avoid two PRs touching the same code with
   different intent. If `sprint-11-security` doesn't land it, a follow-up
   one-shot test on `/admin/document-release` etc. is worth ~3 lines.

4. **CSP nonce + script-src strictness regression test.** Pinned
   `frame-ancestors 'none'`, `base-uri 'self'`, `unsafe-inline` only on
   `style-src`. Did NOT pin the `script-src` shape because v10.x is
   migrating to a nonce-based callback page (`cspWithScriptNonce` exists)
   and a strict literal pin would block that migration.

5. **Webhook-handler authz.** The Strava webhook handler is path-secret-
   gated (`/webhook/${env.STRAVA_WEBHOOK_PATH_SECRET}`), not bearer-token-
   gated, so the standard `resolveAthleteId` pattern doesn't apply. A
   dedicated webhook contract test belongs on the security branch.

6. **Idempotency & rate-limit retry-after header invariants.** Manually
   verified by reading; not pinned. ~5 tests' worth on next pass.

---

## Suggested next-sprint additions

1. **Hoist inline pure helpers** from `src/worker.js` and
   `src/routes/aiPlan.js` into `src/lib/dateHelpers.js` (mondayOf /
   addDays / isoDateToday) and `src/lib/zoneMath.js` (zoneLabelToInt /
   ZONE_LABELS). Replace `worker-pure-helpers-contract.test.ts`'s static-
   scan tests with direct import + behavior tests.

2. **Stand up Layer C** as its own dedicated task. Aim:
   - GET `/api/me/sessions` with no token → 401.
   - GET `/api/me/sessions` with valid token + seeded D1 → 200, no other
     athlete's rows in payload.
   - PATCH `/api/me/sessions/:foreign_id` with valid token → 404.
   - POST `/api/clubs/:other_club/events/:id/cancel` → 404 (membership
     gate).
   This is ~10 tests and would add the round-trip behavior class.

3. **SQL parser-based migration drift test.** Use `node-sql-parser` (or
   pg-mem-style fake D1) to parse migrations + schema.sql into AST, diff
   types/constraints/defaults. Catches type drift the current name-based
   test misses.

4. **Rate-limit contract.** Every write handler that calls
   `checkRateLimit` should return 429 with `Retry-After` on overage. A
   static scan can pin: every handler that calls `checkRateLimit` also
   has a `Retry-After:` header in its 429 branch.

5. **Idempotency invariants for `/cancel` and `/uncancel`.** Document
   "second call is a no-op" as a static-scan pattern: every soft-delete
   handler must check the existing state (`if (existing.cancelled_at)`)
   and short-circuit.

6. **CHANGELOG ↔ version.ts ↔ apps/web/package.json parity.** Three
   sources of truth for the version string; the v10.x lifecycle has
   shipped at least one mismatch. One static-scan test would catch it.

---

## Notes on branch + push

- Worktree-mode branch creation was sandboxed away from this agent
  (`git checkout -b sprint-11-tests` denied). The branch in this worktree
  is `worktree-agent-a8a4a2ca52cff1346`. Founder / orchestrator should
  rename or push as `sprint-11-tests` from the parent shell, e.g.:
  ```
  git -C apps/web/.. push origin worktree-agent-a8a4a2ca52cff1346:sprint-11-tests
  ```
  All commits on this branch are scoped to `apps/web/src/lib/__tests__/`
  + one `schema.sql` line for the drift fix; nothing else touched.
- Final `git push -u origin sprint-11-tests` was attempted and is logged
  if it succeeded; if blocked by sandbox, the founder should push from
  the parent shell.
