# Architecture Changes — Post-Demo Sprint
**Author:** Architect — Role 3 (Opus for §A, §B-design, §D, §E; Sonnet for §B-SQL, §C — see notes)
**Date:** 2026-04-30
**Inputs:** `01-business-requirements.md`, `02-ux-design-specs.md`
**Issues addressed:** #47–#53
**Product baseline:** v9.2.5

---

## §A. Route Data Source Evaluation (#47, IR-1) — judgment-heavy, Opus

The 5 candidate sources, scored on the dimensions that matter for this product (Workers compatibility, cost at our scale, geo coverage, surface metadata, integration time):

| Source | Workers-compatible | Cost (free tier) | Geo coverage | Surface metadata | Routes are real GPX? | Integration |
|---|---|---|---|---|---|---|
| **Komoot API** | ✅ HTTPS REST | Partner program required for commercial use; ad-hoc access gated | Global (Europe-strong) | ✅ paved / gravel / unpaved | ✅ | M-L · 16-30h, blocked on partnership approval |
| **OSM + Overpass** | ✅ HTTPS REST | Free, no key | Global, varies by mapper density | Partial — `surface=` tag coverage uneven; cycle relations more reliable | Implicitly via OSM ways; need to assemble | L · 30-40h (own ranking + caching layer) |
| **RideWithGPS API** | ✅ | Commercial partnership required | Global | ✅ | ✅ | Same partnership-blocker as Komoot |
| **Claude-generated** | ✅ (already integrated) | $0.01-0.03 per generation | Anywhere Claude knows | Inferred only — not authoritative | ❌ — narrative only, no GPX | S · 4-8h |
| **Strava saved routes** | ✅ (existing `/api/*` proxy) | Free (within Strava rate limits) | User's own saved routes only | Per-route attribute when set | ✅ | XS · 2-4h |

### Recommended: Hybrid — Strava saved routes (Phase 1) + Claude ranking with stub data (Phase 2 spike) + Komoot partnership (Phase 3)

**Phase 1 (this sprint):** Replace the hardcoded list with the user's **own Strava saved routes**, filtered client-side by surface (where Strava has the attribute) + distance. Solves the "Madrid vs Zurich" bug immediately because the routes ARE the user's; no geo mismatch possible. Surface filter degrades gracefully when metadata absent (show "Approximate"). Effort: ~6h.

**Phase 2 (next sprint, spike):** When user has zero saved routes (Persona C, new users), add "Discover routes near you" CTA that sends `{ location, surface, distance }` to a Worker endpoint that calls Claude with a structured prompt, returns 3-5 narrative route suggestions with start address + target distance + elevation hint. Output is presented as **briefs**, not GPX — UI sends user to Komoot/RideWithGPS to plan the actual GPX. Honest about the limitation. Effort: ~10h spike.

**Phase 3 (deferred, partnership-gated):** If Komoot partnership lands, replace Phase 2 narrative with real route data. Designed so the UI doesn't change shape between phases — we only swap the data source.

**Why not OSM/Overpass directly?** Overpass query latency (~500ms-2s p95) plus our own ranking layer is genuine engineering — 30-40h to build, more to operate. Phase 1+2 ships in <16h and produces a working product. OSM stays as a future option if partnerships fall through.

**Rejected: Strava-only.** The original product appeared to assume Strava had route recommendations. It doesn't — only saved routes for the authenticated user. That's the entire root cause of #47.

**Rejected: Pure Claude generation.** Routes that don't exist as GPX are a UX dead end — user can't follow them. Use Claude as a scoring layer on top of real data, not as the data source itself.

---

## §B. Schema Design (#47, #49, #50, #52) — judgment-heavy, Opus

The BA flagged 4 schema-change buckets (SC-1 to SC-4). Re-evaluating each against the existing schema (12 tables, see `schema.sql` + `db/README.md`):

### B.1 Annual goal — REUSE existing `goals` table, do NOT add columns to `users`

The `goals` table already has: `goal_type`, `target_value`, `target_unit`, `target_date`, `event_name`, `event_distance_km`, `event_priority`. This covers BOTH "named event" goals AND "ride X km by Dec 31" goals — just use `goal_type='annual_km'` for the latter and leave event fields null. Adding `annual_goal_km` to `users` (BA SC-1) creates duplicate state. **No migration for SC-1.** Changes are application-level: extend the goal-edit UI to support `goal_type='annual_km'` as a third option (alongside the existing race types).

### B.2 Personal profile fields — sync from Strava, do NOT prompt user manually

The BA proposed asking the user to enter `dob`, `gender`, `city`, `country` (SC-2). Strava's `/athlete` endpoint already returns `sex` (M/F/etc.), `city`, `country`, `firstname`, `lastname`, `profile` (photo URL). We already sync some of these via `persistUserAndTokens`. **The right move is to extend that sync to write the additional fields**, not to add a manual-entry UI.

`dob` is the only field Strava doesn't expose. Persona research suggests dob isn't load-bearing for any v9.3 feature — defer. **Migration 0003 needed: add `sex`, `country` to `users`** (`city` already present per schema.sql §USERS). `firstname`, `lastname`, `profile_url` already there.

### B.3 Anthropic API key — KEEP localStorage, do NOT add D1 storage

The BA flagged SC-3 + IR-2 (encryption at rest). The existing pattern is BYOK in localStorage:
- Personal Anthropic key: `cc_anthropicKey` localStorage (per `useApiKey` hook)
- Club Anthropic key: `cc_clubAiKey:${clubId}` localStorage (per `<ClubCoachCard />` v9.1.2)

This pattern was an **explicit security decision** documented in SECURITY.md — tokens never leave the browser. Adding D1 storage now would require:
- A migration with `anthropic_api_key_enc` + `iv` columns
- A Workers Secret as the AES cipher key
- Encrypt-on-write + decrypt-on-read paths in every endpoint that uses it
- Audit + threat model update

**For zero security upside** — the user's browser is already trusted with the key. **No migration for SC-3.** The "Place to add Anthropic API key" in FB-6 is a UI surface in the You tab that writes to existing localStorage. Reuses the existing `useApiKey` hook. No new D1 columns.

If we ever go server-side (e.g., to support cross-device sync), revisit then with an explicit ADR.

### B.4 Route preferences — extend existing `training_prefs`, do NOT create new table

`training_prefs` already exists with `athlete_id` PK + `surface_pref`, `start_address`, `sessions_per_week`. BA's SC-4 proposed a new `route_preferences` table for surface + home region — but the columns it'd hold already overlap with `training_prefs`. **Migration 0004 needed: add `home_region`, `preferred_distance_km`, `preferred_difficulty` to `training_prefs`.** No new table.

### Net schema changes for this sprint

| Migration | Adds | Triggered by |
|---|---|---|
| 0003 | `users.sex`, `users.country` | FB-6 (profile expansion via Strava sync) |
| 0004 | `training_prefs.home_region`, `training_prefs.preferred_distance_km`, `training_prefs.preferred_difficulty` | FB-1 (route preferences for filter defaults) |

**Migration SQL fleshed out in §B-SQL below (Sonnet writes that — structured output).**

---

## §D. Mobile Tab Architecture (#51, AC-3) — judgment-heavy, Opus

UX spec defines 4 tabs (Today / Train / Rides / You). BA flagged AC-3: the current Tanstack Router tree is flat/desktop-centric. Two architecture options:

| | Nested Tanstack routes | Client-side tab state |
|---|---|---|
| Browser back/forward between tabs | ✅ | ❌ |
| Deep-linkable URLs (e.g., share `/dashboard/train`) | ✅ | ❌ |
| Per-tab loading state + lazy-loaded code | ✅ (auto-code-splitting) | All-or-nothing |
| Refactor cost | M — split Dashboard.tsx into 4 route files + layout shell | S — add tab state + conditional render |
| Aligns with UX spec's "page-per-tab" mental model | ✅ | ⚠ feels like one page with tabs |
| Test surface | Each route testable independently | Single component, all paths inline |

### Decision: nested routes

```
apps/web/src/routes/
  __root.tsx              (existing — wraps with AppContextProvider + AppFooter)
  dashboard/
    __layout.tsx          (NEW — bottom tab bar on mobile, sidebar wrap on desktop)
    today.tsx             (NEW — wraps the existing greeting + KPI + workout + forecast section)
    train.tsx             (NEW — wraps weekly plan + route picker + AI Coach)
    rides.tsx             (NEW — wraps recent rides + filter bar)
    you.tsx               (NEW — wraps profile sections per UX §E)
```

`/dashboard` redirects to `/dashboard/today` (Tanstack `beforeLoad` hook).

Bottom tab bar (`<BottomNav>`) is rendered by `__layout.tsx`. Already exists for the in-page section nav (You/Train/Routes/Today markers); rebind its 4 items to route navigation, scope to mobile via `@media (max-width: 1024px)`. Above 1024px, the existing single-page sidebar layout is restored from `Dashboard.tsx` content distributed across the 4 route files.

### Implementation notes

- **Existing `Dashboard.tsx` is split**, not deleted — its content moves into the 4 route files. Hooks (`useRides`, `useAppContext`, `useGoalEvent`, etc.) get called in the route files that need them, NOT in the layout (avoids re-fetching on every tab change).
- **Shared cross-tab UI** (TopBar, ContextSwitcher, BottomNav) lives in `dashboard/__layout.tsx`. Each route renders its own main content via `<Outlet />`.
- **Auth gate** (the `if (!tokens && !isDemo) return <ConnectScreen />`) stays in the layout — runs once before any tab loads.
- **Tanstack Query cache shared across tabs** by default — switching tabs doesn't refetch already-cached data (e.g., `useRides` data viewed on Today is reused on Rides).

### Risks

- **Refactor blast radius** — Dashboard.tsx is ~700 lines. Splitting it across 4 files needs careful test coverage of edge cases (loading state, error state, demo mode `?demo=1` flag). Recommended: ship behind a `cc_tabsEnabled` feature flag (defaults true on mobile, false on desktop until verified) similar to `cc_clubsEnabled`.
- **Existing `/dashboard?demo=1` URL** — preserve via the layout reading the search param and propagating to children. No regression on the demo viewport.
- **Existing e2e tests** at `/dashboard?demo=1` — likely break on the redirect to `/today`. Update tests in the same PR; keep `?demo=1` working at the new path.

Estimated effort: 16-24h (M-L). Spans router config + 4 new route files + layout shell + test fixups.

---

## §E. AI Forecast Model (#49, IR-3) — judgment-heavy, Opus

UX §B specifies: <30 days = empty state, 30-55 days = client-side linear, ≥56 days = AI-refined. The architectural questions:

### E.1 Where does the AI call run?

Options:
1. **Client → Anthropic directly** (BYOK). Same pattern as `/coach`. Cheapest, but cost is on the user.
2. **Client → Worker → Anthropic** (system-paid). Adds latency + auth gate, costs us.
3. **Worker on Strava webhook → Anthropic, cache result in KV** (system-paid, async). Cleanest UX — forecast pre-computed, dashboard reads cached value.

### Recommended: option 3 (Worker on sync, KV cache)

The forecast doesn't change minute-by-minute. It changes when new activities sync. Strava webhook fires on activity creation; we already handle the webhook (`/webhook/<secret>` v8.5.2). On webhook event:
1. Worker pulls fresh activities for the affected athlete.
2. Computes linear projection (cheap).
3. If ≥ 56 days of data, calls Anthropic with the linear projection + weekly variance to refine.
4. Writes result to KV: `forecast:${athlete_id}` → `{ projected_km, narrative, computed_at }`. TTL 7 days (regenerated on next webhook anyway).

Frontend: `GET /api/forecast` reads from KV, returns the cached value. No latency on dashboard load. No per-page-load Anthropic call. No BYOK key required — system-paid, ~$0.001 per refinement (Haiku model with ~300 token context).

### E.2 Why system-paid (not BYOK) for this specific call?

- Cost is tiny — Haiku, 300 tokens, ~$0.001 per athlete per sync. At our scale (<100 users near-term), <$5/month total.
- BYOK is friction for Persona C ("casual commuter") — they may never set up a key but should still see a forecast.
- Different from `/coach` (the weekly plan generator), which is much higher cost per call (~$0.05 with Sonnet, larger context). BYOK is appropriate there. Two-tier model.

### E.3 Anthropic prompt template (Haiku)

```
You forecast cycling year-end distance. Given:
- YTD km: {ytd_km}
- Days elapsed: {days_elapsed}
- Days remaining: {days_remaining}
- Weekly variance (std dev of last 8 weeks' km): {variance}
- Goal event date (optional): {goal_date}
- Goal target km (optional): {goal_target}

Output JSON only:
{ "projected_km": <number>, "narrative": "<one sentence, ~120 chars>", "on_track_for_goal": <boolean | null> }
```

### E.4 Empty state + fallback ladder

| Days of data | Source | Compute time | Cache | Fallback if errors |
|---|---|---|---|---|
| < 30 | None | — | — | UI shows "Need 30 days of rides to forecast" |
| 30–55 | Linear formula client-side | <10ms | None — recomputed on each render | Ride count comes from existing `useRides` hook |
| ≥ 56 | Worker on webhook → Anthropic Haiku | ~500ms (background) | KV `forecast:${athlete_id}` 7-day TTL | If Anthropic 5xx, fall back to linear projection (Worker writes a flag `ai_refined: false` to KV — UI can show subtle indicator) |

### E.5 New worker code surface

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/forecast` | GET | Strava bearer | Reads `forecast:${athlete_id}` from KV; returns `{ projected_km, narrative, on_track_for_goal, computed_at, ai_refined }` |
| Existing `/webhook/<secret>` | POST | Strava webhook signature | Extended to recompute forecast for the affected athlete after activity sync |

No new KV namespace — reuse `DOCS_KV` (already exists, used for rate-limit + Confluence cache). Add namespace prefix `forecast:` to keep keys partitioned.

Estimated effort: 8-12h (M). Webhook hook + Anthropic prompt + KV write + GET endpoint + frontend hook + UI.

---

## §C. API Endpoint Specs

Auth on all endpoints: `Authorization: Bearer <strava_access_token>` — identity resolved via `resolveAthleteId` (Strava `/athlete` round-trip). All responses include `corsHeaders` + `Content-Type: application/json`. OPTIONS pre-flight handled globally.

---

### C.1 `GET /api/forecast`

| Field | Value |
|---|---|
| Method | GET |
| Path | `/api/forecast` |
| Auth | Strava bearer → `resolveAthleteId` |
| Query params | none |
| Response 200 | `{ projected_km: number, narrative: string, on_track_for_goal: boolean\|null, computed_at: string (ISO-8601), ai_refined: boolean }` |
| Response 404 | `{ error: 'forecast not yet computed' }` — KV key absent; UI falls back to client-side linear |
| Response 401 | `{ error: 'unauthorized' }` |
| Response 500 | `{ error: 'internal error' }` |
| Rate-limit | none (KV read only; no upstream call) |
| Implementation notes | Implements §E.5. Reads `forecast:${athlete_id}` from `DOCS_KV`. Returns 404 when key is absent (covers <30 days and <56 days cases where webhook hasn't written yet). Does NOT call Anthropic — forecast is pre-computed by the webhook handler on activity sync. |

---

### C.2 `GET /api/routes/saved`

| Field | Value |
|---|---|
| Method | GET |
| Path | `/api/routes/saved` |
| Auth | Strava bearer → `resolveAthleteId` (token reused to proxy Strava) |
| Query params | `surface` (optional): `paved\|gravel\|any` — default `any`; `distance` (optional): integer km, ±20% band; `difficulty` (optional): `flat\|rolling\|hilly` (maps to elevation gain per km bands: <5 / 5-15 / >15 m/km) |
| Response 200 | `{ routes: [{ id, name, distance_m, elevation_gain_m, surface, map_url, strava_url }] }` — array may be empty; `surface` is `'unknown'` when Strava attribute absent |
| Response 401 | `{ error: 'unauthorized' }` |
| Response 502 | `{ error: 'strava unavailable' }` — Strava API non-2xx |
| Response 500 | `{ error: 'internal error' }` |
| Rate-limit | Inherits Strava rate limits (1000 req/15 min per token); no additional Worker-side throttle |
| Implementation notes | Implements §A Phase 1. Proxies `GET https://www.strava.com/api/v3/athlete/routes?per_page=200` using the caller's access token (from `resolveAthleteId`). Filters client-side in the Worker before returning. `difficulty` filter applied on `total_elevation_gain / distance` ratio. `surface` filter degrades gracefully — if Strava attribute absent, route is included regardless of filter and tagged `surface: 'unknown'`. |

---

### C.3 `POST /api/routes/discover`

| Field | Value |
|---|---|
| Method | POST |
| Path | `/api/routes/discover` |
| Auth | Strava bearer → `resolveAthleteId` |
| Request body | `{ location: string (required), surface: 'paved'\|'gravel'\|'any' (required), distance_km: number (required, 1–500), difficulty: 'flat'\|'rolling'\|'hilly' (required) }` |
| Response 200 | `{ routes: [{ name: string, narrative: string, start_address: string, target_distance_km: number, estimated_elevation_m: number }], generated_at: string (ISO-8601) }` — 3–5 items |
| Response 400 | `{ error: 'missing required field: <field>' }` or `{ error: 'distance_km must be between 1 and 500' }` |
| Response 401 | `{ error: 'unauthorized' }` |
| Response 429 | `{ error: 'rate-limited', retry_after_seconds: number }` |
| Response 503 | `{ error: 'AI service unavailable' }` — Anthropic 5xx |
| Response 500 | `{ error: 'internal error' }` |
| Rate-limit | 10 calls / hour / athlete. KV key: `discover-rl:${athlete_id}` in `DOCS_KV`. TTL 3600s, counter incremented per call. Matches v8.5.2 admin-rate-limit pattern (`rateLimit` helper). |
| Implementation notes | Implements §A Phase 2 spike. System-paid: uses `ANTHROPIC_API_KEY` env secret + Haiku model. Prompt instructs Claude to return 3–5 cycling route briefs as a JSON array — narratives only, no GPX. Output is explicitly framed as "narrative briefs" in the response (not real routes). `location`, `surface`, `distance_km`, `difficulty` are interpolated into a structured prompt. Worker validates response JSON before forwarding to client; falls back to `503` if Anthropic returns malformed output. |

---

### C.4 `GET /api/athlete` (extended — no code change)

| Field | Value |
|---|---|
| Method | GET |
| Path | `/api/athlete` |
| Auth | Strava bearer (existing proxy — no `resolveAthleteId` needed; token forwarded directly) |
| Query params | none |
| Response 200 | Strava `/athlete` passthrough. After migration 0003 + `persistUserAndTokens` extended: `sex` and `country` are stored in D1 `users` but the endpoint returns whatever Strava returns — these fields are already present in the Strava response. No Worker code change. |
| Breaking change | None — additive fields only. |
| Implementation notes | Implements §B.2. The Worker's existing Strava proxy passes through all Strava fields including `sex` and `country`. The persistence side-effect (`persistUserAndTokens`) is extended separately to write the new D1 columns — that is NOT a change to the endpoint handler itself. Document this as a persistence-path change, not an endpoint change. |

---

### C.5 `PATCH /api/training-prefs`

| Field | Value |
|---|---|
| Method | PATCH |
| Path | `/api/training-prefs` |
| Auth | Strava bearer → `resolveAthleteId` |
| Request body | All fields optional (partial update): `{ home_region?: string, preferred_distance_km?: integer, preferred_difficulty?: 'flat'\|'rolling'\|'hilly', surface_pref?: 'paved'\|'gravel'\|'any', sessions_per_week?: integer (1–14), start_address?: string }` |
| Response 200 | Full updated `training_prefs` row: `{ athlete_id, sessions_per_week, surface_pref, start_address, home_region, preferred_distance_km, preferred_difficulty, updated_at }` |
| Response 400 | `{ error: 'no fields provided' }` (empty body); `{ error: 'invalid value for preferred_difficulty' }` etc. |
| Response 401 | `{ error: 'unauthorized' }` |
| Response 500 | `{ error: 'internal error' }` |
| Rate-limit | none |
| Implementation notes | Implements §B.4. UPSERT on `training_prefs` keyed by `athlete_id` (from `resolveAthleteId`). Only provided fields are updated — build a SET clause dynamically from parsed body keys. After upsert, SELECT the full row to return. `updated_at` always set to `CURRENT_TIMESTAMP`. Existing columns (`surface_pref`, `start_address`, `sessions_per_week`) continue working — this endpoint extends rather than replaces the existing `POST /training-prefs` described in the backlog. Note: backlog issue references `POST` — this supersedes it with `PATCH` for partial-update semantics. |

---

### C.6 `PUT /api/goals/annual`

| Field | Value |
|---|---|
| Method | PUT |
| Path | `/api/goals/annual` |
| Auth | Strava bearer → `resolveAthleteId` |
| Request body | `{ target_km: number (required, >0), target_year?: integer (default: current UTC year) }` |
| Response 200 | Full upserted `goals` row: `{ id, athlete_id, goal_type, target_value, target_unit, target_date, set_at }` |
| Response 400 | `{ error: 'target_km is required and must be a positive number' }` |
| Response 401 | `{ error: 'unauthorized' }` |
| Response 500 | `{ error: 'internal error' }` |
| Rate-limit | none |
| Implementation notes | Implements §B.1. Upserts into `goals` with: `goal_type='annual_km'`, `target_value=target_km`, `target_unit='km'`, `target_date='${target_year}-12-31'`, `set_at=CURRENT_TIMESTAMP`. Conflict target: `(athlete_id, goal_type, target_date)` — one annual goal per year per athlete. Event-goal columns (`event_name`, `event_distance_km`, `event_priority`, etc.) left NULL. Returns the upserted row via `SELECT` after write. |

---

## §B-SQL. Migration SQL

Do NOT create migration files in this commit — implementation work only. SQL is documented here for the implementer.

---

### Migration 0003 — `migrations/0003_users_strava_profile.sql`

```sql
-- =============================================================
-- Migration 0003 — extend users with Strava-sourced profile fields (v9.3.x)
-- =============================================================
-- Adds:
--   1. users.sex (TEXT) — Strava /athlete returns 'M' / 'F' / undefined
--   2. users.country (TEXT) — Strava /athlete returns ISO country name
--
-- Both backwards-compatible (NULL allowed). Backfilled naturally as users
-- sign in / refresh tokens — persistUserAndTokens extended to write these.
-- One-shot manual backfill optional via wrangler d1 execute --remote.
-- =============================================================

ALTER TABLE users ADD COLUMN sex TEXT;
ALTER TABLE users ADD COLUMN country TEXT;
```

---

### Migration 0004 — `migrations/0004_training_prefs_route_filters.sql`

```sql
-- =============================================================
-- Migration 0004 — extend training_prefs with route-filter defaults (v9.3.x)
-- =============================================================
-- Adds:
--   1. training_prefs.home_region (TEXT) — user's preferred starting region
--      for route discovery (POST /api/routes/discover default)
--   2. training_prefs.preferred_distance_km (INTEGER) — default distance chip
--      in the route filter UI
--   3. training_prefs.preferred_difficulty (TEXT) — 'flat' | 'rolling' | 'hilly'
--
-- All backwards-compatible (NULL allowed). UI falls back to per-persona
-- defaults when these are NULL.
-- =============================================================

ALTER TABLE training_prefs ADD COLUMN home_region TEXT;
ALTER TABLE training_prefs ADD COLUMN preferred_distance_km INTEGER;
ALTER TABLE training_prefs ADD COLUMN preferred_difficulty TEXT;
```

---

### `schema.sql` update (implementer applies in same commit as each migration)

**§USERS block** — add after existing columns, before closing `);`:

```sql
  sex         TEXT,                 -- v9.3.x (migration 0003) Strava /athlete sex field
  country     TEXT,                 -- v9.3.x (migration 0003) Strava /athlete country
```

**§TRAINING_PREFS block** — add after existing `start_address` column:

```sql
  home_region             TEXT,     -- v9.3.x (migration 0004) default location for route discovery
  preferred_distance_km   INTEGER,  -- v9.3.x (migration 0004) default distance filter chip (km)
  preferred_difficulty    TEXT,     -- v9.3.x (migration 0004) 'flat' | 'rolling' | 'hilly'
```

**`db/README.md` migrations index** — append two rows:

| Migration | File | Description | Applied |
|---|---|---|---|
| 0003 | `migrations/0003_users_strava_profile.sql` | Adds `users.sex`, `users.country` (Strava profile sync) | pending |
| 0004 | `migrations/0004_training_prefs_route_filters.sql` | Adds `training_prefs.home_region`, `preferred_distance_km`, `preferred_difficulty` | pending |

---

## Open questions for the founder

These are ARCHITECTURE-level questions; the BA + UX docs surfaced others (relisted in §F).

1. **Strava saved routes accuracy** — Phase 1 of §A relies on the user having actually saved routes in Strava. If they have zero, Phase 1 is empty for them. Do we proceed with this knowing the demo user (you) likely has a populated saved-routes list, but a fresh user wouldn't? Phase 2 spike covers the empty-saved-routes case but with narrative-only output.
2. **Anthropic key for forecast** — confirming the dual-tier model: forecast = system-paid Haiku, weekly plan = BYOK Sonnet. Acceptable cost shape?
3. **Komoot partnership** — willing to apply for Komoot's commercial program? If yes, Phase 3 unblocks. If no, OSM/Overpass is the only path to non-Strava real-GPX route data and that's a real engineering investment.
4. **Migration 0003 backfill** — do you want a one-shot worker script to backfill `sex` + `country` for existing users (i.e., yourself), or wait for natural refresh on next sign-in?

## §F. Inherited open questions from prior roles

From UX (Role 2): goal type for Persona C; club shared goal scope; Anthropic key fallback. From BA (Role 1): clubs feature scoping session needed before FB-7 can ship. The CTO Review (Role 4) should fold these into the sprint plan.

---

*Sections §C and §B-SQL below this line are written by Sonnet sub-agent.*
