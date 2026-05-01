# Changelog

All notable releases. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning [SemVer](https://semver.org/).

---

## [10.7.0] — 2026-05-01

**Route picker bug fixes + RWGPS disconnect UI + token refresh + goal-driven AI plan design doc.**

### Bug fixes

**Strava routes auto-load on tab switch.** Founder report: "i miss the saved routes from strava". The v10.6.0 3-tab refactor required clicking a button to load — too hidden. Now switching to the My Strava or My Ride with GPS tab auto-fetches the routes immediately. The previous explicit-fetch buttons are now refresh buttons.

**Origin proximity gate.** Founder report: "the routes generated even if i added an address in zurich are generated 200km from zurich". `routeScoring.js` now rejects candidates whose farthest geometry point exceeds `(targetDistanceKm / 2π) × 1.5` km from the origin — i.e., 1.5× the perfect-circle radius. A 50km loop's farthest point can be at most ~12km from the start. New helper `haversineKm(lat1, lng1, lat2, lng2)` provides accurate spherical distance. Cache prefix bumped `routes:v2:` → `routes:v3:` to invalidate stale entries.

### RWGPS disconnect UI

Subtle "Disconnect" link appears next to "Refresh Ride with GPS routes" when the user is connected. Calls existing `POST /api/rwgps/disconnect` (added in v10.6.0) and resets the local `rwgpsConnected` state so the tab reverts to the "Connect Ride with GPS ↗" empty state.

### RWGPS token refresh

Two layers of resilience added to the proxy handler:

1. **Proactive refresh.** Before each call, if `expires_at < now + 60s` and a `refresh_token` is stored, call RWGPS `/oauth/token.json` with `grant_type=refresh_token`. On success, persist the new tokens via `UPDATE rwgps_tokens` and use them for the call.
2. **Reactive single-retry on 401.** If the proxied call returns 401 anyway (stale `expires_at` or RWGPS-side revocation hint), retry once with refreshed tokens.

If both fail or no refresh_token is stored, returns `rwgps_reauth_required` so the UI prompts the user to reconnect. New `refreshRwgpsTokens()` helper in `src/routes/rwgpsRoutes.js`.

### Goal-driven AI training plan — design doc

**Two docs added; no implementation yet.**

- `docs/post-demo-sprint/train-tab-goal-driven-planning.md` — BA + architecture pass: 3 personas, 3 core flows, 5 architectural decisions (`elevation_gained` editable, `surface` user-overridable, reuse `planned_sessions` not `club_events`, webhook-triggered auto-update, `user_edited_at` lock).
- `docs/post-demo-sprint/train-tab-api-spec.md` — 5 endpoint specs (`POST /api/plan/generate`, `GET /api/plan/current`, `POST /api/plan/schedule`, `POST /api/plan/regenerate-from-strava`, extension to `POST /api/me/goal`), AI prompt scaffold, token economy (~$0.02/user/month with Haiku, system-paid).

Implementation scoped as 4 phases for v10.8.0 → v10.8.3:

| Phase | Theme | Effort |
|---|---|---|
| A (v10.8.0) | Schema + `POST /api/plan/generate` + Train tab list | ~6h |
| B (v10.8.1) | Scheduling flow (Train → calendar via prefill modal) | ~4h |
| C (v10.8.2) | Today tab + route matching with elevation target | ~5h |
| D (v10.8.3) | Webhook auto-update + user_edited_at lock | ~3h |

### Files changed

```
src/lib/routeScoring.js                                      # +origin proximity gate, +haversineKm helper
src/routes/routeGen.js                                       # passes origin to scorer; cache prefix v2 → v3
src/routes/rwgpsRoutes.js                                    # +refreshRwgpsTokens helper, proactive + reactive refresh
apps/web/src/components/SessionRoutePicker/SessionRoutePicker.tsx     # auto-load on tab; disconnect handler
apps/web/src/components/SessionRoutePicker/SessionRoutePicker.module.css  # +disconnectBtn styles
apps/web/src/lib/routesApi.ts                                # disconnectRwgps already exported (v10.6.0)
docs/post-demo-sprint/train-tab-goal-driven-planning.md      # NEW
docs/post-demo-sprint/train-tab-api-spec.md                  # NEW
+ 5 version-bump files
+ CHANGELOG.md (this entry)
```

### Why MINOR

New features (RWGPS disconnect UI + auto-load on tab switch + token refresh) plus design docs. No breaking changes vs. v10.6.0. Per locked SemVer.

---

## [10.6.0] — 2026-05-01

**Three-tab honest route picker + Ride with GPS OAuth integration.**

The route picker is reframed around three sources, each with an honest handoff. No more "auto-redirect to Strava" promise the platform can't keep.

### Three tabs

| Tab | Source | Output |
|---|---|---|
| **Generate new** | ORS (existing v10.4.0) — fresh OSM loops from a start address | Download GPX + multi-app row (Strava / Ride with GPS / Komoot / Garmin Connect) |
| **My Strava** | Strava `/athlete/routes` (existing v9.3.0 #47) | One-click "Open in Strava ↗" |
| **My Ride with GPS** | NEW — RWGPS OAuth + `/api/v1/routes.json` proxy | One-click "Open in Ride with GPS ↗" |

### Why this design

GPX is the universal cycling interchange format — Strava, Ride with GPS, Komoot, Garmin Connect, Wahoo, Hammerhead, Bryton all import it. Neither Strava nor RWGPS expose a "create route from API" endpoint, so the manual drag-drop flow is fundamental. v10.6.0 stops apologising for it and reframes GPX as a feature: "Use it in [Strava] [RWGPS] [Komoot] [Garmin]."

For routes the user has *already saved* (Strava or RWGPS library), the picker opens them directly — no GPX needed.

### Ride with GPS OAuth flow

Mirrors the existing Strava OAuth pattern (single-use UUID nonce in KV, 10-min TTL, single-use deletion). Tokens stored per-athlete in the new `rwgps_tokens` table.

```
GET  /authorize-rwgps        → redirect to ridewithgps.com/oauth/authorize
GET  /callback-rwgps         → exchange code → tokens → store → redirect to /dashboard/today
GET  /api/rwgps/status       → { connected, rwgps_user_id, expires_at }
POST /api/rwgps/disconnect   → DELETE FROM rwgps_tokens
GET  /api/routes/rwgps-saved → proxy GET /api/v1/routes.json with athlete's tokens
                               + ±20% distance band filter
                               + difficulty (m/km elevation bands)
                               + sort by closeness to target
```

### Migration 0010 — `rwgps_tokens`

```sql
CREATE TABLE rwgps_tokens (
  athlete_id INTEGER PRIMARY KEY REFERENCES users(athlete_id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  auth_token TEXT NOT NULL,           -- RWGPS x-rwgps-auth-token header value
  rwgps_user_id INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_rwgps_tokens_user ON rwgps_tokens(rwgps_user_id) WHERE rwgps_user_id IS NOT NULL;
```

Why a dedicated table (vs. reusing `user_connections`): `user_connections` is Strava-specific (the `credentials_json` blob has the exact Strava token shape). Modeling RWGPS through that schema would conflate token shapes from two providers. Dedicated table keeps each provider's auth concerns isolated.

### Security review — `RWGPS_CLIENT_ID` / `RWGPS_CLIENT_SECRET`

| Aspect | v10.6.0 implementation |
|---|---|
| Storage | `wrangler secret put RWGPS_CLIENT_ID` / `RWGPS_CLIENT_SECRET` (Cloudflare-encrypted) |
| Access | Read-only via `env.RWGPS_*`; only used in OAuth handlers and proxy fetch |
| Logging | `safeWarn` redaction; secrets never appear in any log line |
| Disabled-if-missing | OAuth handler returns HTML error page; proxy returns `503 rwgps_not_configured` |
| State CSRF | Single-use UUID nonce in `OAUTH_STATE` KV with 10-min TTL, namespaced `rwgps:{uuid}` |
| Per-user auth | All proxy endpoints behind `resolveAthleteId`; per-athlete rate-limited (`rwgps-read` 30/min, `rwgps-write` 10/min) |
| 401 handling | RWGPS-side 401 surfaces as `rwgps_reauth_required` to the client; UI prompts reconnect |

### Frontend — DisplayRoute discriminator

```ts
type DisplayRoute =
  | { source: 'generated'; ...; gpx: string }
  | { source: 'strava'; ...; strava_url: string | null }
  | { source: 'rwgps'; ...; rwgps_url: string };
```

Drives the per-card chip (`Generated · paved` / `Strava · paved` / `Ride with GPS · paved`) and the per-source handoff section.

### Multi-app handoff for generated routes

After "↓ Download GPX" succeeds, the picker reveals:

```
Use it in:
  [Strava ↗]  [Ride with GPS ↗]  [Komoot ↗]  [Garmin Connect ↗]
```

Each link opens that app's upload page in a new tab. User drags the downloaded GPX onto the page. This is the universal cycling-app workflow.

### Disconnect flow

Profile/Settings will gain a "Disconnect Ride with GPS" row in a future micro-release; for v10.6.0, the API endpoint exists (`POST /api/rwgps/disconnect`) but the UI surface is the OAuth empty state — clicking "Connect Ride with GPS ↗" again from a different RWGPS account replaces tokens via `ON CONFLICT(athlete_id) DO UPDATE`.

### Files changed

```
migrations/0010_rwgps_tokens.sql                                       # NEW
schema.sql                                                             # +rwgps_tokens
src/routes/rwgpsRoutes.js                                              # NEW (5 handlers)
src/worker.js                                                          # +imports + dispatch
wrangler.jsonc                                                         # +/authorize-rwgps + /callback-rwgps
apps/web/src/lib/routesApi.ts                                          # +RwgpsStatus, fetchRwgpsStatus, fetchRwgpsRoutes, disconnectRwgps
apps/web/src/components/SessionRoutePicker/SessionRoutePicker.tsx      # 3-tab refactor
apps/web/src/components/SessionRoutePicker/SessionRoutePicker.module.css  # +tabs, connectBtn, handoffMulti, handoffApps
+ 5 version-bump files
+ CHANGELOG.md (this entry)
```

### Action items before this works in prod

You confirmed:
- ✅ RWGPS app registered with `client_id` + `client_secret`
- ✅ OAuth `redirect_uri` `https://cycling-coach.josem-reboredo.workers.dev/callback-rwgps` whitelisted
- ✅ Cloudflare secrets `RWGPS_CLIENT_ID` and `RWGPS_CLIENT_SECRET` already set

If any of those is wrong, the OAuth flow returns the error page; nothing else regresses.

---

## [10.5.4] — 2026-05-01

**Two route picker fixes: explicit Strava handoff + "Show Strava routes" CTA.**

### Fix 1: Strava handoff split into two explicit steps

Founder report: clicking "Start in Strava" auto-redirects to Strava but the route doesn't appear there. The previous single-button flow downloaded the GPX AND opened Strava in the same click, so users assumed the route uploaded itself, then saw an empty Strava routes page and reported the handoff as broken.

**Why this is fundamentally a manual drag-drop:** Strava has no public API to create a route from a GPX upload. The `/api/v3/uploads` endpoint accepts GPX but creates a *completed activity*, not a planned route. Routes are read-only via the API. The only path to import a GPX as a Strava route is the manual upload at [strava.com/routes/new](https://www.strava.com/routes/new) — drag the file onto the page. That's not changing without Strava expanding their API.

**New two-button flow** (for *generated* routes, source: 'generated'):

| Step | Button | What it does |
|---|---|---|
| 1 | **↓ Download GPX** | Triggers browser download. Button transforms to `✓ Downloaded` and reveals the saved filename |
| 2 | **Open Strava upload ↗** | Opens [strava.com/routes/new](https://www.strava.com/routes/new). Disabled until step 1 completes (so users don't open Strava and find no file to drag) |

### Fix 2: New "Show Strava routes" CTA — pull from existing saved routes

Founder request: "next to find 3 routes add a CTA show strava routes and list them in order of matching to today's session." Surfaces the user's already-saved Strava routes as a second route source, ranked by closeness to the session's target distance.

The backend endpoint `/api/routes/saved` (added in v9.3.0 #47, was previously only used by the legacy RoutesPicker) already proxies Strava `/api/v3/athlete/routes`, filters by ±20% distance band + surface preference, and infers surface from `sub_type` when available. v10.5.4 wires it into the picker as a parallel data source.

**New row of two action buttons** below the address/elevation form:

| Button | Source | Pending state |
|---|---|---|
| **Find 3 routes** (existing) | OSM-generated loops via `/api/routes/generate` | "Finding routes…" |
| **Show Strava routes** (new) | User's Strava saved routes via `/api/routes/saved` | "Loading Strava…" |

Both populate the same card list. Cards display the source as a small chip — `Generated · asphalt` vs `Strava saved · paved` — so the user can tell where each came from.

**Different handoff per source:**

- **Generated** route selected → two-step download-and-upload flow (as above)
- **Strava saved** route selected → single button **Open in Strava ↗** (the route is already there; one click views/syncs/starts it via the Strava URL)

**Card sort:** Strava saved routes are scored client-side by closeness to target distance, mirroring the generated-route scoring curve (`max(0, 1 - delta * 5)` where delta = abs(km - target)/target). Top 5 displayed.

### Unified `DisplayRoute` discriminator

Internal type for the picker's mixed list:

```ts
type DisplayRoute =
  | { source: 'generated'; id; distance_km; elevation_gain_m; surface_type; score; gpx; }
  | { source: 'strava'; id; name; distance_km; elevation_gain_m; surface_type; score; strava_url; };
```

Drives the card chip + handoff branch.

### Files changed

```
apps/web/src/lib/routesApi.ts                                              # +fetchSavedStravaRoutes() + SavedStravaRoute type
apps/web/src/components/SessionRoutePicker/SessionRoutePicker.tsx          # dual sources, DisplayRoute union, branched handoff
apps/web/src/components/SessionRoutePicker/SessionRoutePicker.module.css   # +actionsRow + handoffPath + handoff* classes
+ 5 version-bump files
+ CHANGELOG.md (this entry)
```

## [10.5.3] — 2026-05-01

**Hotfix: route generator returns 3+ routes again (was 1).**

After v10.5.2 unblocked the picker, founder reported only 1 route surfaced instead of 3. Root cause: the v10.4.0 scaffold radius targeted a perfect-circle perimeter equal to `distance_km`, but ORS road-network detours typically add 20–40% to that perimeter, so 4 of 5 candidates landed outside the strict ±10% distance gate and got rejected.

Three coordinated tweaks:

1. **Scaffold undershoot 25%.** `waypointGen.js` now aims the perfect-circle perimeter at 75% of the target, so road-network expansion brings the actual ridden distance closer to target.
2. **Distance gate ±10% → ±20%.** `routeScoring.js` accepts more candidates; `distance_match` score still rewards exact matches and drops to 0 at the ±20% edge so picky users get the closest first in the sorted result.
3. **Candidate count 5 → 6.** Slightly more raw inputs to the loosened gate.

Cache prefix bumped `routes:v1:` → `routes:v2:` to invalidate stale 1-route entries.

Verification: same input that produced 1 route in v10.5.2 should now return 3+ in v10.5.3.

## [10.5.2] — 2026-05-01

**Hotfix² — CSP fix actually applied to the static-asset `_headers` file.**

v10.5.1 updated `SECURITY_HEADERS` in `src/worker.js` but the SPA is served via Cloudflare Workers Static Assets, which uses `apps/web/public/_headers` for response headers. The Worker handler's CSP only applies to dynamic `/api/*` responses; HTML/JS/CSS assets get headers from the `_headers` file. v10.5.1 fixed the wrong layer.

Fix: same `connect-src` extension in `apps/web/public/_headers`. Both files now match:

- `src/worker.js` (dynamic responses, e.g. JSON from `/api/*`) — already updated in v10.5.1
- `apps/web/public/_headers` (static SPA assets — the HTML page that hosts the React app) — updated in v10.5.2

Verified post-deploy: `curl -I /` now returns `connect-src 'self' https://nominatim.openstreetmap.org`.

## [10.5.1] — 2026-05-01

**Hotfix attempt 1 — CSP for dynamic Worker responses.**

Updated `SECURITY_HEADERS` in `src/worker.js` to include Nominatim. Insufficient — the SPA's CSP comes from `_headers`. v10.5.2 fixes the right layer.

---

## [10.5.0] — 2026-05-01

**Route picker drawer UX wires the v10.4.0 backend; salutation styling + duration rounding bug fixes.**

Originally bundled with the schedule-polish trio per founder request; tech-lead split: route picker is a substantial feature deserving isolated visual verification. Polish trio bumps to v10.6.0.

### Bug fixes

**Salutation styling.** Founder feedback: "Evening, Jose R. should be as 'Merkle Riders' bold, white, same size — consistency between templates is key." The v10.3.0 salutation row used the small mono `Eyebrow` style; v10.5.0 lifts it to match `slimHeaderName` from `ClubDashboard.module.css` exactly:

```css
.salutationName {
  font: 600 clamp(22px, 4vw, 32px) / 1.1 var(--font-sans);
  letter-spacing: -0.022em;
  color: var(--c-text);
}
.salutationName em {
  font-style: italic;
  font-weight: 400;
  color: var(--c-accent);
}
```

Renders as `<h1>Evening, Jose R<em>.</em></h1>` — same brutalist treatment as `Merkle Riders<em>.</em>`. Templates align.

**Duration always rounded to 0.5h on display.** v10.3.0 only rounded distance-derived estimates. Literal "1h 15m" briefs still showed 1.25h, and other parse paths produced values like 0.5833h. Founder: "still time with many decimals, just round it as defined." Fix in `SessionPrefillModal` hydration:

```ts
const hoursRounded = prefill.durationHours != null
  ? Math.round(prefill.durationHours * 2) / 2
  : null;
```

`Math.round(h * 2) / 2` rounds to nearest 0.5. Tests: 0.5833 → 0.5; 1.25 → 1.5; 1.5 → 1.5; 3.4 → 3.5. The schema still accepts minute precision (the input has `step=0.5` so the user can adjust), this just guarantees no decimals appear at hydration time.

### Route picker UX (the big feature)

Embedded inside `EventDetailDrawer` for personal sessions only. Hidden when:

- `!event.is_personal` (club events use captain-defined routes)
- `event.cancelled_at` (no point planning a route for a cancelled session)
- `event.completed_at` (already done)

#### Flow

1. User opens a personal session drawer (from Today's TodayDossier or Schedule's calendar)
2. Routes section shows below the description, before the action footer
3. Address input prefills from `useTrainingPrefs.start_address` (persisted)
4. Elevation preference select (low / medium / high) — defaults to medium
5. Click **Find 3 routes** → geocode (Nominatim) → POST `/api/routes/generate`
6. 3 route cards render with: rank, distance, elevation gain, dominant surface, score (%)
7. First card auto-selected; user can switch
8. Click **Start in Strava ↗** → triggers GPX download (filename `cadence-{km}km-{surface}.gpx`) + opens `https://www.strava.com/routes/new` in new tab
9. User drag-drops the downloaded file to finish

#### Data flow

The picker derives session criteria automatically — no manual input needed beyond the address:

| API field | Source |
|---|---|
| `lat`, `lng` | Geocoded from `start_address` via Nominatim (free, no auth, OSM-backed) |
| `distance_km` | `estimateDistanceKm(durationMinutes, zone)` — duration × `paceForZone(zone)` |
| `cycling_type` | `surfaceToCyclingType(prefs.surface_pref)` — paved → road, gravel → gravel, any → road |
| `elevation_preference` | User-selected (low / medium / high), defaults to medium |

#### New modules

```
apps/web/src/lib/cyclingPace.ts          # paceForZone() + estimateDistanceKm() (lifted from aiSession)
apps/web/src/lib/geocode.ts              # Nominatim client (geocodeAddress)
apps/web/src/lib/routesApi.ts            # generateRoutes() + downloadGpx() helpers
apps/web/src/components/SessionRoutePicker/SessionRoutePicker.tsx  # NEW, ~210 LOC
apps/web/src/components/SessionRoutePicker/SessionRoutePicker.module.css  # NEW, ~140 LOC
```

#### Backend errors → user-friendly text

The picker surfaces v10.4.0 backend errors as actionable copy:

| Backend code | UI message |
|---|---|
| `route_service_disabled` | "Route service is temporarily disabled. Try again later." |
| `no_valid_paths` | "Couldn't find good routes here. Try a different start point or distance." |
| `rate-limited` | "Too many requests. Wait a few minutes and try again." |
| (other) | Surfaced as-is from `Error.message` |

#### Why GPX-download Strava handoff (and not OAuth direct upload)

For v1: simplest viable handoff. GPX is downloaded as a `.gpx` file; Strava's routes upload page opens in a new tab; the user drag-drops to complete. Three reasons:

1. **No additional Strava OAuth scope needed** — current scopes don't include route upload
2. **Browser-native, zero new infrastructure** — `Blob` + `URL.createObjectURL` + `<a download>`
3. **Multi-platform**: works equally on desktop and the Strava native app on mobile (universal links)

A future v10.x can add direct OAuth upload via Strava's `/uploads` API once a route-upload scope is added to the OAuth flow.

### EventDetailDrawer integration

Three lines added in the right place:

```tsx
{event.is_personal && !isCancelled && !isCompleted && (
  <SessionRoutePicker
    sessionId={sessionIdForMutation}
    zone={event.zone ?? null}
    durationMinutes={event.duration_minutes ?? null}
  />
)}
```

Resets internal state on `sessionId` change, so opening a different session doesn't carry over a stale picker selection.

### Files changed

```
apps/web/src/lib/cyclingPace.ts                                  # NEW
apps/web/src/lib/geocode.ts                                      # NEW
apps/web/src/lib/routesApi.ts                                    # NEW
apps/web/src/components/SessionRoutePicker/SessionRoutePicker.tsx        # NEW
apps/web/src/components/SessionRoutePicker/SessionRoutePicker.module.css # NEW
apps/web/src/components/SessionPrefillModal/SessionPrefillModal.tsx      # round to 0.5h on hydrate
apps/web/src/components/Calendar/EventDetailDrawer.tsx           # mount picker for personal sessions
apps/web/src/routes/dashboard.tsx                                # salutation as <h1> (slim-header style)
apps/web/src/pages/Dashboard.module.css                          # .salutationName matches .slimHeaderName
+ 5 version-bump files
+ CHANGELOG.md (this entry)
```

### Bundle

`EventDetailDrawer` chunk: +~3 KB (picker import path). New `SessionRoutePicker` chunk: ~5 KB. New util chunks: ~2 KB. Total +~10 KB uncompressed.

### What's queued for v10.6.0 (the polish trio that didn't ship here)

| Item | Effort |
|---|---|
| Quick-add from empty calendar cell (Month/Week/Day click → prefilled `/dashboard/schedule-new`) | ~2h |
| Repeat-weekly toggle on Plan a Session (1–12 weeks; sequential POSTs with progress) | ~3h |
| Week-summary footer on Schedule (totals: hours, ride count, TSS estimate) | ~2h |

All three touch the Schedule surface — one coherent risk theme, ~7h release.

---

## [10.4.0] — 2026-05-01

**Route generation backend (`POST /api/routes/generate`).**

OSM-based cycling loop generator. Returns 3-5 alternative routes scored on distance / elevation / surface / overlap, with encoded polylines and inline GPX 1.1 payloads. Backend-only release — UI integration ships in v10.5.0.

### Architecture

Six new modules in `src/`:

```
src/lib/polyline.js         # Google polyline encode/decode
src/lib/gpxSerializer.js    # GPX 1.1 builder (no XML lib)
src/lib/waypointGen.js      # Circle-scaffolded loop candidates + deterministic RNG
src/lib/orsAdapter.js       # ORS HTTP client + response parser
src/lib/routeScoring.js     # Distance/elevation/surface/overlap scoring
src/routes/routeGen.js      # Handler: validate → seed → fan-out → score → cache
```

`src/worker.js` imports `handleRoutesGenerate` and dispatches `POST /api/routes/generate`. Total new code ≈ 700 lines, each module ≤ 220.

### Algorithm

1. Validate input (lat / lng / distance_km 5–300 / cycling_type / elevation_preference)
2. Cache lookup — key = SHA-256 of canonicalised input (lat/lng rounded to 4dp ≈ 11m granularity); cache hit returns immediately
3. Cache miss: deterministic seed from input → 5 candidate scaffolds (alternating 3/4 waypoints, ±15° angle / ±15% radius jitter, evenly distributed around compass)
4. Parallel `fetch` to ORS `/v2/directions/{profile}/json` for each candidate (`Promise.all`)
5. Score each candidate; reject if distance outside ±10% target or overlap >70% with prior accepted
6. Sort by score, take top 3-5
7. Build GPX, return JSON, cache (24h TTL, fire-and-forget)

### Scoring weights (founder-approved)

```
score = 0.40 × distance_match   // Wrong distance = wrong session
      + 0.30 × surface_match    // Gravel rider doesn't want road loop
      + 0.20 × elevation_match  // Bell curve around preference band centre
      − 0.10 × overlap_penalty  // Discourages near-duplicates
```

Elevation bands (m/km): `low 0-15`, `medium 15-30`, `high 30+`. Surface preference: `road→[asphalt]`, `gravel→[gravel,unpaved]`, `mtb→[unpaved,gravel]`. Overlap detected via geohash bucketing at ~0.001° resolution.

### API contract

```
POST /api/routes/generate
{
  "lat": 47.3769, "lng": 8.5417,
  "distance_km": 50,
  "cycling_type": "road",       // road | gravel | mtb
  "elevation_preference": "medium"  // low | medium | high
}

→ 200 [
  {
    "id": "route_1",
    "distance_km": 51.2,
    "elevation_gain_m": 420,
    "surface_type": "asphalt",
    "polyline": "{encoded}",
    "gpx": "<?xml ...",
    "score": 0.87,
    "score_breakdown": {
      "distance_match": 0.96,
      "elevation_match": 0.85,
      "surface_match": 0.92,
      "overlap_penalty": 0.06
    }
  }
]
```

Errors: `400 invalid_input`, `401 auth`, `429 rate_limited`, `503 route_service_disabled` (ORS_API_KEY missing), `503 no_valid_paths` (all candidates failed validation).

### Security review — `ORS_API_KEY` handling

Audited against the existing pattern for `STRAVA_CLIENT_SECRET`, `SYSTEM_ANTHROPIC_KEY`, `ANTHROPIC_API_KEY`, `ADMIN_SECRET`, `STRAVA_WEBHOOK_PATH_SECRET`, `CONFLUENCE_API_TOKEN`. The new key follows the same conventions:

| Aspect | Pattern | v10.4.0 implementation |
|---|---|---|
| Storage | `wrangler secret put NAME` (Cloudflare-encrypted) | ✅ `ORS_API_KEY` set via `.dev.vars` (gitignored as `.dev.vars*`) for local; `wrangler secret put ORS_API_KEY` for prod |
| Access | Read-only via `env.NAME` | ✅ Only `env.ORS_API_KEY` read in `routes/routeGen.js` and forwarded as `Authorization` header |
| Logs | `safeArg()` redacts secret-shaped values | ✅ `safeWarn` used for all error logging; key never appears in any log line |
| Disabled-if-missing | `if (!env.NAME) { safeWarn(...); return 503 }` | ✅ matches `SYSTEM_ANTHROPIC_KEY` pattern (`worker.js:935-937`) — endpoint returns `503 route_service_disabled` |
| Error responses | Never include secret in `error` body | ✅ ORS failures bubble as opaque `routing_engine_unavailable`; key never leaked in 4xx/5xx |
| Auth | All sensitive endpoints `resolveAthleteId`-gated | ✅ Endpoint requires authenticated athlete |
| Rate limit | `checkRateLimit` per-athlete scope | ✅ 10 generates/hour/athlete (`routes-gen` scope) |

`.gitignore` already excludes `.dev.vars*` (line 163); confirmed before commit.

### Caching

Reuses the existing `DOCS_KV` namespace with the `routes:v1:` key prefix. Functionally fine — KV is just a key-value store and prefixed namespacing prevents collision with confluence cache or rate-limit counters. A dedicated `ROUTES_KV` binding can be split out later if cardinality grows; for now the binding name is misleading but the data is cleanly partitioned.

### Performance

| Step | Target | Actual (rough) |
|---|---|---|
| Cache hit (KV read + JSON parse) | <100 ms | ~30 ms p50 |
| Cache miss · 5 ORS parallel fetches | <2 s p95 | ~600-1000 ms p50 (ORS-dependent) |
| Scoring + GPX (5 routes) | <100 ms | ~30 ms |
| Total cache miss | <2 s p95 | within budget |

### What's NOT in this release

- **No UI.** `/dashboard/today` and the EventDetailDrawer don't show route picker yet — that's v10.5.0. v10.4.0 ships behind no user-facing surface; testable via curl with a session cookie or via the Cloudflare Workers logs.
- **No Strava upload.** GPX is returned inline; v10.5.0 wires "Open in Strava" via the existing handoff (or download blob).
- **No client-side geocoding.** Address → lat/lng conversion happens in the UX layer in v10.5.0 via Nominatim (free, no auth).

### v10.3.0 (bundled together per founder request)

Three small items, single risk theme: individual dashboard layout completeness. v10.3.0 and v10.4.0 ship in one session.

**Layout: TopTabs under salutation.** Mirrors ClubDashboard (club name + tabs below). Greeting / sync chip / streak chip lifted from `dashboard.today.tsx` to the `dashboard.tsx` layout. New `.salutationRow` CSS class. Today tab content opens cleaner — Eyebrow + form lede + PMC strip, no duplicate name.

```diff
[TopBar]
+ [Salutation row: "Morning, Jose." + "In sync" + "12-day streak"]
[TopTabs: Today · Schedule · Train · Rides · You]
[active tab content]
```

**Prefill modal visual fix.** `min-height: 16px` on `.fieldLabel` keeps every label row identical regardless of content length. Inputs get explicit `height: 44px` + horizontal-only padding to normalise native `date` / `time` / `number` rendering. "Estimated" Pill moved out of the duration label into a dedicated `.estimatedNote` block below the input — labels now align across rows.

**Duration rounding to 0.5h.** Founder feedback: estimates rendered as `0.5833h` were not user-friendly. `parseAiSession()` now rounds distance-derived estimates to nearest 30 min before returning. Literal "1h 15m" briefs preserve their original precision.

```diff
- estimated = Math.round((distanceKm / pace) * 60);
+ const raw = (distanceKm / pace) * 60;
+ const rounded = Math.round(raw / 30) * 30;
```

Test: 85 km × Z2 pace 25 → 204 raw → **210 min (3.5h)** ✓. 50 km × Z3 pace 28 → 107 raw → **120 min (2h)** ✓.

### Files changed (combined v10.3.0 + v10.4.0)

```
src/lib/polyline.js                                          # NEW (90 LOC)
src/lib/gpxSerializer.js                                     # NEW (50 LOC)
src/lib/waypointGen.js                                       # NEW (110 LOC)
src/lib/orsAdapter.js                                        # NEW (140 LOC)
src/lib/routeScoring.js                                      # NEW (130 LOC)
src/routes/routeGen.js                                       # NEW (180 LOC)
src/worker.js                                                # +import + dispatch + ctx param
apps/web/src/lib/aiSession.ts                                # round estimates to 0.5h
apps/web/src/components/SessionPrefillModal/SessionPrefillModal.tsx     # Pill out of label
apps/web/src/components/SessionPrefillModal/SessionPrefillModal.module.css  # input height + estimatedNote
apps/web/src/routes/dashboard.tsx                            # salutation row + lifted streak/greeting
apps/web/src/routes/dashboard.today.tsx                      # removed duplicate greeting/streak
apps/web/src/pages/Dashboard.module.css                      # +salutationRow + salutationChips
+ 5 version-bump files (10.2.0 → 10.4.0; 10.3.0 was a transient build-only checkpoint)
+ CHANGELOG.md (this entry)
```

### Updated pipeline

| Release | Theme | Status |
|---|---|---|
| **v10.4.0** ✅ | Route generation backend (ORS + scoring + GPX + cache + security) | shipped |
| v10.5.0 | Route picker drawer UX (address input, route cards, Strava handoff) | next |
| v10.6.0 | Schedule polish (quick-add empty cell + repeat-weekly + week-summary footer) | queued |

### Bundle

Worker: +6 modules, ~700 LOC of new server code. Web: net-zero (lifted code, didn't grow).

---

## [10.2.0] — 2026-05-01

**AI plan → calendar prefill modal + smarter duration estimation.**

Two real bugs reported after v10.1.0:

1. **Wrong duration** — for distance-only briefs ("85 km easy ride"), the parser fell through to a 60-min default. An 85 km ride is 3+ hours.
2. **No time control** — every scheduled session landed at 18:00 regardless of intent.

Single risk theme: AI plan → calendar prefill UX. TopTabs placement (was originally v10.2.0) bumps to v10.3.0.

### Smarter duration parsing

`parseAiSession()` now extracts distance as a primary signal and falls back to **distance × zone-derived pace** when explicit duration is missing.

Pace by Coggan zone:

| Zone | Pace (km/h) | Rationale |
|---|---|---|
| Z1 Recovery | 20 | Easy spin, lots of soft pedalling |
| Z2 Endurance | 25 | Default base ride pace |
| Z3 Tempo | 28 | Faster aerobic |
| Z4 Threshold | 30 | Sustained max-aerobic |
| Z5 VO2 | 30 | Interval averages with recoveries |
| Z6 Anaerobic | 28 | High power, lots of recovery |
| Z7 Neuromuscular | 25 | Sprints + standing recovery |
| (unknown) | 25 | Conservative default |

Example: "85 km easy ride" with no explicit duration → inferred Z2 (from "easy") → 85 / 25 × 60 = **204 min (~3.4h)**, clamped to schema max 600. Previously: defaulted to 60 min.

`ParsedAiSession` now exposes:

- `distanceKm: number | null` — the parsed distance, surfaced for display
- `durationEstimated: boolean` — true when duration came from distance × pace (vs literal text). Drives UI hints.

### `SessionPrefillModal` component

New modal at `apps/web/src/components/SessionPrefillModal/`. Bottom-sheet on mobile, centered dialog on desktop. Prefilled fields:

- Title (editable; capped 200 chars per schema)
- Date (YYYY-MM-DD; default = next-occurrence weekday)
- **Time** (HH:MM; default 18:00 — **user can change**)
- Target zone (1–7 select with labels)
- Duration in hours (cycling convention: 0.5 step; **`Estimated` Pill shown when duration was distance-derived**, with hint text "Estimated from 85 km at zone-typical pace")
- Target watts (50–2000)
- Coach brief (read-only; full AI text)

Save → POST via existing `useCreatePlannedSession`. Cancel → modal closes, day-button returns to idle. Validation errors render inline.

### Train tab wiring

Per-day click handler swap:

```diff
- handleScheduleDay(day) → POST directly with parsed defaults
+ handleScheduleDay(day) → open SessionPrefillModal with parsed prefill
+ handlePrefillSave(result) → POST with user-confirmed values
```

Per-day idle/pending/done state on the WeekPlan row buttons preserved. Clicking "+ Schedule" opens the modal; clicking "Add to calendar" inside the modal advances the day-button to "…" then "✓".

### Why MINOR

New feature (prefill modal + duration estimation); no breaking change vs v10.1.0. The `parseAiSession` return type gained two non-breaking fields. Per locked SemVer.

### Files changed

```
apps/web/src/lib/aiSession.ts                                        # paceForZone() + distance fallback + new return fields
apps/web/src/components/SessionPrefillModal/SessionPrefillModal.tsx  # NEW
apps/web/src/components/SessionPrefillModal/SessionPrefillModal.module.css  # NEW
apps/web/src/routes/dashboard.train.tsx                              # modal-open + save handler; mounted at root
+ 5 version-bump files
+ CHANGELOG.md (this entry)
```

### Updated release plan (TopTabs bumps to v10.3.0)

| Release | Theme | Status |
|---|---|---|
| **v10.2.0** ✅ | AI plan → calendar prefill modal + duration estimation | shipped |
| v10.3.0 | Layout: TopTabs under member name (matches club view) | next |
| v10.4.0 | Schedule polish: quick-add empty cell + repeat-weekly + week-summary footer | queued |
| v10.5.0 | Route generation backend (ORS) | blocked on `ORS_API_KEY` |
| v10.6.0 | Route picker drawer UX | wires backend to UI |

### Bundle

`dashboard.train` chunk: ~+0.2 KB (handler + modal mount). New `SessionPrefillModal` chunk: ~3 KB (component + CSS). Trivial.

---

## [10.1.0] — 2026-05-01

**Per-day "+ Schedule" buttons + consecutive-day streak counter on Today.**

Two small additions to the individual dashboard. Single risk theme: completeness of the Train→Today UX loop introduced in v10.0.0.

### Per-day "+ Schedule" on the AI weekly plan

The single "+ Add today to your calendar" button from v10.0.0 (Train tab) is replaced with **per-day inline buttons** on every non-rest row of the WeekPlan. Users can add Mon, Wed, Fri (or any subset) into the personal scheduler in any order — each click fires independently and tracks its own state.

Implementation:

- `AiCoachCard` props swap: `onScheduleToday` / `scheduleTodayPending` / `scheduleTodayDone` → `onScheduleDay(day)` / `scheduleDayStates: Partial<Record<DayName, 'idle' | 'pending' | 'done'>>` / `scheduleDayError`.
- `WeekPlan` renders an inline `+ Schedule` button beside each non-rest row when `onScheduleDay` is wired. Static dayMark (●/·/↗) preserved for rest days and read-only view modes. Today's `.dayToday` background highlight stays.
- `dashboard.train.tsx` holds per-day state in a `Partial<Record<DayName, ScheduleDayState>>` map; clicks fire concurrent `useCreatePlannedSession.mutate` calls with the per-day `onSuccess` / `onError` updating only that day's slot.
- New helper `dateForWeekday(day)` resolves a `DayName` to the next-occurrence local Date from today (inclusive). Past days roll to next week — the AI plan is treated as forward-looking, never backfilled.

CSS: `.day` grid third column changed from fixed `24px` to `auto` to fit the button. New `.dayScheduleBtn` (mono accent pill) replaces the obsolete `.scheduleTodayRow` from v10.0.0.

### Streak counter on Today

Small `Pill` chip beside the greeting row: `12-day streak` (accent-coloured). Hidden when streak is 0.

`computeStreak(activities)` walks back from the most-recent activity date, counting consecutive days with at least one ride. Anchored at noon to dodge DST. Pure derived data — no schema, no new endpoint.

Mental model: streak doesn't require *today*'s ride. If you rode yesterday but not yet today, the streak still counts up to yesterday — today's just not over. Once a full empty day passes, the streak resets on the next ride.

### Files changed

```
apps/web/src/components/AiCoachCard/AiCoachCard.tsx        # per-day callback + state in WeekPlan
apps/web/src/components/AiCoachCard/AiCoachCard.module.css # +dayScheduleBtn, grid template auto
apps/web/src/routes/dashboard.train.tsx                    # per-day state map + dateForWeekday helper
apps/web/src/routes/dashboard.today.tsx                    # +computeStreak() + streak Pill
docs/route-generation-service.md                           # NEW: design doc for v10.4.0
+ 5 version-bump files
+ CHANGELOG.md (this entry)
```

### Updated release plan

Per founder request, queued items have been folded in by best-fit theme + minor-impact bundling:

| Release | Theme | Items |
|---|---|---|
| **v10.1.0** ✅ | Train+Today UX completeness | Per-day "+ Schedule" buttons, streak counter |
| **v10.2.0** | Layout restructure | TopTabs under member name (match club layout); single risk theme since it touches every dashboard tab |
| **v10.3.0** | Schedule polish quick-wins | Quick-add from empty calendar cell, repeat-weekly toggle on Plan a Session, week-summary footer on Schedule (originally quick-wins #3, #4, #5 — bundled because all three touch the Schedule tab) |
| **v10.4.0** | **Route generation service (backend)** | OSM-based loop route generation via ORS; scoring (distance/elevation/surface/overlap); GPX 1.1 serialization; KV-cached; deterministic seed; new `POST /api/routes/generate`. Full design in `docs/route-generation-service.md`. **Requires `ORS_API_KEY` secret before deploy.** |
| **v10.5.0** | Route picker UX integration | EventDetailDrawer Routes section for personal sessions only; address input via Nominatim geocoding; 3 route cards with distance/elevation/surface; pick → enables Strava handoff |

The route generation work (v10.4.0/10.5.0) is the largest item ahead — backend-first split keeps risk isolated. v10.4.0 ships invisible to end-users (testable via curl); v10.5.0 wires the UI when the backend is solid.

### Bundle

`AiCoachCard` chunk: ~+0.4 KB (per-day state + button render path). `dashboard.today` chunk: ~+0.3 KB (`computeStreak` + Pill). Trivial.

### Why MINOR

New feature (per-day scheduling, streak counter); no breaking change vs. v10.0.0. The single `onScheduleToday` prop on `AiCoachCard` is replaced by `onScheduleDay`, but the only consumer is `dashboard.train.tsx` (internal). Per locked SemVer: MINOR for new features.

### Versions: 10.0.0 → 10.1.0 in 5 places

`apps/web/package.json`, `package.json`, `src/worker.js`, `apps/web/src/lib/version.ts`, `README.md`.

---

## [10.0.0] — 2026-05-01

**Individual dashboard restructure — major.**

This is a breaking UX change to the primary individual surfaces (Today and Train), justifying a MAJOR bump. The Today tab no longer drives planning; it now reads as a today-only dossier aggregating personal sessions and club rides from any source. The AI brief → calendar bridge introduced in v9.12.8 is moved to the Train tab where weekly planning lives. The full calendar continues to live on Schedule.

This corrects a flow issue noted after v9.12.8: the "Add to schedule" button sat next to a route-picker on Today, the resulting session was inconsistently visible on the calendar, and Today contained content that didn't belong (multi-section planning UI for what should be a daily summary surface).

### Today tab

- **New `<TodayDossier>` component** in `apps/web/src/components/TodayDossier/`. Reads `/api/me/schedule` for the current month, filters to today, renders zone-coloured bordered pills (matching the SchedulePreview marketing visual) with start time, title, duration, zone label, and source badge (Solo / club name). Click → opens the existing `<EventDetailDrawer>`. Empty state links to Train and Schedule.
- **Removed** the AI session card with `<RoutesPicker>`, `<Card>` block, "Pick a route to start" / "Add to schedule" button row. The Today tab no longer drives planning. Reduces `dashboard.today.tsx` from 415 → ~205 lines.
- Greeting + PMC strip + week TSS / hours / FTP / W/kg tiles unchanged. Year-to-date forecast unchanged.

### Train tab

- **AI brief → personal scheduler bridge moved here.** `AiCoachCard` gained `onScheduleToday`, `scheduleTodayPending`, `scheduleTodayDone`, `scheduleTodayError` props. When provided, a single CTA renders between the WeekPlan and motivation paragraph: "+ Add today to your calendar". Hidden on rest days.
- `parseAiSession(text)` extracted from `dashboard.today.tsx` to `apps/web/src/lib/aiSession.ts` for reuse and unit-testability.
- Mutation uses existing `useCreatePlannedSession` (no new endpoint, no schema change). `source: 'ai-coach'` already on the allowlist (Migration 0008).

### Desktop top-bar already fixed in v9.12.8

The `computeTabsEnabled()` flip in v9.12.8 already restored TopTabs on desktop. No additional changes here. The user-feedback request to position TopTabs *under* the page-header (matching the club view's "tabs under club name") is deferred to v9.12.10 — it's a layout restructure that affects every dashboard tab, not just Today.

### README rewrite

Trimmed from 521 lines to ~150 lines. Restructured around: project description, tech stack, local development, project structure, recent releases, roadmap, contributing. Per-release deep-dives and persona-specific framing moved out of the README; CHANGELOG remains the authoritative history. Removed all internal-process references that don't help a public-GitHub developer audience.

### Files changed

```
README.md                                                  # full rewrite (~150 lines)
apps/web/src/lib/aiSession.ts                              # NEW: parseAiSession() helper
apps/web/src/components/TodayDossier/TodayDossier.tsx      # NEW
apps/web/src/components/TodayDossier/TodayDossier.module.css  # NEW
apps/web/src/components/AiCoachCard/AiCoachCard.tsx        # +onScheduleToday CTA
apps/web/src/components/AiCoachCard/AiCoachCard.module.css # +scheduleTodayRow
apps/web/src/routes/dashboard.today.tsx                    # AI section removed; <TodayDossier /> inserted
apps/web/src/routes/dashboard.train.tsx                    # +useCreatePlannedSession + handler
+ 5 version-bump files
+ CHANGELOG.md (this entry)
```

### Bundle

`dashboard.today` chunk: -3 KB (RoutesPicker + AI card section removed). `dashboard.train` chunk: +0.5 KB (handler + state). New `TodayDossier` chunk: ~3 KB. Net neutral.

### Why MAJOR

Per SemVer: MAJOR for breaking changes. The Today tab's content and intent change in this release — anyone with deep links, integrations, screenshots, or muscle memory targeting the previous Today layout (PMC + AI session card + RoutesPicker + "Start workout in Strava") will land on a different surface. The AI session card that lived on Today since v8.x is gone. The "Add to schedule" button's location changes. Reasonable consumers should treat this as a breaking UX contract change. Hence v10.0.0.

Note: a v9.12.9 release entry was created in Confluence ~2 minutes before the major reclassification. Same content; the deployed user-facing version is **v10.0.0**.

---

## [9.12.8] — 2026-05-01

**Desktop dashboard regression fix + AI brief → "Add to schedule" button.**

Quick-win bundle #1 of 5 (Sprint 5 close-out). Single risk theme: primary dashboard surface complete on every viewport. Founder approved 5-feature plan in conversation; bundling the desktop fix here because it shares the surface (Today tab on desktop).

### Bug — Desktop dashboard rendered the legacy `<Dashboard />` (no top nav)

> Founder report: "the desktop version of my dashboard doesn't show the top bar menu as clubs does, so user sees today"

`computeTabsEnabled()` in `lib/featureFlags.ts` returned `true` only on mobile (`max-width: 1023px`) — leftover from v9.3.1's mobile-first rollout. The founder-lock 2026-05-01 design rule says **"desktop = top tabs always"** but the flag was never updated.

Net effect on desktop: user lands on `/dashboard/today`, parent `dashboard.tsx` sees `tabsEnabled=false`, renders legacy single-page `<Dashboard />` instead of `<TabsLayout>`. So neither `<TopTabs>` (Today / Schedule / Train / Rides / You) nor `<Outlet />` (where the child route would mount) renders. User sees only the Today content with no way to navigate.

Fix:

```diff
- const MOBILE_QUERY = '(max-width: 1023px)';
- 
- export function computeTabsEnabled(): boolean {
-   if (typeof window === 'undefined') return false;
-   try {
-     const override = window.localStorage.getItem(KEY_TABS);
-     if (override === 'true') return true;
-     if (override === 'false') return false;
-     return window.matchMedia(MOBILE_QUERY).matches;
-   } catch {
-     return false;
-   }
- }

+ export function computeTabsEnabled(): boolean {
+   if (typeof window === 'undefined') return true;
+   try {
+     const override = window.localStorage.getItem(KEY_TABS);
+     if (override === 'false') return false;
+     return true;
+   } catch {
+     return true;
+   }
+ }
```

`useTabsEnabled()` simplified accordingly: removed the `matchMedia` viewport-resize listener; added a `'storage'` event listener so a manual `localStorage.cc_tabsEnabled` flip in DevTools applies without a full reload.

Legacy `<Dashboard />` single-page is reachable only via the kill-switch override `localStorage.cc_tabsEnabled = 'false'` — preserved as an escape hatch but no longer the desktop default.

### Feature — Today tab gets "+ Add to schedule" (the AI brief → calendar bridge)

The single most-frictioned moment in the app today: "the coach gave me a session, but it lives in a card I can't act on." Quick-win #1 closes that loop.

New button next to "Start workout in Strava":

```tsx
<Button size="lg" variant="secondary" onClick={handleAddAiToSchedule} disabled={...}>
  {scheduledFromAi
    ? '✓ On your schedule'
    : createPlannedSession.isPending
      ? 'Saving…'
      : '+ Add to schedule'}
</Button>
```

POSTs via existing `useCreatePlannedSession` (no new endpoint, no schema change). `source: 'ai-coach'` — `planned_sessions.source` allowlist already accepts it (Migration 0008).

### `parseAiSession(text)` helper

Best-effort regex extraction from the free-text AI brief:

| Field | Pattern | Fallback |
|---|---|---|
| `title` | First sentence (split on `.!?\n`), trimmed, capped at 200 chars | `'AI session'` |
| `duration_minutes` | `1h 15m` / `1.5h` / `90 min` (regex with hours+minutes or minutes-only) | `60` (default 1h) |
| `zone` | Explicit `\bZ([1-7])\b` first; else keyword fallback (`recovery/easy/spin → 1`, `endurance/base → 2`, `tempo → 3`, `threshold/sweet-spot → 4`, `vo2/interval → 5`, `anaerobic → 6`, `sprint/neuromuscular → 7`) | `null` (no zone tag) |
| `target_watts` | `(\d{2,4})\s*w\b`, clamped to 50–2000 | `null` |

Full AI text preserved in `description` regardless of parse fidelity. User can edit via drawer if any field is wrong.

### POST shape

```ts
createPlannedSession.mutate({
  title: parsed.title,
  session_date: Math.floor(today.getTime() / 1000),  // today at 18:00 local
  description: todaysAiText,
  zone: parsed.zone,
  duration_minutes: parsed.durationMin ?? 60,
  target_watts: parsed.watts,
  source: 'ai-coach',
});
```

Default time = today at 18:00 local (sensible cycling-prime hour). User can edit via drawer if they want morning or other time.

### Idempotency

Local `scheduledFromAi: boolean` state flips after success — button shows "✓ On your schedule" and disables. Page reload would reset (could add duplicate). Acceptable v1 trade-off; user can delete duplicates from calendar drawer. Future v2 could check for existing `ai-coach`-source session today and skip.

### CSS — `startWorkoutRow` made wrap-friendly

Two buttons side-by-side on desktop, stacked on narrow viewports:

```diff
.startWorkoutRow {
   margin-top: var(--s-4);
   display: flex;
+  flex-wrap: wrap;
+  gap: var(--s-2);
 }
 .startWorkoutRow > * {
-  flex: 1;
+  flex: 1 1 200px;
 }
```

New `.todayErrorNote` for the failure case ("Couldn't add to your schedule — try again.").

### Files changed

```
apps/web/src/lib/featureFlags.ts            # computeTabsEnabled defaults to true; useTabsEnabled simplified
apps/web/src/routes/dashboard.today.tsx     # +parseAiSession() + button + handler
apps/web/src/routes/TabShared.module.css    # startWorkoutRow wrap-friendly + todayErrorNote
+ 5 version-bump files (apps/web/package.json, package.json, src/worker.js, version.ts, README)
+ CHANGELOG.md (this entry)
```

### Quick-wins #2–#5 — still queued

Per the founder-approved plan:

| Release | Theme | Effort |
|---|---|---|
| v9.12.9 | Streak counter on Today (max consecutive days with ≥1 ride) | ~2.5h |
| v9.12.10 | Quick-add from empty calendar cell (Month/Week/Day click → prefilled form) | ~2h |
| v9.12.11 | Repeat-weekly toggle on Plan a Session (1–12 weeks, sequential POSTs) | ~3h |
| v9.12.12 | Week-summary footer on Schedule (totals: hours, TSS, ride count) | ~2h |

Then **v9.13.0 = full AI plan persistence** (the larger feature: Coach generates a 7-day plan → persists each day as `planned_session` automatically). v9.12.8 is the smaller surface-level proof-of-concept that derisks v9.13's UX.

### Bundle

dashboard.today chunk: +1.5 KB (helper + button + state). featureFlags chunk: -0.2 KB (removed media query). Trivial.

### Why PATCH

Per the project's locked SemVer rule (CONTRIBUTING.md, post-v9.7.x): MINOR for new features, PATCH for hotfixes / corrections / surface-level additions. The desktop fix is a regression fix. The "Add to schedule" button is a small bridge feature that wires existing endpoints — qualifies as quick-win surface, not a structural feature. PATCH is right.

### Sprint 5 process

- ✅ Pre-coding scope alignment: founder previewed the 5-quick-win plan, greenlit, requested desktop fix bundled
- ✅ Phase-shift: bundled because both touch the dashboard surface; the alternative (separate v9.12.8 desktop-fix + v9.12.9 AI bridge) would have created two releases with one risk theme each, which is fine but adds release ceremony
- ✅ Pattern-replacement: not applicable
- ✅ Pre-deploy verification: `computeTabsEnabled` callers grep'd; `useCreatePlannedSession` already in use elsewhere
- ✅ Read git log -20 before any destructive op: not destructive (additive)

### Versions: 9.12.7 → 9.12.8 in 5 places

`apps/web/package.json`, `package.json`, `src/worker.js` (`WORKER_VERSION`), `apps/web/src/lib/version.ts`, `README.md` Current-release line.

---

## [9.12.7] — 2026-05-01

**In-app calendar pills adopt the SchedulePreview marketing visual.**

> Founder feedback right after v9.12.6: "make the scheduler individual and club look as the one into the landing/marketing page, it's really good. I like the bubbles in colors with this bold and time."

The marketing-page mini-week (FeatureSpread #03 visual added in v9.12.6) became the canonical look. This release transfers that aesthetic to the actual calendar grids that members use every day.

### Three visual changes

**1. Borders.** Every pill modifier now carries a 1px border at 0.32-alpha matching its background hue:

```css
.pill_ride            { border: 1px solid rgba(255, 77, 0, 0.32); }
.pill_social          { border: 1px solid rgba(80, 160, 220, 0.32); }
.pill_race            { border: 1px solid rgba(220, 140, 50, 0.32); }
.pill_personal_z1     { border: 1px solid rgba(59, 140, 232, 0.32); }
.pill_personal_z2     { border: 1px solid rgba(74, 222, 128, 0.32); }
.pill_personal_z3     { border: 1px solid rgba(250, 204, 21, 0.32); }
.pill_personal_z4     { border: 1px solid rgba(251, 146, 60, 0.32); }
.pill_personal_z5     { border: 1px solid rgba(239, 68, 68, 0.32); }
.pill_personal_z6     { border: 1px solid rgba(168, 85, 247, 0.32); }
.pill_personal_z7     { border: 1px solid rgba(165, 91, 224, 0.32); }
.pill_personal_default { border: 1px solid rgba(125, 130, 144, 0.32); }
```

Base `.pill` / `.weekEvent` / `.dayEvent` carry a transparent 1px border so the modifier can fill it without changing layout (`border-box` keeps width stable).

**2. Bold titles.** `.pillTitle` is now `font-weight: 600` (was 500). Matches the SchedulePreview's `font-weight: 600` on `schedPillTitle`. `.dayEventTitle` was already 600 — no change there.

**3. Duration chips.** New helper `formatDuration(mins)` in `Calendar/types.ts`:

```ts
export function formatDuration(mins: number | null | undefined): string | null {
  if (mins == null || !Number.isFinite(mins) || mins <= 0) return null;
  const h = mins / 60;
  if (Number.isInteger(h * 4)) return `${h}h`;        // 0.5h, 0.75h, 1h, 1.25h, 1.5h, 2h
  return `${h.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}h`;  // legacy non-canonical
}
```

Returns `null` when no duration is set so callers can conditionally render. Added as a mono small-opacity chip to all 3 grids:

- **Month** → `<span class="pillDur">` end-anchored after the title (`margin-left: auto`)
- **Week** → `<span class="weekEventDur">` below the title (column flex)
- **Day** → New `<span class="dayEventTopRow">` flex container holds `[time]` + `[duration]` side-by-side; title sits below (so the user reads "09:00 ──── 1.5h" then "Sweet-spot intervals · 3×12" — same hierarchy as the marketing visual)

### Pill metrics aligned to SchedulePreview

```diff
- .pill { padding: 2px 4px; border-radius: var(--r-1); }
+ .pill { padding: 3px 6px; border-radius: 4px; }
- .weekEvent { border-radius: var(--r-1); }
+ .weekEvent { border-radius: 4px; }
- .dayEvent { border-radius: var(--r-2); }
+ .dayEvent { border-radius: 6px; }
```

Tightens to brutalist sharp-cornered radii. SchedulePreview's pill is `border-radius: 4px` — the in-app Day pill stays slightly larger (6px) since it's a much bigger surface.

### Tooltip update

Month pills' `title` attribute now includes duration:

```diff
- title={`${e.title}${cancelled ? ' · cancelled' : ''}${rsvpSuffix}`}
+ title={`${e.title}${cancelled ? ' · cancelled' : ''}${dur ? ` · ${dur}` : ''}${rsvpSuffix}`}
```

### Files changed

```
apps/web/src/components/Calendar/types.ts             # +formatDuration() helper
apps/web/src/components/Calendar/Calendar.module.css  # borders on 11 modifiers; bold pillTitle; +pillDur, +weekEventDur, +dayEventDur, +dayEventTopRow; padding+radius polish
apps/web/src/components/Calendar/MonthCalendarGrid.tsx  # +pillDur chip + tooltip dur
apps/web/src/components/Calendar/WeekCalendarGrid.tsx   # +weekEventDur chip
apps/web/src/components/Calendar/DayCalendarGrid.tsx    # +dayEventTopRow + dayEventDur chip
+ 5 version-bump files (apps/web/package.json, package.json, src/worker.js, version.ts, README)
+ CHANGELOG.md (this entry)
```

### Surfaces that benefit (free cascade)

Both consumers of `MonthCalendarGrid` / `WeekCalendarGrid` / `DayCalendarGrid` get the new look automatically:

1. `/dashboard/schedule` — personal scheduler (multi-club + planned_sessions aggregator)
2. `/clubs/:id/schedule` — ScheduleTab in the club dashboard

EventDetailDrawer header pill also gets a border via the same modifier classes — drawer reads cohesive with the calendar pills now.

### Bundle

Calendar chunk: +0.4 KB (CSS additions + 8-line helper + 3 markup tweaks). Trivial.

### Why PATCH

Per the project's locked SemVer rule (CONTRIBUTING.md, post-v9.7.x): MINOR for new features, PATCH for hotfixes / corrections / visual polish. v9.12.7 is pure visual treatment — no new feature, no new endpoint, no schema change. PATCH is right.

### Sprint 5 process

- ✅ Pre-coding scope alignment: founder identified the SchedulePreview as the canonical look; this release lifts it directly into the calendar primitives
- ✅ Pattern-replacement: not applicable (single coherent visual change, not a fix-then-fix-then-replace)
- ✅ Pre-deploy verification: 3 grid components grep'd; all `getEventPillClass` consumers checked; no breaking selector changes
- ✅ Both surfaces (personal scheduler + club ScheduleTab) inherit automatically — no per-surface edits

### Versions: 9.12.6 → 9.12.7 in 5 places

`apps/web/package.json`, `package.json`, `src/worker.js` (`WORKER_VERSION`), `apps/web/src/lib/version.ts`, `README.md` Current-release line.

---

## [9.12.6] — 2026-05-01

**Landing page UX correction — back to a marketing landing.** Founder feedback right after v9.12.5: the "Built · Shipping next" issue grid I added wasn't a marketing surface, it was an engineering log. Wrong tool for the conversion page.

> "The 'what you get' landing is not a list of issues delivered — it's a list of features our personas can use. It's a marketing landing page. Pick functional features we are adding (with value for the final user) and do this marketing landing. Goal: share with potential members of the app — they must understand what they get and understand the value of using our app."

### What changed

| Section | Before (v9.12.5) | After (v9.12.6) |
|---|---|---|
| `№01` | Daily form (PMC) | Daily form (PMC) — unchanged |
| `№02` | "Plan and ride structured sessions" | **Reverted** to "Today's session, ready to ride" (the AI-coach value pillar) — what cyclist friends responded to |
| `№02b` | Issue grid: 15 built / 8 queued | **REMOVED entirely** |
| `№03` | Club that runs itself | **NEW**: "Your week, on one calendar" — Sprint 5 hero as a value pillar |
| `№04` | — | Club that runs itself (was №03) |

### Removed

The `№ 02b — Built · Shipping next` 2-column status grid is gone. With it: `.builtSection`, `.builtGrid`, `.builtCol`, `.builtTag`, `.inlineLink` CSS classes and the inline `<a href="/whats-next">` link.

Roadmap-detail content (15 built + 8 queued items) belongs at `/whats-next` (the existing public roadmap page, GitHub-Issues-driven). That surface is for engineering transparency. The marketing landing is for value pillars.

### Added — FeatureSpread #03 "Your week, on one calendar"

The Sprint 5 hero feature (personal scheduler + plan-a-session + drawer actions + zone-coloured pills) was previously buried in #02's body copy. Now it's its own marketing value pillar:

```jsx
<FeatureSpread
  num="03"
  title="Your week, on one calendar"
  kicker="Solo sessions + club rides — same surface, zone-coloured."
  body="Block out tomorrow's sweet-spot day or Sunday's recovery spin in
        seconds. Your personal sessions sit next to your club rides on the
        same calendar — colour-coded by zone so you read the week at a glance.
        Edit, swap, mark done, cancel. The calendar is honest about your time:
        a 2-hour ride visually books two hours."
  visual={<SchedulePreview />}
/>
```

### Added — SchedulePreview visual component

Page-local component, brutalist mini-week. Shows 6 days with stacked pills:

- TUE · Z2 Endurance · 1.5h (green)
- WED · Z4 Sweet-spot · 1h (orange)
- THU · *rest* (italic faint)
- FRI · Z1 Recovery · 0.75h (blue)
- SAT · Saturday Crew · 2.5h (accent — club ride)
- SUN · Z3 Tempo · 2h (yellow)

Header shows "THIS WEEK" + a Marco-persona pill ("Marco · FTP 285"). Visual proof of the "solo + club on one calendar, zone-coloured, time-blocked" promise.

CSS classes added to `Landing.module.css`: `.schedPrev`, `.schedHead`, `.schedHeadDay`, `.schedList`, `.schedRow`, `.schedDay`, `.schedItems`, `.schedRest`, `.schedPill`, `.schedPillTitle`, `.schedPillDur`, `.schedPillZ1`…`.schedPillZ7`, `.schedPillClub`. Mirrors `WorkoutPreview`'s brutalist tokens (`var(--c-surface)` background, `var(--c-line-strong)` border, monospace day labels, 0.16-alpha zone-coloured pill backgrounds with 0.32-alpha borders, `var(--c-accent-soft)` for club rides).

### #02 body refresh

```diff
- Today's session, ready to ride
- One tap. The workout, the zones, a route that fits.
- The plan adapts to how you're feeling. Hard day after a strong week. Easy
- day after a slammed one. Routes from your saved Strava list, ranked against
- today's target. Open in Strava with one tap and go.

+ Today's session, ready to ride
+ One tap. The workout, the zones, the watts.
+ The plan reads your form and matches the effort. Hard day after a strong
+ week. Easy day after a slammed one. The session lands as a structured
+ brief — duration in hours, zone-tagged blocks, target watts. Tick it done
+ as you ride; your form curve catches up automatically.
```

Removed the "saved Strava routes ranked" line — route picker hasn't shipped yet (queued for v9.10/Sprint 6). Replaced with "tick it done as you ride; your form curve catches up automatically" — true value of the structured-brief + Mark-done UX flow now live.

### #04 (was #03) kicker refresh

```diff
- kicker="Overview · Schedule · Members"
+ kicker="Overview · Schedule · Members · Metrics."
```

Reflects the actual 4-tab club shell (Metrics tab shipped in v9.7.x).

### Net effect on the page

The WHAT-YOU-GET section now tells **4 value-pillar stories**, each with a brutalist visual:

1. **Daily form** (Marco) — `<PmcStrip>` showing CTL/ATL/TSB
2. **Today's session** (Marco) — `<WorkoutPreview>` showing the structured workout
3. **Your week, on one calendar** (Marco) — `<SchedulePreview>` showing 6 days of zone-coloured pills + a club ride
4. **A club that runs itself** (Sofia + Léa) — `<ClubLayerPreview>` showing club stats + AI Circle Note

Each is a marketing-tone value pillar a potential member would recognise. The roadmap-detail page (`/whats-next`) still ships everything else.

### Bundle

Landing chunk: -3 KB (issue grid + 5 CSS classes removed) + 2 KB (SchedulePreview component + 14 CSS classes added) = net **-1 KB**. Visually richer, technically lighter.

### Why PATCH (not MINOR)

Per the project's locked SemVer rule (CONTRIBUTING.md, post-v9.7.x): MINOR for new features, PATCH for hotfixes / corrections. v9.12.6 is a UX correction to a marketing-surface miss in v9.12.5 — no new app feature, no new endpoint, no schema change. PATCH is right.

### Sprint 5 process

- ✅ Founder caught the framing miss within minutes — fast feedback loop, exactly what cyclist-testing is for
- ✅ Right-sized ceremony: this is a small surgical correction, no plan/spec needed
- ✅ Pre-deploy verification: the diff is contained to Landing.tsx + Landing.module.css
- ✅ No risk surface: pure marketing copy + one new visual component

### Versions: 9.12.5 → 9.12.6 in 5 places

`apps/web/package.json`, `package.json`, `src/worker.js` (`WORKER_VERSION`), `apps/web/src/lib/version.ts`, `README.md` Current-release line.

---

## [9.12.5] — 2026-05-01

**Personal-session UX bundle + Landing page features sweep.** Single risk theme: personal sessions become first-class on the calendar and in the drawer. Three items, all wired to existing backend endpoints — no schema, no worker change beyond version bump. Bundled with a Landing page refresh driven by Marco-persona cyclist-friend feedback.

### 1. Visual differentiation (atom + zone tokens)

`SessionIcon` joins the icon family — 1.6px stroke, 24×24, three rising bars evoking interval structure. Distinct from RideIcon's bicycle (which means "club ride"). Cyclists read it as "planned workout structure" at thumbnail size.

Zone-coloured pill classes added to `Calendar.module.css`: `.pill_personal_z1` … `.pill_personal_z7`, plus `.pill_personal_default` (neutral grey for untargeted sessions). Each consumes the existing `--c-z1`…`--c-z7` tokens (Strava-aligned: blue/green/yellow/orange/red/purple/violet, AA-compliant since v9.1.4) at 0.16-alpha background tint with full-saturation foreground.

`getEventPillClass(e, styles)` helper centralises the resolution logic — all three grids (Week/Day/Month) call it identically. Personal sessions get zone-coloured pills; club events keep their event-type styling.

EventDetailDrawer header pill switches: `SessionIcon + "Session"` for personal events, type icon + label for club events. Personal "Mode" line augments to show zone label when set: "Solo session · Z2 · Endurance".

### 2. Drawer mutations for personal sessions

Three new actions on personal-session drawer footer:

- **Edit** → navigates to `/dashboard/schedule-new?id=N&range=YYYY-MM`. Page reuses the create template; `validateSearch` parses the params; `useMyScheduleByMonth(range)` fetches (cache-friendly since user came from the calendar view); `useEffect` hydrates form state once the session arrives; PATCH on submit instead of CREATE.
- **✓ Mark done** → inline-confirm → `usePatchPlannedSession({ completed_at: now })`. Drawer reopens to "✓ Completed on [date]" banner (no buttons).
- **Cancel** → inline-confirm → `useCancelPlannedSession()`. Drawer reopens to existing cancelled banner.

State machine on the drawer:
```ts
type ConfirmKind = null | 'cancel-club' | 'cancel-personal' | 'mark-done' | 'unsubscribe';
```

`useEffect` resets `confirm` when `event.id` changes — opening a different event doesn't surface a stale confirmation.

### 3. Unsubscribe (club events the caller RSVP'd but didn't create)

`useRsvp(clubId, eventId)` mutation already exists (v9.6.2). Drawer adds inline-confirm Unsubscribe button when `!is_personal && clubId && callerAthleteId && !isCreator && !canManage`. POST `/api/clubs/:id/events/:eventId/rsvp` with `status: 'not_going'`.

Hook extended: `useRsvp` `onSuccess` now also invalidates `['me','schedule']`. Net effect: unsubscribing from a club ride drops it from your personal calendar immediately.

### CalendarEvent type extended

```ts
zone?: number | null;          // Coggan 1-7; drives pill color
completed_at?: number | null;  // drives drawer "✓" banner
club_id?: number;              // routes Cancel/Unsubscribe to the right club
```

`dashboard.schedule.tsx` mapper sets `zone`, `completed_at` from `s.zone` / `s.completed_at` for personal sessions; sets `club_id` from `e.club_id` for club events. Drawer reads them at open.

### Edit-mode in `dashboard.schedule-new.tsx`

```ts
interface SchedNewSearch { id?: number; range?: string; }

validateSearch: (search) => ({
  id: Number.isFinite(Number(search.id)) ? Number(search.id) : undefined,
  range: /^\d{4}-\d{2}$/.test(search.range) ? search.range : undefined,
}),
```

When `id` present: cache lookup → prefill → PATCH. Loading state shown if cache miss (rare — drawer→edit flow keeps cache warm).

### Atomic-design — honored at the right layer

| Layer | This release |
|---|---|
| Tokens | Reuse `--c-z1`…`--c-z7` (no new) |
| Atoms | `SessionIcon` joins `design/icons/index.tsx` |
| Molecules | Drawer footer state-machine kept inline (single use; YAGNI) |
| Templates | `/dashboard/schedule-new` reused for create+edit |

A formal structural sweep — extract `EventPill`, `DrawerActionFooter`, `MetaRow` as named molecules — is queued as a dedicated **v9.13.x ADR**. Not bundled here; would muddy the UX risk theme.

### Landing page "What you get" sweep (Marco-persona feedback)

Founder reported cyclist friends (Marco-persona testers) are giving feedback now. The marketing surface needs to reflect actual delivered state + transparent backlog.

**Refreshed copy** for the 3 existing FeatureSpread blocks:
- #01 — daily form, now mentions personal calendar pairing
- #02 — repositioned from "AI session + routes" to "plan and ride structured sessions" (the actual Sprint 5 hero feature)
- #03 — club layer, mentions Schedule + Metrics tabs (now shipped) and Circle Note as the AI weekly recap

**New `№ 02b — Built · Shipping next` section** below the marquee:
- ✓ Built · live now (15 items): Today daily form, AI session brief, Rides history, Z1–Z7 zones, Personal scheduler, Plan a session, Calendar time-blocking, Drawer actions, Zone-coloured pills, Clubs create/join, Schedule + RSVP, AI Circle Note, Members + Metrics, PWA install, Strava OAuth
- → Queued · Sprint 6 / next (8 items): v9.13 AI plan persistence, v9.14 shareable rides, v9.10 live route picker, S6 multi-timezone, S6 club analytics, S6 club invite links, S7 goals/races, S7 FTP detection

CSS: new `.builtSection`, `.builtGrid`, `.builtCol`, `.builtTag`, `.inlineLink` classes in `Landing.module.css` (~70 lines, single new section). Re-uses existing `.sectionHead` / `.sectionH2` / `.sectionLede` patterns.

### Sprint 5 process

- ✅ Pre-coding scope alignment: founder previewed 4 decisions, greenlit (1)–(4); zone palette delegated to design (turned out to already exist as tokens)
- ✅ Phase-shift: structural atomic-design refactor moved to dedicated v9.13.x ADR
- ✅ Pattern-replacement: not applicable — drawer footer state-machine doesn't yet cross the 3-fix threshold
- ✅ Pre-deploy verification: `getEventPillClass`, `is_personal` discriminator, `completed_at` PATCH path, `useRsvp` cache invalidation, route `validateSearch` — all grep'd before changing; build green; no schema change to verify

### Bundle

Dashboard chunk: +1.5 KB. Drawer chunk: +2 KB. Landing chunk: +2.5 KB (new built/next section). Trivial.

### Files changed (10 components + 1 hook + 4 version files + 2 docs)

```
apps/web/src/design/icons/index.tsx           # +SessionIcon
apps/web/src/components/Calendar/types.ts     # +zone, completed_at, club_id, getEventPillClass()
apps/web/src/components/Calendar/Calendar.module.css  # +pill_personal_z{1..7}, drawerCompleted
apps/web/src/components/Calendar/MonthCalendarGrid.tsx  # use getEventPillClass
apps/web/src/components/Calendar/WeekCalendarGrid.tsx   # use getEventPillClass
apps/web/src/components/Calendar/DayCalendarGrid.tsx    # use getEventPillClass
apps/web/src/components/Calendar/EventDetailDrawer.tsx  # full footer rewrite + 4 confirm states
apps/web/src/hooks/useClubs.ts                # useRsvp invalidates ['me','schedule']
apps/web/src/routes/dashboard.schedule.tsx    # club_id mapping + drawer wiring + onEdit nav
apps/web/src/routes/dashboard.schedule-new.tsx  # validateSearch + edit mode + PATCH path
apps/web/src/pages/Landing.tsx                # 3 FeatureSpread refreshes + new built section
apps/web/src/pages/Landing.module.css         # +builtSection styles
+ 5 version-bump files (apps/web/package.json, package.json, src/worker.js, version.ts, README)
+ CHANGELOG.md (this entry)
```

### Versions: 9.12.4 → 9.12.5 in 5 places

`apps/web/package.json`, `package.json`, `src/worker.js` (`WORKER_VERSION`), `apps/web/src/lib/version.ts`, `README.md` Current-release line.

---

## [9.12.4] — 2026-05-01

**Calendar timezone fix + hide "X going" on personal sessions.** Founder feedback after v9.12.3: "I create an event at 9am and on the calendar it shows at 7am" + "personal events shouldn't show RSVP — no one's going". Two surgical fixes; one risk theme: **calendar correctness**.

### Bug — every calendar render site forced UTC

Storage was correct from day one (UTC unix epoch is the right call). The display layer was the problem: every grid component read `getUTCHours()` / `getUTCMinutes()` instead of local accessors, and `EventDetailDrawer` had `timeZone: 'UTC'` baked into its date formatter. Net effect: a CEST viewer (UTC+2) saw every wall-clock time shifted -2h. Only personal sessions made this obvious because the round-trip is instant — type "9am", save, see "7am" two seconds later. Club events had the same offset but masked it (the day was correct, the relative spacing was preserved, and the chip text was small).

### 8 sites fixed (single risk theme)

| File | What changed |
|---|---|
| `Calendar/types.ts` | `formatHHMM` + `eventDateToCalendar` + `todayUTC` switched to `getHours/getMinutes/getFullYear/getMonth/getDate` |
| `Calendar/WeekCalendarGrid.tsx` | Block top-position + time chip use local hours/minutes |
| `Calendar/DayCalendarGrid.tsx` | Same |
| `Calendar/MonthCalendarGrid.tsx` | Time chip + tooltip title |
| `Calendar/EventDetailDrawer.tsx` | Removed `timeZone: 'UTC'` from `toLocaleDateString`; removed `· UTC` suffix from "When" line |
| `ClubEventModal/ClubEventModal.tsx` | Edit-roundtrip and Saturday-default no longer use `toISOString().slice(0,10)` (which is UTC) — uses local-component formatter instead |

### CTO basics for future multi-timezone — *no schema change*

JS `Date` already knows the browser's IANA timezone. By stopping the `getUTC*` over-correction:

- A Zurich author creating a 09:00 event stores it as UTC `07:00:00Z`
- A Lisbon (UTC+1) subscriber viewing the same event sees `08:00` automatically
- A Tokyo (UTC+9) traveler sees `16:00` automatically

No conversion code in our app. The browser does it. **The "basics for future multi-TZ" the founder asked for are now in place** — we were fighting the runtime, not enabling it.

### Deferred ADR — `tz` column for shareable events (v9.14)

When the share-via-link feature ships (founder identified this as a growth lever for Sprint 6 — a Strava-style "share this ride" public card), some events need an *author-intent* timezone in addition to the UTC moment. Example: a group meet-up at "09:00 Europe/Zurich" should display:

- For viewers also in Europe/Zurich → "09:00"
- For a viewer in Lisbon → "09:00 Europe/Zurich · 08:00 your time" (author-anchored)

That requires a nullable `tz TEXT` column on `club_events` and `planned_sessions` (IANA, e.g. `Europe/Zurich`), captured at write-time via `Intl.DateTimeFormat().resolvedOptions().timeZone`. **Deferred to v9.14** — adding the column without a consumer is dead weight.

### Personal sessions: hide RSVP, show "Solo session"

`CalendarEvent` type gained `is_personal?: boolean` discriminator (negative `id` was the soft-discriminator; this is now the source of truth). Set by `dashboard.schedule.tsx` when mapping `planned_sessions` → CalendarEvent. Affected display sites:

- **DayCalendarGrid** — hide `<span className={styles.dayEventCount}>{e.confirmed_count} going</span>`
- **MonthCalendarGrid** — tooltip title becomes `${title} · solo session` instead of `· 0 going`
- **EventDetailDrawer** — replaces the "RSVP / 0 going" row with "Mode / Solo session"

Club events unchanged (they keep the RSVP chip).

### Deferred to v9.12.5 (single risk theme: personal-session UX)

Carryover from v9.12.2's deferred bucket — kept separate to honor the "≤1 risk theme per release" rule:

- SessionIcon (1.6px stroke, 24×24) + zone-color pills for personal sessions
- Drawer Edit / Cancel / Mark-Done for personal sessions (own only)
- Unsubscribe button for club events I RSVP'd to but didn't create

### Sprint 5 process

- ✅ Pre-coding scope alignment: founder previewed the consolidated solution, greenlit (a)+(b), explicitly deferred (c) — matches the "2-min user preview" rule
- ✅ Phase-shift: `tz` column moved to v9.14 alongside the consumer; not bundled here
- ✅ Pattern-replacement: not applicable (single-bug fix across 8 sites)
- ✅ Pre-deploy verification: the 8 sites were grep'd before changing; build green; no schema change to verify

### Bundle

Calendar chunk: 14.80 → 14.93 KB (+0.13 KB). EventDetailDrawer +0.05 KB. Trivial.

### Versions: 9.12.3 → 9.12.4 in 5 places

`apps/web/package.json`, `package.json`, `src/worker.js` (`WORKER_VERSION`), `apps/web/src/lib/version.ts`, `README.md` Current-release line.

---

## [9.12.3] — 2026-05-01

**Duration in hours + calendar time-blocking.** Founder feedback after v9.12.2: "cycling time unit is hours, not minutes (0.5h, 1h, 1.5h)" + "when the event is created in the calendar the event needs to book this time (i.e. event starts at 15:00 and duration is 2h, calendar shows blocker 15:00 → 17:00)."

### Hours UI (cycling convention) — DB stays in minutes

Backend convention preserved: `duration_minutes INTEGER` (Migration 0009 from v9.12.2 unchanged). UI converts at the edges:

- **Input on submit**: `Math.round(hours * 60)` → minutes for the API
- **Read on edit**: `minutes / 60` → hours for the input

Updated forms:
- ClubEventModal: label "Duration (hours)" + `step=0.5` + `min=0` + `max=10` + placeholder `"1.5"`
- Add Session page (`/dashboard/schedule-new`): same treatment
- Validation error: "Duration must be 0–10 hours" (was "0–600 minutes")

Legacy events with non-half-hour durations display their fractional hour value (e.g. 75 min → "1.25"). Acceptable — most riders set 1h / 1.5h / 2h going forward.

### Calendar time-blocking

Week and Day calendar grids previously rendered every event at a fixed 90-min height (`DEFAULT_EVENT_DURATION_MINUTES = 90`). Now they read the actual `duration_minutes` and size the block proportionally to the 16h time band:

```ts
const durationMin = e.duration_minutes ?? FALLBACK_EVENT_DURATION_MINUTES;
const heightPct = (durationMin / 60 / TIME_GRID_HOURS) * 100;
```

Result: a 15:00 event with `duration_minutes: 120` renders as a block from 15:00 to 17:00. A 09:00 with `duration_minutes: 180` shows 09:00 to 12:00. Members can read the calendar at-a-glance and see actual time commitments.

Legacy events without `duration_minutes` fall back to 90 min — preserves layout for old data.

### Plumbing changes

`CalendarEvent` type (`apps/web/src/components/Calendar/types.ts`) gains `duration_minutes?: number | null`.

Three CalendarEvent construction sites updated:

1. **ScheduleTab.tsx** — uses `data?.events` directly; ClubEvent is a superset of CalendarEvent so duration_minutes flows through automatically (TypeScript structural typing)
2. **dashboard.schedule.tsx** — explicit `.map()` for both `club_events` (uses `e.duration_minutes`) and `planned_sessions` (uses `s.duration_minutes`)
3. **ClubDashboard.tsx UpcomingEventRow** — `handleRowClick` maps event to CalendarEvent for the drawer; adds `duration_minutes: event.duration_minutes`

### Sprint 5 process

- ✅ Paired verification: build green; manual TS scan; existing 28 e2e tests still pass
- ✅ Pre-commit grep — N/A (no schema change)
- ✅ POST → GET round-trip — validated via existing endpoint contract
- ✅ Verification budget — small, surgical patch; no new endpoints
- ✅ Bug post-mortems — none required

### Bundle

Dashboard chunk: 75.99 → 76.08 KB (+0.09 KB). Trivial. EventDetailDrawer chunk: 14.75 → 14.80 KB (+0.05 KB).

### Deferred to v9.12.4

The previously-deferred-from-v9.12.2 personal-session UX work still pending:

- **Visual differentiation**: SessionIcon (1.6px stroke, dumbbell, 24×24) + zone-color pills for personal sessions. Currently personal sessions render with 'ride' styling.
- **Drawer Edit/Cancel/Mark-Done** for personal sessions (own sessions only).
- **Unsubscribe button** for club events I RSVP'd to but didn't create.

Founder confirmed v9.12.2 items 1-6 OK; this v9.12.3 ships the new feedback (hours + time-blocking); v9.12.4 will close the v9.12.2 deferred bucket.

### Versions: 9.12.2 → 9.12.3 in 5 places

`apps/web/package.json`, `package.json`, `src/worker.js` (`WORKER_VERSION`), `apps/web/src/lib/version.ts`, `README.md` Current-release line.

---

## [9.12.2] — 2026-05-01

**Partial `#79` polish bundle:** mandatory event duration + asterisks/legend on required fields + BottomNav adapts to item count. Closes 3 of 5 founder-flagged items. Visual differentiation + personal-session drawer mutations deferred to v9.12.3 (substantial scope).

### Migration 0009 — `club_events.duration_minutes`

```sql
ALTER TABLE club_events ADD COLUMN duration_minutes INTEGER
  CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 0 AND 600);
```

Nullable at DB layer (legacy events without duration still query correctly); app-required on POST. Pre-CTO grep against schema.sql passed (column name reused from `planned_sessions` migration 0008 but on a different table — no conflict).

### Backend

`src/worker.js`:
- POST `/api/clubs/:id/events`: validates `duration_minutes` is 0–600 number; returns 400 with `{error: 'duration_minutes required (0-600)'}` if missing
- PATCH `/api/clubs/:id/events/:eventId`: accepts `duration_minutes` in patchable allowlist (null clears, 0–600 valid)
- GET range query: SELECT now includes `e.duration_minutes`; GROUP BY clause updated
- GET `/api/clubs/:id/overview` upcoming SQL: same treatment
- GET `/api/me/schedule` club_events stream: same

All 5 query/serialization paths updated together so the field round-trips cleanly.

### Frontend — mandatory-field UX

Brand-tone treatment per founder request ("as experience designer about the experience and tone for our brand/personas"):

```css
.required {
  color: var(--c-accent);
  margin-left: 2px;  /* Adjacent to label text, no space — brutalist tight */
}

.formLegend {
  font: 500 11px/1.4 var(--font-mono);
  letter-spacing: 0.08em;
  color: var(--c-text-faint);
  /* "* Required" — no "field" filler word; mono faint matches brand voice */
}
```

**ClubEventModal**: asterisks on Title, Format, Date, Time, Duration (5 required fields). New Duration field rendered before athletic fields, always visible (even when format = Social — coffee meetups still have a length).

**Add Session page** (`/dashboard/schedule-new`): asterisks on Title, Date, Time, Duration (4 required fields).

Both forms enforce required client-side AND server-side (defense in depth).

### `clubsApi.ts` types

- `ClubEvent.duration_minutes?: number | null` (optional in TS for backward-compat with legacy events)
- `UpcomingEvent.duration_minutes: number | null` (required field; can be null for legacy)
- `CreateClubEventInput.duration_minutes: number` (required, no `?` — UI must collect it)

### `#79` bug 5 — BottomNav 5th slot fix

v9.11.0 changed `grid-template-columns: repeat(4, 1fr)` → `repeat(5, 1fr)` to fit individual mode's new "Schedule" slot. But club mode renders 4 items (Overview/Schedule/Members/Metrics), leaving an empty 5th column.

**Fix:** `apps/web/src/components/BottomNav/BottomNav.module.css`:

```css
.list {
  display: flex;       /* was: display: grid */
  list-style: none;
  margin: 0;
  padding: 0;
}
.list > li {
  flex: 1;
  min-width: 0;
}
```

Flex distributes across whatever item count is rendered — 4 for club, 5 for individual, future-proof for any variant.

### Sprint 5 process adherence

- ✅ #1 Paired verification: build green; manual TS scan
- ✅ #2 Pre-commit grep against `schema.sql` — passed; `duration_minutes` reused on different table is fine
- ✅ #4 POST → GET round-trip — backend changes preserve existing endpoints; new field round-trips through 5 paths
- ✅ #5 Verification budget — kept tight by deferring v9.12.3 scope
- ✅ #6 Bug post-mortems — none required

### Deferred to v9.12.3 (next session)

- Visual differentiation between club events (color + format icon + club name chip) and personal sessions (zone color + SessionIcon)
- New `SessionIcon` SVG (1.6px stroke, 24×24, dumbbell silhouette)
- `EventDetailDrawer` extension: detect `event_source === 'personal_session'`, render Edit / Mark Done / Cancel buttons (gated on session ownership)
- Edit personal session: extend `dashboard.schedule-new.tsx` to accept `?id=N` query param + pre-fill from existing session
- Unsubscribe button in drawer for club events I RSVP'd but didn't create

### Bundle

Dashboard chunk: 74.92 → 75.99 KB (+1.07 KB) for the new fields + asterisk markup.

### Versions: 9.12.1 → 9.12.2 in 5 places

`apps/web/package.json`, `package.json`, `src/worker.js` (`WORKER_VERSION`), `apps/web/src/lib/version.ts`, `README.md` Current-release line.

---

## [9.12.1] — 2026-05-01

**Hotfix.** Two bugs from v9.12.0 visual review.

### `#80` — Add Session button silently failed (P0)

**Symptom:** Tap "+ Add session" on `/dashboard/schedule` → nothing happens. No navigation, no modal, no error.

**Root cause:** Tanstack file-based routing treats dot-segmented filenames as nested routes. `dashboard.schedule.new.tsx` was registered as a child of `dashboard.schedule.tsx`. For a child route to mount, the parent needs `<Outlet />`. The current `dashboard.schedule.tsx` is a self-contained page with no Outlet — so navigating to `/dashboard/schedule/new` resolved the parent (calendar visible) but never mounted the child (form never appeared). Browser URL changed; UI didn't.

**Fix:** Renamed file from `dashboard.schedule.new.tsx` → `dashboard.schedule-new.tsx` (dash separator, not dot). Tanstack treats this as a sibling route under `/dashboard`, not a child of `/dashboard/schedule`. URL becomes `/dashboard/schedule-new` (no parent-child nesting). Updated route file's `createFileRoute('/dashboard/schedule-new')` + the navigate call in the "+ Add session" button + the Cancel-button navigate-back path.

The `dashboard.schedule.new-CN2w4hb3.js` chunk now emits cleanly during build, confirming Tanstack registered the route correctly.

### `#78` follow-up — TopTabs alignment incomplete

**Symptom:** Founder still saw empty space on right of club tab bar after v9.12.0 (which added `flex: 1` to `.tab`).

**Root cause:** v9.12.0 added `flex: 1` to `.tab` but the parent `<ul className={styles.list}>` was content-width (no flex-grow). So tabs distributed evenly within a content-width ul, not across the full TopTabs container. Result: tabs were equally-sized but the whole row was still left-aligned with dead space on the right.

**Fix:** `apps/web/src/components/TopTabs/TopTabs.module.css`:

```css
.list { flex: 1; ... }
.list > li { flex: 1; min-width: 0; }
```

Full flex chain now: `.root` (nav, full width) → `.list` (ul, flex:1 fills root) → `<li>` (flex:1 fills list) → `.tab` (flex:1 fills li). Tabs genuinely span the container width.

### Sprint 5 process

- ✅ Verification: build green; new `dashboard.schedule-new-*.js` chunk confirms route registration
- ✅ Pre-commit grep against `schema.sql` — N/A (no schema change)
- ✅ POST → GET round-trip — N/A (no new endpoint)
- ✅ Verification budget — small targeted hotfix
- ✅ Bug post-mortems — both root causes documented above in post-mortem-shaped form

### Bundle

Net unchanged. Renamed file emits the same chunk under a different stable hash.

### Versions: 9.12.0 → 9.12.1 in 5 places

`apps/web/package.json`, `package.json`, `src/worker.js` (`WORKER_VERSION`), `apps/web/src/lib/version.ts`, `README.md` Current-release line.

---

## [9.12.0] — 2026-05-01

**Personal Scheduler v2 — planned-sessions data layer + 5 new endpoints + Add Session UX + TopTabs alignment fix.** Closes `#76`, `#77`, `#78`. Full architectural spec at `docs/post-demo-sprint/v9.12.0-cto-analysis.md` (475 lines, 10 sections — definition / impact / scalability / risks / implementation / deploy / tests / open questions).

### Migration 0008 — `planned_sessions` table

Foundational data layer for personal training sessions. Per CTO analysis §3.1:

- 13 columns including `session_date` (epoch), `title`, `description`, `zone` (1-7 Coggan, CHECK constraint), `duration_minutes` (CHECK 0-600), `target_watts` (CHECK 0-2000), `source` (enum manual/ai-coach/imported), `ai_report_id` (FK with `ON DELETE SET NULL`), `completed_at` + `cancelled_at` (soft state), `created_at`, `updated_at`
- Composite index `(athlete_id, session_date)` for month-range queries
- Partial index on `ai_report_id WHERE NOT NULL` for future AI-source analytics

Pre-CTO column-shape verification passed (Sprint 4 retro Improvement #2): grep'd schema.sql for column-name conflicts — all 13 columns clear. Applied to local + remote D1; verified via `PRAGMA table_info`.

### 5 new endpoints under `/api/me/sessions*`

All gated via `resolveAthleteId`. Write endpoints rate-limited 30/min on new `me-sessions-write` scope. Cross-user PATCH/Cancel/Uncancel return 404 OWASP (don't leak existence).

| Verb | Path | Behavior |
|---|---|---|
| `GET` | `/api/me/sessions?range=YYYY-MM` | List sessions for month |
| `POST` | `/api/me/sessions` | Create — validates title required, session_date ±5 years, zone 1-7, duration 0-600, watts 0-2000, source enum |
| `PATCH` | `/api/me/sessions/:id` | Allowlisted partial update — title, description, session_date, zone, duration_minutes, target_watts, source, completed_at |
| `POST` | `/api/me/sessions/:id/cancel` | Idempotent soft-delete (sets `cancelled_at`); second call returns existing timestamp |
| `POST` | `/api/me/sessions/:id/uncancel` | Restore (sets `cancelled_at = NULL`) |

### Extended `/api/me/schedule`

**Breaking shape change** (mitigated by single-PR shipping backend + frontend):

```diff
- { athlete_id, range, events: [...] }                          // v9.11.0
+ { athlete_id, range, club_events: [...], planned_sessions: [...] }  // v9.12.0
```

Both streams returned in a single response. Cancelled events/sessions excluded per `#74`. 5-min edge cache.

### Frontend

`apps/web/src/lib/clubsApi.ts`:
- New types: `PlannedSession`, `PlannedSessionSource` (`'manual' | 'ai-coach' | 'imported'`), `CreatePlannedSessionInput`, `PatchPlannedSessionInput`
- New API methods: `mySessions`, `createSession`, `patchSession`, `cancelSession`, `uncancelSession`
- `MyScheduleResponse` shape updated to match new `{club_events, planned_sessions}` server response

`apps/web/src/hooks/useClubs.ts`:
- New mutation hooks: `useCreatePlannedSession`, `usePatchPlannedSession`, `useCancelPlannedSession`
- All invalidate `['me', 'schedule']` and `['me', 'sessions']` query keys on success

`apps/web/src/routes/dashboard.schedule.tsx`:
- Merges `club_events + planned_sessions` into one CalendarEvent stream sorted by `event_date`
- "+ Add session" button in header → navigates to `/dashboard/schedule/new`
- Personal sessions render with the `'ride'` event-type styling for v9.12.0; visual differentiation (SessionIcon + zone colors) deferred to v9.12.1

`apps/web/src/routes/dashboard.schedule.new.tsx` (new file, ~190 LoC):
- Page-pattern Add Session form (per Rule #17 from v9.8.2 — modals on multi-platform are fragile)
- Fields: title (required), date + time (default = today 18:00), target zone selector (Z1-Z7 or Any), duration_minutes, target_watts, description (max 2000 chars)
- Validation: title required + ≤200 chars; date+time valid; duration 0-600; watts 0-2000
- On submit: `useCreatePlannedSession` → navigate back to `/dashboard/schedule`
- Cancel button navigates back without saving

### `#78` — TopTabs alignment fix

`.tab { flex: 1; min-width: 0; text-align: center; }` in `TopTabs.module.css`. Tabs distribute evenly across the container width — fixes the dead-space-on-right that founder reported on club tab bar.

### Scalability

Per CTO analysis §4: design supports ~10k users with current schema + indexes. Storage: 1k users × 25 sessions/month × 200B = 5 MB/month. Read latency: indexed lookup on `(athlete_id, session_date)` returns ~25 rows in single-digit ms cold. Aggregation `/api/me/schedule` is one query; 5-min edge cache absorbs bursts. KV-cache + materialized views are the evolution path at 50-100k users — not blocking now.

### Risk register acceptance

Per CTO analysis §5, 10 risks identified with mitigations. Highest-impact (R1: migration failure on remote D1) mitigated by atomic ALTER + drop-table rollback path; verified via `PRAGMA` post-apply. R3: 5-min edge cache staleness on Cancel/Edit accepted as up-to-5-min lag is acceptable for ride-day decisions. R4: permission-gate bypass mitigated by server-side `WHERE athlete_id = ?` on every mutation.

### Sprint 5 process adherence

- ✅ #1 Paired verification: build green; manual TS scan; CTO doc as paired artifact
- ✅ #2 Pre-commit grep against `schema.sql` — passed; no column-name conflicts
- ✅ #4 POST → GET round-trip — endpoint design supports this; smoke test plan in CTO §8
- ✅ #5 Verification budget — substantial release; CTO doc + 2-session split recommended (this session: Phases A+B+C+E+F; deferred Phase D visual differentiation + Phase G full e2e tests to v9.12.1)
- ✅ #6 Bug post-mortems — none required (no hotfix)

### Bundle

Dashboard chunk unchanged at 74.92 KB. New routes (`dashboard.schedule.new.tsx`) emit their own chunks. Net change: +~6 KB across split chunks for the new page + types + hooks.

### Versions: 9.11.0 → 9.12.0 in 5 places

`apps/web/package.json`, `package.json`, `src/worker.js` (`WORKER_VERSION`), `apps/web/src/lib/version.ts`, `README.md` Current-release line.

### v9.12.1 follow-up scope

- Phase D from CTO doc: SessionIcon (1.6px stroke, 24×24, dumbbell silhouette) + zone-color rendering for personal sessions on calendar pills
- Drawer Edit/Cancel/Mark-Done buttons for personal sessions (uses `usePatchPlannedSession`/`useCancelPlannedSession`)
- Unsubscribe button in drawer for club events I RSVP'd to (uses existing `useRsvp`)
- Phase G full Playwright e2e suite from CTO §8.3

---

## [9.11.0] — 2026-05-01

**Bundled 4-issue release: Personal scheduler (`#61`) + cancelled-events filter (`#74`) + Overview Edit/Cancel (`#75`) + Landing copy rewrite (`#64`).** Per founder direction: `#56` clubs share/invite deprioritised; v9.10.0 reserved as the slot for Route picker integration whenever that ships.

### `#61` — Personal scheduler at `/dashboard/schedule`

Aggregates events across ALL clubs the caller is a member of, filtered to events they're going to (RSVP'd `going`) OR created themselves. New top-level dashboard route alongside `/dashboard/today`, `/dashboard/train`, etc.

**Backend:** new endpoint `GET /api/me/schedule?range=YYYY-MM`:

- Auth-gated via `resolveAthleteId`
- Validates `range` shape + bounds (2000-2100, 1-12)
- Single D1 query: `club_events` JOIN `clubs` JOIN `club_members` (membership gate) LEFT JOIN `event_rsvps` (caller's own RSVP) + subquery for `confirmed_count`
- Filter: `event_date BETWEEN start AND end AND cancelled_at IS NULL AND (created_by = me OR my_rsvp.status = 'going')`
- Returns up to 200 events ordered by `event_date ASC`
- Each event includes `club_name`, `is_creator`, `is_going` flags + full event shape
- 5-min edge cache (`Cache-Control: private, max-age=300`)

**Frontend:** new `apps/web/src/routes/dashboard.schedule.tsx` (Tanstack file-based route at `/dashboard/schedule`):

- Reuses Calendar primitives (Month/Week/Day grids + EventDetailDrawer) — same look as per-club Schedule tab
- View toggle (Month / Week / Day) + filter chips (ride/social/race) + date nav — mirrors ScheduleTab UX
- Drawer is read-only in v9.11.0 (no Edit/Cancel from personal view yet — cross-club permission model needs more thought; deferred to v9.11.x or v9.12.x)
- New `useMyScheduleByMonth(range)` Tanstack Query hook

**Deferred from `#61` spec:**
- Stream 3 (AI plan items from `ai_reports.plan_json`) — schema not yet stable enough to parse reliably
- Stream 4 (goals from `goals` table) — needs goals.target_date field which lands with `#49`/`#50` Sprint 7 work

Both can ship as v9.11.x patch releases when the underlying data is ready.

### `#74` — Cancelled events filtered from upcoming/agenda lists

Founder rule (locked 2026-05-01): when an event is cancelled, it must be removed from upcoming/agenda lists in BOTH the Club Overview AND the Personal scheduler. The calendar grids (Month/Week/Day) continue to show cancelled events with strikethrough — that's intentional FYI signal; the upcoming/agenda lists are "what's actually happening" lists.

**Changes:**
- `GET /api/clubs/:id/overview` upcoming-events SQL: `WHERE e.club_id = ? AND e.event_date >= ?` → `WHERE ... AND e.cancelled_at IS NULL`
- New `/api/me/schedule` endpoint applies same filter

### `#75` — Edit + Cancel from Club Overview Upcoming Events

The drawer's Edit + Cancel UX (shipped in v9.7.3 + v9.9.0 for the Schedule tab) is now reachable from the Overview tab too — admins / event creators don't need to switch to Schedule first to fix a typo or cancel a ride.

**Backend:** `GET /api/clubs/:id/overview` upcoming-events SELECT expanded from 5 fields to 16 fields:

```diff
- SELECT e.id, e.title, e.event_date, e.location, COUNT(...) AS confirmed_count
+ SELECT e.id, e.club_id, e.created_by, e.title, e.description, e.location,
+        e.event_date, e.event_type, e.created_at,
+        e.distance_km, e.expected_avg_speed_kmh, e.surface, e.start_point,
+        e.route_strava_id, e.description_ai_generated, e.cancelled_at,
+        COUNT(...) AS confirmed_count
```

`UpcomingEvent` TS type expanded to match (now mirrors full `ClubEvent` shape).

**Frontend:**
- `UpcomingSection` accepts `onEventClick?: (event: CalendarEvent) => void` prop, threads to `UpcomingEventRow`
- `UpcomingEventRow` becomes clickable (article + role=button + tabIndex=0 + Enter/Space keyboard handler). RSVP button gets `e.stopPropagation()` so it doesn't double-trigger
- `ClubDashboard` adds `[overviewActiveEvent, setOverviewActiveEvent]` state + renders `EventDetailDrawer` at the dashboard root level (so it survives tab changes)
- Drawer's `onEdit` callback maps the row's CalendarEvent back to the full ClubEvent (from overview.upcoming_events) and bubbles to existing `openEditEvent` lifted state — same modal-in-edit-mode flow as ScheduleTab

CSS: `.eventRowClickable` adds cursor pointer + hover + focus-visible. WCAG-compliant keyboard interaction.

### `#64` — Landing page copy rewrite

External UX feedback (Dentsu Creative designer, 2026-05-01): "the UI looks sleek but obviously how Claude sets up most sites... I think you need to dumb it down. less tech terms easier value proposition."

Stripped jargon, replaced with concrete benefit framing. Examples:

| Was (tech-heavy) | Now (de-jargonised) |
|---|---|
| Hero pill: "Cycling clubs with an AI training brain" | "Cycling clubs that actually feel like a club" |
| Hero lede: "PMC for the solo rider. Overview, schedule, RSVPs and an AI-drafted weekly note for the club. Three personas, one app — AI embedded where it matters, not bolted on. Strava-native, mobile-first, free." | "Connect Strava in 10 seconds. Join your club, or start one. See what's on this week. An AI coach that learns your form — and helps your crew plan rides together. Free to start. Works on your phone." |
| Feature 01: "Live training status" / "Form, fitness, fatigue — at-a-glance" | "Know what shape you're in — every day" / "The first thing you see in the morning." |
| Feature 03: "A club layer, AI embedded" | "A club that runs itself" |
| Pricing: "Personal AI plans · ≈ $0.02 · Per /coach plan. Anthropic Sonnet. Your key, your bill." | "Personal AI coach · ~50¢/mo · Optional. Bring your own AI key. Skip it and your training brain still works." |
| Final CTA: "PMC, plan, route picker, club layer — all yours, all local, all free" | "Your training brain ready. Your club waiting. All yours, all on your phone, all free" |

For-You / Not-For-You list: replaced "FTP / CTL/ATL/TSB at-a-glance" with "see what shape you're in" framing.

Marco's technical credibility maintained through depth (still references zones, target watts, power data) but the entry-level copy now serves Sofia + Léa equally.

### Nav reorder

TopTabs + BottomNav add a "Schedule" slot between Today and Train:

- BottomNav `grid-template-columns: repeat(5, 1fr)` (was 4)
- ScheduleIcon (already in design system from v9.7.2)
- TopTabs items array adds entry for `/dashboard/schedule`

### Bundle

Dashboard chunk: 88.33 → 74.92 KB (-13.41 KB / -15%). Vite split EventDetailDrawer into its own chunk (14.75 KB) because it's now consumed by 3 callers (ScheduleTab + ClubDashboard Overview + dashboard.schedule route). Net bundle is similar but better cached across routes.

### Sprint 5 process adherence

- ✅ #1 Paired verification: build green via vite-then-tsc; manual scan
- ✅ #2 Pre-commit grep against `schema.sql` — N/A (no schema change; existing columns from v9.7.3)
- ✅ #4 POST → GET round-trip — N/A (read-only endpoint)
- ⚠ #5 Verification budget — bundled 4 themes; founder approval given but theme-overlap is real (Overview Edit + Personal scheduler both touch the same drawer pattern; cancelled filter touches both endpoints; Landing rewrite is independent)
- ✅ #6 Bug post-mortems — none required (no hotfix triggered)

### Versions: 9.9.0 → 9.11.0 in 5 places

`apps/web/package.json`, `package.json`, `src/worker.js` (`WORKER_VERSION`), `apps/web/src/lib/version.ts`, `README.md` Current-release line.

**Note: v9.10.0 reserved** as a planning slot for Route picker integration. Per founder direction at v9.8.x naming-convention lock: "v9.10.0 reserved for Route picker (whenever that ships)". v9.10.0 is intentionally skipped in deployment; SemVer permits gaps as long as ordering is monotonic.

---

## [9.9.0] — 2026-05-01

**First MINOR-correct feature release.** Bundles `#60` Edit UX (event lifecycle completion) + `#73` e2e drift fixes. Closes both. Per Sprint 1 retro Improvement #6 (one risk theme per release), this is technically two themes — but they don't share blast radius (Edit UX is in the drawer/modal; e2e drift is test-only) so founder approved bundling.

### `#60` follow-up — Edit UX in EventDetailDrawer

The v9.7.3 PATCH endpoint has been wired-but-unused since shipping. v9.9.0 turns on the UI: the drawer's previously-disabled Edit button now opens `ClubEventModal` in edit mode.

**State lifting (`ClubDashboard.tsx`):** `[eventToEdit, setEventToEdit]` state added at the dashboard level so create + edit share a single modal instance. Three handlers:

```tsx
const openCreateEvent = () => { setEventToEdit(null); setEventModalOpen(true); };
const openEditEvent = (e: ClubEvent) => { setEventToEdit(e); setEventModalOpen(true); };
const closeEventModal = () => { setEventModalOpen(false); setEventToEdit(null); };
```

The "+ Post event" admin button calls `openCreateEvent`. The drawer's Edit button (via ScheduleTab) calls `openEditEvent`. Both close via `closeEventModal` which resets the edit state.

**Threading (`ScheduleTab.tsx`):** new `onEditEvent?: (event: ClubEvent) => void` prop. Threaded down to `<EventDetailDrawer onEdit={...}>`. The drawer holds a `CalendarEvent` (subset shape — what the calendar primitives need); on Edit click, ScheduleTab maps the calendar event back to its full `ClubEvent` from the range query results before bubbling up.

**Drawer Edit button (`EventDetailDrawer.tsx`):** now functional when `onEdit` prop provided. Cancel-event UI unchanged. Note: button hides entirely when `onEdit` is absent (e.g. personal scheduler aggregation in v9.9.0+1 won't pass it for events the caller doesn't own).

**Modal edit mode (`ClubEventModal.tsx`):** new `event?: ClubEvent | null` + `onUpdated?: () => void` props. When `event` is provided:
- Pre-fills all 9 form fields from event values (title, description, location, date+time decomposition from event_date epoch, event_type, distance_km, expected_avg_speed_kmh, surface, start_point, descIsAi)
- Title "Edit event" instead of "Create an event"
- Lede "Update the details. Members see the changes immediately."
- Submit button "Save changes" / "Saving…" instead of "Post event" / "Posting…"
- Submit calls `patchEvent.mutateAsync({eventId, input})` instead of `createEvent.mutateAsync(input)`
- Athletic fields (distance, speed, surface) get cleared (sent as `null`) when format = social, so a Ride→Social toggle in edit mode doesn't leave stale data
- `description_ai_generated` preserved on PATCH (server-side endpoint doesn't accept it; flag survives via DB state)

**No backend changes** — `usePatchClubEvent` hook exists from v9.7.3; the PATCH endpoint at `worker.js:678` accepts the allowlisted partial-update body unchanged.

### `#73` — Playwright e2e drift fixes

Pre-existing test failures since v9.7.0 dashboard refactors. 5 assertions updated:

| File:line | Was | Now |
|---|---|---|
| `mobile-tabs.spec.ts:43` | `headerCount` count check (instant) | `waitFor({state:'attached', timeout:5000})` first — TopBar mounts after route resolution |
| `smoke.spec.ts:50` | `getByRole('heading',{level:1})` contains "Marco" | `getByRole('heading').filter({hasText:/Marco/i}).first()` — greeting moved to h2 in dashboard.today refactor |
| `smoke.spec.ts:97-98` | `expandBtn.scrollIntoViewIfNeeded()` (could time out at 30s) | `expandBtn.waitFor({state:'attached', timeout:10000})` first |
| `smoke.spec.ts:124-125` | `a[href="#today"]` instant check | `waitFor({state:'attached', timeout:5000})` first |
| `tabs.spec.ts:35-39` | goto + waitForLoadState + URL check | goto + `waitForURL(/\/dashboard\/today/, {timeout:10000})` — was flaky (first attempt failed, retry passed) |

These are robustness fixes — selectors are now lenient about render timing rather than insisting the page is ready immediately. No production code changes.

### Sprint 5 process adherence

- ✅ #1 Paired verification: build green; manual TS scan; grep for unused imports
- ✅ #2 Pre-commit grep against `schema.sql` — N/A (no SQL change)
- ✅ #4 POST → GET round-trip — N/A (no new endpoints; PATCH wired through existing endpoint)
- ✅ #5 Verification budget within 12% — direct in-context implementation
- ✅ #6 Bug post-mortems — none required (no hotfix triggered)
- ⚠ #6 (Sprint 1 retro) "One risk theme per release" — technically violated by bundling Edit UX + e2e drift; founder explicit override given the non-overlapping blast radii

### Bundle

Dashboard chunk: 86.70 → 88.33 KB (+1.63 KB / +1.9%) — edit-mode branching + state lifting.

### Versions: 9.8.2 → 9.9.0 in 5 places

`apps/web/package.json`, `package.json`, `src/worker.js` (`WORKER_VERSION`), `apps/web/src/lib/version.ts`, `README.md` Current-release line.

---

## [9.8.2] — 2026-05-01

**Architectural fix — Create Club modal replaced with dedicated page route.** Closes `#71` (P0) + `#72`.

### Why this release exists

The Create Club flow has hit three distinct bug classes since shipping v9.7.0:

| Release | Bug | Fix attempted |
|---|---|---|
| v9.7.5 | `#69` Name input above viewport when iOS keyboard opens | `useVisualViewportHeight` hook (sizing) |
| v9.8.1 | `#70` Modal renders behind page on mobile | `createPortal` to document.body (stacking) |
| **v9.8.2** | **`#71` Modal still broken on desktop — renders above viewport, hidden by page content** | **Migration to `/clubs/new` page route — eliminates the bug class** |

Each fix added complexity (portal + viewport hook + safe-area handling + body scroll lock + focus trap) without addressing the root cause: **modals on multi-platform are fragile**. Page pattern is simpler, more reliable, and works identically on mobile + desktop.

### `#71` — Create Club page migration

**New file:** `apps/web/src/routes/clubs.new.tsx` + `clubs.new.module.css`. Tanstack file-based route at `/clubs/new`. Uses standard layout flow — no portal, no visualViewport hook, no z-index battles, no body scroll lock, no focus trap. The Tanstack Router plugin auto-generates `routeTree.gen.ts` to expose the new route's typed paths.

**Form contents:** identical to old modal — Name (required, ≤100), Description (optional, ≤500). Same `useCreateClub` mutation. On success: `setClub({ id, name, role })` to switch AppContext, then `navigate({ to: '/dashboard/today' })` to land in the new club's view. Cancel button navigates back to `/dashboard/today`.

**Styling:** new `clubs.new.module.css` reuses the modal's CSS patterns (`.input` / `.textarea` / `.fieldLabel` / `.fieldHint` / `.error` / `.actions` / `.cancelBtn`). Page wrapper has mobile bottom-padding to clear BottomNav (`calc(var(--s-8) + 72px + env(safe-area-inset-bottom, 0))`).

**Wiring updates:**

- `ContextSwitcher.tsx` — removed `ClubCreateModal` import + `createOpen` state. "Create new club" menu item now calls `navigate({ to: '/clubs/new' })`.
- `ClubCreateCard.tsx` — removed `ClubCreateModal` import + state. "Create club" button now calls `navigate({ to: '/clubs/new' })`.

**Old `ClubCreateModal.tsx` not deleted** — kept in the tree for now (no longer imported anywhere). Removal will be a one-line cleanup in a future release after this approach proves stable.

### `#72` — Footer copyright covered by BottomNav on mobile

`apps/web/src/components/AppFooter/AppFooter.module.css`:

```css
@media (max-width: 599px) {
  .foot {
    padding-bottom: calc(var(--s-10) + 72px + env(safe-area-inset-bottom, 0));
  }
}
```

Same approach as v9.7.4's ClubDashboard padding-bottom fix. Desktop unaffected — BottomNav is hidden ≥ 600px.

### Build process note (regen of routeTree.gen.ts)

When adding a new file-based route, the Tanstack Router plugin's auto-regen runs only inside `vite build`. The project's npm script chains `tsc -b && vite build` — but `tsc` runs first and fails because `routeTree.gen.ts` doesn't yet know about the new route. Workaround used here: invoke `npx vite build` directly (regenerates the tree), then run the full `npm run build` again. Will document this in CONTRIBUTING.md as part of the next release if it bites again.

### Bundle impact

Dashboard chunk: 89.98 → 86.70 KB (−3.28 KB / −3.6%) — modal logic + visualViewport hook + portal wrapper all gone. New `clubs.new` route emits its own auto-split chunk on first navigation.

### Sprint 5 process adherence

- ✅ #1 Paired verification: build green; manual scan; auth gate verified intact
- ✅ #2 Pre-commit grep against `schema.sql` — N/A (no SQL change)
- ✅ #4 POST → GET round-trip — N/A (uses existing `useCreateClub` mutation)
- ✅ #5 Verification budget — single-route scope; well within 12%
- ✅ #6 Bug post-mortems — `#69`/`#70`/`#71` together qualify as a pattern. Lesson promoted to `0-learnings.md` Rule #16 candidate (already noted in v9.8.1 CHANGELOG): when fixing a modal/overlay z-index or stacking-context bug, audit ALL modals + overlays in the same release cycle. New related learning for Rule #17: **when a UI pattern keeps producing bug-class regressions despite multiple targeted fixes, consider an architectural replacement (modal → page) rather than a third targeted fix.**

### Deploy state — manual intervention needed

Local wrangler auth expired mid-session (OAuth token timed out). `CLOUDFLARE_API_TOKEN` in `.deploy.env` is also returning 400. Workers Builds CI also failing (e2e Playwright job is red — to be diagnosed separately). To ship v9.8.2 to prod:

```bash
npx wrangler login                      # browser flow
source .deploy.env && npm run deploy    # build + wrangler deploy + docs:sync
```

After successful deploy, Confluence release entry will auto-create. Until then, v9.8.0 stays live in prod (v9.8.1 portal fix never landed; v9.8.2 page migration supersedes it anyway).

### Versions: 9.8.1 → 9.8.2 in 5 places

`apps/web/package.json`, `package.json`, `src/worker.js` (`WORKER_VERSION`), `apps/web/src/lib/version.ts`, `README.md` Current-release line.

---

## [9.8.1] — 2026-05-01

**Hotfix — Create Club modal stacking-context bug (`#70`).** Founder reported on iPhone Safari that the Create Club modal still renders behind page content despite the v9.7.5 keyboard-handling fix for `#69`. Different root cause; different fix.

### Root cause

The v9.7.5 fix addressed sizing — `useVisualViewportHeight` clamps modal `max-height` when the keyboard opens. That part worked. What it didn't fix: the modal renders **inline** in the React tree inside `ContextSwitcher` → `TopBar`, both of which create stacking contexts (TopBar via `position: sticky` + z-index; ContextSwitcher's parent via similar combinations). Once a stacking context is created, child z-indices are confined inside it — `z-index: var(--z-modal, 500)` only competes against siblings within that stacking context, not against the Schedule tab content rendered as a sibling of the parent.

Result: modal rendered BEHIND the Schedule tab calendar grid. Functionally broken.

### Fix

`createPortal` from `react-dom` for both modals. Portals render the JSX at a different point in the DOM (`document.body`) while preserving React tree relationships (state, context, refs). Crucially, portals escape parent stacking contexts entirely.

```tsx
import { createPortal } from 'react-dom';

return createPortal(
  <AnimatePresence>{open && (...)}</AnimatePresence>,
  document.body,
);
```

Applied to:

- `apps/web/src/components/ClubCreateModal/ClubCreateModal.tsx` — primary, where the bug surfaced
- `apps/web/src/components/ClubEventModal/ClubEventModal.tsx` — preventive (same risk class; same parent tree)

`EventDetailDrawer` not portaled in this release — no reported bug, and its z-index fix in v9.7.4 plus typical render path from inside ScheduleTab → ClubDashboard doesn't appear to hit the same issue. Defer unless a report surfaces.

### Process learning — `0-learnings.md` Rule #16 candidate

> **When fixing a modal/overlay z-index or stacking-context bug, audit ALL modals + overlays in the same component family in the same release cycle.** Single-fix mode misses the same root-cause class affecting other instances. v9.7.4 fixed the drawer z-index but didn't audit ClubCreateModal/ClubEventModal for the same family of issues; v9.8.1 closes the gap. Will be promoted to auto-memory after S5 retro confirms it didn't recur.

### Sprint 5 process adherence

- ✅ #1 Paired verification: build green; manual scan; auth gate intact
- ✅ #2 Pre-commit grep against schema.sql — N/A (no SQL change)
- ✅ #4 POST → GET round-trip — N/A (no new endpoints)
- ✅ #5 Verification budget — small targeted hotfix, well within 12%
- ✅ #6 Bug post-mortems — `#69` + `#70` together qualify; CHANGELOG entries above + the v9.7.5 entry capture root cause / fix / prevention rule in post-mortem-shaped form. A dedicated post-mortem file at `docs/post-mortems/v9.8.1-modal-stacking.md` will be written if `#70` recurs or if Sprint 5 retro decides the dual-bug pattern (sizing fix without stacking audit) needs durable memory promotion.

### Bundle

Dashboard chunk: 89.86 → 89.98 KB (+0.12 KB) — just the `createPortal` import.

### Versions: 9.8.0 → 9.8.1 in 5 places

`apps/web/package.json`, `package.json`, `src/worker.js` (`WORKER_VERSION`), `apps/web/src/lib/version.ts`, `README.md` Current-release line.

---

## [9.8.0] — 2026-05-01

**First MINOR-correct feature release.** Closes the AI-description piece of `#60` (event-lifecycle work started in v9.7.3). Also: locks the release-naming convention in `CONTRIBUTING.md` and re-syncs the Confluence Sprint Roadmap with corrected labels going forward.

### `#60` follow-up — AI-drafted event description

Founder spec (Sprint 4 ADR-S5.3): AI moments at the club level are system-paid Haiku, free for users. ~$0.001/draft. Members generate a 2-3 sentence event description from the form values they've already filled in.

**New endpoint** — `POST /api/clubs/:id/events/draft-description`:

- **Auth:** `resolveAthleteId` (Strava bearer required)
- **Membership gate:** 404 OWASP — non-members of the club can't probe
- **Rate limit:** new `event-ai-draft` scope, 5/min/athlete (independent from `clubs-write` 30/min)
- **Body:** `{ title (required), event_type, distance_km?, expected_avg_speed_kmh?, surface?, start_point?, location? }` — accepts whatever the form has filled so far
- **Allowlists:** `event_type ∈ {ride, social, race}`; `surface ∈ {road, gravel, mixed}`; numeric ranges as per POST `/events`
- **System key:** `SYSTEM_ANTHROPIC_KEY` (falls back to `ANTHROPIC_API_KEY` for legacy single-user dev)
- **Model:** `claude-haiku-4-5-20251001`, max_tokens 250
- **Response:** `{ description: string }` — plain text capped at 2000 chars (matches `club_events.description` upper bound)
- **Failure modes:** 503 with logged `safeWarn` if SYSTEM_ANTHROPIC_KEY missing, Anthropic fetch errors, response parsing fails, or empty content

The prompt is conversational — speaks directly to club members ("we", "the crew"), mentions pace/effort honestly so newer riders can self-assess, ends with one practical detail (coffee stop, regroup, meet-time reminder). No markdown, no labels, no preface.

### Frontend wiring

- `clubsApi.draftEventDescription(clubId, input)` + `DraftEventDescriptionInput` type added
- `useDraftEventDescription(clubId)` Tanstack mutation hook (no cache invalidation — pure read-only generation)
- ClubEventModal: new **"Generate with AI ✨"** button inside the Notes field's label row
  - Disabled when title is empty or while a request is in flight
  - On success, populates the textarea + sets `descIsAi = true`
  - User edits clear the flag (so subsequent submissions don't lie about AI authorship)
  - Hint copy below textarea updates: "AI-drafted — edit to refine."
- POST `/events` body now passes `description_ai_generated: true` when the flag is set, so analytics can track AI-vs-human authorship over time

### CSS

`.fieldLabelRow` (flex row, label + button); `.aiDraftBtn` (accent pill with hover + disabled + focus-visible states). All design-system tokens; no hardcoded colors.

### Bundle

Dashboard chunk: 88.98 → 89.86 KB (+0.88 KB / +1.0%) for the AI button + hook.

### Deferred to v9.9.0 + v9.10.0

The original v9.8.0 plan bundled three pieces (AI description + Edit UX + Route picker). Splitting was the right call:

- **v9.9.0** — Edit UX (PATCH wired in drawer; modal in edit mode)
- **v9.10.0** — Route picker integration (`route_strava_id` field UI; reuses `RoutesPicker` from `/coach`)

Each gets its own release theme + verification budget per Sprint 4 retro Improvement #5. Total Sprint 5 release count climbs by 2 (was 5 ahead, now 7), but each release stays under 12% verification budget.

### Naming convention locked — `CONTRIBUTING.md`

Strict SemVer: MAJOR for the 5 specific triggers (CTO call), MINOR for features, PATCH for hotfixes. Past v9.7.x releases stay labelled as shipped. New convention applies from v9.8.0 onward.

5 MAJOR-bump triggers (any ONE qualifies):

1. New architectural system (real-time presence, native mobile, multi-platform integration, multi-tenant infrastructure)
2. Breaking data-model change (new D1 db, primary table drops/renames, storage layer migration — additive `ALTER TABLE` stays MINOR per cumulative-schema policy)
3. Public-launch milestone (Beta exit / GA, first paid tier, press launch, `cadenceclub.cc` domain migration)
4. Breaking API change (versioned API, removal of public endpoints — additive endpoints stay MINOR)
5. Strategic persona pivot (primary persona changes, not adding personas)

Anti-patterns documented: don't use PATCH for new features (the v9.7.0–v9.7.3 mistake); don't bump MAJOR for marketing reasons alone; don't stack hotfixes inside a feature release.

### Confluence Sprint Roadmap re-sync

`src/docs.js` sprint-roadmap entry updated:

- v9.7.0–v9.7.5 marked as shipped with their actual labels (frozen)
- v9.8.0 → v9.11.0 mapped to upcoming features (AI description ✓ this release, Edit UX, Route picker, Personal scheduler, Clubs share/invite, Sprint 5.5 Landing rewrite)
- v9.12.0 → v9.14.0 mapped to Sprint 6 (Phase 4 cron, Phase 5 LLM Circle Note + Metrics, post-ride callout)
- Naming-convention-correction note added inline so future readers understand the v9.7.x labelling is intentional historical record, not a typo

### Sprint 5 process adherence

- ✅ #1 Paired verification: build green; manual TS scan; rate-limit + auth gate verified at smoke
- ✅ #2 Pre-commit grep against `schema.sql` — N/A (no SQL change)
- ✅ #4 POST → GET round-trip — endpoint is read-only (no persistent state); auth gate + 503 fallback both verified
- ✅ #5 Verification budget within 12% — split AI description from Edit + Route picker to keep this release contained
- ✅ #6 Bug post-mortems — none required (no hotfix triggered; v9.7.5 closed all open prod bugs)

### Versions: 9.7.5 → 9.8.0 in 5 places

`apps/web/package.json`, `package.json`, `src/worker.js` (`WORKER_VERSION`), `apps/web/src/lib/version.ts`, `README.md` Current-release line.

---

## [9.7.5] — 2026-05-01

**iOS Safari hardening — closes 3 P0/P1 issues from v9.7.4 visual verification.** Founder reported on iPhone Safari that v9.7.4's iOS attempts (changing BottomNav from `bottom: 0` to `bottom: env(safe-area-inset-bottom, 0)`) didn't cover the actual platform behaviour. v9.7.5 systematically addresses the three iOS Safari edge cases that surfaced.

### `#67` — BottomNav obscured by Safari iOS chrome (P0)

**Symptom:** On iPhone Safari with the bottom URL bar visible, the BottomNav's last tab was clipped or fully obscured. Touch targets in the bottom 80px registered Safari controls (back/forward/share/bookmarks) instead of app controls.

**Root cause analysis:** The v9.7.4 `bottom: env(safe-area-inset-bottom, 0)` approach assumed Safari would report its toolbar height in `safe-area-inset-bottom`. In practice this is inconsistent across iOS versions — the home indicator is reliably reported but Safari's bottom toolbar isn't always.

**Fix in `apps/web/src/components/BottomNav/BottomNav.module.css`:**

```css
.root {
  position: fixed;
  bottom: 0;                                                   /* restored from env() */
  padding-bottom: max(env(safe-area-inset-bottom, 0), 12px);   /* with floor */
}
```

The bar **background** extends to viewport bottom (clean visual under the toolbar's blur), while the **buttons** are pushed above the safe-area inset with a 12px minimum fallback for cases where env() returns 0. `viewport-fit=cover` is already in `index.html` so safe areas resolve correctly.

### `#68` — Date/Time inputs overflow modal horizontally (P1)

**Symptom:** In ClubEventModal on iPhone, the `<input type="date">` and `<input type="time">` fields rendered wider than the modal, breaking out of the right edge.

**Root cause:** v9.7.4 added `box-sizing: border-box` to `.input` and `.textarea`, which fixed text inputs. But iOS Safari renders native date/time controls that ignore CSS width unless `-webkit-appearance: none` strips the native chrome.

**Fix in `apps/web/src/components/ClubEventModal/ClubEventModal.module.css`:**

```css
.input[type='date'],
.input[type='time'] {
  -webkit-appearance: none;
  appearance: none;
  -webkit-min-logical-width: 0;  /* Safari ignores width:100% on date inputs without this */
  min-width: 0;
  font: 500 15px/1.4 var(--font-sans);
}
.input[type='date']::-webkit-date-and-time-value,
.input[type='time']::-webkit-date-and-time-value {
  text-align: left;
}
```

Native iOS date/time picker still works (tapping opens the wheel picker); only the rendered control sizing is normalised.

### `#69` — Create Club modal Name input above viewport on iPhone (P0)

**Symptom:** Opening Create Club on iPhone Safari rendered the modal with the NAME input ABOVE the visible viewport. When the keyboard opened, the modal's `max-height: 92dvh` didn't shrink, so the focused input slid further out of view. Modal was functionally broken on iOS.

**Root cause:** `dvh` (dynamic viewport height) doesn't react to the iOS keyboard show/hide. Need `window.visualViewport` to track the actual visible area.

**Fix:**

New shared hook at `apps/web/src/hooks/useVisualViewportHeight.ts`:

```tsx
export function useVisualViewportHeight(): number | null {
  const [height, setHeight] = useState(...);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onChange = () => setHeight(vv.height);
    vv.addEventListener('resize', onChange);
    vv.addEventListener('scroll', onChange);
    return () => { /* cleanup */ };
  }, []);
  return height;
}
```

Both `ClubCreateModal` and `ClubEventModal` call this hook and apply the result inline:

```tsx
<motion.div
  ref={modalRef}
  className={styles.modal}
  style={vvh != null ? { maxHeight: `${vvh - 16}px` } : undefined}
  ...
>
```

When the iOS keyboard opens, `visualViewport.height` shrinks, the hook re-fires, and the modal's `max-height` drops in step. Internal scrolling then keeps the focused input in view.

`16px` margin reserves a small breathing-room gap below the viewport edge.

### Plan re-numbering

Sprint 5 plan shifts +1 from v9.7.5 onward. The previously-deferred AI description + Edit UX + Route picker work was previously labelled v9.7.5 → now **v9.7.6**. Subsequent releases shift accordingly:

| Release | Was | Status |
|---|---|---|
| v9.7.5 | (new) iOS hardening | ✅ this release |
| v9.7.6 | v9.7.5 | AI description + Edit UX + Route picker |
| v9.7.7 | v9.7.6 | Personal scheduler `/dashboard/schedule` (`#61`) |
| v9.7.8 | v9.7.7 | Clubs share/invite (`#56`) |
| v9.7.9 | v9.7.8 (Sprint 5.5) | Landing copy rewrite (`#64`) |

Confluence Sprint Roadmap (page `3375129`) updated in this deploy. Plan doc `4-sprint-plan-2026-05.md` will be re-synced at sprint close in the retro.

### Sprint 5 process adherence

- ✅ #1 Paired verification: build green; manual scan; visual verification deferred to founder on real iPhone (the only reliable test for iOS Safari edge cases — the synthetic Playwright environment doesn't reproduce Safari toolbar behaviour)
- ✅ #2 Pre-commit grep against `schema.sql` — N/A (no SQL change)
- ✅ #4 POST → GET round-trip — N/A (no new endpoints)
- ✅ #5 Verification budget within 12% — direct in-context implementation
- ✅ #6 Bug post-mortems — none required (the 3 issues were in-flight bugs from the same release cycle, not production hotfixes)

### Bundle impact

Dashboard chunk: 88.49 → 88.98 KB (+0.49 KB / +0.6%). Just the new hook + applied to two modals.

### Versions: 9.7.4 → 9.7.5 in 5 places

`apps/web/package.json`, `package.json`, `src/worker.js` (`WORKER_VERSION`), `apps/web/src/lib/version.ts`, `README.md` Current-release line.

### RELEASE_CHECKLIST addition

Add to per-release smoke for any change touching mobile layout:

- iPhone Safari real-device test (not Simulator) — bottom URL bar mode, both portrait and landscape:
  - BottomNav fully visible above Safari toolbar
  - All 4 tabs tappable
  - Open Create Club + Create Event modals — Name input visible without scrolling
  - Tap a date/time input — native picker opens, doesn't break modal layout
  - Open keyboard from any input — modal height shrinks to keep focused input in view

---

## [9.7.4] — 2026-05-01

**Hotfix — 5 UX bugs from v9.7.3 visual review (`#66`).** Founder reviewed v9.7.3 in the wild and reported a bundle of issues that needed fixing before the next feature ships. Bundled into a single hotfix so v9.7.5 (AI description + Edit UX + Route picker, previously labelled "v9.7.3.1") ships into a clean shell.

### Bug 1 — Emoji Format chips violated the design system

Format chips in `ClubEventModal` and `TYPE_LABEL` in `Calendar/types.ts` used literal emojis (🚴 Ride / ☕ Social / 🏁 Race). The Sprint 5 / v9.7.2 design lock was **CC line-icon SVGs in the design system, persona-focused JSDoc**. Emojis render with platform-default fonts (Apple Color Emoji vs Segoe etc.), break brand consistency, and contrast with the brutalist mono typography.

**Fix:** Three new branded SVG components in `apps/web/src/design/icons/index.tsx`:

- `RideIcon` — bicycle silhouette: two wheels + frame + handlebar (Marco's primary format)
- `SocialIcon` — coffee cup with steam (Sofia's post-ride coffee, Léa's social anchor)
- `RaceIcon` — chequered flag (Marco's race-day signal, universally cycling)

All 1.6px stroke / 24×24 viewBox / `currentColor` / `aria-hidden` — same conventions as the v9.7.2 nav icons. Stripped emojis from `TYPE_LABEL` (now plain `'Ride' / 'Social' / 'Race'`). Updated 3 consumers:

- `ClubEventModal` Format chips: render `<Icon size={16} /> {label}` inline
- `ScheduleTab` filter chips: same pattern with `TYPE_ICON` lookup map
- `EventDetailDrawer` drawerType badge: same pattern at `size={14}`

Each chip CSS gained `display: inline-flex; align-items: center; gap: 6px; svg { flex-shrink: 0; }` so the icon sits cleanly beside the label.

### Bug 2 — EventDetailDrawer covered by BottomNav on mobile

Drawer z-index was hardcoded `100`. `tokens.css` defines `--z-nav: 200`, `--z-modal: 500`. So BottomNav (200) overlaid the drawer (100), hiding the bottom edge — Cancel button unreachable.

**Fix:** `apps/web/src/components/Calendar/Calendar.module.css`:

```css
.drawerBackdrop { z-index: var(--z-modal, 500); }
```

Now the drawer covers BottomNav on mobile.

### Bug 3 — Overview tab footer hidden behind BottomNav

ClubDashboard had no `padding-bottom` to clear the fixed BottomNav. Last section + invite hint were cut off on mobile (Members + Metrics tabs had the same gap).

**Fix:** `apps/web/src/components/ClubDashboard/ClubDashboard.module.css`:

```css
@media (max-width: 599px) {
  .root {
    padding-bottom: calc(var(--s-6) + 72px + env(safe-area-inset-bottom, 0));
  }
}
```

Desktop unaffected (BottomNav is hidden ≥ 600px).

### Bug 4 — ClubEventModal had horizontal scroll on mobile

Inputs inside the modal pushed past the modal width on narrow viewports (≤ 390px), causing horizontal scroll.

**Root cause:** `.input` and `.textarea` had `width: 100%` but no `box-sizing` rule. Default `content-box` adds the `padding: var(--s-3)` on top of the 100%, so inputs computed wider than the field container.

**Fix:** `apps/web/src/components/ClubEventModal/ClubEventModal.module.css`:

```css
.input, .textarea { box-sizing: border-box; width: 100%; ... }
.modal { ...; overflow-x: hidden; box-sizing: border-box; }
.field { ...; min-width: 0; }
```

`overflow-x: hidden` + `min-width: 0` are belt-and-braces against any other overflow source we haven't found.

### Bug 5 — iOS Safari toolbar covered BottomNav

iPhone Safari's bottom toolbar (back / forward / share / bookmarks) was covering BottomNav. Tab menu unreachable.

**Root cause:** BottomNav was at `position: fixed; bottom: 0`. In iOS Safari with the bottom URL bar visible, `bottom: 0` is at `100vh`, which is HIDDEN under the toolbar. Per Apple guidance, Safari treats the toolbar height as part of `safe-area-inset-bottom`, so the BottomNav needs to FLOAT above the inset, not extend into it.

**Fix:** `apps/web/src/components/BottomNav/BottomNav.module.css`:

```css
.root {
  bottom: env(safe-area-inset-bottom, 0);   /* was: bottom: 0 */
  /* removed: padding-bottom: env(...) — no longer needed */
}
```

The bar now floats above the toolbar safely. Home indicator on iPhone X+ is still cleared (the env() value covers both cases).

### Sprint 5 plan re-numbering

The previously-deferred work labelled "v9.7.3.1" (AI description + Edit UX + Route picker) is now **v9.7.5** to keep semver patch-segment clean. Subsequent releases shift down by one:

- v9.7.5 — AI description + Edit UX + Route picker (was "v9.7.3.1")
- v9.7.6 — Personal scheduler at `/dashboard/schedule` (was v9.7.4)
- v9.7.7 — Clubs share/invite (was v9.7.5)
- v9.7.6 was previously the Sprint 5.5 Landing copy rewrite — that becomes **v9.7.8** (still Sprint 5.5)

Confluence Sprint Roadmap will be updated with v9.7.5 deploy.

### Sprint 5 process adherence

- ✅ #1 Paired verification: build green + manual scan
- ✅ #2 Pre-commit grep against `schema.sql` — N/A (no SQL change)
- ✅ #4 POST → GET round-trip — N/A (no new endpoints)
- ✅ #5 Verification budget — direct in-context implementation; no new sub-agent dispatch
- ✅ #6 Bug post-mortems — none required (fixes are in the same release window as the v9.7.3 ship; CHANGELOG entry above documents root cause + fix in post-mortem-shaped form for each of the 5 bugs)

### Bundle impact

Dashboard chunk: 87.30 → 88.49 KB (+1.19 KB / +1.4%) — 3 small SVG icons + chip flex layout. gzip 25.56 → 25.81 KB (+0.25 KB).

### Versions: 9.7.3 → 9.7.4 in 5 places

`apps/web/package.json`, `package.json`, `src/worker.js` (`WORKER_VERSION`), `apps/web/src/lib/version.ts`, `README.md` Current-release line.

---

## [9.7.3] — 2026-05-01

**Sprint 5 / `#60` event model expansion + lifecycle + `#63` Privacy header removal.** Largest single release in Sprint 5 — adds 7 columns to `club_events`, 2 new endpoints, extends POST + GET, expands the Create modal, wires Cancel UX end-to-end. AI-description endpoint and Edit (PATCH UX) deliberately deferred to v9.7.3.1 to keep this release shippable inside the 12% verification budget.

### Migration 0007 — `club_events` expansion

`ALTER TABLE club_events ADD COLUMN` × 7:

| Column | Type | Purpose |
|---|---|---|
| `distance_km` | REAL nullable | Marco's "is this Z2 or Z4?" / Léa's "is this too far?" |
| `expected_avg_speed_kmh` | REAL nullable | Pace proxy / target zone |
| `surface` | TEXT CHECK ('road','gravel','mixed') nullable | Kit choice / Léa's confidence (no surprise gravel) |
| `start_point` | TEXT nullable | "Where do we meet?" — separate from Location/area |
| `route_strava_id` | TEXT nullable | Reuses Coach's RoutePicker pattern; UI lands v9.7.3.1 |
| `description_ai_generated` | INTEGER NOT NULL DEFAULT 0 | Tracks AI-drafted vs hand-written for analytics |
| `cancelled_at` | INTEGER nullable | Soft-delete; preserves history; pill renders strikethrough |

Pre-CTO column-shape verification (Sprint 4 retro Improvement #2): grep'd against `schema.sql` before commit. Caught two false-positive substring matches (`distance_km` matches `preferred_distance_km` in `training_prefs` + `event_distance_km` in `goals`; `surface` matches `surface_pref` in `training_prefs`). All 7 verified clear on `club_events`. Applied to local + remote D1; verified all 7 columns present via `PRAGMA table_info` query.

### Backend — extended POST + GET, new PATCH + Cancel

**Extended POST `/api/clubs/:id/events`** to accept all new fields. Allowlist guards on `event_type ∈ {ride, social, race}` and `surface ∈ {road, gravel, mixed}`. Numeric range guards: distance 0–1000 km, speed 0–100 km/h. `description_ai_generated` accepts `true`/`1` only. POST response includes all new fields + `cancelled_at: null`.

**Extended GET `?range=YYYY-MM`** SELECT + GROUP BY to return all new columns + `confirmed_count` from the existing event_rsvps LEFT JOIN. No breaking change for existing callers.

**New PATCH `/api/clubs/:id/events/:eventId`** (`src/worker.js:~675`):
- Membership-gated (404 if not a member, OWASP)
- Creator OR admin gating (403 otherwise) — checked against `club_events.created_by` + `club_members.role`
- `clubs-write` rate-limit 30/min/athlete (shared scope with POST/RSVP)
- Allowlisted partial-update — only present body keys are applied; empty-string clears nullable text fields
- Idempotent — replays produce identical UPDATE statements

**New POST `/api/clubs/:id/events/:eventId/cancel`**:
- Same membership + creator/admin gating as PATCH
- Soft-delete: sets `cancelled_at = unix_now`
- Idempotent: second call returns existing `cancelled_at` with `already_cancelled: true` flag (no-op UPDATE)

### Frontend — modal expansion + cancel UX + strikethrough

**ClubEventModal** (`apps/web/src/components/ClubEventModal/ClubEventModal.tsx`, ~290 lines):

- New **Format chip row** (🚴 Ride / ☕ Social / 🏁 Race), default = Ride
- New **Distance + Avg-speed** numeric inputs, side-by-side (`fieldRow` layout)
- New **Surface chip row** (Any / Road / Gravel / Mixed)
- New **Start point** text input ("Bürkliplatz fountain" — meeting spot)
- Renamed existing Location to **Location / area** ("Albis Loop" — where the ride happens)
- **Persona-aware hiding**: Distance / Speed / Surface fields auto-hide when format = Social (rendered conditionally on `showAthleticFields`)
- Hint copy on Notes textarea: "AI-draft button ships in v9.7.3.1"

**EventDetailDrawer** (`apps/web/src/components/Calendar/EventDetailDrawer.tsx`):

- Cancel button now functional: tap → inline confirmation prompt → `useCancelClubEvent` mutation → drawer closes on success
- Permission gating: if `callerAthleteId` + `callerRole` are passed (club Schedule tab), Cancel only shows for creator OR admin. If absent (personal scheduler in v9.7.4), Cancel shows; server enforces 403 if denied.
- Cancelled events render a "This event was cancelled on {date}." line instead of action buttons
- Edit button stub (still disabled) — note explains "Edit ships in v9.7.3.1"
- Mutation error renders inline ("Couldn't cancel — try again.")

**Strikethrough on cancelled pills** across all 3 calendar grids (Month/Week/Day):

```css
.pill.cancelled, .weekEvent.cancelled, .dayEvent.cancelled {
  opacity: 0.55;
  filter: grayscale(0.4);
}
.pill.cancelled .pillTitle, ... { text-decoration: line-through; }
```

`MonthCalendarGrid`, `WeekCalendarGrid`, `DayCalendarGrid` all add `${e.cancelled_at ? styles.cancelled : ''}` to their pill className.

### `#63` — Privacy link removal from public Landing header

External UX feedback (Dentsu Creative designer, 2026-05-01): "the privacy link doesn't need to be in header." Removed `<Link to="/privacy">` from `Landing.tsx` TopBar `trailing` prop. Privacy link still reachable via the Landing footer + the `/privacy` route directly. Authenticated users still have privacy in the UserMenu. Cleaned unused `Link` import.

### New API client methods

`apps/web/src/lib/clubsApi.ts`:
- `clubsApi.patchEvent(clubId, eventId, input)` → PatchClubEventInput partial body
- `clubsApi.cancelEvent(clubId, eventId)` → CancelClubEventResponse
- New types: `ClubEventSurface`, `PatchClubEventInput`, `CancelClubEventResponse`
- Extended `ClubEvent` with all 7 new optional fields
- Extended `CreateClubEventInput` with new optional fields

`apps/web/src/hooks/useClubs.ts`:
- `usePatchClubEvent(clubId)` → invalidates events + overview caches on success
- `useCancelClubEvent(clubId)` → same invalidation pattern

### Bundle impact

Dashboard chunk: 83.08 → 87.30 KB (+4.22 KB / +5.1%). gzip 24.48 → 25.56 KB (+1.08 KB).

### Sprint 5 process adherence (Sprint 4 retro Improvements applied)

- ✅ #1 Paired verification: build green + manual scan + pre-commit grep + remote D1 PRAGMA verification
- ✅ #2 Pre-commit grep against `schema.sql` — caught false-positive substring matches; all 7 columns verified clear on `club_events`
- ✅ #3 Defensive scope on Sonnet sub-agents — N/A (Opus implemented directly)
- ⏳ #4 POST → GET round-trip smoke — verified locally; production smoke pending visual auth'd test (RELEASE_CHECKLIST per-release gate)
- ✅ #5 Verification budget within 12% — direct in-context implementation; deferred AI-description + Edit UX to v9.7.3.1 to keep this release scoped
- ✅ #6 Bug post-mortems — none required (no hotfix triggered)

### Deferred to v9.7.3.1

- **AI-description endpoint** (`POST /api/clubs/:id/events/:eventId/description-ai`) — system-paid Haiku, ~$0.001/draft, new `event-ai-draft` rate-limit scope (5/min)
- **AI-description button** in ClubEventModal — calls the endpoint with current form values, populates Notes textarea
- **Edit (PATCH UX)** in EventDetailDrawer — wired button + edit-mode form
- **Route picker** integration — `route_strava_id` field UI; reuses Coach's RoutesPicker

### Versions: 9.7.2 → 9.7.3 in 5 places

`apps/web/package.json`, `package.json`, `src/worker.js` (`WORKER_VERSION`), `apps/web/src/lib/version.ts`, `README.md` Current-release line.

---

## [9.7.2] — 2026-05-01

**Sprint 5 / `#59` + `#62` — Responsive nav consistency + CC line-icon library + Members search input bug fix.** Foundation refactor for the rest of Sprint 5: every UX surface that lands in v9.7.3+ inherits a consistent shell. Closes `#59` and `#62`.

### `#62` — Members search input height fix

Reported via the Sprint 5 BA-issue-filing flow. Symptom: search input rendered at ~40% of mobile viewport height (~280–300px), pushing roster rows below the fold. v9.6.3 had attempted to fix this by setting `height: 36px` but the fix didn't hold.

Root cause: `.membersSearch` had `flex: 1 1 200px`. The parent `.membersControls` is `flex-direction: column` on mobile, which means `flex: 1` grows along the **vertical** main axis. The explicit height was overridden by flex-grow + the default `align-items: stretch`. v9.6.3's fix was a band-aid that worked at desktop (row layout) but never applied to mobile.

Fix:
- Default `.membersSearch`: `flex: 0 0 auto` + `width: 100%` + `box-sizing: border-box` + `height: 44px` (WCAG 2.5.5 minimum touch target)
- Desktop row layout (`@media min-width: 640px`): re-enable `flex: 1 1 240px` for horizontal stretch + raise height to 48px + cap `max-width: 360px` so search doesn't dominate the row
- Added `:focus-visible` outline (Sprint 3 a11y conventions)
- Stripped `::-webkit-search-cancel-button` (we don't show iOS clear-X)

### `#59` — Responsive nav consistency + CC line-icon library

**Locked decisions (founder, 2026-05-01):**
- Desktop = top tabs always; Mobile = BottomNav always; breakpoint = 600px
- Applied to BOTH clubs and individual contexts (was inconsistent: clubs had top tabs on mobile too; individual had only BottomNav)
- Line-icon SVGs branded for Cadence Club, persona-focused JSDoc

**New: `<TopTabs />` shared component** at `apps/web/src/components/TopTabs/`. Desktop horizontal tab bar with v9.6.4 typography (10px / 0.14em mono uppercase, accent-color active state, 1px accent underline). Hidden below 600px via CSS. Accepts `items: TopTabItem[]` — each item is either a Tanstack Link (with `to`) or a state-setter (with `onClick` + `active`).

**Extended: `<BottomNav />`** to accept optional `items` prop. When omitted, falls through to the existing individual-mode behavior (Tanstack Links if `cc_tabsEnabled` flag, hash anchors otherwise — preserves backwards compat). When provided, renders the items as a state-setter nav (used by club mode). Breakpoint moved from `min-width: 1024px` → `min-width: 600px` (consistent with TopTabs cutover).

**New: CC line-icon library** at `apps/web/src/design/icons/index.tsx`:

| Icon | Persona |
|---|---|
| `<TodayIcon />` | Marco's morning kettle, Sofia's day-check, Léa's start-here |
| `<TrainIcon />` | Marco's primary tab; performance-line peak |
| `<RidesIcon />` | All personas — fitness history bars |
| `<YouIcon />` | Identity tab — profile + shoulders |
| `<OverviewIcon />` | Sofia's at-a-glance club entry; 4-square dashboard grid |
| `<ScheduleIcon />` | Sofia plans, Léa checks the day; calendar with one cell highlighted |
| `<MembersIcon />` | Sofia's roster, Léa's reassurance scan; three figures |
| `<MetricsIcon />` | Marco's competitive edge, Sofia's growth tracking; line chart with peaks |

Branded format: 1.6px stroke, 24×24 viewBox, `currentColor`, `aria-hidden` by default, optional `size` prop, every icon uses `strokeLinecap: 'round'` + `strokeLinejoin: 'round'`. Single file (8 components ≈ 130 lines) — small enough to keep co-located.

**Wiring:**
- ClubDashboard renders `<TopTabs items=[Overview/Schedule/Members/Metrics, ...]>` (desktop) + `<BottomNav items=[same with icons]>` (mobile). Existing `<TabBtn>` function deleted (62 lines removed).
- Individual dashboard route (`routes/dashboard.tsx` `TabsLayout`) renders `<TopTabs items=[Today/Train/Rides/You with `to` props]>` above the `<Outlet />` on desktop. BottomNav unchanged below.

**Bundle:** dashboard chunk 80.48 → 83.08 KB (+2.60 KB / +3.2%).

### Sprint 5 process adherence

- ✅ #1 Paired verification: build green + manual scan of TypeScript edges (TabBtn unused-detection caught the cleanup)
- ✅ #2 Pre-commit grep against `schema.sql` — N/A (no SQL change)
- ✅ #4 POST → GET round-trip — N/A (no new endpoints)
- ✅ #5 Verification budget within 12% — direct in-context implementation
- ✅ #6 Bug post-mortems — none required (#62 was a UX bug fixed inline; not a hotfix-triggering production regression)

### Versions: 9.7.1 → 9.7.2 in 5 places

`apps/web/package.json`, `package.json`, `src/worker.js` (`WORKER_VERSION`), `apps/web/src/lib/version.ts`, `README.md` Current-release line.

---

## [9.7.1] — 2026-05-01

**Sprint 5 / `#57` — Outlook-style multi-view scheduler + event detail drawer.** Closes the v9.7.0 gap where only Month view existed. Users explicitly asked for Month / Week / Day views, with event detail opening on click. Locked decisions 2026-05-01: 06:00–22:00 (16h) band on both Week and Day; default = Month on desktop, Day on mobile (auto-switch at 600px breakpoint); multi-view applies to both club Schedule tab and the upcoming personal scheduler (v9.7.4) for consistency.

### New view toggle

Three view chips at the top of the Schedule tab: `Month` / `Week` / `Day`. Each click updates a URL hash (`#month` / `#week` / `#day`) so deep-linking and back-button work. The hash also seeds the initial view: if a user lands on `/clubs/N#week`, Week view renders. Otherwise the default kicks in (Month on desktop, Day on mobile via `window.matchMedia('(max-width: 599px)')`).

Date navigation buttons (prev / next) are view-aware:

- Month view → step by 1 month
- Week view → step by 7 days (anchored to Monday-start week)
- Day view → step by 1 day

The header label adapts: "May 2026" / "5 May – 11 May 2026" / "Friday, 1 May 2026".

### Calendar primitives — new shared directory `apps/web/src/components/Calendar/`

Refactor: the month-grid logic that lived inline in `ScheduleTab.tsx` is now extracted to standalone primitives. ScheduleTab becomes orchestration only (view toggle, filter chips, date nav, drawer state).

| File | Lines | Purpose |
|---|---|---|
| `types.ts` | ~95 | Shared types + helpers (CalendarEvent, CalendarDate, weekStart, weekDates, groupByDay, mondayStartWeekday, etc.) |
| `MonthCalendarGrid.tsx` | ~95 | 6×7 grid, Monday-start, today highlighted, +N more overflow |
| `WeekCalendarGrid.tsx` | ~115 | 7-col × 06:00–22:00 time grid, events positioned by start time, today column tinted |
| `DayCalendarGrid.tsx` | ~80 | Single col × 06:00–22:00, larger event cards (title + time + location + count) |
| `EventDetailDrawer.tsx` | ~90 | Bottom-sheet (mobile) / right-side panel (desktop), Escape-to-close, scroll lock, Edit/Cancel stubs |
| `Calendar.module.css` | ~310 | All grid + drawer styles + the shared event-type color family (`pill_ride` / `pill_social` / `pill_race`) |

Default event block height in time-grid views = 90 minutes. The `club_events` schema doesn't yet have a duration column — that comes with v9.7.3 (event model expansion). Until then, blocks render as 90-min visual approximations, which covers most cycling events.

### EventDetailDrawer

- Opens on tap of any event pill across all 3 grids (single shared `onEventClick` plumbed through the orchestrator).
- Mobile: slides up from bottom as a bottom-sheet (`max-height: 85dvh`, scrolls if content overflows).
- Desktop (≥ 600px): slides in from right as a panel (`max-width: 480px`, full viewport height).
- Body scroll lock + Escape-key handler + click-outside-to-close.
- Renders: format pill, title, when (full date + UTC time), where, RSVP count, organiser, description, club name (if present — for the personal scheduler aggregation in v9.7.4).
- Edit + Cancel event buttons are stubbed (disabled with explanatory note: "Edit / Cancel ship in v9.7.3 (event lifecycle).").

### ScheduleTab refactor

Now ~225 lines (was 230) but with significantly more functionality. Holds:

- View state (`useCalendarView` custom hook with hash sync)
- Date state (CalendarDate; `setDate` adapts to current view)
- Filter state (Set of active event types; multi-select)
- Drawer state (`activeEvent`)
- Range fetch (still month-based for now; over-fetch is cheap with the 5-min edge cache)

Future opt for Week view crossing month boundaries: query both months in parallel — deferred until users actually hit that pattern.

### Bundle impact

- Dashboard chunk: 70.42 → 80.48 KB (+10.06 KB / +14.3%) — within the verification budget for v9.7.1.
- New Calendar/ chunk did NOT split out (Vite kept it inline with the dashboard route bundle since it's only consumed by ClubDashboard).
- gzip dashboard: 21.32 → 23.93 KB (+2.61 KB).

### Sprint 5 process adherence (Sprint 4 retro Improvements applied)

- ✅ #1 Paired verification: build green + manual TypeScript scan + visual review of grid math (week/day positioning formula `topPct = ((hh - 6) / 16) * 100`)
- ✅ #2 Pre-commit grep against `schema.sql` — N/A (no SQL change)
- ✅ #4 End-to-end smoke for UPSERT — N/A (no new endpoints; reused v9.7.0 read-only)
- ✅ #5 Verification budget within 12% — direct in-context implementation, no Sonnet sub-agents needed
- ✅ #6 Bug post-mortems — none required (no hotfix)

### Versions: 9.7.0 → 9.7.1 in 5 places

`apps/web/package.json`, `package.json`, `src/worker.js` (`WORKER_VERSION`), `apps/web/src/lib/version.ts`, `README.md` Current-release line.

---

## [9.7.0] — 2026-05-01

**Sprint 5 Phase 3 — clubs Schedule tab.** First feature release under the new founder process directives (sprint retros mandatory, bug post-mortems mandatory, paired Sonnet+verification dispatch, nightly autonomous code-review routine). All Sprint-5 kickoff items #1–#7 from the retro played out as planned: founder walkthrough on UI before code; ADR-S5.1 + ADR-S5.2 locked in 1 round; pre-commit grep against `schema.sql` caught a column-name drift (`start_date_local` → `event_date`) before commit; hygiene-close commit retired `#44`/`#45`/`#3`; v9.6.1 + v9.6.4 retroactive post-mortems established the template.

### Migration 0006 — `club_events.event_type`

`ALTER TABLE club_events ADD COLUMN event_type TEXT NOT NULL DEFAULT 'ride'`. Single column add; backfills existing rows via the NOT NULL DEFAULT. No new index — existing `idx_club_events_club_date(club_id, event_date)` already serves the month-range query the new endpoint runs.

Pre-CTO verification (Sprint 4 Improvement #2): grep'd the new SQL against `schema.sql` before commit. Caught my own design drift — the actual column name is `event_date` (INTEGER unix epoch), not `start_date_local` as the early walkthrough described. Schedule tab walkthrough corrected before any code landed; migration shipped clean. Applied to local + remote D1; verified via `PRAGMA table_info(club_events)` returns `event_type` row.

### Endpoint extension — `GET /api/clubs/:id/events?range=YYYY-MM`

The existing GET handler now supports a `range` query param. When provided:

- Validates `YYYY-MM` shape (regex + year/month bounds 2000–2100, 1–12)
- Computes UTC month boundaries in unix seconds (`Date.UTC(yr, mo - 1, 1)` start, `Date.UTC(yr, mo, 1) - 1` end)
- Runs a single D1 query: `club_events` LEFT JOIN `users` (creator name) LEFT JOIN `event_rsvps` (`COUNT(CASE WHEN status='going')` for `confirmed_count`)
- Returns `{club_id, range: {year, month, start, end}, events: [...]}` with each event including `event_type` + `confirmed_count`
- Sets `Cache-Control: private, max-age=300` for edge caching (5 min — events change infrequently within a month view)
- Membership-gated 404 (OWASP) — same gate as the existing branches
- Read-only; no rate-limit bump

Original GET branches preserved — `?include=past` (50 rows DESC) and default (upcoming 50 ASC) both now return `event_type` in their selects too.

### Schedule tab UI — `apps/web/src/components/ClubDashboard/ScheduleTab.tsx`

New component (~190 lines TSX + ~210 lines CSS). Replaces the v9.6.0 placeholder ("Coming in v9.6.2"). Design choices locked with founder 2026-05-01:

- **6×7 month grid**, Monday-start week (matches European convention; `getUTCDay()` Sun=0 → Monday-0 conversion at line ~52). Always renders 42 cells; out-of-month cells flagged with `inMonth: false` and rendered with `--c-bg-deep` background + 50% opacity day number.
- **Today highlighted** with 1 px accent border (matches BottomNav active-state convention from v9.6.4 Club tabs typography align).
- **Prev / next month nav** — buttons sized to `--hit-min` (44 px touch target), `:focus-visible` ring per Sprint 3 Phase 3 conventions.
- **Filter chips** — multi-select by `event_type`. Empty filter set = show all. Active chip uses `--c-accent` + 8% accent background. `aria-pressed` on each.
- **Event pills** — up to 2 per cell, `+N more` overflow. Colour-coded:
  - `ride` — `--c-accent` text on 12% accent background
  - `social` — `--c-info` text on 15% info background
  - `race` — `--c-warn` text on 15% warn background
- **Time formatting** — UTC `HH:MM` from `event_date` epoch; pill shows `HH:MM` mono + truncated title; mobile (≤ 600 px) hides title and shows time only.
- **Empty state** — "No events in {Month} {Year}" when filter set is empty or no events exist.

No new design tokens introduced. Reuses `--c-accent`, `--c-info`, `--c-warn`, `--c-text-faint`, `--hit-min`, `--ring-focus`, `--ring-focus-offset`, `--s-*` spacing scale, `--r-*` radius scale.

### Frontend hook — `useClubEventsByMonth(clubId, range)`

New Tanstack Query hook. `enabled: clubId != null && /^\d{4}-\d{2}$/.test(range)`. `staleTime: 5 min`, `gcTime: 30 min` — same conventions as `useClubOverview`. `queryKey: ['clubs', clubId, 'events', 'range', range]` so each month's view gets its own cache slot.

### Bundle impact

`dashboard` chunk: 66.23 KB → 70.42 KB (+4.19 KB / +6.3%). Acceptable — the calendar grid logic is in a single component.

### Sprint 5 process adherence (Sprint 4 Improvements applied)

- ✅ #2 Pre-commit grep against `schema.sql` for any SQL change — caught my own column-name drift before commit
- ✅ #3 Defensive sub-agent scope — no Sonnet sub-agents dispatched this phase; Opus implemented directly
- ✅ #4 End-to-end smoke for UPSERT + count-refetch — N/A (this endpoint is read-only); endpoint smoked via direct curl + month-range probe
- ✅ #5 Verification budget at 12% — paired self-verification (build + grep + curl smoke before commit)
- ✅ #6 Bug post-mortems — none required (no hotfix triggered)

### Versions: 9.6.5 → 9.7.0 in 5 places

`apps/web/package.json`, `package.json`, `src/worker.js` (`WORKER_VERSION`), `apps/web/src/lib/version.ts`, `README.md` Current-release line.

---

## [9.6.5] — 2026-05-01

**Marketing rewrite.** Landing page realigned to current product direction (clubs-first with AI embedded across three personas) after the 4-sprint trajectory was locked. No backend, schema, or routing changes.

### Landing page copy pivot — `apps/web/src/pages/Landing.tsx`

The page was last rewritten when Cadence Club was a single-persona product (Marco — power-meter cyclist with FTP 285 and an Etape du Tour goal). Sprint 4 introduced clubs as the differentiator and three-persona framing (Marco + Sofia/captain + Léa/casual commuter). The marketing copy hadn't caught up.

| Section | Before | After |
|---|---|---|
| Hero pill | "For the performance-driven amateur · v9" | "Cycling clubs with an AI training brain · v9" |
| Hero H1 | "Train like the *metrics* matter." | "Train solo. *Ride together.* Smarter." |
| Hero lede | PMC + workouts + routes (Persona A only) | PMC + club Overview/Schedule/RSVPs + AI-drafted Circle Note + 3-persona framing |
| §01 H2 | "For cyclists who care *about the numbers*" | "Three riders, one *shared toolkit*" |
| §01 For-You list | 6 items, all Marco | Broadened to A + B (captain a Saturday crew) + C (belong without intimidation) |
| §02 H2 | "Three screens. *One coherent training brain*" | "Solo training brain. *Plus a club layer*" |
| §02 Feature 02 | "Today's workout" only | Workout + saved-Strava-route picker absorbed into one feature; BYOK Sonnet pricing inline |
| §02 Feature 03 | "Routes that match the plan" + RoutePreview SVG | "A club layer, AI embedded" — Overview/Schedule/Members/Metrics, RSVP, FTP-private-by-default, AI Circle Note (system-paid Haiku, free) |
| §03 Pricing | 4 rows, BYOK only | 5 rows: app + clubs free, club AI included (system-paid), personal AI BYOK (~$0.02/plan), total <$0.50/mo |
| Final CTA | "PMC, plan, route picker — all yours" | "PMC, plan, route picker, club layer — all yours" |

### Component changes

- **New:** `ClubLayerPreview` function (~15 lines) — reuses existing `.routePrev` / `.routeStats` classes. Renders "Saturday Crew" mock with collective-stat tiles and an AI Circle Note pill. No new CSS.
- **Removed:** `RoutePreview` function (38 lines) — no longer referenced after the §02 pivot. Per project convention (no backwards-compat shims for unused code), deleted outright.

### README sweep

Tagline rewritten from "Performance training intelligence for serious cyclists. … Built around the persona of Marco" to "Cycling clubs with an AI training brain. PMC for the solo rider; Overview / Schedule / Members / Metrics with AI-drafted Circle Notes for the club. Built for three personas: Marco / Sofia / Léa." Per the auto-memory rule "Release-time README sweep is mandatory" — every `chore(release)` reconciles README's surface text with shipped state.

### Versions: 9.6.4 → 9.6.5 in 5 places.

`apps/web/package.json`, `package.json`, `src/worker.js` (`WORKER_VERSION` + `BUILD_DATE` → `2026-05-01`), `apps/web/src/lib/version.ts` ("April 2026" → "May 2026"), `README.md` Current-release line.

---

## [9.6.4] — 2026-04-30

**Hotfix-of-hotfix. v9.6.3's `LEFT JOIN event_rsvps` was technically correct, but D1 verified `event_rsvps` had 0 rows ever — RSVPs never actually persisted in Phase 2. Real cause: a misuse of `checkRateLimit` in two endpoints. Plus: Club tabs typography aligned with BottomNav labels per founder feedback.**

### Bug — `checkRateLimit` shape mismatch (CRITICAL, blocked all RSVPs since v9.6.2)

Phase 2 added two new rate-limited endpoints (`POST /rsvp`, `PATCH /api/users/me/profile`) using `checkRateLimit`. The helper (added Sprint 1 #33) returns:

- `null` when under threshold (proceed)
- `{ retryAfter: N }` when over threshold (return 429)

But Phase 2 wrote `if (!rl.ok)` — `rl.ok` doesn't exist in either case. When `rl === null`, accessing `null.ok` throws a `TypeError`. The worker `try`-less control flow meant every first `POST /rsvp` returned 500. Frontend's optimistic-revert kicked in on error → "shows 1 then 0".

Symptom 100% confirmed via D1: `SELECT COUNT(*) FROM event_rsvps;` = 0 across all time. Not a single RSVP had ever persisted.

Fix: changed both call sites (worker.js:813, worker.js:909) to `if (rl)` and aligned the response shape to the rest of the codebase (`{ error: 'rate-limited', retry_after_seconds }`). Verified other 4 `checkRateLimit` callers (`/coach`, `/coach-ride`, `/discover`, the existing `/clubs*` writes) all use the correct `if (rl)` pattern; the bug is isolated to the two new Phase 2 endpoints.

### Tabs typography aligned with BottomNav (#53 Phase 2 polish — UX coherence)

Founder asked: "alinea el diseño de los tabs de Clubs con los tabs de My Account". My Account's mobile tabs are `BottomNav` labels: `10px / 0.14em` mono uppercase, active state via accent COLOR (no border). Club tabs were `11px / 0.16em` with a heavy 2 px accent border-bottom on active.

Aligned to the BottomNav typography:

| Was | Now |
|---|---|
| `font: 500 11px/1` | `font: 500 10px/1.2` |
| `letter-spacing: 0.16em` | `letter-spacing: 0.14em` |
| `color: var(--c-text-muted)` (default) | `color: var(--c-text-faint)` (default) |
| `border-bottom: 2px solid` | `border-bottom: 1px solid` |
| Active: `--c-text` color + accent border | Active: `--c-accent` color + 1 px accent border |

Position retained at top of the club page (semantically correct — these are sub-views within a single club, not primary app navigation). Visual treatment now coherent with the rest of the app.

### Versions: 9.6.3 → 9.6.4 in 5 places.

---

## [9.6.3] — 2026-04-30

**Three Phase 2 polish bugs from founder feedback. Fixed in one commit.**

### Bug 1 — RSVP confirmed_count drops back to 0 after click (HIGH)

`GET /api/clubs/:id/overview` was returning `confirmed_count: 0` for every upcoming event because Phase 1 hardcoded the field as a placeholder ("until Phase 2 lands event_rsvps"). Phase 2 added `event_rsvps` and the RSVP endpoints, but the overview endpoint was never updated to use the table.

Symptom: user clicks RSVP → optimistic increment to 1 → POST succeeds → React Query refetches the overview → server returns `confirmed_count: 0` (hardcoded) → UI snaps back to 0.

Fix: rewrote the upcoming-events D1 query to LEFT JOIN `event_rsvps` and `COUNT(CASE WHEN r.status = 'going' THEN 1 END)` per event, GROUP BY event id. Now `confirmed_count` reflects live state.

### Bug 2 — `ClubCreateModal` clipped on mobile

The modal used `align-items: center` with `padding: var(--s-7)` (28 px) on small viewports. iOS soft keyboard opened on input focus → modal pushed off-screen with no recovery path.

Fix: `align-items: flex-start` + `overflow-y: auto` on the backdrop, safe-area-aware top/bottom padding via `max(var(--s-6), env(safe-area-inset-…, 0))`. Modal padding reduced to `var(--s-5)` on `<600 px`, restored to `var(--s-7)` at `≥600 px`. Max-height capped at `calc(100dvh - 2 * var(--s-6))`.

### Bug 3 — Members tab search input visually too tall (UX best-practice)

`.membersSearch` had `padding: var(--s-2) var(--s-3)` + `font: 400 14px/1.4`. Felt heavier than the surrounding sort buttons.

Fix: explicit `height: 36px` + `padding: 0 var(--s-3)` (height does the work, no vertical padding) + `font: 400 13px/1` + `border-color: var(--c-line)` for a calmer visual weight. `-webkit-appearance: none` strips iOS native search styling.

### Versions: 9.6.2 → 9.6.3 in 5 places.

---

## [9.6.2] — 2026-04-30

**Sprint 4 Phase 2 — clubs Members tab + RSVP wiring + privacy-visibility plumbing.**

### Migration 0005 (commit `8fcd298`)

- New `event_rsvps` table — `id PK, event_id FK club_events, athlete_id FK users, status DEFAULT 'going', created_at, updated_at`. `UNIQUE(event_id, athlete_id)` enforces idempotency. Two indexes: `(event_id, status)` for confirmed-count queries, `(athlete_id, event_id)` for "my RSVPs" reads.
- `users.ftp_visibility TEXT NOT NULL DEFAULT 'private'` per ADR-S4.4 (privacy-first; existing rows backfill via the column default).
- `club_members.trend_arrow TEXT, trend_updated_at INTEGER` — both nullable; populated by the Phase 4 cron (added now so the column is ready when Phase 4 ships).

`schema.sql` updated per the v9.2.0 process rule. Applied to remote D1 in the same commit.

### Three new endpoints + one extension (commit `ce88c3d`)

- **`POST /api/clubs/:id/events/:eventId/rsvp`** — Strava-bearer auth, membership-gated 404. UPSERT on `event_rsvps`. Returns `{ status, confirmed_count }`. Rate-limited 30/min on the existing `clubs-write` scope.
- **`GET /api/clubs/:id/events/:eventId/rsvps`** — top 12 avatars + total count. ADR-S4.5: visible to all members; no FTP exposed.
- **`PATCH /api/users/me/profile`** — column allowlist (`['ftp_visibility']` for now). Rate-limited 10/min on a new `profile-write` scope. 422 on disallowed field; never interpolates user-supplied column names into SQL.
- **`GET /api/clubs/:id/members` extended** — ADR-S4.4 server-side FTP mask. Caller role `'admin'` → FTP visible for all. Otherwise → FTP visible only when target's `ftp_visibility = 'public'`. Other members' `ftp_w` set to `null` in the JSON payload (absent from the DOM, not just CSS-hidden). New optional `sort` (allowlist `name | role | joined_at`, default `joined_at DESC`) + `dir` query params.

`ftp_w` is not yet in the `users` schema (lands with `#52` in Sprint 5) — the masking logic returns `null` until then, but the wiring is complete.

### Members tab full + Overview RSVP wiring (commit `9e5ea8c`)

Members tab — Phase 1's placeholder replaced. Columns: Name / Role / Joined. Sort dropdown, search-as-you-type, role chips inline, "NEW" badge for joined-within-30-days, inline drawer on row click. FTP / Hours-per-month / Attended deferred.

RSVP button on Overview now live: optimistic `confirmed_count` increment → `POST /rsvp` → revert on error. Re-click toggles to "Cancel RSVP". New `useRsvp` + `useUpdateProfile` mutation hooks invalidate relevant query keys.

### Test totals + smoke

27/27 unit pass. Mobile-tabs gate green. **OAuth full happy-path** added to the post-deploy smoke list per v9.6.1 hotfix retro tightening — verified before signing off.

### Versions: 9.6.1 → 9.6.2 in 5 places.

---

## [9.6.1] — 2026-04-30

**Hotfix — `/callback` inline script blocked by CSP from v9.5.1 (#15). Strava OAuth completion was hanging at "Loading dashboard…" forever.**

### What broke

v9.5.1 (Sprint 3 #15) introduced strict security headers including `Content-Security-Policy: script-src 'self'`. The `/callback` page renders an inline `<script>` that runs after Strava OAuth: it writes the access/refresh tokens to `localStorage` (`cc_tokens`) and then `window.location.href = '…/dashboard'`. The strict CSP **silently blocked** that script — the page sat showing "Loading dashboard…" with the throbber animation, while neither the localStorage write nor the redirect ever ran. Users couldn't complete Strava authentication.

The bug was latent from v9.5.1 deploy (a few hours ago), masked because nobody re-tested the OAuth flow end-to-end after Phase 2 of Sprint 3. The Sprint 1 retro improvement #1 (legacy-parity audit) and #5 (smoke what changed) would have caught it — `/callback` is exactly the kind of inline-script edge case a CSP rollout has to verify. Filing this miss into the post-deploy smoke list going forward.

### Fix (commit pending)

Per-request nonce CSP, applied only to `/callback`:

- New helper `cspWithScriptNonce(nonce)` builds a CSP string by replacing `script-src 'self'` with `script-src 'self' 'nonce-{value}'` and leaving all other directives (style-src, img-src, connect-src, frame-ancestors, etc.) unchanged.
- `htmlResponse()` extended to accept an optional `extraHeaders` arg so the callback can override CSP for its response only.
- `/callback` handler generates `crypto.randomUUID().replace(/-/g, '')` per request, passes the nonce to `callbackPage()`, and sets the response's CSP to `cspWithScriptNonce(nonce)`. The `withSecurityHeaders` wrapper from #15 already respects existing headers (`if (!headers.has(k)) headers.set(k, v)`), so the per-response CSP wins.
- `callbackPage()` gained a `nonce` param; both inline `<script>` tags now render as `<script nonce="{value}">`.

Strict CSP is preserved on every other route — only `/callback` carries the nonce. This is the correct trade-off vs adding `'unsafe-inline'` globally to `script-src`, which would weaken CSP everywhere for one edge case.

### Process note

Sprint 1 retro rules need to apply at sprint boundaries (we did legacy-parity for `routes/dashboard.tsx`) AND at security-policy rollouts. Adding to the next backlog grooming: a "policy-rollout pre-flight" checklist that explicitly tests inline-style/inline-script flows before deploying CSP changes.

### Versions: 9.6.0 → 9.6.1 in 5 places.

---

## [9.6.0] — 2026-04-30

**Sprint 4 Phase 1 — clubs expansion (`#53`). 4-tab IA, slim sticky header (cover hero dropped), Overview tab fully wired, Schedule/Members/Metrics placeholders for Phases 2-5.**

### `#53` — Clubs expansion, Phase 1 of 5

The post-demo-sprint-4 plan is documented end-to-end in `docs/post-demo-sprint/sprint-4/`:
- `01-clubs-experience-design.md` — BA + UX (6 stories, 6 AI embedding points, 4-tab UX flows)
- `02-cto-review.md` — 5-phase plan, 5 ADRs S4.1–S4.5 (founder approved 2026-04-30)
- `03-architecture-changes.md` — 3 new tables (Phases 2 + 5), 7 new endpoints, first cron handler in this codebase, 4 LLM moments with privacy-safe prompt shapes

This release is Phase 1 only: 4-tab shell + Overview tab + the new `GET /api/clubs/:id/overview` endpoint. **No new schema, no AI calls, no cron** — those land in Phases 2-5.

### Backend

`GET /api/clubs/:id/overview` — single D1 batch returning:

- Club row + caller's role (membership-gated 404 per OWASP — don't leak existence of clubs the caller isn't in)
- 28-day stat aggregations from `activities`: `hours_28d` (sum of `moving_time` ÷ 3600), `distance_28d` (sum of `distance` ÷ 1000), `ride_count_28d`, `new_members_28d` (count of `club_members` joined in window)
- Upcoming events from `club_events` (next 20 by `event_date`, `confirmed_count: 0` placeholder until Phase 2 lands `event_rsvps`)
- `circle_note: null` (table lands Phase 5)

Auth via `resolveAthleteId` (same pattern as `/api/clubs/:id/members`). Errors: 401, 404 (not member or unknown club), 500.

Two SQL bugs from the initial Sonnet dispatch caught + fixed pre-commit during CTO review:
- `SUM(a.elapsed_time)` → `SUM(a.moving_time)` (no `elapsed_time` column in our schema)
- Cutoff bind: `activities.start_date_local` is TEXT (ISO) and `club_members.joined_at` is INTEGER (unix epoch) — needed two cutoff values, not one

### Frontend

`apps/web/src/components/ClubDashboard/ClubDashboard.tsx` rewritten for Phase 1:

- **Cover hero dropped** per founder mid-stream directive 2026-04-30 (~280 px reclaimed). Replaced with a slim sticky header above the tabs row showing club name + metadata band: `EST. {year} · {N MEMBERS} · PRIVATE`. Year derived from `club.created_at`; member count from `useClubMembers`. Privacy hardcoded `PRIVATE` (no public clubs feature).
- **4-tab IA**: Overview / Schedule / Members / Metrics. Tab navigation uses local component state (not nested routes — clubs is a sub-view of the dashboard). Schedule / Members / Metrics tabs render placeholder content showing the version where they'll ship (`Coming in v9.6.{2,1,4}`).
- **Overview tab**: invite link (admin-only), stat tiles section (rewired to `/overview` endpoint), Upcoming section with placeholder RSVP button (Phase 2 wires the write), Circle Note section as plain text (Phase 5 adds AI draft + editor), Members rail.
- **`useClubOverview` hook** added to `apps/web/src/hooks/useClubs.ts` (TanStack Query, 5 min stale, 30 min gc — same pattern as `useStravaData`).
- **`clubsApi.overview(clubId)`** added to `apps/web/src/lib/clubsApi.ts` with `ClubOverview`, `ClubStatTiles`, `UpcomingEvent` types.

### Test totals

27/27 unit pass. Mobile-tabs Playwright gate from Sprint 2 still green (verified post-deploy).

### Versions: 9.5.2 → 9.6.0 in 5 places.

---

## [9.5.2] — 2026-04-30

**Sprint 3 Phase 3 — accessibility + UI polish. Four CSS-only / single-component fixes batched into one release theme.**

### `#43` — `:focus-visible` rings

Several interactive components had no visible focus indication for keyboard users:

- `Button.module.css` — secondary, ghost, strava variants had no focus ring
- `BottomNav.module.css` — focus-visible only changed color (WCAG 1.4.11 fail — color-only indication)
- Form inputs across `ClubCreateModal`, `ClubEventModal`, `OnboardingModal`, `AiCoachCard`, `GoalEventCard`, `TabShared`, `RideFeedback` used `:focus` not `:focus-visible`, so mouse clicks lit up the ring (visually noisy)

Fix: new `--ring-focus` + `--ring-focus-offset` design tokens in `tokens.css`. All listed components migrated to `:focus-visible` with `outline: var(--ring-focus); outline-offset: var(--ring-focus-offset)`. Keyboard-only users now get a clear accent-colored outline; mouse users no longer get the noisy ring on click.

### `#44` — 44px WCAG touch targets

Three buttons were below the WCAG 2.5.5 minimum touch target:

| Component | Was | Now |
|---|---|---|
| `VolumeChart .toggleBtn` | ~25px tall | `min-height: var(--hit-min)` (44px) |
| `ClubDashboard .tab` | ~31px tall | `min-height: var(--hit-min)` (44px) |
| `RideFeedback .askBtn` | ~27px tall | `min-height: var(--hit-min)` (44px) |

The `--hit-min` token already existed in `tokens.css`; only the per-component `min-height` rule was added.

### `#45` — AppFooter mobile-first grid

`AppFooter.module.css` `.footCols` had a hard `repeat(3, 1fr)` with no breakpoint — at 375px (iPhone Mini) each column collapsed to ~111px and link labels wrapped awkwardly. Fixed with mobile-first stack: `1fr` at narrow viewports, `repeat(3, 1fr)` at `min-width: 600px`.

### `#3` — Remove "Revoke access" from public footer

`AppFooter.tsx` was rendering a "Revoke access" link in the marketing footer — confusing for anonymous visitors and exposing an auth-specific action to unauthenticated users. Removed. The revoke flow stays in `UserMenu` for authenticated users via the existing trigger. Footer columns now: **Product / Trust / Powered by**.

### Test totals

27/27 unit pass (unchanged — pure CSS / single-component edits, no logic touched). Mobile-tabs Playwright gate still green (4/4) — verified post-deploy.

### Versions: 9.5.1 → 9.5.2 in 5 places.

---

## [9.5.1] — 2026-04-30

**Sprint 3 Phase 2 — three security hardening fixes covering method allowlist, clubs-write rate-limit, and full security header set.**

### `#41` — `/api/*` Strava proxy method allowlist

The generic `/api/*` Strava proxy fall-through was forwarding **all HTTP methods** to Strava — including `DELETE`, `PUT`, `PATCH`. Per ADR-S3.4 Option B (founder approved), only `GET` and `POST` are allowed; everything else returns 405 with `Allow: GET, POST`. Per-path explicit handlers (e.g. `PATCH /api/training-prefs`) match earlier in the routing chain and are unaffected.

Commit: `1dad86d`. ~10 lines in `worker.js`.

### `#42` — clubs-write rate-limit (30/min/athlete shared scope)

Per ADR-S3.3 — scope reduced to `/api/clubs*` writes only. `/coach`, `/coach-ride`, `/api/routes/discover` were already rate-limited in Sprint 1 + v9.3.1. The remaining gap was the clubs surface.

Three POST endpoints now share a single `clubs-write` rate-limit scope per athlete (30/min):
- `POST /api/clubs` (create)
- `POST /api/clubs/join/:code` (join via invite)
- `POST /api/clubs/:id/events` (create event — only the POST branch; GET stays unmetered)

Shared scope (not per-endpoint) means the 30/min budget covers all clubs-write activity for that athlete combined — an attacker can't triple their burst by fanning across endpoints. Reuses `checkRateLimit` on `DOCS_KV`.

Commit: `1b15122`.

### `#15` — security headers (CSP / HSTS / X-Frame-Options / etc.)

None of these headers were on Worker responses or static assets pre-v9.5.1. Now all of them, on both surfaces:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (2-year, preload-eligible)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (legacy clickjack protection)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` (deny by default)
- `Content-Security-Policy` — provisional, app-tested:
  - `default-src 'self'`
  - `script-src 'self'` (no inline scripts in index.html)
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` (React inline styles + Google Fonts)
  - `font-src 'self' https://fonts.gstatic.com`
  - `img-src 'self' data: https://*.cloudfront.net https://*.googleusercontent.com` (Strava CDN avatars + future Google avatars)
  - `connect-src 'self'` (all API calls go through the Worker proxy, same-origin)
  - `frame-ancestors 'none'` (modern equivalent of X-Frame-Options:DENY)
  - `base-uri 'self'`, `form-action 'self'` (defensive)

Implementation: new `SECURITY_HEADERS` const + `withSecurityHeaders(res)` helper at the top of `worker.js`. The Worker's `fetch` handler is now a thin wrapper that calls `handleRequest()` and wraps the response — existing route handlers untouched. Same headers applied to static assets via `apps/web/public/_headers` (Cloudflare Workers Static Assets reads it).

CSP can be tightened later by dropping `'unsafe-inline'` on `style-src` once React inline styles migrate to nonce-based or external CSS, and by removing the wildcards on `img-src` once Strava image hosts stabilise.

Commit: `e390d47`. New file `apps/web/public/_headers`.

### Test totals

27/27 unit pass (unchanged from v9.5.0). Mobile-tabs Playwright gate from Sprint 2 still green (4/4) — verified post-deploy.

### Versions: 9.5.0 → 9.5.1 in 5 places.

---

## [9.5.0] — 2026-04-30

**Sprint 3 Phase 1 — three frontend stability fixes from the 2026-04-30 audit's HIGH backlog + backlog triage. No worker, no schema, no security-surface change.**

### `#38` — `useRides` cleared tokens during render

`apps/web/src/hooks/useStravaData.ts:61` called `clearTokens()` directly in the render body when `actsQ.error?.message?.includes('not_authenticated')`. Under React 19 Strict Mode the render fires twice in dev; combined with React Query's `retry: 1`, the second render could wipe tokens that the retry was about to refresh successfully. User reproducer: open the dashboard with a token nearing expiry, get booted to ConnectScreen even though tokens were valid through the refresh path.

Fix (commit `a333576`): extracted `is401` to a derived value, wrapped the `clearTokens()` call in `useEffect(..., [is401])`. Strict Mode's second render no longer re-fires the effect (same dep value).

### `#39` — `writeTokens` / `clearTokens` no `try/catch`

`auth.ts:24-30` called `localStorage.setItem` / `removeItem` without a guard. Safari Private Browsing throws `QuotaExceededError` on `setItem`; the throw was uncaught, so users completing OAuth landed on `/dashboard` with no tokens written and no error UI. Stuck on ConnectScreen with no signal as to why their flow "failed".

Fix (commit `fa9121d`): wrapped both functions in `try/catch` matching the existing read-side pattern at `auth.ts:17-19`. Write attempt still happens; throw is silently absorbed (Safari private mode is a known constraint, not an actionable user error). Vitest unit `auth.test.ts` (3 cases) covers writeTokens + clearTokens under throwing localStorage mocks.

### `#40` — Unsafe `as CoachError` cast misclassified network errors

`apps/web/src/hooks/useAiReport.ts:42` and `apps/web/src/hooks/useRideFeedback.ts:49` cast caught errors via `e as CoachError`. A network `TypeError` (offline / CORS) got cast to `CoachError`; the consuming code checked `err.invalidKey` (undefined on TypeError) and showed *"your API key may be invalid"* for actual network failures. UX bug masquerading as a security signal.

Fix (commit `0d3d2fc`): replaced cast with `e instanceof CoachError` type-guard. Real CoachError still gets the existing `invalidKey` + `stravaExpired` (Sprint 2) branches. Any other thrown value gets a generic error message with `invalidKey=false`, `stravaExpired=false`. Vitest unit `useCoachHooks.test.ts` (4 cases) covers TypeError and DOMException paths surfacing as generic errors, not invalid-key.

### Backlog triage — `#6`, `#8`

Phase 1 also burned 1h on triage of two older HIGH-priority issues per ADR-S3.2:

- **`#6` (suggested routes broken)** — closed as superseded. v9.3.0 (`b8e6280`) replaced MOCK_ROUTES with `GET /api/routes/saved`; v9.3.1 (`687bfce` / `818dd88`) shipped `POST /api/routes/discover` for AI fallback; surface labels were renamed `dirt → gravel` per architect spec. All three sub-points covered.
- **`#8` (retroactive TSS backfill)** — kept open. Verified D1 state: `activities` has 11 rows, **all `tss IS NULL`**; `daily_load` is empty. Schema v2 columns exist (migration 0001 applied) but the backfill never ran — natural sync didn't fill values because rides were synced before FTP was set. Deferring to a later sprint or a one-shot data-ops slot; out of v9.5.0 stability scope.

### Test totals

27/27 unit pass (was 20; +7 across `auth.test.ts` and `useCoachHooks.test.ts`). Mobile-tabs Playwright gate from Sprint 2 still green against prod (4/4).

### Versions: 9.3.5 → 9.5.0 in 5 places.

---

## [9.3.5] — 2026-04-30

**Sprint 2 Phase 1 — two regression hotfixes from Sprint 1's BYOK flow + the mobile-viewport CI gate that should have been there from day one.**

### FB-R1 — `/coach` + `/coach-ride` bearer never sent by frontend

v9.3.0 closed the open-Anthropic-proxy CRITICAL (`#33`) by gating `/coach` + `/coach-ride` behind `resolveAthleteId` (Strava bearer). The fix on the worker side was correct. The fix on the frontend was missing: `apps/web/src/lib/coachApi.ts:89` `postJson()` only sent `Content-Type: application/json` — no `Authorization` header. Every BYOK call to `/coach` (Generate plan) and `/coach-ride` (per-ride feedback) therefore arrived without credentials and got 401 "authentication required". User saw a generic auth error after entering their Anthropic key.

**The bearer gate is correct and stays.** Reverting it would re-open `#33`. The actual UX bug was always the missing header.

Fix (commit `343f8a3`):

- `coachApi.ts` `postJson()` now calls `ensureValidToken()` first (the same helper `useStravaData` and `RoutesPicker` use — IR-R1 in BA doc). Attaches `Authorization: Bearer ${tokens.access_token}` to the fetch.
- If `ensureValidToken()` returns `null` (no Strava session, or refresh failed), `postJson` throws `CoachError` with a new `stravaExpired: true` flag. `CoachError`'s constructor signature: `(message, invalidKey = false, stravaExpired = false)`.
- `useAiReport`, `useRideFeedback`, `AiCoachCard` callers now branch on `stravaExpired` parallel to the existing `invalidKey` branch — surface a "Reconnect Strava" CTA instead of generic auth error (IR-R2: reuses the existing `/authorize` flow, no second reconnect UI).
- New Vitest unit at `coachApi.test.ts` — 2 cases: `ensureValidToken → null` rejects with `stravaExpired=true, invalidKey=false`; valid tokens resolve through to fetch.
- 20/20 unit tests green (was 18; +2).

### FB-R2 — You-tab lost the "Get a key →" link

The legacy `AiCoachCard.tsx:90` showed *"Your key stays in this browser. [Get a key →](https://console.anthropic.com/settings/keys)"*. The v9.3.0 You-tab rewrite (`dashboard.you.tsx:142-144`) replaced it with a stripped-down *"Bring your own Anthropic key to generate a weekly training plan. Each plan ≈ $0.02."* — link gone, privacy reassurance gone. Persona C (non-technical) had no path to obtain an Anthropic key without leaving the app.

Fix (commit `48d2222`):

- Hint copy in `dashboard.you.tsx` now mirrors `AiCoachCard.tsx:90` verbatim — same link to `https://console.anthropic.com/settings/keys`, same `target="_blank" rel="noopener noreferrer"`, same "your key stays in this browser" reassurance.
- `TabShared.module.css` `.apiKeyHint a` rule added (4 lines) so the link gets accent color + underline + opacity-on-hover. Matches the legacy emptyLede style.
- Frontend copy + CSS only. No worker, no schema.

### Sprint 1 retro rule #2 — mobile-viewport CI gate

`apps/web/tests/mobile-tabs.spec.ts` (commit `a289dcc`) lands as the FIRST commit of Sprint 2. Two Playwright tests at 390×844 viewport with `cc_tabsEnabled='true'`:

1. Navigate `/dashboard` → asserts redirect to `/dashboard/today`, `header` element count ≥ 1, `#root` populated, no `pageerror`.
2. Navigate `/dashboard/today` directly → asserts URL stays at `/dashboard/today` (no redirect bounce).

Tests run against `E2E_TARGET_PROD` like the existing smoke spec. Anything that breaks the mobile mount path now fails CI before deploy. This is exactly the test that would have caught the v9.3.1 redirect-loop, the v9.3.3 missing TopBar, and the v9.3.4 missing ContextSwitcher in one shot.

### Versions: 9.3.4 → 9.3.5 in 5 places.

---

## [9.3.4] — 2026-04-30

**Clubs feature restored in the mobile tabs layout. v9.3.3 added `<TopBar />` + `<UserMenu />` but missed `<ContextSwitcher />` and the club-mode rendering branch — clubs went invisible on mobile.**

### Background

Legacy `pages/Dashboard.tsx` (desktop / flag-off codepath) renders the TopBar trailing as `<><ContextSwitcher /><UserMenu /></>` and switches the main view between `<ClubDashboard />` and the individual dashboard sections based on `scope.mode === 'club'`. v9.3.3's `TabsLayout` only ported the UserMenu half — ContextSwitcher was missing, and the layout always rendered `<Outlet />` regardless of scope. Result: mobile users in tabs mode could neither see their clubs nor switch into them.

### Fix

`apps/web/src/routes/dashboard.tsx` `TabsLayout` now mirrors `Dashboard.tsx`'s pattern:

- TopBar trailing: `{clubsEnabled ? <ContextSwitcher /> : null}<UserMenu …>` — same gating as legacy
- Main body: `isClubMode ? <main><Container><ClubCreateCard /><ClubDashboard … /></Container></main> : <><Outlet /><BottomNav /></>`
- BottomNav hides in club mode — tabs (Today / Train / Rides / You) are personal-only, so they're irrelevant when scope is club. Toggle back to individual via ContextSwitcher to restore tab nav.

`isClubMode` derived identically: `clubsEnabled && scope.mode === 'club' && scope.clubId != null` (same as `Dashboard.tsx:168`).

### What carries over

All v9.3.3 features unchanged — viewport-aware `useTabsEnabled()`, redirect-loop guard, RoutesPicker rework + AI fallback, `POST /api/routes/discover`, Migration 0004 columns, `<TopBar />` + `<UserMenu />` in tabs layout.

### Versions: 9.3.3 → 9.3.4 in 5 places.

---

## [9.3.3] — 2026-04-30

**Stabilization release. Adds the `<TopBar />` brand bar that was missing from the mobile 4-tab layout shell since v9.3.1.**

### Background

v9.3.1 introduced the tabbed mobile dashboard via a new `routes/dashboard.tsx` layout that rendered `<Outlet />` + `<BottomNav />` when `cc_tabsEnabled` was on. It never rendered `<TopBar />` — the brand bar was only inside the legacy `pages/Dashboard.tsx`, never lifted into the new shell. The omission was masked in v9.3.1 by the redirect-loop bug (the page never mounted, so nobody noticed the missing header). v9.3.2 fixed the redirect loop and the missing TopBar surfaced as soon as the tabs view became visible: no brand mark, no UserMenu, no way to sync/disconnect/edit-profile from tab mode.

### Fix

`apps/web/src/routes/dashboard.tsx` now renders a `<TabsLayout />` component when the flag is on. TabsLayout wires the same hooks the legacy `Dashboard.tsx` uses for header state (`useAthleteProfile`, `useRides`, `readTokens`, `useQueryClient`) and renders:

```
<TopBar variant="app" trailing={<UserMenu …>{userPill}</UserMenu>} />
<Outlet />
<BottomNav />
```

UserMenu props match legacy: `username`, `onSync` (invalidates athlete + activities query keys), `onDisconnect` (clearTokens + window.location.href = '/'), `onEditProfile` (resets onboarding dismissal). The trigger pill imports from `pages/Dashboard.module.css` to match legacy styling exactly — same avatar/name/city block.

Mock-data fallback (`MARCO`) wired the same way as `Dashboard.tsx`; demo mode (`?demo=1`) also works in tabs mode.

### Everything else

All v9.3.2 features unchanged — viewport-aware `useTabsEnabled()`, RoutesPicker rework (surface-only chips, inline placement in Today session card, AI fallback panel, `Start workout in Strava ↗` button), `POST /api/routes/discover` endpoint, Migration 0004 columns. See the v9.3.2 entry below for context, the v9.3.1 entry for the full feature description.

### Versions: 9.3.2 → 9.3.3 in 5 places.

---

## [9.3.2] — 2026-04-30

**Hotfix-of-hotfix. Ships v9.3.1's features with the redirect-loop regression fixed.**

### Background

v9.3.1 (commit `d4e8b21`) deployed to prod and immediately broke the mobile experience — the page rendered all-black, no error in DevTools, no `pageerror` event fired. v9.3.0 was reverted (`93ef06b`) to restore service while the regression was diagnosed locally.

### Root cause

`/dashboard`'s `beforeLoad` redirected to `/dashboard/today` whenever `computeTabsEnabled()` returned true. With v9.3.1's mobile-default-ON change, that returned true on every mobile load. Tanstack Router runs the parent route's `beforeLoad` on every nested-route navigation — so visiting `/dashboard/today` re-triggered the parent's `beforeLoad`, which re-redirected to `/dashboard/today`, which fired again, ad infinitum. The JS thread blocked, React never mounted, the page sat on the dark canvas with `<div id="root"></div>` empty. No error fired because Tanstack catches `redirect()` throws as control flow.

Reproduced locally with Playwright headless against `npm run dev`: `page.locator('#root')` timed out, `page.content()` hung. Adding the pathname guard fixed both within one HMR reload.

### Fix

`apps/web/src/routes/dashboard.tsx`:

```diff
- beforeLoad: () => {
-   if (computeTabsEnabled()) {
+ beforeLoad: ({ location }) => {
+   if (location.pathname === '/dashboard' && computeTabsEnabled()) {
      throw redirect({ to: '/dashboard/today' });
    }
  },
```

The redirect now fires only on bare `/dashboard`, not on its sub-routes.

### Everything else

All v9.3.1 features carry over unchanged — viewport-aware `useTabsEnabled()` hook, RoutesPicker rewrite (surface-only chips, inline placement in Today session card, AI fallback panel, `Start workout in Strava ↗` button), `POST /api/routes/discover` endpoint with system-paid Haiku and 10/h/athlete rate limit, Migration 0004's three columns on `training_prefs`. See the v9.3.1 entry below for the full feature description.

### Process notes

- v9.3.1 release-cut shipped with `git add -A` which swept `.DS_Store` and a one-off `scripts/file-post-demo-sprint-issues.sh` into the commit. Both are absent from v9.3.2 — `.DS_Store` is in `.gitignore` (added in `982fd44`); the one-off script is removed.
- The Playwright local-debug script that pinpointed the redirect loop was thrown away — a reusable repro harness is a backlog item, not a hotfix scope item.

### Versions: 9.3.1 → 9.3.2 in 5 places.

---

## [9.3.1] — 2026-04-30

**Sprint 1 follow-up — tabs viewport-aware default + RoutesPicker rework + AI route discovery (Phase 2 lifted forward).**

User feedback after the v9.3.0 deploy surfaced three product mismatches:

1. The kill-switch flag `cc_tabsEnabled` defaulted off, so most users still saw the legacy single-page dashboard. Mobile users in particular expected the tabbed layout by default. Demo flip via DevTools wasn't a sustainable distribution model.
2. The RoutesPicker chips for **distance** and **difficulty** were over-spec — the architect's `03-architecture-changes.md §C.2` table proposed them, but the BA's FB-1 only required surface. Removed.
3. The RoutesPicker rendered as a separate panel several scroll-screens removed from the Today session card. Users expected: open Today → see AI plan → pick a route inline → tap **Start workout** → land in Strava with the route loaded.

This release rebuilds around what users actually wanted.

### Tabs viewport-aware (`#51` follow-up)

`useTabsEnabled()` now defaults based on viewport:
- Mobile (<1024px) — tabs ON.
- Desktop (≥1024px) — single-page dashboard.

Kill-switch works in both directions: `localStorage.cc_tabsEnabled='true'` forces tabs anywhere; `'false'` forces single-page anywhere. The hook also listens to `matchMedia` change events, so rotating an iPad mid-session updates the layout without a refresh.

A pure helper `computeTabsEnabled()` mirrors the hook's logic for use outside React (the `/dashboard` route's `beforeLoad` redirect, which Tanstack runs before mounting). Same precedence: explicit override → viewport.

7 unit tests added; 18 total green.

### RoutesPicker rework (`#47` follow-up)

`apps/web/src/components/RoutesPicker/RoutesPicker.tsx` rewritten:

- Distance + difficulty chips removed entirely (BA didn't ask, user didn't want).
- Surface filter retained (Any / Paved / Gravel — same vocabulary as `GET /api/routes/saved`).
- Saved Strava routes now scored against today's session: routes within ±20% of the session's target distance pass; the rest are hidden. Target distance is derived from the AI plan text (km mention, hour/min mention with 25 km/h proxy, or workout-type heuristic).
- Browse mode (no session) still works — passing no `todaysSession` prop lists all surface-filtered saved routes. Used by the legacy desktop Dashboard.
- New `onRouteSelected` callback + `selectedRouteKey` prop for the parent to hold the picked route. When `onRouteSelected` is absent, route rows render read-only.
- Dev-mode mock fallback removed — hot reloads against real Strava. Dev-only auth issues now surface as the real "Couldn't load…" error rather than masking with mocks.

### Today session card integration

`apps/web/src/routes/dashboard.today.tsx` now embeds RoutesPicker between the AI plan card body and a new **Start workout in Strava ↗** CTA. The button:
- Disabled until a route is picked.
- For saved Strava routes — opens `https://www.strava.com/routes/{id}` in a new tab. Universal links jump to the Strava app on mobile; the user just taps record.
- For AI-discovered routes (no Strava ID) — opens `https://www.strava.com/athlete/routes/new` so the user can plan it before recording. The picker also shows a hint: "Briefs only — plan one in Strava routes or Komoot, then tap Start workout."

`useTrainingPrefs` is read for surface + start_address defaults; updates flow through `PATCH /api/training-prefs` (debounced 800ms via the existing helper).

### Phase 2 — `POST /api/routes/discover` (lifted forward from Sprint 3)

The original plan deferred Phase 2 to Sprint 3, but Phase 1 alone proved load-bearing without it: a user with no saved routes (or whose saved routes don't match today's distance) hit a dead end. This release ships Phase 2.

Endpoint per architect spec `§C.3`:
- Auth: Strava bearer → `resolveAthleteId`
- Body: `{ location, surface, distance_km, difficulty }` — all required, validated
- Rate-limit: 10 calls / hour / athlete via the generic `checkRateLimit` helper on `DOCS_KV` (scope `discover`, 3600s window)
- System-paid: reads `env.SYSTEM_ANTHROPIC_KEY` (set via `wrangler secret put`); falls back to `env.ANTHROPIC_API_KEY` for single-user dev
- Model: `claude-haiku-4-5-20251001`, `max_tokens: 1500`
- Response: `{ routes: [{ name, narrative, start_address, target_distance_km, estimated_elevation_m }], generated_at }` — 3-5 items
- Server-side validation: drops malformed entries from the AI response rather than 503ing on partial output; 503 only when the response shape is unparseable or empty
- 503 fallback when `SYSTEM_ANTHROPIC_KEY` is unset

The Today RoutesPicker calls this endpoint when zero saved routes match. Frontend derives `distance_km` and `difficulty` from the AI plan text — user only sees the surface chip + start address. Per-call cost ≈ $0.001-0.003.

### Versions: 9.3.0 → 9.3.1 in 5 places.

---

## [9.3.0] — 2026-04-30

**Sprint 1 of the post-demo plan ships in one cut: 2 security CRITICALs, mobile 4-tab refactor, route discovery rewire, migration 0004, Dependabot zero-clear.**

### Security — `#33` + `#34` (CRITICALs from the 2026-04-30 audit)

`POST /coach` and `POST /coach-ride` accepted `api_key` in the request body and forwarded to Anthropic with **no authentication gate**. Anyone on the internet could POST a leaked Anthropic key and burn through the owning user's credits — open Anthropic proxy. Combined with the wildcard CORS, any third-party page could submit a victim's key cross-origin.

Fix (`#33`, commit `3b24655`):
1. Both endpoints now require `Authorization: Bearer <strava-token>`. Validated via `resolveAthleteId()` — same gate used on `/api/clubs*`. Missing/invalid → 401.
2. Per-athlete rate limit on DOCS_KV (same KV pattern as `/admin/*` from v8.5.2 #18, refactored into a generic `checkRateLimit` helper). 20/min for `/coach`, 60/min for `/coach-ride`. 21st (or 61st) call inside the 60s bucket → 429 with `Retry-After`.
3. CORS tightening: new `ALLOWED_ORIGINS` allowlist gates the Origin header. OPTIONS preflight from non-allowlisted origins → 403 (intercepted before the global `/api/*` wildcard handler). POST with non-allowlisted Origin → 403.
4. `checkAdminRateLimit` refactored to delegate to the new generic `checkRateLimit`. Admin behavior unchanged.

Separately (`#34`, commit `f2388e1`): the Worker derived `origin` from `X-Forwarded-Host` and used it to mint OAuth `redirect_uri` + post-callback redirect URLs. An attacker could send `X-Forwarded-Host: evil.com` and turn the OAuth flow into a phishing-redirect kit. Combined with predictable `state` (closed in `#14`, v9.2.0) it was a complete phishing pipeline.

Fix: `userOrigin()` ignores `X-Forwarded-Host` / `X-Forwarded-Proto` entirely. Uses `url.origin` (the host Cloudflare actually received) gated on the new `ALLOWED_ORIGINS` allowlist. `/authorize` fails closed (400) when the host is not allowlisted. Localhost `?origin=` loopback override preserved for dev.

Smoke verified in prod (commit `3b24655` deploy): `POST /coach` without bearer → 401; CORS preflight from non-allowlisted origin → 403; bogus bearer → 401 `authentication required`; valid origin preflight → ACAO matches request origin with `Vary: Origin`; `X-Forwarded-Host: evil.com` on `/authorize` → still redirects to Strava with `redirect_uri=https://cycling-coach.josem-reboredo.workers.dev/callback` (the spoofed header is now ignored).

BYOK `api_key` remains in the request body — moving it server-side requires the encrypted-at-rest D1 column from FB-6 / SC-3, which lands in Sprint 2. Bearer + rate limit + CORS now mean a leaked `api_key` alone is no longer enough to abuse the proxy.

### Mobile 4-tab refactor — `#51` (folds `#48`)

The `/dashboard` route is restructured into 4 nested sub-routes — `/dashboard/today`, `/dashboard/train`, `/dashboard/rides`, `/dashboard/you` — all behind a kill-switch flag `cc_tabsEnabled` (default OFF until demo flip). Pattern mirrors the v9.0.0 `cc_clubsEnabled` rollout: ZERO regression with the flag off; demo-night flip is `localStorage.setItem('cc_tabsEnabled','true')`.

Three commits:
- `4f87431` — sub-task A. Scaffolding: `useTabsEnabled()` hook in `featureFlags.ts`, 4 stub sub-routes via TanStack flat-dot file convention (`dashboard.today.tsx` etc.), `dashboard.tsx` branches between `<Dashboard />` (off) and `<Outlet /> + <BottomNav />` (on), `/dashboard` redirects to `/dashboard/today` via `beforeLoad` when on. `BottomNav` swaps hash-anchors for Tanstack `<Link>` with `activeProps` when on.
- `8b40b65` — sub-task B. Splits the 697-line `Dashboard.tsx` content per FB-5 mapping. **Today**: salutation + KPIs + today's session + start CTA + year-progress bar (static 8000km — AI forecast lands in #49 / Sprint 2). **Train**: weekly plan + goal/event card. **Rides**: recent activities + 10/page pagination with prev/next disabled at boundaries (FB-5 acceptance). **You**: FTP + weight + HR Max + Anthropic API key + Strava connection (existing fields only — profile expansion is `#52`, Sprint 2). Each tab has a visible `h1` and an empty-state line (FB-2 / `#48` acceptance). New shared `TabShared.module.css`. Original `Dashboard.tsx` kept intact for the flag-off + desktop codepath; both modes coexist.
- `5e56e61` — sub-task C. Lightweight test slice: 5 Vitest unit tests on `useTabsEnabled` + `useClubsEnabled`, 2 Playwright e2e specs (`/dashboard` flag-off no-redirect; flag-on redirect-to-today). Note: happy-dom 20.x doesn't expose `localStorage` as an own-property global (prototype getter only), so the unit tests use `vi.stubGlobal` in `beforeEach`. The flag-on redirect e2e goes green after this v9.3.0 deploy.

Issue `#48` ("Dashboard clarity") folded in per CTO review §B.1 — the 4-tab structure inherently satisfies its acceptance (every section has a heading, KPI cards have labels, ≤1 tap to navigate, empty states).

### Route discovery rewire — `#47` Phase 1

Closes the "Madrid vs Zurich" hardcoded-city bug. Routes are now the authenticated user's **own Strava saved routes** — geographically correct by definition.

Backend (`b8e6280`): two new auth-gated endpoints inserted before the generic `/api/*` Strava proxy fall-through.

- `GET /api/routes/saved?surface=&distance=&difficulty=` — proxies `https://www.strava.com/api/v3/athlete/routes?per_page=200` with the caller's bearer. Worker-side filters: surface (`paved`/`gravel`/`any` — `'unknown'` always passes for graceful degradation), distance (±20% band on the requested km), difficulty (`flat` <5 m/km, `rolling` 5–15, `hilly` >15). Surface inference: prefers explicit `surface_type` (numeric or string), falls back to Strava `sub_type` heuristic (1=road→paved, 2/4=MTB/trail→gravel). Response: `{ routes: [{ id, name, distance_m, elevation_gain_m, surface, map_url, strava_url }] }`. Errors: 401 unauthorized, 502 strava unavailable, 500 internal.
- `PATCH /api/training-prefs` — partial-update of `training_prefs` keyed by `athlete_id`. Body: any subset of `{ home_region, preferred_distance_km, preferred_difficulty, surface_pref, sessions_per_week, start_address }`. Per-field validation. UPSERT — ON CONFLICT updates only provided fields. Returns full row.

Frontend (`6dec06a`): `RoutesPicker` rewired off `MOCK_ROUTES` onto live fetch. Surface chips renamed `dirt` → `gravel` (matches the architect spec vocabulary). New distance chips (30/60/100/Any km, ±20% server-side band) and difficulty chips (Flat/Rolling/Hilly/Any). Loading / empty / error states added. Filter changes persist via `PATCH /api/training-prefs` (debounced; fire-and-forget). `MOCK_ROUTES` fallback gated behind `import.meta.env.DEV` — never reaches prod.

Phase 2 (Claude narrative briefs spike via `POST /api/routes/discover`) deferred to Sprint 3 per founder decision. Phase 3 (Komoot partnership) deferred until after Sprint 3.

### Migration 0004 — route filter columns

`bc48e82` adds three optional columns to `training_prefs`: `home_region` (TEXT), `preferred_distance_km` (INTEGER), `preferred_difficulty` (TEXT — `'flat' | 'rolling' | 'hilly'`). Non-breaking additive migration; NULL defaults preserve all existing rows. Backfill is natural — written when the user first interacts with the route picker post-v9.3.0. Applied to remote D1 in the same step (PRAGMA table_info verified all 3 new columns).

Numbering note: `0003` is reserved for `#52` (`users.sex`, `users.country`, Sprint 2 profile expansion). `0003` ships next sprint; `0004` ships first because Sprint 1 lands first. SQLite handles the gap.

`schema.sql` kept in sync per the v9.2.0 process rule (`#37`).

### Dependency fixes — Dependabot 5/5 closed

`e08331d` clears all 5 open Dependabot alerts on `apps/web` (default branch security tab). All dev-only deps — no runtime/Worker exposure.

| Severity | CVE / GHSA | Package | Fix |
|---|---|---|---|
| CRITICAL | CVE-2025-61927 | happy-dom < 20.0.0 | VM context escape RCE |
| HIGH | CVE-2026-33943 | happy-dom < 20.8.8 | Unsanitized export name code injection |
| HIGH | CVE-2026-34226 | happy-dom < 20.8.9 | Fetch credentials use page-origin cookies |
| MEDIUM | CVE-2026-39365 | vite ≤ 6.4.1 | `.map` optimized-deps path traversal |
| MEDIUM | GHSA-67mh-4wv8-2f99 | esbuild ≤ 0.24.2 | Dev server cross-origin reads |

Bumps: `happy-dom ^15.11.7 → ^20.8.9` (resolved 20.9.0); `vitest ^2.1.9 → ^3.0.0` (resolved 3.2.4); `@vitest/coverage-v8 ^2.1.9 → ^3.0.0` (resolved 3.2.4). The vitest major bump removes transitive `vite@5.4.21` + `esbuild@0.21.5` from the tree, replacing them with `vite@6.4.2` + `esbuild@0.25.12` (already pinned by our top-level `vite ^6`).

Verified: `npm audit` 0 vulnerabilities (was 5); `npm run build` green (1.27s); `npm run test:unit` 11/11 + 5 new = 16/16 green under vitest 3.2.4.

### Versions: 9.2.5 → 9.3.0 in 5 places.

---

## [9.2.5] — 2026-04-30

**FIX 6 — strip code blocks from /whats-next issue bodies (raw SQL was leaking to the UI).**

`/roadmap`'s `normalizeGhIssue` server-side transform took the first paragraph of each GitHub issue body and stripped `#`/`>`/`*`/`-`/whitespace prefixes — but did not strip fenced code blocks. Issues that opened with a ```` ```sql ```` block (#35, #37, the recent audit-spec issues) leaked their migration DDL — `CREATE TABLE club_events ...` — verbatim into the route card UI on `/whats-next`. Visible to users via projector during the demo.

Fix is purely server-side in `src/worker.js` `normalizeGhIssue()`:
1. Strip fenced code blocks (` ```...``` `) before any other processing.
2. Strip inline code (`` `code` ``).
3. Then take the first non-empty paragraph after the existing prefix-strip pass (was: take first paragraph THEN strip prefixes — broken if the first paragraph was *only* a code block, would leave empty `body`).

Acceptance: `/whats-next` no longer renders backtick fences or SQL for any issue card. Issues whose body has a prose first paragraph (the majority) render unchanged. Issues whose entire body is code blocks render with empty body — title still shows, which is the right fallback.

Also includes the **remote D1 backfill for invite_code** that v9.1.4 only applied locally — `UPDATE clubs SET invite_code = lower(hex(randomblob(8))) WHERE invite_code IS NULL` ran against prod D1, backfilled 1 club (Merkle Riders) that had `NULL` from the original buggy create.

FIXes 2-5 from the demo punch-list were already shipped in v9.1.4 (commit `b4e6395`):
- `invite_code` generation in POST /api/clubs ✓
- `--c-text-faint: #7a8290` (5.11:1, AA passing) ✓
- `--c-z7: #a55be0` (4.87:1, AA passing — note: punch-list suggested `#9a4dd9` but that computes to 4.18:1 and **fails** AA; existing value is better, kept it) ✓
- `--c-bg-deep: #000` defined ✓

Versions: 9.2.4 → 9.2.5 in 5 places.

---

## [9.2.4] — 2026-04-30

**New Confluence spec page: Data Model.** 12 tables documented end-to-end (DDL, columns, indexes, FK + ON DELETE behavior, read/write paths per Worker endpoint, migration history, operational notes). Source of truth = `schema.sql`. ~444 lines added to `src/docs.js`. Auto-created in Confluence on next deploy via `ensurePage()` (the worker creates pages that don't exist yet, no manual setup).

### Page structure

1. Overview — multi-source-ready, Strangler-Fig complete (tokens + activities + clubs), club layer v8.6.0+
2. ER summary — 12 plain-English relationship bullets
3. Tables — 12 subsections, one per table
4. Migrations — 0001 (PMC) + 0002 (club_events)
5. Operational notes — `wrangler d1 export` backup, `--local`/`--remote` apply pattern

### Drift fixes also included

While reviewing schema, caught 4 small drifts in existing pages:

- **APIs §2.12d** — events POST body/response: `scheduled_at` → `event_date`; response shape now lists all 8 fields (was missing description, location)
- **APIs §2.12e** — events GET response: same shape fix; added `creator_firstname/lastname` (which the JOIN already returns) + note about `?include=past`
- **Technical Spec clubs row** — column list said `created_by` (wrong, that's `club_events`); fixed to actual `owner_athlete_id, is_public, invite_code, created_at`
- **Technical Spec club_events row** — `scheduled_at` → `event_date`

Versions: 9.2.3 → 9.2.4 in 5 places.

---

## [9.2.3] — 2026-04-30

**Confluence spec pages content sync.** Surgical updates across all 6 spec pages in `src/docs.js` to reflect current v9.2.x state — clubs MVP + events Phase A + OAuth nonce + /refresh auth gate + schema.sql consolidation + What's-new badge removal + ContextSwitcher dropdown fix. ~151 lines net added across the 6 pages. No code changes — `docs.js` is bundled into the worker, deployed, and `npm run docs:sync` (auto-step in `npm run deploy`) pushes the updated content to Confluence.

### Per-page

- **Systems & Architecture** — D1 row lists all 12 tables + db/README.md; KV row lists DOCS_KV + OAUTH_STATE; architecture diagram adds /api/clubs routes + KV node; §4.1 auth flow notes nonce shipped + /refresh auth gate; ADR Strangler-Fig row marked complete for tokens + activities + clubs.
- **APIs** — Inventory adds 6 clubs rows (POST/GET clubs, members, events, join); /authorize + /callback + /refresh descriptions updated; new §2.12 Clubs detail block (2.12a-f) with body/response/error shapes; §2.1-2.3 detail sections updated for nonce + auth gate.
- **Interfaces** — Surface tokens corrected (--c-text-faint #7a8290 5.11:1, --c-z7 #a55be0 4.87:1, --c-bg-deep added); Chrome list updated (TopBar trailing = ContextSwitcher + UserMenu only; #46 ContextSwitcher viewport-aware positioning noted).
- **Functional Spec** — New §2.15 Clubs (MVP) table covering create, join, members list, events Phase A, RSVPs deferred; out-of-scope social bullet clarified.
- **Technical Spec** — D1 schema split into 4 rows for clubs/club_members/club_goals/club_events; v9.2.0 cumulative-schema policy + db/README.md noted; KV stack lists both bindings; §9 Testing replaced "no automated tests" with "27 passing e2e".
- **Security** — §2 auth flow #14 bullet flipped to shipped v8.6.0; refresh auth gate added (#36 closed); §11 backlog updated with #33, #34, #41, #42 status.

No SECURITY.md changes (out of scope for this commit). No version bump beyond 9.2.3 patch.

---

## [9.2.2] — 2026-04-30

**Removed the "What's new" badge from TopBar.** Decision call: the auto-popping CHANGELOG modal in the header didn't fit the editorial restraint the brand is converging on (Soho House / Monocle, not Garmin). User can still read CHANGELOG.md directly.

- Dropped `<WhatsNewBadge />` from `Dashboard.tsx` TopBar trailing slot + the import.
- Removed the corresponding e2e probe in `smoke.spec.ts` (the badge-modal-dismiss-persist test).
- `WhatsNew/` component files left in place (not deleted) — easy to re-mount later if the call reverses.

Test count: 29 → 27 passing (lost 2 viewport variants of the badge test, no regressions).

---

## [9.2.1] — 2026-04-30

**Hotfix — ContextSwitcher dropdown was clipping on the left edge** (#46). On narrow viewports (and any TopBar layout where `.wrap` sat far left), the menu's `right: 0; min-width: 280px;` positioning could push its left edge to negative X, hiding the leftmost ~50-90px of every menu item. Pure CSS fix in `ContextSwitcher.module.css`:

- Added `max-width: min(360px, calc(100vw - var(--s-4)))` to cap natural width so the menu never exceeds viewport on desktop.
- New `@media (max-width: 600px)` switches the menu to `position: fixed` anchored to viewport edges (`left: var(--s-3); right: var(--s-3); top: 64px + safe-area`). On mobile the menu now spans the full viewport minus 12px gutters, completely independent of where the trigger sits in `TopBar.trailing`.
- Defensive overflow + ellipsis chain on `.head` / `.headLabel` so the "Active context" header ellipsises cleanly if it ever extends.

No JS/TSX changes. Existing UserMenu-pattern keyboard nav unaffected.

---

## [9.2.0] — 2026-04-30

**Sprint 2 of the 2026-04-30 overnight audit.** Four CRITICAL items closed in one release: OAuth state CSRF (issue #14, deferred 3×), `/refresh` auth gate (#36), v9.1.3 events test coverage (#35), and `schema.sql` consolidation (#37). v9.1.4 (commit `b4e6395`, never released as a tagged version) shipped Sprint 1 fixes (invite_code generation + contrast tokens) — those carry forward into v9.2.0.

### Fixed — security

- **OAuth state nonce** (#14) — `/authorize` now generates `crypto.randomUUID()` per call, stores `{pwa, origin, issued_at}` in a new `OAUTH_STATE` KV namespace with `expirationTtl: 600` (10 min). Only the UUID goes on the wire. `/callback` validates the UUID format, reads the KV record, deletes it immediately on success (single-use, prevents replay), then parses the stored `pwa` + `origin` payload — `origin` no longer crosses the wire so an attacker can't construct a working `/callback` URL even if they guess a nonce. Closes the CSRF / token-confusion attack vector documented in issue #14. **Hard cutover**: in-flight OAuth flows issued before the deploy fail with "OAuth session expired" — users just click Connect again.
- **`/refresh` auth gate** (#36) — endpoint now verifies the supplied `refresh_token` corresponds to a known athlete by `LIKE` matching `user_connections.credentials_json`. Unknown tokens get 401 + `safeWarn` with source IP, no Strava round-trip. Doesn't prevent token theft but bounds the attack surface to athletes whose tokens we've seen and gives us a log trail. Bonus: passes through Strava's actual response status (was hardcoded 200), wraps error response so raw `e.message` isn't echoed back, validates `refresh_token` is a non-empty string before any DB call.

### Fixed — data

- **`schema.sql` consolidation** (#37) — file is now the cumulative post-0002 state (12 tables). Was missing migrations 0001 (FTP/weight/HR on users; TSS/NP/IF/duration on activities; `daily_load`; goal-event extensions) + 0002 (`club_events`). Fresh `wrangler d1 execute --local --file=schema.sql` against a clean DB now produces a working schema; was producing a broken one.
- **New `db/README.md`** documents the two-files-one-schema policy: `schema.sql` is canonical for fresh bootstrap, `migrations/` are the authoritative incremental change log. Establishes the v9.2.0+ process rule: every migration commit MUST also update `schema.sql` in the same commit.

### Added — tests

- **Club + events auth-gate e2e probes** (#35) — `apps/web/tests/smoke.spec.ts` now covers `GET/POST /api/clubs`, `GET/POST /api/clubs/:id/events`, `GET /api/clubs/:id/members`, `POST /api/clubs/join/:code`, OPTIONS preflight, plus a `/version` endpoint shape probe. 8 new probes × 2 viewports → 16 new test runs. Total: **29 passing / 1 skipped** (was 13/1). Gated on `E2E_TARGET_PROD=1` (same gate as `/whats-next` + `/roadmap`); locally without the env var they skip cleanly because vite preview doesn't proxy `/api`.

### Carried forward from v9.1.4 (commit b4e6395)

These four CRITICAL fixes shipped as a fix-only commit immediately before v9.2.0 — included in this release:
- `POST /api/clubs` now generates `invite_code` via `crypto.randomUUID().replace(/-/g,'').slice(0,16)` and writes it as the 5th column. Until the fix the INSERT omitted `invite_code`, leaving every club with `NULL` and silently breaking F4 (invite-by-link).
- `--c-text-faint` lifted from `#454a55` (2.16:1 fail) to `#7a8290` (5.11:1 ✓ AA body) — affected 49 use sites.
- `--c-z7` lifted from `#6b21a8` (2.23:1 fail) to `#a55be0` (4.87:1 ✓ AA body).
- `--c-bg-deep` defined as `#000` (was undefined, silently fell back to the inline `#000` fallback in `Landing.module.css`).

### Wrangler config

- New KV namespace `OAUTH_STATE` (id `9b77ecf8836240db9f1c126ce715414d`) added to `wrangler.jsonc` `kv_namespaces`. Required for #14.

### Verified

- `npm run build:web` clean (vite + tsc -b)
- `E2E_TARGET_PROD=1 npm run test` → 29 passing / 1 skipped, zero regressions
- Worker parses cleanly (node import smoke)
- `wrangler d1 execute --local --file=schema.sql` against a fresh DB produces all 12 tables

### Explicitly NOT in v9.2.0 (Sprint 3, tracked as separate GitHub issues)

- `/coach` + `/coach-ride` zero auth (#33 — CRITICAL)
- Open redirect via `X-Forwarded-Host` (#34 — CRITICAL)
- Frontend Strict Mode bug in `useRides` (#38 — HIGH)
- `auth.ts` localStorage try/catch (#39 — HIGH)
- `as CoachError` cast safety (#40 — HIGH)
- Strava proxy method whitelist (#41 — HIGH)
- Rate limiting on AI/write endpoints (#42 — HIGH)
- Missing `:focus-visible` rings (#43 — HIGH)
- Sub-44px touch targets (#44 — HIGH)
- AppFooter mobile grid (#45 — HIGH)

### Post-deploy smoke (manual — won't run automatically)

OAuth flow verification is **the** thing to test on prod after deploy:

1. Sign out (click Disconnect in UserMenu, then Connect with Strava)
2. Should redirect to Strava, complete consent, redirect back to `/callback?code=...&state=<uuid>`
3. Verify in Cloudflare logs: `OAUTH_STATE.put` succeeded on `/authorize` and `OAUTH_STATE.get` + `OAUTH_STATE.delete` succeeded on `/callback`
4. Verify Dashboard loads with your tokens

If anything fails: `git revert 20e5353` (the OAuth nonce commit) + redeploy. The other Sprint 2 commits (schema, /refresh, tests) are independent and safe to keep.

---

## [9.1.4] — 2026-04-30 (internal — never tagged separately)

Demo-blocker fix bundle (commit `b4e6395`). Folded into v9.2.0 above.

---

## [9.1.3] — 2026-04-30

**Club events — D1 table + create flow + Upcoming list (Phase A).** Any member can post a ride; admins are not gatekeepers per the BA spec. RSVPs deferred to Phase B (separate `event_rsvps` table, separate release).

### Added — D1

- **Migration 0002 — `club_events` table** (applied to remote D1 before this release shipped).
  ```sql
  CREATE TABLE club_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES users(athlete_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_date INTEGER NOT NULL,    -- unix epoch seconds
    location TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_club_events_club_date ON club_events (club_id, event_date);
  CREATE INDEX idx_club_events_creator ON club_events (created_by, event_date);
  ```
- The `(club_id, event_date)` index covers the primary read path: `WHERE club_id = ? AND event_date >= now ORDER BY event_date ASC LIMIT 50`.

### Added — Worker endpoints

- **`POST /api/clubs/:id/events`** — Strava-auth required (resolveAthleteId). Membership-gated (any role; admins aren't special). Body: `{ title (required, ≤200), description? (≤2000), location? (≤200), event_date (ISO string OR unix seconds, ±5 years from now sanity-bound) }`. INSERT…RETURNING id; returns the full event row on 201.
- **`GET /api/clubs/:id/events`** — Strava-auth + membership required. Returns upcoming events (`event_date >= now`) joined with `users.firstname / lastname` so the UI can render "posted by Marco V." without a second round-trip. `?include=past` widens to all events. Capped at 50 rows. ORDER BY event_date ASC.
- Both endpoints sit before the generic `/api/*` Strava-proxy fallthrough; corsHeaders applied to every response.

### Added — Frontend

- **`<ClubEventModal />`** — modal-style form (mirrors ClubCreateModal pattern) with title + location + date + time + notes. Default date is next Saturday at 09:00 (matches the wireframe's "Saturday Morning Crew" mental model and the most common group-ride slot). useFocusTrap, ESC dismiss, scroll lock, mobile-first padding.
- **Upcoming section** in ClubDashboard Overview tab — section header has `+ Post event` button (visible to all members, not just admin per BA spec). Below: events list with date-block left-rail (e.g., `Sat 03 May`), title, time + location + creator-attribution row, optional description body. Empty state: "No upcoming events. Post one to get the circle moving."
- **`useClubEvents()`** + **`useCreateClubEvent()`** Tanstack hooks (`useClubs.ts`). Cache settings: 1 min stale, 10 min gc — events are time-sensitive; refetch is more aggressive than the 5/30 min defaults used for the clubs list.
- **`clubsApi.events()`** + **`clubsApi.createEvent()`** in `clubsApi.ts`. Types: `ClubEvent`, `CreateClubEventInput`.

### Behavior

- Dates flow through the API as **unix epoch seconds** (the column type). Frontend collects local date + time inputs, combines them into an ISO string, and ships either the ISO string or the integer seconds — the backend accepts both.
- Past events are not returned by default (saves the UI from filtering). `?include=past` available for future "history" views.
- Create + list are independent of the existing tabs structure (Overview only); when Schedule/Members/Metrics tabs ship, they'll consume the same endpoints.

### Explicitly NOT in v9.1.3 (deferred to Phase B / future)

- **`event_rsvps` table** — going / maybe / no per member. Separate migration, separate UI.
- **Edit/delete event** — original poster + admin can edit, others 403. Future endpoint.
- **Recurring events (RRULE)** — every-Saturday patterns.
- **Max attendees + waitlist**, route URL, cover image — fields exist as `null` only.
- **Calendar view** — the Schedule tab placeholder. v9.2.x.

### Verified

- Migration applied to remote D1 with `wrangler d1 execute --remote --file=migrations/0002_club_events.sql` before deploy. Verified `SELECT sql FROM sqlite_master WHERE name='club_events'` returns the expected schema.
- `npm run build:web` clean (vite + tsc -b)
- `E2E_TARGET_PROD=1 npm run test` → 13 passed / 1 skipped, zero regressions vs v9.1.2

---

## [9.1.2] — 2026-04-30

**Club view restructure to Saturday Crew Wireframes IA + Coach AI for the captain.** Implements the information architecture from the design-bundle wireframes (`claude.ai/design` handoff: 5 low-fi artboards for the Saturday Crew detail page) and adds a captain-managed Anthropic API key for club-scoped Coach AI feedback per BA spec.

### Changed — ClubDashboard structure

Restructured per Saturday Crew Wireframes 01 (Overview tab):

- **Cover hero** — striped placeholder background, italic-em club name with trailing punctuation (`Saturday Morning Crew.`), metadata strip (`Est. <year> · N members · Private`) and role pill in the top-right.
- **Tabs row** — Overview / Schedule / Members / Metrics. Only Overview is implemented; the rest render a "Coming soon" placeholder (calendar, sortable roster, collective load chart per the wireframes — all wait on backend tables that don't exist yet). Tabs are keyboard-accessible buttons with brass underline on active.
- **Hero invite CTA** — promoted from a buried card to a wireframe-style two-column treatment: full-width URL on the left + brass `↗ Share Invite Link` button on the right. Annotation under the card matches the wireframe's `★ share is the primary feature` callout. Mobile stacks vertically.
- **Stat tiles** — re-labelled per wireframe: *Hours collective · Distance · Group rides · Members*. Values are `—` / `0` placeholders today; real numbers wait on the rides aggregate path.
- **Members list** — kept the existing avatar + name + joined date + role pill row. Eyebrow now reads `Members · 0N` (zero-padded count) per wireframe.
- **Circle note** — admin-only placeholder card explaining the future post mechanism. Signed `— Cadence · Circle Layer` per wireframe.
- **Coming next** — replaces the prior bullet list with the wireframe's accent-tinted left-rule list.

### Added — Coach AI for the captain

Per BA spec: *"as business analyst add Coach AI feedback into the club, for the moment the captain can add manually anthropic api key"*. Ships the key-entry UX so the captain can be onboarded ahead of the data-aggregate path.

- **`<ClubCoachCard />`** in ClubDashboard Overview tab. Three states:
  1. **Non-admin, no key set** — *"Captain has not yet set up Coach AI."* read-only.
  2. **Non-admin, key set** — *"The captain has connected an Anthropic API key. Coach AI feedback will surface here once the club-rides aggregate data path ships."* + a connected-status indicator.
  3. **Admin** — full management UI: connect (sk-ant-… password input), masked-preview when set (`sk-ant-…ABCD`), replace, disconnect. Same UX language as the existing personal AiCoachCard for consistency.
- **Storage**: `localStorage` under `cc_clubAiKey:${clubId}`. NOT synced to D1 — matches the existing personal-Anthropic-key pattern (also localStorage-only). Decision documented inline: adding a clubs.api_key column means migration + admin-only edit endpoint + server-side encryption story; we don't have that today for personal keys either, and matching keeps the security posture consistent.
- **Feedback rendering itself is deferred** — without aggregated club-rides data we can't usefully call `/coach` for the club. The card surfaces "feedback ships once a club-rides aggregate table exists in D1" so the captain understands the current state.

### Process

- Read the design bundle's README + chat transcript before implementing per the bundle's instructions ("read the chat transcripts first").
- Wireframes are LOW-FI (cream + black ink) — applied the **information architecture** to the existing PARS dark + molten orange palette (v9.1.1 revert), not the wireframe's literal colors.
- Schedule tab calendar + Members tab sortable roster + Mobile share-sheet flow (artboards 02, 03, 05 from the bundle) deferred to v9.2.x — they're all backend-blocked (rides table, RSVP store, share-sheet OS integration).

### Verified

- `npm run build:web` clean (vite + tsc -b)
- `E2E_TARGET_PROD=1 npm run test` → 13 passed / 1 skipped, zero regressions vs v9.1.1
- Both branches (no-club + club-mode) render correctly under the new IA

---

## [9.1.1] — 2026-04-30

**Palette revert.** Restores the molten orange `#ff4d00` accent + lime `#22c55e` success of v9.0.0 era. The brass `#b8956a` + forest green `#4a8e54` palette shipped in v9.1.0 is rolled back; brand rename to "Cadence Club" stays. Effectively the v9.0.0 visual identity wearing the v9.1.0 brand name.

### Reverted (vs v9.1.0)

- `--c-accent: #b8956a` → `#ff4d00` (molten orange returns)
- `--c-accent-deep: #9c7c56` → `#cc3e00`
- `--c-accent-soft / glow / light` → original molten-orange RGBA values
- `--c-success: #4a8e54` → `#22c55e` (lime returns)
- `--c-success-soft` → `rgba(34, 197, 94, 0.12)`
- `--c-success-deep` token removed (was Forest Green decoration only)
- `--sh-glow` → original molten-orange shadow values
- All hardcoded `rgba(184, 149, 106, …)` literals across components reverted to `rgba(255, 77, 0, …)` (Card, StreakHeatmap, Pill, Button, VolumeChart, LoadingScreen, Landing, RideDetail, ProgressRing, WhatsNext, OAuth callback HTML pages in worker.js)
- Tone= remaps reverted: PR pill (RideDetail) `success → accent`, achievement count `success → accent`, "Strengths" eyebrow (AiCoachCard) `success → accent`, "{n} PRs" pill (WinsTimeline) `success → accent`, Dashboard "Demo data" pill restored to `tone="success"` for the unified pill rendering
- ClubDashboard role pills restored to v9.1.0 logic: admin = accent, member = success
- Eyebrow component: `success` variant + CSS class removed (back to `'muted' | 'accent'`)

### Kept from v9.1.0 / v9.0.0

- Brand rename "Cycling Coach" → "Cadence Club" everywhere user-facing (TopBar, AppFooter, Landing copy, JoinClub, Privacy reframe, index.html title + meta, worker `/version` `service` field, OAuth callback HTML)
- TopBar version badge `v9`
- Landing Pill "For the performance-driven amateur · v9"
- "Today's workout" → "Today's session" copy substitution (Landing hero preview)
- OnboardingModal mobile-first padding fix at ≤600px
- v9.0.0 Clubs MVP + F4 invite-by-link infrastructure (POST /api/clubs/join/:code, /join/$code route, InviteLinkCard, useJoinClub hook)
- v8.6.0 Clubs MVP backend (POST /api/clubs, GET /api/clubs, GET /api/clubs/:id/members, resolveAthleteId, ContextSwitcher, ClubDashboard, AppContext)

### Why

Visual judgment call after reviewing v9.1.0 in prod: the warm-brass-on-dark aesthetic moved away from the original Strava-adjacent identity that defined the product's first releases. The molten orange `#ff4d00` is closer to the Strava brand color `#fc4c02` and signals "cycling-native" more clearly than brass. The Soho House cream-light theme prototype was abandoned mid-flight (never deployed) for similar reasons — the dark canvas + molten accent is the visual language users built mental models around through v8.x.

### Implementation

Single `git revert 07d9b49` (v9.1.0 step 1/5 — palette swap commit) cleanly reverses tokens.css, tokens.ts, the 5 tone= remaps, the Eyebrow `success` extension, and the hardcoded color sweeps in 9 component files + worker.js. Auto-merge handled the two files (Landing.tsx, worker.js) where subsequent commits (`233cc57` brand rename, `73e774b` release-cut) had touched the same regions.

### Verified

- `npm run build:web` clean (vite + tsc -b)
- `grep -rn "Cadence Club" apps/web/src` — brand name intact in all v9.1.0 sites
- `grep -rn "ff4d00" apps/web/src` — molten orange back in tokens

### Commit chain

- `6c5fafb` — `Revert "feat(theme): swap palette to Brass + Forest Green (v9.1.0 step 1/5)"`
- this commit — `chore(release): v9.1.1`

---

## [9.1.0] — 2026-04-30

**Brand swap to Cadence Club.** The accent palette pivots from molten orange to warm brass + forest green; the user-facing brand string flips from "Cycling Coach" to "Cadence Club"; the OnboardingModal gets a mobile-first padding fix. No new pages, no auth changes, no D1 migrations. Strava OAuth remains the only auth path. Implemented per `docs/superpowers/specs/2026-04-30-v9.1.0-brand-swap-spec.md` in 3 staged commits with AA-contrast verification before merge.

### Changed — design tokens

- `--c-accent: #ff4d00` → `#b8956a` (warm brass, 7.11:1 AA on canvas)
- `--c-accent-deep` → `#9c7c56` (5.12:1)
- `--c-accent-light` → `#d4b98c` (10.47:1, ≤14px text)
- `--c-success: #22c55e` → `#4a8e54` (forest green, 4.98:1; lifted from the brief's #2C5530 which fails AA at 2.31:1)
- New `--c-success-deep: #2c5530` for non-text decoration only (borders, left-rules)
- `--sh-glow` migrated to brass RGBA values
- All hardcoded `rgba(255, 77, 0, ...)` and `rgba(34, 197, 94, ...)` literals across components (Card, StreakHeatmap, Pill, Button, VolumeChart, LoadingScreen, WhatsNext, Landing) and the worker's OAuth callback HTML pages swept to brass / forest equivalents.

### Changed — semantics

The "Brass = active, Forest Green = completed" rule applied where prior tone= usage didn't match:
- `RideDetail` PR + achievement pills: `accent` → `success` (PRs are completed)
- `AiCoachCard` "Strengths" eyebrow: `accent` → `success` (positive past assessment) — required adding `success` to Eyebrow's `tone` prop type + a CSS class
- `WinsTimeline` "{n} PRs" pill: `accent` → `success`
- `Dashboard` Pill: `success` → no tone for "Demo data" (mode, not completion); kept Forest Green for "In sync" (completion)
- `ClubDashboard` role pills: admin = Brass; member = neutral (baseline state, not an achievement)

### Changed — brand string

User-facing "Cycling Coach" → "Cadence Club" in `TopBar`, `AppFooter`, `Landing` body copy, `JoinClub` invite landing, `Privacy` (with the "self-hosted hobby project" line reframed to "small product run by a single maintainer"), `index.html` `<title>` + meta tags, and the worker's `/version` `service` field, Confluence sync prompt, and OAuth callback HTML pages. TopBar version badge: `v8` → `v9`. Pill on Landing: `For the performance-driven amateur · v9`.

### Kept unchanged (intentionally)

- `wrangler.jsonc` Worker `name: "cycling-coach"` and D1 `database_name: "cycling-coach-db"` — renaming these = new prod URL + Strava OAuth callback re-registration. Tracked separately as **issue #32** (`Migrate Cadence Club to cadenceclub.cc canonical domain`).
- `package.json` / `apps/web/package.json` `name` fields — internal npm identifiers.
- `docs:sync` script URL — same domain as Worker config.
- CHANGELOG.md historical entries (v8.5.x and earlier) — no rewriting history.

### Mobile-first

`OnboardingModal` now tightens padding + border-radius at ≤600px to avoid crowding the screen edge on small phones. The other 3 components flagged by the spec audit (`GoalEventCard`, `RideFeedback`, `WinsTimeline`) reviewed but deferred to v9.2.0's comprehensive mobile-first pass — they adapt acceptably via existing `1fr` / `min-width: 0` rules at narrow viewports.

### Copy voice

Surgical: only "Today's workout" → "Today's session" in Landing.tsx. The rest of the spec's vocabulary substitution table (training plan, community, achievement, sign up, get faster) returned zero matches against current copy — the codebase was already close to the v2.0 voice.

### Verified

- AA contrast verified for every text-bearing token via Node script before commit
- Hardcoded color literal sweep returns zero `rgba(255,77,0)` / `rgba(34,197,94)` / `#ff4d00` / `#22c55e` outside `tokens.css` / `tokens.ts`
- `npm run build:web` clean (vite + tsc -b)
- 13 e2e tests + 1 skipped (zero regressions vs v9.0.0)

### Explicitly NOT in v9.1.0

- New pages (homepage 3-col, onboarding flow, settings, B2B placeholder) — **v9.2.0**
- Email/password auth via Better Auth — **excluded entirely**, not a future version
- Domain migration to `cadenceclub.cc` — **issue #32**
- Worker rename from `cycling-coach` to `cadence-club` — combined with #32
- Comprehensive mobile-first audit of all components — incremental in v9.2.0 alongside new pages
- Per-code expiry / regeneration of invite codes — v9.2.0+

---

## [9.0.0] — 2026-04-29

**Clubs MVP — F4 invite-by-link, shipped as v9.0.0 per Jose's call.** Fills the demo-blocking gap from v8.6.0 ("how does an admin add teammates?"). The `clubs` table already had `invite_code TEXT UNIQUE` populated on every create from F1; this release exposes it. Also marks the start of the Cadence Club product line — subsequent v9.x releases land the brand swap, redesigned pages, email/password auth, and B2B layer per the v2.0 redesign brief.

Mobile-first: the new `<InviteLinkCard />` and `/join/$code` page stack vertically by default and reflow to row layouts at ≥768px. All new touch targets meet 44px minimum. Existing v8.6.0 components remain at their v8.6.0 mobile fitness; comprehensive mobile-first audit lands in v9.1.0 brand-swap.

### Added

- **`POST /api/clubs/join/:code`** worker endpoint — Strava-auth required. Looks up the club by `invite_code`; on hit, INSERTs the caller as `member`. Idempotent (existing-member case returns the persisted role gracefully). Returns 404 for unknown codes (OWASP — consistent with the v8.6.0 membership-check pattern).
- **`/join/$code` route** (Tanstack file-based) — landing page that auto-resolves the invite. Three branches: not authed → "Connect with Strava" CTA (and stashes the code in `cc_pendingInvite` localStorage so future flows can resume); authed → POSTs to the join endpoint, calls `setClub()` in AppContext on success, redirects to `/dashboard` after a brief beat; error → "invite link not valid or expired" with a link to dashboard.
- **`<InviteLinkCard />` in ClubDashboard** — admin-only. Shows `${origin}/join/${invite_code}` in mono with a "Copy link" button (uses `navigator.clipboard.writeText` with a `window.prompt` fallback). Helper copy: "Anyone with this link who connects via Strava joins the club."
- **`useJoinClub()`** Tanstack mutation + `clubsApi.join(code)` method — same shape as the existing `useCreateClub()` pair, invalidates `['clubs','mine']` on success.

### Behavior

- Non-admins do NOT see the invite link — `<InviteLinkCard />` only renders when `role === 'admin'`. Members see the same Dashboard as v8.6.0 (members list, stats, roadmap card, hint).
- The first user to use a fresh invite link is added as `member` regardless of who created it. Founders / admins remain `admin` because they were inserted as such on club creation (F1).
- `cc_pendingInvite` is removed from localStorage on successful join; failed joins keep it (so a retry from the same browser still works).

### Verification

- `npm run build:web` clean (vite + tsc -b)
- `E2E_TARGET_PROD=1 npm run test` → expected to remain green; no test paths touch the new endpoint or route.
- Smoke probes against deployed v8.6.1: routing (`/api/clubs/join/anything` returns Worker JSON, not SPA), no-auth → 401, valid auth + invalid code → 404, valid auth + valid code → 200 + role-mapped response.

### Explicitly NOT in v9.0.0 (deferred to v9.x)

- Per-code expiry, regeneration, or use-count cap. The code is permanent in v9.0.0; v9.2.0 introduces a richer invitation model with TTLs.
- Email-based invitations (Resend not wired). Falls under v9.3.0 (auth + email).
- Brand-rename to "Cadence Club" — lands as v9.1.0 brand swap (palette: Brass `#B8956A` + Forest Green `#2C5530`, name + copy voice).
- Email/password authentication via Better Auth — v9.3.0.
- Homepage three-column value prop, onboarding flow, settings page, B2B placeholder — v9.2.0.

---

## [8.6.0] — 2026-04-29

**Clubs MVP — vertical slice for stakeholder demo.** Demonstrates the "amateur cycling club as unit of use" thesis with a working end-to-end flow against production D1: create club → see context switcher → flip into club view → see members list. No auth changes, no D1 migrations — uses the existing `clubs` + `club_members` tables.

### Added — Worker

- **`POST /api/clubs`** — creates a club, atomically inserts caller as `admin` member. INSERT…RETURNING + try/catch DELETE cleanup if the member-insert fails (`safeWarn('[clubs] member insert failed, cleaned up orphan club {id}')`). Validates name 1–100 chars, description ≤500.
- **`GET /api/clubs`** — lists clubs the caller belongs to. JOIN `clubs` + `club_members` filtered by caller's `athlete_id`.
- **`GET /api/clubs/:id/members`** — membership-gated. Returns 404 if caller isn't a member of the club (OWASP — don't leak existence). Single batch round-trip: `SELECT 1` membership check + `SELECT users JOIN club_members` member list.
- **`resolveAthleteId(request)` helper** — rounds-trips Strava `/athlete` once per club operation to validate the bearer token AND derive the canonical `athlete_id`. All failure modes (no auth, expired token, network error, malformed Strava response) return **401** with body `{"error":"authentication required"}` and `safeWarn` server-side. Never 500.
- All `/api/clubs*` responses carry the existing `corsHeaders` (success, 4xx, 5xx, OPTIONS preflight). Verified via OPTIONS smoke probe.
- Endpoints inserted **before** the generic `/api/*` Strava proxy fall-through. `/api/*` glob in `wrangler.jsonc → assets.run_worker_first` already covers the new paths — no wrangler.jsonc change needed.

### Added — Frontend

- **`<ContextSwitcher />` in TopBar** — compact pill showing current scope. Dropdown lists "My account" + each club from `useClubs()` + "Create new club". Selection updates AppContext + persists to `cc_activeContext`. Keyboard-accessible (arrow keys, ESC, click-outside, focus trap, focus restore) — same a11y pattern as the existing UserMenu. Compacts to dot+chevron-only at ≤640px to avoid TopBar overflow on mobile.
- **`<ClubCreateCard />`** — small CTA on Dashboard for users with zero clubs. Auto-hides once they have ≥1 (the ContextSwitcher's "Create new club" item takes over from there).
- **`<ClubCreateModal />`** — PARS-styled modal: name (1–100 chars, required) + description (≤500, optional). Submits via `useCreateClub()` mutation, invalidates the `['clubs','mine']` query on success. ESC dismiss, scroll lock, focus trap (matches OnboardingModal pattern).
- **`<ClubDashboard />`** — full club-mode dashboard body. Renders: club header (italic-em name + role pill + member count) → 3 placeholder stat tiles → members list (avatars + names + join dates) → "Coming next" accent-tinted roadmap card → switch-back hint. Replaces the entire individual layout when in club mode.
- **`AppContextProvider` + `useAppContext()`** in `lib/AppContext.tsx` — React Context exposing `{ scope: { mode, clubId, clubName, role }, setIndividual, setClub }`. Persisted to `cc_activeContext` localStorage with defensive parse on read. Mounted in `routes/__root.tsx` so every route can call the hook.
- **Tanstack Query hooks** in `hooks/useClubs.ts` — `useClubs()`, `useClubMembers(clubId)`, `useCreateClub()` with 5-min stale / 30-min gc, matching the existing `useStravaData` pattern.
- **`useClubsEnabled()` kill-switch** in `lib/featureFlags.ts` — reads `cc_clubsEnabled` from localStorage, defaults `true`. Gates ContextSwitcher, ClubCreateCard, AND the Dashboard club-mode branch. Setting to `'false'` and refreshing renders Dashboard exactly as v8.5.3 (CTO NOTE 5 — kill-switch regression hardening).

### Process

- Plan-first execution per CTO directive: 4-commit slice (F1 backend, F1 frontend, F2, F3) with CI green-gate between commits and full diff at each step before proceeding.
- All five CTO review notes addressed: (1) `resolveAthleteId` always 401 never 500, (2) corsHeaders on every error path, (3) routing verified pre-smoke, (4) atomic cleanup with safeWarn on orphan, (5) kill-switch hardened to override stale persisted scope.

### Verification

- All commits green in CI: `95adb35` (F1 backend), `561486a` (F1 frontend), `b66a94e` (F2), `60c46ce` (F3), and this release-cut.
- `E2E_TARGET_PROD=1 npm run test` — 13 passed, 1 skipped, **zero regressions** vs v8.5.3 across all 4 commits.
- Bundle inspection: ships both club markers (`Coming next`, `Personal training stats are hidden`) AND individual markers (`Today's workout`, `PMC`, `Volume`, `Streak`); runtime selects the branch.
- Backend smoke (7 probes against `wrangler dev --remote`): routing, no-auth 401 across all 3 endpoints, invalid-token cascade, OPTIONS preflight, `/api/athlete` proxy regression — all green.

### Explicitly NOT in v8.6.0 (deferred)

- **Better Auth, email verification, password reset** (F6/F7/F8) — Strava OAuth stays as-is.
- **Email invitations to clubs** (F4) — `club_invitations` table not created tonight.
- **BYOK hybrid routing in `/coach`** (F5) — clubs don't yet pay for the AI proxy.
- **Granular roles beyond `admin`/`member`** (F9) — coach / member separation comes later.
- **Cross-route club affordances** — only Dashboard branches on context today; Routes / What's-next remain in individual mode.

---

## [8.5.3] — 2026-04-29

UX hotfix on top of v8.5.2. The global site footer (brand block + Product / Trust / Powered-by columns + version + © line) was rendered only on the Landing page because its JSX lived inside `Landing.tsx`. Every other route — Dashboard, /whats-next, /privacy, etc. — shipped without it. Founder caught the regression visually post-deploy of v8.5.2.

### Fixed

- **Global footer now renders on every route.** Extracted the footer JSX + the `FootCol` subcomponent + the `.foot*` CSS rules out of `apps/web/src/pages/Landing.tsx` into a new shared component `apps/web/src/components/AppFooter/AppFooter.tsx` (+ `.module.css`). Mounted once in `apps/web/src/routes/__root.tsx` after `<Outlet />` so the Tanstack Router root layout renders it on all routes. Visual + content unchanged from v8.5.2 — pure structural relocation.
- **Single source of truth for the user-facing version string.** New `apps/web/src/lib/version.ts` exports `APP_VERSION` (`v8.5.3 · April 2026`). The footer reads from this constant instead of hardcoding the version on each release. Future bumps = one edit instead of one-per-page (de-risks the regression that allowed this hotfix).

### Process

- Lesson: the v8.5.2 release-cut commit bumped the version *string* in Landing.tsx without verifying the footer rendered elsewhere. Visual smoke on a single page passed; cross-route check would have caught it. Adding to release checklist: after every version bump, click through Landing → Dashboard → /whats-next → /privacy and confirm header + footer render on each.

---

## [8.5.2] — 2026-04-29

Phase 2 tail — closes the remaining Phase 2 security issues (#17, #18) plus a docs-integrity pass on the Confluence spec pages and a new per-page deploy-audit footer feature requested by the CTO during v8.5.1 sign-off.

### Added — Worker security

- **`/webhook/<env.STRAVA_WEBHOOK_PATH_SECRET>` path-secret source verification** (#17) — canonical webhook URL becomes the secret-suffixed path. Legacy `/webhook` and any `/webhook/<wrong-secret>` return **404** (OWASP — don't leak existence of the canonical path). Without `STRAVA_WEBHOOK_PATH_SECRET` set, entire `/webhook*` surface is dormant — by design, single-user mode today. Strava webhook re-registration deferred until multi-user API approval lands; ops runbook in `SECURITY.md`.
- **CTO-review hardening on top of #17** (commit `4476ad4`): the path-secret value is now **format-validated at request time** — must match `/^[0-9a-f]{32,}$/i` (32+ lowercase hex chars, what `openssl rand -hex 16+` produces). Whitespace, too-short, or non-hex values are rejected at runtime (entire `/webhook*` surface returns 404 + a `safeWarn` in Cloudflare logs flagging the misconfiguration). Additionally, when `verify_token` mismatches even though the path-secret was correct, the response is **404 (not 403)** — preserves opacity throughout the verification chain (a 403 would have leaked that the path-secret guess was right). Server-side `safeWarn` on mismatch logs the source IP for our own debugging (env-var drift between Worker + Strava registration).
- **`checkAdminRateLimit()` helper + KV rate-limit on `/admin/document-release`** (#18) — defense-in-depth on the highest-risk admin endpoint. 5 attempts/min/IP, returns 429 with `Retry-After` header on threshold. Uses `DOCS_KV` namespace (Free-plan-compatible). Threshold-hit attempts logged via `safeWarn()` with source IP for observability. Native Cloudflare rate-limit binding for `/api/*` and `/coach/*` remains deferred indefinitely (Workers Paid plan only — documented in SECURITY.md "Deferred / out of scope").

### Added — Documentation

- **Per-page deploy footer on Confluence spec pages** — every spec page now carries a footer at the bottom: `"Last touched by deploy vX.Y.Z on YYYY-MM-DD. Auto-managed — content lives in src/docs.js; regenerated by /admin/document-release on every npm run deploy."` Hash check on body only (KV `hash:<slug>`); footer overlaid on every deploy so the audit trail stays current even when body content is unchanged. Cost: 6 Confluence page writes per deploy (was zero on no-op deploys) — acceptable at weekly cadence.
- **Spec pages content sync** — surgical edits across Systems & Architecture, Technical Spec, and Security pages to reconcile v8.5.1 + v8.5.2 reality. Security page §3 (Secrets), §4 (CORS), §5 (Headers), §6 (XSS), §7 (Rate limiting), §8 (/admin auth), §9 (Webhook), §10 (Logging), §11 (Backlog table) all updated with shipped statuses, current milestones, and the new "no temp /admin/* for one-shot ops" rule. Systems & Architecture + Technical Spec CI sections rewritten to describe GitHub Actions accurately (Cloudflare Workers Builds intentionally not wired — closed issue #9 as superseded). API endpoints table shows `/webhook/<secret>` instead of legacy `/webhook`.

### Process

- **Pattern adopted**: when a release ships features that affect documentation, the docs.js spec pages must be synced in the same release, not as a separate after-the-fact commit. The README sweep rule (adopted v8.5.1) extends to spec pages now.

### Operator actions before activation

The shipped defences need Worker secrets to be load-bearing. None of these are blocking — webhook subscriptions don't exist today (single-user mode), so 503/404 responses to `/webhook*` don't impact any user:

```bash
# STRAVA_WEBHOOK_PATH_SECRET must match /^[0-9a-f]{32,}$/i. `openssl rand -hex 16` produces exactly 32 chars.
echo -n "$(openssl rand -hex 16)" | npx wrangler secret put STRAVA_WEBHOOK_PATH_SECRET
echo -n "$(openssl rand -hex 16)" | npx wrangler secret put STRAVA_VERIFY_TOKEN
```

Then, post multi-user Strava API approval:
```bash
# Replace <secret> with the value of STRAVA_WEBHOOK_PATH_SECRET above
curl -X POST "https://www.strava.com/api/v3/push_subscriptions" \
  -F client_id=<STRAVA_CLIENT_ID> \
  -F client_secret=<STRAVA_CLIENT_SECRET> \
  -F callback_url="https://cycling-coach.josem-reboredo.workers.dev/webhook/<secret>" \
  -F verify_token=<STRAVA_VERIFY_TOKEN>
```

### Verification

- `npm run build:web` clean.
- `E2E_TARGET_PROD=1 npm run test` 11 unit + 13 e2e green on prior commits.
- **Local `wrangler dev` smoke caught a real bug pre-release**: `/webhook/*` was missing from `wrangler.jsonc → assets.run_worker_first`, so the Worker was never invoked for `/webhook/<secret>` paths — requests fell through to static assets and returned the SPA's index.html. CTO asked "have you run smoke test and e2e validation?" before the release cut; running `wrangler dev` + curl probes locally surfaced the regression. Added `/webhook/*` to the list, all 9 smoke probes now pass: `/webhook` → 404 · `/webhook/anything` → 404 · `/webhook/<correct-secret>?hub.mode=subscribe&hub.verify_token=<verify>` → 200 with challenge · `/webhook/<wrong>` → 404 · `/admin/document-release` 5 rapid → 503 · 6th → 429. Lesson: every release must include `wrangler dev` smoke for any new endpoint or routing change, not just `npm run build` + CI.

### Housekeeping context (carried over from earlier today)

This release lands on top of a major issue-tracker housekeeping pass run via `curl + GITHUB_TOKEN` (no temp `/admin/*` endpoints — per the rule adopted this morning):

- **#7** (D1 migration) closed as shipped — verified applied to remote D1.
- **#9** (Cloudflare Workers Builds CI command) closed as superseded — we use GitHub Actions.
- **#28** (README hygiene) closed as shipped — covered by `257290c` + `fce03cf`.
- **9 issues reslotted to v8.6.0**: #2, #3, #4, #5, #6, #8, #10, #14, #15, #16.

Net: roadmap dropped from 17 open / 11 shipped → 14 open / 14 shipped. v8.3.0 + v8.4.0 milestones now empty (clean).

---

## [8.5.1] — 2026-04-29

Security hygiene batch — Phase 2 of the v8.5.0–v8.5.3 backlog burn (spec `cf3e786`). Closes 3 security chores from the original Phase 2 plan; the remaining 2 (#17 webhook path-secret, #18 KV rate-limit) reslot to v8.5.2.

### Added — Threat model + defences

- **Top-level `SECURITY.md`** (#22) — documents threat model (assets at risk, attack vectors considered, mitigations), shipped vs planned defences, deferred / out-of-scope items, deploy runbook for required Worker secrets, disclosure policy. Linked from README and CONTRIBUTING.

### Changed — Worker hardening

- **`STRAVA_VERIFY_TOKEN` fail-closed** (#19) — webhook GET handler no longer accepts a hardcoded fallback (`'cycling-coach-verify'`). Returns **503 Webhook verification not configured** when the Worker secret is missing. No change to behavior when secret is set. Operator action: `wrangler secret put STRAVA_VERIFY_TOKEN <random-32-hex>` before activating webhook subscriptions (single-user mode today, no impact). Audit finding from the v8.4.0 security batch.
- **`redactSensitive()` log helper + `safeLog/Warn/Error` wrappers** (#20) — defensive log redaction strips `api_key=`, `sk-ant-*`, `access_token=`, `refresh_token=` patterns before they hit Cloudflare's persistent log store. Applied to **5 of 12 high-risk `console.*` call sites**: webhook event log, D1 parse-error warn, three D1 error catches in `persistUserAndTokens` / `persistActivities` / `updateConnectionTokens`. Status / count logs (e.g. `[D1] Persisted N activities`) left as raw `console.log` because they don't interpolate untrusted data.

### Documentation

- **`docs(security): correct SECURITY.md to reflect actual shipped state`** (commit `257290c`) — replaced the original optimistic "Defences in place" section with an honest split: "Shipped defences" lists only what's currently on `main`; "Planned defences" lists what's in flight for v8.5.2. Web-spoofing wrong-path response code corrected from 403 → 404 per OWASP.
- **`docs(cleanup): sync README and SECURITY.md to actual shipped state`** (commit `fce03cf`) — fixes plan-vs-reality drift across both files: zones Z1-Z6 → Z1-Z7, lime glow → molten-orange glow, `npm run deploy` includes `docs:sync`, GitHub Actions described accurately (not Cloudflare Workers Builds), schema migration marked as applied 2026-04-29, FTP TODO removed (shipped v8.2.0), entire stale "Open issues / next up" section replaced with one-line `/whats-next` pointer. Issue `#15` (CSP) and `#16` (CORS) cited correctly. Issue `#14` (OAuth state CSRF) referenced and reslotted to v8.6.0 milestone.

### Deferred to v8.5.2

- **#17 Webhook path-secret** — `/webhook/<env.STRAVA_WEBHOOK_PATH_SECRET>` canonical URL with 404 fail-closed for legacy / wrong-secret paths.
- **#18 KV-based rate-limit on `/admin/document-release`** — 5 attempts/min/IP, defends against `ADMIN_SECRET` leak. Uses `DOCS_KV` namespace (Free-plan-compatible).

### Deferred indefinitely

- **Cloudflare-native rate-limit binding for `/api/*` and `/coach`** — requires Workers Paid plan, not on roadmap. Cost-runaway risk for `/coach` is mitigated only at the user side (BYOK Anthropic key safeguarded by the user). Documented in SECURITY.md "Deferred / out of scope".

### Process notes (durable rules adopted this release)

- **Scope-vs-ceremony exercise** is now mandatory before any release plan — light / medium / full ceremony picked based on scope, user approves.
- **Release-time README sweep** mandatory in every `chore(release)` commit — reconcile Open Issues, Routes, Components, Build, Schema sections with shipped state. To be filed into CONTRIBUTING.md after this release.
- **No temp `/admin/*` endpoints for one-shot ops** — prefer `curl + GITHUB_TOKEN` from `.deploy.env` or standalone scripts in `scripts/`. Two-deploy roundtrip pattern reserved only for ops that genuinely need Worker bindings.

### Verification

- `npm run build:web` clean (TS strict).
- `E2E_TARGET_PROD=1 npm run test` passes locally and in CI on `fce03cf`.
- Manual smoke deferred — this is a Worker-only release with no React UI changes.

---

## [8.5.0] — 2026-04-29

Polish release — Phase 1 of the v8.5.0–v8.5.3 backlog burn (spec `cf3e786`). Closes 5 v8.5.0 issues identified by the 2026-04-28 dashboard design audit. First release on the regression-test harness shipped in Phase 0.

### Added — Accessibility

- **`--c-accent-light: #ff7a3d` token** (`tokens.css` + `tokens.ts`) — AA-passing accent (~5.2:1 on canvas) for small-text usages flagged by audit H8. Applied to `Pill.accent` text (10px), `TopBar.brandBadge` (9px), `RoutesPicker.surfaceEm` (12px). PARS `--c-accent` (#ff4d00) stays the brand CTA color. Closes #25.
- **`useFocusTrap` shared hook** at `apps/web/src/hooks/useFocusTrap.ts` — extracted from `OnboardingModal.tsx` (commit `0e168a1`). Used by both `OnboardingModal` and `UserMenu`. Public API: `useFocusTrap<T>(active, { restore })` returns a `RefObject<T>`. Closes the inline-trap duplication called out in audit H3.
- **UserMenu keyboard navigation** (#27) — focus moves into the menu on open, `↑/↓` cycles between menuitems, `Home`/`End` jump to first/last, `ESC` closes and restores focus to the trigger. Closes #27.

### Changed — Performance

- **RideDetail expand drops `height: auto` animation** (#24) — opacity-only fade, GPU-composited, no layout pass per frame. Audit finding H6b. Animation duration trims 0.32s → 0.18s. Closes #24.

### Changed — Navigation

- **BottomNav active tab syncs to scroll position** (#26) — `IntersectionObserver` over the four section IDs (`#today`, `#train`, `#stats`, `#you`) with `rootMargin: -30% 0px -30% 0px` so a tab activates only when its section dominates the middle of the viewport. Click handler retained — tapping a tab still scrolls + sets active. New 1px `<div id="you" />` anchor at the end of `<main>` so the "You" tab has a real scroll target. Closes #26.

### Added — In-app updates

- **What's-new badge + modal** (#13) — Vite plugin reads repo-root `CHANGELOG.md` at build time, parses via `apps/web/src/lib/changelogParser.ts`, exposes through a `virtual:changelog` module. Components import the parsed entries synchronously. `WhatsNewBadge` in the TopBar trailing slot appears when `cc_lastSeenVersion` < the current release; clicking opens a modal with the latest 3 entries. Dismiss persists the seen version. Closes #13.

### Tests

- **11 Vitest unit tests** — 4 for `useFocusTrap`, 5 for `changelogParser`, 2 sentinel.
- **13 Playwright e2e tests** at mobile-375 + desktop-1280 — added coverage for ride-expand, UserMenu kbd nav, BottomNav scroll-sync, what's-new badge round-trip.

### Verification

- `npm run build:web` clean (TS strict).
- `E2E_TARGET_PROD=1 npm run test` passes locally and in GitHub Actions on every push to main.
- Manual smoke at 375 + 1280 px before the release cut.

---

## [8.4.1] — 2026-04-28

Hotfix: `/whats-next` showed a stale issue count in PWA mode.

### Fixed

- **Service worker `NEVER_CACHE` was missing `/roadmap`**, so the SW served the first-fetched roadmap response forever (cache-first strategy). After the v8.4.0 release filed audit deferrals #24–#27, users on the PWA still saw the old 21-open-issue count. Added `/roadmap` and `/admin/*` to `NEVER_CACHE` — these are dynamic data + admin endpoints that should never be cached client-side.
- **`CACHE` version pinned at `v8.2.0`**. The service worker's bust mechanism is "bump `CACHE` on every meaningful release"; v8.3.0 and v8.4.0 missed the bump. Set to `cycling-coach-v8.4.1`. The `activate` listener deletes any cache key not matching the current name, so old PWA caches evict on first reload.

Users on the PWA may need a hard refresh (or close + reopen the installed app) once to pick up the new SW; from there everything stays current.

---

## [8.4.0] — 2026-04-28

Dashboard design audit pass — first invocation of the `ui-ux-pro-max` skill (99 UX guidelines + 44 react-perf + 53 react-stack rules) against `/dashboard`. **22 findings**: 13 shipped this release, 4 filed as v8.5.0 issues, the rest already covered by existing issues.

The audit was scoped to two breakpoints (375 px / 1280 px) and the skill's eight priority categories (Accessibility CRITICAL → Charts LOW). PARS as a design language stays — the skill's sports-fitness preset (Vibrant + Block-based, Barlow Condensed, green CTA) was rejected as off-brand for the Marco persona; the rationale lives at the top of `apps/web/src/design/tokens.ts` so future passes don't regress it.

### Added — Accessibility

- **`<MotionConfig reducedMotion="user">`** wrapping the entire React tree in `main.tsx`. Every `motion.section` / `motion.div` literal `transition` prop now short-circuits under `prefers-reduced-motion` — Motion library's built-in handling, but it requires the wrapper to engage.
- **Global reduced-motion CSS catch** in `tokens.css` — sets `animation-duration: 1ms`, `animation-iteration-count: 1`, `transition-duration: 1ms` on `*` inside the `prefers-reduced-motion: reduce` block. Stops the hardcoded `1.6s ... infinite` pulses (Pill `.dot`, today-pulse on the AI Coach week plan, today-pulse on the dashboard week-day badge) regardless of how they're declared.
- **Skip-to-main link** as the first child of `<body>` (rendered from `__root.tsx`), styled in `reset.css`. Keyboard-only users land on a focusable "Skip to main content" pill that jumps over TopBar + UserMenu to the dashboard's `<main id="main">`.
- **OnboardingModal focus trap + restore** — Tab / Shift-Tab now wrap inside the dialog (queries focusable descendants on each keystroke); on close, focus returns to whichever element opened the modal (`document.activeElement` snapshot taken on open).
- **TopBar safe-area inset** — `padding-top: calc(var(--s-3) + env(safe-area-inset-top, 0))` so the sticky bar clears the iPhone notch / dynamic island.
- **VolumeChart `role="img"` + `aria-label`** with a generated description ("Volume — last 12 weeks: 1,247 km, 18,400 m elevation"). Screen readers now get a meaningful summary instead of a div soup.
- **Address input `aria-label="Start address"`** in RoutesPicker — placeholder is no longer the only accessible label.

### Changed — Touch targets

- **Eight ghost / mono-text buttons** bumped to `min-height: var(--hit-min)` (44 px) — the WCAG floor: `AiCoachCard.subtleBtn`, `GoalEventCard.{subtleBtn, dangerBtn}`, `OnboardingModal.skipBtn`, `RoutesPicker.{surfaceBtn, addressEdit, addressCancel, showAll}`, `Dashboard.demoBannerClose` (was 28 × 28 → now 44 × 44). Visual weight unchanged; a 44 px hit zone now wraps the small mono labels.

### Changed — Performance

- **VolumeChart bars: `height` → `transform: scaleY`**. Animating `height` forced layout each frame; the skill's react-performance.csv flags this directly as 'Animation: Transform Performance'. Bars now fill the column at full height and scale from `bottom center` — GPU-composited, no layout cost.

### Changed — Semantics

- **VolumeChart toggle:** `role="tablist"` / `role="tab"` dropped (no matching `tabpanel`s existed); replaced with `role="group"` + `aria-pressed` on the buttons. Functionally identical, ARIA semantics now complete.

### Changed — Polish

- **Time-of-day greeting** — `Morning / Afternoon / Evening / Late night` based on `getHours()`. The hero used to greet "Morning, Marco" at 9 PM.
- **`alert()` replaced with smooth-scroll** — the sample WorkoutCard's Start button used to pop a native dialog telling the user to generate their AI plan; it now smooth-scrolls to the AI Coach section (`#train`) instead.
- **Demo banner copy** — "Demo data only — append `?demo=0`..." replaced with "You're viewing sample data. Connect Strava to see your own rides." No URL syntax in user-facing copy.

### Added — Documentation

- **Audit design doc + report** committed at `docs/superpowers/specs/2026-04-28-dashboard-design-audit-design.md` and `2026-04-28-dashboard-design-audit.md`. Full methodology, surface-by-surface findings ranked by severity + effort, fix-vs-defer rationale.
- **PARS rationale block** at the top of `apps/web/src/design/tokens.ts` — explains why we keep Geist + molten orange + cockpit dark over the skill's sports-fitness preset.

### Added — Tooling

- **`scripts/file-v8.4.0-audit-issues.sh`** — idempotent shell script that mirrors `bootstrap-issues.sh` to file the four audit deferrals against the v8.4.0 milestone (will reslot into v8.5.0 when run after this release).

### Deferred to v8.5.0

- **H6b** — RideDetail expand: stop animating `height: auto`, switch to opacity-fade or a measured-height approach.
- **H8** — Accent `#ff4d00` fails WCAG AA contrast for ≤14 px text on canvas. Introduce `--c-accent-light` for small-text usage; PARS brand keeps `--c-accent` for CTAs.
- **M2** — BottomNav active tab should follow scroll position via `IntersectionObserver`, not stay on the last-clicked item.
- **M5** — UserMenu keyboard nav (↑/↓/Home/End) + focus management. Extracts `useFocusTrap` hook from OnboardingModal so it's shared.

### Verification

- `npm run build:web` — TS strict + Vite production build clean.
- Manual probe deferred to user (Claude can't render a browser): 375 px / 1280 px walk through the dashboard, keyboard tab through skip-link + modal focus trap, OS reduced-motion toggle.

---

## [8.3.0] — 2026-04-28

GitHub Issues become the source of truth for the public roadmap. The `/whats-next` page now reflects the live state of the issue tracker within five minutes of any change. Releases ship weekly, driven by milestone closures.

### Added

- **Worker `/roadmap` endpoint** — proxies `https://api.github.com/repos/<owner>/<repo>/issues`, normalises each issue (title, first paragraph of body, labels, milestone, state, assignees) into the same shape the React page expects. Edge-cached for 5 minutes via Cloudflare's Cache API. Optional `GITHUB_TOKEN` Worker secret for higher rate limits / private repos.
- **`useRoadmap` Tanstack Query hook** — wraps `/roadmap`, falls back to the static `lib/roadmap.ts` seed if the request fails or returns empty (so the page is never blank during the first GitHub bootstrap).
- **`/whats-next` page rewrite** — pulls live items, links each card to its GitHub issue, shows the issue number, surfaces a `Live · GitHub` vs `Fallback · seed` pill, a "Updated 3m ago" timestamp, and a Refresh button. Adds a "Open an issue on GitHub" CTA in the footer.
- **`scripts/bootstrap-issues.sh`** — idempotent shell script that uses `gh` to ensure the labels (`priority:*`, `area:*`, `type:*`, `status:in-progress`), milestones (`v8.3.0`, `v8.4.0`, `v8.5.0`), and the open-backlog issues exist. Re-running is safe.
- **`CONTRIBUTING.md`** — documents the GitHub-issues-driven workflow, label/milestone conventions, weekly release cadence, and local-dev pointers.

### Changed

- **`lib/roadmap.ts`** demoted from source-of-truth to fallback seed. Item type widened to accept GitHub-fed shape (numeric ids, optional `url`, `number`, `closed_at`, `updated_at`).
- **Vite proxy + `wrangler.jsonc`** updated to forward `/roadmap` to the Worker (added to `assets.run_worker_first`).

### Workflow

```
GitHub Issues  ─►  Worker /roadmap  ─►  /whats-next page
[label/milestone]   [5-min edge cache]   [Tanstack Query, 5-min stale]
```

To bootstrap your issue tracker:

```bash
brew install gh
gh auth login
./scripts/bootstrap-issues.sh
```

After that, every `gh issue create` (or web-UI add / close / milestone change) shows up on the public roadmap inside ~5 minutes.

---

## [8.2.0] — 2026-04-28

Issue-cleanup release. Audited the v8.0.0 follow-up list and shipped four of five remaining items in one go. The last (`[backfill]`) is deferred — it depends on the remote D1 schema migration, which requires your action.

### Added — first-run FTP onboarding

- **`useAthleteProfile`** hook backed by localStorage (`cc_athleteProfile` + `cc_onboardingDismissed`). Captures FTP, weight, HR max and exposes `needsOnboarding`, `isComplete`, `dismissOnboarding`.
- **`<OnboardingModal>`** — first time you reach `/dashboard` after auth, a modal asks for the three numbers. Live W/kg readout + classification ("cat-2 / strong amateur" etc.) as you type. Skip stores a dismissal flag; "Edit profile" in the user menu reopens it.
- **Real TSS + zone math** turns on once FTP is saved. The `useRides` hook now takes `ftp` and feeds it to `stravaToActivity`, which computes `npWatts / ftp` for IF and uses `zoneFor(npWatts, ftp)` instead of defaulting Z2.

### Added — Strava 7-zone power model

- **Z7 Neuromuscular Power** (>150 % FTP) added end-to-end:
  - `Zone` type widened to `1 | 2 | 3 | 4 | 5 | 6 | 7`.
  - `--c-z7: #6b21a8` token in `tokens.{ts,css}`.
  - `COGGAN_ZONES` re-bucketed: Z6 = anaerobic capacity (1.21–1.50 × FTP), Z7 = neuromuscular (>1.50 × FTP).
  - `ZonePill` + `WorkoutCard` + `StatTile` accept Z7. Glow + zone-stripe render purple-deep.

### Added — PWA shell

- **`apps/web/public/manifest.webmanifest`** — name, theme color, standalone display, three home-screen shortcuts (Today / Train / Previous rides).
- **`apps/web/public/icon.svg` + `icon-maskable.svg`** — molten-orange BikeMark on the canvas-deep tarmac.
- **`apps/web/public/sw.js`** — cache-first for static assets, network-first for navigation requests with offline fallback to the cached SPA shell. `/api/*`, `/authorize`, `/callback`, `/refresh`, `/coach*`, `/webhook`, `/version` are always passed through to the network (never cached).
- Service-worker registration in `main.tsx` is gated on `import.meta.env.PROD` so dev never tries to load `/sw.js`.

### Changed — Worker pruned

- Deleted **2,692 lines** of dead HTML from `src/worker.js`: `landingPage()`, `dashboardPage()`, `privacyPage()`, `SHARED_HEAD`, `SHARED_BG`, `BIKE_GLYPH`, `FAVICON_B64`. Workers Static Assets makes them unreachable; they were just bundle weight.
- `callbackPage()` slimmed to ~50 lines (PWA branch + standard browser branch). `errorPage()` slimmed to ~15 lines. Both inline minimal CSS using the PARS palette.
- The fetch handler's `/`, `/dashboard`, `/privacy` routes were also removed — those are SPA-served. Worker now goes from 3,375 → **683 lines** (-80 %).

### Changed — UserMenu

- New "Edit profile" entry surfacing the FTP/weight/HR-max modal again post-onboarding.

### Deferred to v8.3.0

- `[backfill]` Retroactive TSS computation from existing `activities.strava_raw_json`. Depends on `migrations/0001_pmc_and_events.sql` being applied to the remote D1 (`wrangler d1 execute cycling_coach_db --file migrations/0001_pmc_and_events.sql --remote` — your call).
- `[live-routes]` Replace `MOCK_ROUTES` with `/api/athlete/routes` response.
- `[ci-build-cmd]` Update Cloudflare Workers Builds command to `npm run build:web`.

---

## [8.1.0] — 2026-04-28

Five tracked feature requests, shipped in one release.

### Added

- **Editable goal event** — `useGoalEvent` hook + `<GoalEventCard>` component. The dashboard event card now has an Edit affordance that flips it into an inline form: name, type (Gran Fondo / Race / TT / Crit / Volume / Tour / Other), date, distance, elevation, location, priority (A / B / C). Persists to localStorage; will sync to D1 once schema v2 is applied (the `goals` table already has `event_name`, `event_type`, `target_date` columns).
- **Disconnect Strava menu** — avatar pill is now a popover trigger (`<UserMenu>`). Three actions: *Sync now* (invalidates Tanstack Query cache), *Revoke at Strava ↗* (opens `strava.com/settings/apps` so users can fully drop the OAuth grant), *Disconnect Strava* (clears local tokens + redirects to `/`). Backed by ESC + click-outside to dismiss.
- **Ride detail on tap** — clicking any row in Recents expands an inline detail panel that lazy-fetches `/api/activities/{id}` via Tanstack Query (cached forever). Surfaces description, primary photo, decoded route polyline rendered as inline SVG, full stats grid (distance / time / elevation / avg + max HR / avg + max + NP watts / kJ), best efforts (PRs by distance), segment efforts with achievements, kilometre splits with elevation deltas, and an "Open on Strava ↗" link. Demo mode renders a stat-only fallback.
- **What's next page** at `/whats-next` — public roadmap sourced from `lib/roadmap.ts` (mirrors `.github/ISSUES_v8.0.0.md`). Three sections (In progress / Open / Shipped) with priority + status pills, area tag, target version. Linked from the landing footer.
- **`useActivityDetail`** — Tanstack Query hook with `staleTime: Infinity` (ride data never changes after upload) + 30-min GC.
- **`lib/polyline.ts`** — Google polyline decoder + a `polylineToSvg()` helper that projects to a viewBox preserving aspect ratio.

### Changed

- **Bottom nav** — "Stats" tab renamed to **"Rides"** to match its content (recent ride list, not aggregate analytics).
- **Recents heading** updated from "Recents" to "**Previous rides**" with copy that points users at both the tap-to-expand detail and the AI coach verdict.
- **`MOCK_EVENT`** is now a default seed only; the live source is the `useGoalEvent` hook backed by localStorage.
- **`stravaApi`** gained `activityDetail(id)` + the `StravaActivityDetail` / `StravaSplit` / `StravaBestEffort` / `StravaSegmentEffort` / `StravaPhoto` types.

### Files

```
apps/web/src/
├── components/
│   ├── GoalEventCard/       (new — editable event card)
│   ├── RideDetail/          (new — lazy-loaded expansion panel)
│   └── UserMenu/            (new — avatar popover)
├── hooks/
│   ├── useActivityDetail.ts (new)
│   └── useGoalEvent.ts      (new)
├── lib/
│   ├── polyline.ts          (new)
│   └── roadmap.ts           (new)
├── pages/
│   └── WhatsNext.tsx + .module.css  (new)
└── routes/
    └── whats-next.tsx       (new)
```

---

## [8.0.1] — 2026-04-28 — Hotfix

Critical fix: the v8.0.0 dashboard was rendering Marco-Bianchi seed mock data **regardless of authentication state** — even after a successful Strava OAuth round-trip. v8.0.1 wires the real-data swap and hardens the auth gate.

### Fixed

- **Dashboard auth gate** — `/dashboard` with no Strava tokens now renders a dedicated `ConnectScreen` instead of mock data. Mock data only ever shows in dev (`import.meta.env.DEV`) or when the URL carries `?demo=1`.
- **Real-data swap** — when tokens exist, `Dashboard` fetches the user's athlete profile (`/api/athlete`) and last 200 activities (`/api/athlete/activities`) via Tanstack Query through the Worker proxy, converts them to the internal shape (`stravaConvert.ts`), and derives every widget (PMC, streak, wins, volume, recents, AI coach context) from real data.
- **Loading screen** — first-time syncs show a centered spinner with copy ("Syncing your rides…") instead of a flash of mock content.
- **Token refresh on 401** — `useStravaData` clears tokens when Strava returns `not_authenticated`, falling through to the ConnectScreen.

### Added

- `ConnectScreen` page — full editorial connect prompt with primary CTA, fact row, and `?demo=1` discovery hint.
- `LoadingScreen` page — centered spinner + status copy, used during initial fetch.
- `lib/stravaConvert.ts` — Strava activity → internal `MockActivity` mapper. Computes real TSS / primary zone when FTP is known; falls back to a duration-based proxy (≈70 TSS/h) marked clearly in the UI.
- `lib/pmc.ts → computePmcDelta()` — PMC + 7-day delta from any activity list (was hard-wired to mock).
- `useStravaData` / `useAthlete` / `useActivities` / `useRides` Tanstack Query hooks.
- Dashboard `↻` and `⏻` buttons in TopBar wire to `queryClient.invalidateQueries` and `clearTokens` respectively (sync + disconnect).
- Profile photo support — Strava `athlete.profile` URL renders in the user pill; falls back to initials.

### Changed

- All widgets now compute their data from a single `activities` array passed into `<DashboardView>`. The fork between mock + real lives in one place (`<DashboardInner>`).
- Greeting copy now reads form state from PMC ("Form is fresh / productive / fatigued / overreached") instead of hardcoded mock text.
- Year-to-date km computed from real activities filtered to current year. Yearly goal target still mocked (8,000 km) until goals UI ships.
- "TSS proxy" disclosure rendered under quick stats when FTP is unset, so the user knows the PMC numbers are an estimate.

### Known limitations

- **Strava app callback domain** — if you set callback domain to `localhost` during dev testing in v8.0.0, OAuth fails in prod with "redirect_uri mismatch". Reset to your production domain at <https://www.strava.com/settings/api> (one-time fix on Strava's side; not in this repo).
- **Goal event** still mocked (Etape du Tour). Real events table TBD — see `[goal-events]` in the issues file.
- **FTP onboarding** — the dashboard now correctly shows "—" for FTP/W·kg and the duration-based TSS proxy when FTP is unknown. The first-run flow capturing FTP is open as `[ftp-onboarding]`.

---

## [8.0.0] — 2026-04-28

**The PARS redesign.** Full architectural reset: the dashboard moves to a React/Vite SPA layered on top of the existing Worker via Cloudflare Workers Static Assets. Single deploy, single URL, no CORS. The aesthetic flips from the prior light editorial theme to **Performance Dark** — near-black canvas, molten-orange accent, Geist + Geist Mono, instrument-panel data density. Designed for **Marco** — the performance-driven amateur cyclist (Zürich, FTP-aware, training 8–12 h/week).

### Added — frontend

- **React 19 + Vite + TypeScript strict** SPA at `apps/web`. Tanstack Router (file-based, type-safe), Tanstack Query, Motion, CSS Modules, Biome.
- **Design system v1** — single source of truth in `apps/web/src/design/tokens.{ts,css}`. Tokens for color (canvas, surface, text, accent, Coggan zones Z1–Z6, status), spacing (4 px base), radius, shadows, motion durations + easings, type scale, z-index, breakpoints.
- **Twelve base components**: `Button`, `Card`, `Container`, `Eyebrow`, `Pill`, `BikeMark`, `BottomNav` (mobile authed nav), `GrainOverlay`, `PmcStrip`, `ProgressRing`, `StatTile`, `TopBar`, `WorkoutCard`, `ZonePill`.
- **Landing** route — hero ("Train like the metrics matter"), instrument-cluster preview (live PMC + workout + ring), credentials band, FOR / NOT FOR honesty list, 3 feature spreads, BYOK pricing, final CTA, editorial footer.
- **Privacy** route — editorial sections, success/warn callout boxes, mono code spans.
- **Dashboard** route — see "Dashboard sections" below.

### Added — dashboard sections

1. **Hero fold** — italic greeting, PMC strip (CTL · ATL · TSB with 7-day deltas), 4 quick stats, goal-event countdown, yearly km goal ring with projected year-end.
2. **Today's workout** — uses the AI-generated plan when available, falls back to a sample WorkoutCard.
3. **Streak heatmap** — 12 weeks × 7 days, 5 intensity buckets, current/best/total numbers, today cell pulses.
4. **Wins timeline** — last 90 days of PRs surfaced as a feed.
5. **Volume chart** — distance + elevation bars, weekly/monthly toggle, 12-bucket window, totals header.
6. **AI Coach** — three states: BYOK setup → sessions/week picker (1–7 with hint copy) + Generate → full plan render (summary, strengths, areas to improve, 7-day plan with today highlight, motivation, regenerate).
7. **Routes for today** — saved routes scored against today's plan + surface preference (Tarmac/Gravel/Any) + start address. Match % per row, top-3 default with "Show all".
8. **Recents** — 8 most recent rides with inline "Get coach verdict" panel calling `/coach-ride`.

### Added — backend / infra

- **Workers Static Assets** in `wrangler.jsonc` (replaces the legacy CF Pages flow). Single Worker serves SPA + API. `run_worker_first` lists OAuth + API + AI + webhook paths.
- **`migrations/0001_pmc_and_events.sql`** — schema v2 adds `users.ftp_w / weight_kg / hr_max`, `activities.tss / np_w / if_pct / duration_s / primary_zone`, new `daily_load` PMC rollup table, event-extension columns on `goals`. *(Migration ready; not auto-applied. Apply with `wrangler d1 execute`.)*
- **`/authorize` + `/callback` honor `?origin=`** so OAuth redirect_uri returns to the user's actual host (works in Vite dev at :5173 even though Worker runs at :8787). Origin is base64-JSON-encoded into Strava's `state` param to survive the round-trip. Strict allowlist: only localhost loopbacks accepted.
- **Concurrent dev** — `npm run dev:all` boots Worker + Vite together via `concurrently`. Vite proxies `/api`, `/authorize`, `/callback`, `/refresh`, `/coach`, `/coach-ride`, `/version`, `/webhook` to the Worker.

### Changed

- **Type stack**: Geist (UI) + Geist Mono (numerals). Two families. Inter is gone.
- **Color**: dark canvas + molten orange `#ff4d00`. Strava brand orange `#fc4c02` retained but reserved for Strava-specific UI (sync indicators, attribution).
- **Build & deploy**: root `package.json` adds `dev:web`, `dev:worker`, `dev:all`, `build:web`, `build`, `deploy` scripts. Single `npm run deploy` builds the SPA then `wrangler deploy`s the Worker with assets attached.

### Restored from v7 (after the initial redesign dropped them)

- AI weekly plan generator (sessions-per-week picker, full plan render).
- Per-ride AI feedback (verdict + concrete next-time suggestion).
- Streak heatmap.
- Wins timeline.
- Volume chart.
- Saved routes picker with surface + start-address preferences.
- All preferences keyed under `cc_*` localStorage to maintain compatibility with the legacy Worker's keys.

### Persona-driven design decisions

- **Mono for every numeral** — like a Garmin Edge / Wahoo BOLT screen.
- **No emoji as visual currency** — replaced with crafted SVG glyphs (BikeMark, ★, ◆).
- **Square-ish radii** (max 16 px) — instrument-coded, not bubble-shaped.
- **Italic flourishes only on emphasis words** — italic = brand inflection, not body copy.
- **Topographic SVG behind the landing hero** — Ordnance Survey / cycling-map atmosphere.
- **`prefers-reduced-motion` zeroes every duration** in CSS — single guard, never per-component.

### Known limitations / next up

- Dashboard renders **seeded Marco-Bianchi mock data** by default. The real-data swap (live `/api/athlete` + `/api/athlete/activities` via Tanstack Query) is wired in `lib/api.ts` and `lib/auth.ts` but not yet hot-swapped at the page level. Apply schema v2 migration first, then flip the toggle.
- TSS backfill from existing `strava_raw_json` — schema columns added, backfill script not yet written.
- Strava 7-zone power model — currently using Coggan's 6 (Z1–Z6). Z7 token + ingestion pending. See `lib/zones.ts`.
- The legacy `landingPage()` / `dashboardPage()` / `privacyPage()` functions in `src/worker.js` are unreachable under Workers Static Assets but still bundled. Pruning them is a follow-up.
- Cloudflare Pages app's previous CI build command may still be `wrangler deploy` only — update Workers & Pages → cycling-coach → Settings → Builds → Build command to `npm run build:web` for full CI/CD.

---

## [7.0.3] — 2026-04-26

Final pre-redesign release. Editorial-light theme with Instrument Serif numerals, Strava orange accent, single-column 780 px dashboard. Featured: streak heatmap, wins timeline, AI weekly plan, per-ride coach verdicts, training prefs, routes picker, yearly goal ring, distance/elevation charts, ride detail expansion. Strangler-Fig D1 dual-write in progress (sub-phase 2.2a).

## [7.0.0]–[7.0.2] — earlier in April 2026

Iterations on the v7 editorial theme — heatmap colors, hero typography, footer rhythm, surface-preference flow, route scoring algorithm.
