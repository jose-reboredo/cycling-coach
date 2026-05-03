# Sprint 11 — User-reported Reliability Bugs

**Branch:** `sprint-11-bugs`
**Author:** Autonomous Sprint 11 prep agent (Opus 4.7)
**Date:** 2026-05-03

Two founder-reported user-visible bugs in the route picker, both surfaced in
the same Zurich-anchored session. Both fixed; both covered by new unit tests
(geoMath helpers in isolation) and a worker-source contract test (so an
accidental delete is caught at CI time, matching the v10.11.3 cache contract
pattern).

---

## Bug 1 — Zurich-anchored ORS-generated routes drift > 2 km from anchor

### Symptom (founder's words)

> "if i say zurich the route cannot be more far away than 1 or 2 km".

The user types a start address (e.g. "Bahnhofstrasse, Zürich"), the picker
geocodes it via Nominatim, and the worker generates 3-5 loop candidates via
ORS. Founder observed that some candidates landed with their centre of mass
several kilometres away from the typed anchor — even though each individual
extreme of the loop was inside the existing per-point proximity gate.

### Files investigated

- `src/routes/routeGen.js` — main worker handler for `POST /api/routes/generate`
- `src/lib/routeScoring.js` — already had a per-point proximity gate (45% of
  target distance from origin), but no centroid gate
- `src/lib/orsAdapter.js` — ORS request builder; nothing to fix here, the
  request was correctly anchored on the user's lat/lng
- `src/lib/waypointGen.js` — scaffold generator; correctly seeds candidates
  around the user's anchor
- `apps/web/src/components/SessionRoutePicker/SessionRoutePicker.tsx` — frontend
- `apps/web/src/lib/routesApi.ts` — frontend client
- `apps/web/src/lib/geocode.ts` — Nominatim wrapper

### Root cause

The existing **per-point** proximity gate in `routeScoring.js` (`farthestKm`
must be ≤ 45% of target distance) catches loops whose extremes wander wildly,
but it does NOT catch a loop whose every point is "kind of close" yet whose
**centre of mass** is clearly off-anchor. Example: a 50 km loop where every
point is within 22.5 km of origin but the loop is entirely on the north side
of the anchor — centroid sits ~10 km north, user typed "Zurich" expecting
something centred on Zurich.

The frontend correctly geocodes the anchor and the worker correctly seeds the
scaffold around it; the failure mode is purely in the post-ORS validation.

### Fix

`src/routes/routeGen.js`:
1. Added two new helpers: `routeCentroid(points)` (arithmetic mean of lat/lng)
   and `haversineKm(lat1, lng1, lat2, lng2)` — both exported so the contract
   test can verify they exist.
2. Added a `CENTROID_MAX_KM = 2.0` constant (matches founder's "1 or 2 km"
   spec — tightest defensible cap).
3. Wired the gate into the score+dedupe loop **before** scoring: any
   candidate whose centroid is more than 2 km from the geocoded anchor is
   dropped via `continue`. Dropped count is logged via `safeWarn` for
   observability.
4. Bumped the cache prefix `routes:v4:` → `routes:v5:` so users with cached
   far-from-anchor entries from before this fix get fresh ones.

The existing "if zero pass, return 503 `no_valid_paths`" behaviour is
preserved — far-away routes are NEVER silently substituted.

### Tests added

- `apps/web/src/lib/geoMath.ts` — pure helpers for haversine, centroid,
  filterWithinRadius, decodeFirstPoint (used by both bug 1 and bug 2 fixes)
- `apps/web/src/lib/__tests__/geoMath.test.ts` — 17 unit tests:
  - haversineKm: identity, known Zurich-Bern (~95 km), Zurich-Positano
    (~900 km), symmetry, antipodal-stability
  - centroid: empty, single, multi-point mean, perfect-loop-centred-on-anchor
  - filterWithinRadius: 50 km drops Bern, 100 km keeps Bern, null coords
    dropped, 2 km tightness validates the bug 1 spec
  - decodeFirstPoint: empty/null guards, canonical Google-spec example,
    truncated-input safety
  - integration: filters Path-of-Gods (Positano hike) when anchor is Zurich
- `apps/web/src/lib/__tests__/worker-route-bug1-contract.test.ts` — 4
  static contract assertions:
  - `CENTROID_MAX_KM` constant exists and is ≤ 2 km
  - `routeCentroid` + `haversineKm` are exported from `routeGen.js`
  - The gate is invoked inside the orsResults loop with a `continue`
  - Cache prefix is bumped past v4
  - (Bug 2 contracts live in a sibling file
    `worker-route-bug2-contract.test.ts` so each commit's tests pass
    in isolation.)

### Residual risks

- **Multi-anchor loops** (e.g. a long out-and-back from Zurich that climbs to
  Uetliberg and back) might have a centroid 1-2 km away from Zurich Hbf even
  though the user would consider them perfectly valid. The 2 km radius is
  the founder's stated upper bound, so this is the tightest acceptable
  setting; I document it as a tunable in a code comment so future loosening
  is one constant change.
- **Founder's "Zurich" interpretation**: I trust Nominatim's first-hit for
  the literal city name "Zurich" — that's how the existing geocode flow
  works. If the user types an ambiguous string and Nominatim picks the wrong
  match, the centroid gate will correctly reject everything (the picker will
  show "we couldn't generate routes" empty state, which is honest). A
  follow-up could surface the geocoded display name to the user for
  confirmation; out of scope tonight.
- **Cache miss storm**: bumping `routes:v4:` → `routes:v5:` invalidates all
  cached generations. First requests after deploy will regenerate (a few
  hundred ms slower). Acceptable cost for correctness.

---

## Bug 2 — Strava saved-routes recommend hiking trails (Path of Gods, Positano) when the anchor is Zurich

### Symptom (founder's words)

> "strava recommended routes if i say zurich why i get path of gods in
> positano as recommendation (its not a ride path, its a hike)".

Two distinct failures stacked: (a) hiking routes appear in the cycling
picker, and (b) routes from a different country appear when the user is
locally anchored.

### Files investigated

- `src/worker.js` — `/api/routes/saved` handler at lines 1981-2096 (in the
  pre-fix file). Proxies Strava `/athlete/routes` and applies surface +
  distance + difficulty filters
- `apps/web/src/lib/routesApi.ts` — `fetchSavedStravaRoutes` client
- `apps/web/src/components/SessionRoutePicker/SessionRoutePicker.tsx` —
  `handleFindStravaSaved` handler

### Root cause

Two missing filters in the worker handler:
1. **No type filter.** Strava `SummaryRoute` carries a `type` field
   (1 = Ride, 2 = Run/Hike). The worker's filter pipeline checked surface,
   distance, and difficulty but never looked at `type`. A type-2 (hike)
   route in dirt surface band could pass all three filters and reach the
   client. Path of Gods is the textbook example — it's surface=dirt
   (passes when user picks "any"), distance=8 km (passes a ±20% band on
   most "short ride" sessions), and... a hike.
2. **No anchor filter.** The handler had no notion of "where is this user
   right now". Saved routes were sent regardless of distance from the
   session anchor. A user who saved a route in Italy and now wants to ride
   in Zurich would get the Italian route at the top.

### Fix

**Layered fix per scope spec.**

#### Fix 2.1 — Type filter (kills Path of Gods directly)

`src/worker.js` `/api/routes/saved` handler:
- Mapped Strava's `r.type` into an internal `_type` field during the
  mapping pass (kept off the public response shape).
- Added a filter rule that drops any route where `_type !== null && _type
  !== 1`. Permissive on missing type (older API entries with no `type`
  field don't get filtered out), strict on explicit non-ride types.
- This single rule rejects Path of Gods (type 2) regardless of any other
  filter state.

#### Fix 2.2 — Anchor-relevance gate (handles "Zurich session, Spain saved route")

Frontend (`SessionRoutePicker.tsx` + `routesApi.ts`):
- Before fetching Strava saved routes, geocode the saved
  `prefs.start_address` (or the picker input if no pref saved) via the same
  Nominatim helper used by the generate tab.
- Pass `lat` and `lng` query params to `/api/routes/saved`.
- Geocode failures are non-fatal — the fetch still happens without an
  anchor (graceful degradation; user still sees their saved routes).

Worker:
- Reads `?lat=&lng=` from the query string. Validates both as in-range
  numbers (no NaN, lat -90..90, lng -180..180). If either is missing/
  invalid, the gate is skipped entirely (existing behavior preserved).
- For each route, decodes the first lat/lng of `map.summary_polyline`
  (only ~30 chars in — no need to decode the whole geometry).
- Computes haversine distance from anchor to first point. Drops routes
  more than `STRAVA_ANCHOR_RADIUS_KM` (= 50 km) away.

#### Why 50 km for the anchor radius

50 km is loose enough to keep regional routes (Strava saved routes don't
always start at the user's home — some start at a friend's place, a club
meetup, or "the next town over for a Sunday loop"). It's tight enough to
throw out clearly-wrong-region routes (Path of Gods at 900 km from Zurich
gets dropped 18× over). 50 km matches the rough scale of "I might
realistically drive there for a ride this weekend" — a sensible
relevance band that won't surprise the user with empty results in cases
where they have legitimately diverse saved routes.

A 2 km gate (matching bug 1) would empty the list for most users
because Strava saved routes lack the tight anchoring of ORS-generated
ones. A 200 km gate would still allow a Bern saved route to leak into
a Zurich session, which is plausibly wrong. 50 km is the most
defensible compromise; it's a constant in `worker.js` so future tuning
is one-line.

### Tests added

- 17 geoMath tests cover the haversine + filter helpers used here too
- 4 worker-route-contract assertions specific to Bug 2 (in
  `apps/web/src/lib/__tests__/worker-route-bug2-contract.test.ts`):
  - `/api/routes/saved` handler block is locatable in `worker.js`
  - The handler reads Strava's `r.type` AND has a gate against `=== 1`
    (the implementation may use either `r.type` directly or a normalized
    `_type` field — the contract test accepts both)
  - The handler reads `lat` and `lng` query params for anchor ranking
  - `STRAVA_ANCHOR_RADIUS_KM` constant exists and is in the defensible
    25-200 km band

### Residual risks

- **Saved routes without `summary_polyline`** (rare but possible — Strava
  has historically omitted polylines for very short routes or routes in
  a specific draft state). These bypass the anchor gate (graceful
  degradation, same policy as the surface filter). Users who configure
  the anchor will still get type-1-only routes, just not anchor-filtered
  ones.
- **No diagnostic surfacing**: the picker today shows "No Strava saved
  routes match ~X km" when the filtered list is empty. If a user has 100
  saved routes that are all type-2 hikes (unlikely but possible), the
  picker will show this same generic empty state. Could be improved with
  a "filtered N hikes" hint, but that's UI polish — out of scope for
  reliability fixes.
- **Geocoding round-trip on every Strava tab open**: the picker now
  geocodes the start address every time the user switches to the Strava
  tab. Nominatim's free tier is rate-limited at 1 req/sec; we already
  tolerate failures. A future optimization would cache the last
  geocode in `useTrainingPrefs`; not a reliability issue tonight.

---

## What I did NOT change (deliberately out of scope)

- **The cache key for `/api/routes/saved`.** The endpoint isn't currently
  cached at the worker level (cache headers are now `private, no-store`
  via the v10.11.3 entry filter). No invalidation needed.
- **The ORS `bbox` parameter.** The handoff doc speculated the ORS request
  might use a too-wide bbox; in fact the current `requestOrsRoute`
  implementation passes only `coordinates` and lets ORS choose its own
  routing radius. Tightening that would require an ORS API change with
  uncertain behaviour; the centroid post-gate is the founder-spec'd fix.
- **The Nominatim ambiguity issue.** "Zurich" might in theory geocode to
  Zurich, Iowa or Zurich, Saskatchewan if Nominatim's heuristics shift.
  Out of scope; the centroid gate makes this a soft-fail (empty results,
  not bad results). A future fix would surface the geocoded display name
  in the picker so the user can correct ambiguous matches.
- **The RWGPS saved-routes endpoint** (`/api/routes/rwgps-saved`). Not in
  the founder's bug report. Same anchor-relevance fix would likely apply,
  but I'm not introducing a non-spec change tonight.
- **Strava sub_type filtering** (e.g. dropping MTB-trail saved routes
  when the user asks for road). The existing `surface` filter already
  handles the gross case; sub_type-level filtering needs founder spec.
- **Reordering the result list by anchor distance.** Today the worker
  filters but doesn't rank by anchor proximity (Strava already returns
  in user-recency order). Ranking by proximity could move "yesterday's
  saved Italian route" to the bottom; that's a UX call I won't make
  unilaterally.
- **Branch rename.** The worktree was created on
  `worktree-agent-aaab57e95b2ae1206`; environment policy denied direct
  branch rename via `git branch -m`. The push step in the agent runner
  pushes the work to `origin/sprint-11-bugs` per the handoff's contract.

---

## Suggested follow-ups for v10.13

- **Surface the geocoded display name in the picker** so users can spot
  ambiguous matches ("Zurich, Iowa" vs "Zürich, Switzerland") before
  generating.
- **Apply the same anchor gate to `/api/routes/rwgps-saved`.** Same
  failure mode is theoretically possible there; founder hasn't reported
  it but the fix is small and symmetric.
- **Cache the last geocode in `useTrainingPrefs`** (`{lat, lng,
  display_name, geocoded_at}`) so the Strava tab doesn't round-trip to
  Nominatim on every tab switch.
- **Add an end-to-end Playwright test** that mocks Strava's `/athlete/
  routes` returning a type-2 route and asserts it never reaches the
  picker. Would need a Worker test harness; today's static-source
  contract test catches the symptom in CI without that infrastructure.
- **Move the duplicated `haversineKm`** in `routeScoring.js` and
  `routeGen.js` into a shared `src/lib/geo.js` module to match
  `apps/web/src/lib/geoMath.ts`. Currently the worker has two private
  copies; not a bug, just spreading-out tech debt.

---

## Verification (run locally before merging)

```bash
cd apps/web && npm run test:unit -- --run
# Expected: 11 test files, 67 tests pass (was 9 / 42 before; +2 files,
# +25 tests covering the new helpers + contract guards)

cd apps/web && npx tsc --noEmit
# Expected: exits 0 (no new type errors)
```

Both verified at commit time; CI will rerun.
