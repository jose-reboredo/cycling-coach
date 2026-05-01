# Route Generation Service — Architecture & Design

**Status:** Draft for review · v10.4.0 candidate
**Author:** Backend / geospatial design pass
**Replaces / supersedes:** the deprecated `RoutesPicker` UX from pre-v10.0.0 (mocked routes only)

---

## 1. Problem statement

Cyclists planning a structured session need 3 things to actually **start riding**: a brief (zone, duration, target watts), a **route that matches the brief**, and a way to launch it. The brief comes from the AI Coach. The launch is Strava handoff. The route — historically mocked, then deleted in v10.0.0 — is the missing piece.

Founder vision (paraphrased):

> The user generates a plan and adds it to today. The route picker takes all criteria from the session (time, distance, elevation, surface) and generates 3 routes from the user's start address. When the user picks an address, the "Start workout" button enables. Routes are also defined by surface type (any, gravel, paved). This flow is a key winner for the app — equal to the calendar.

Constraints:

- **OSM-based only.** No proprietary routing systems. No Strava route generation.
- **Backend-driven, stateless, cached.**
- **Personal sessions only.** Club events use captain-defined routes.

---

## 2. Where this lives in the UX (challenged)

The founder originally said "this is a Today feature." On reflection: the route picker doesn't belong on Today's flat dossier surface — it belongs **inside the EventDetailDrawer for personal sessions**, opened from any entry point (Today's TodayDossier, the full calendar on Schedule, drawer-after-add from Train).

**Argument for drawer placement:**

- The drawer is the canonical "open this session" surface across the entire app
- The picker is contextual to a *specific session* (its zone, duration, target_watts) — drawer-context already has all of that
- Putting it on Today means duplicating the inputs there + the drawer everywhere else
- Today's TodayDossier becomes simpler (read-only summary), as the founder asked for in v10.0.0
- The drawer for **club events** doesn't show a picker — clubs define their own routes; this respects the founder's "individual only" rule cleanly via the existing `is_personal` discriminator

**Counter-argument (steelman):** placing the picker inline on Today saves a click. But that requires Today to surface every session-detail field, which contradicts the v10.0.0 dossier design. The drawer-tap is one click; the picker is the next user action after.

**Recommendation:** drawer placement.

The **start address** is captured once via `useTrainingPrefs` (already exists, persists to localStorage today, will move to D1 in v10.4.x). When set, the drawer auto-loads 3 candidate routes for the open session. When unset, the drawer shows an inline address input. Pick a route → "Start workout in Strava" enables.

---

## 3. API contract

### `POST /api/routes/generate`

**Request:**

```json
{
  "lat": 47.3769,
  "lng": 8.5417,
  "distance_km": 50,
  "cycling_type": "road",
  "elevation_preference": "medium",
  "session_id": -123
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `lat` | float | yes | -90..90 |
| `lng` | float | yes | -180..180 |
| `distance_km` | float | yes | 5..300, clamped |
| `cycling_type` | enum | yes | `road` \| `gravel` \| `mtb` |
| `elevation_preference` | enum | yes | `low` \| `medium` \| `high` |
| `session_id` | int | optional | for cache/auditing — ties a route set to a planned_session |

**Response:** `200 OK` with array of 3–5 routes, sorted by score descending:

```json
[
  {
    "id": "route_1",
    "distance_km": 51.2,
    "elevation_gain_m": 420,
    "surface_type": "asphalt",
    "polyline": "{encoded}",
    "gpx": "<?xml version=\"1.0\"?>...",
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

`gpx` is the inline payload (small enough; ~5–20 KB for a 50 km route). No separate `/gpx` endpoint needed; GPX is an attribute of the route response.

**Errors:**

- `400 invalid_input` — schema or range violation
- `429 rate_limited` — caller-scoped, 10 generates / hour / athlete
- `502 routing_engine_unavailable` — ORS/GraphHopper down or credit exhausted
- `503 no_valid_paths` — all generated routes failed validation; UI shows "couldn't find good routes here, try a different start point"

---

## 4. Algorithm

### 4.1 Inputs → loop scaffolds

For 5 candidate routes (will downsample to 3–5 valid ones after scoring):

1. **Compute baseline radius:** `r = distance_km / (2π)` for a perfect circle. Real routes will be longer due to road network — we'll deliberately undershoot so the routing engine's path-following doesn't blow past the target.
2. **Scaffold variants:** each candidate gets:
   - **Waypoint count:** 3 or 4 (alternating) — fewer waypoints → smoother loops, more → more variation
   - **Angle offset:** `(routeIndex × 72°) + jitter(seed, ±15°)` — spreads loops around the compass
   - **Radius jitter:** `r × (1 + jitter(seed, ±15%))` — varies overall scale
3. **Place waypoints** on a circle of radius `r_jittered` at angles `θ_offset, θ_offset+360/n, ...` where n is waypoint count. Convert (lat, lng, bearing, distance) to (lat, lng) via [haversine inverse](https://en.wikipedia.org/wiki/Vincenty%27s_formulae) (good enough at city/region scale).
4. **Coordinate sequence:** `[origin, wp1, wp2, ..., wpN, origin]` — last point = first ensures loop closure.

### 4.2 Routing engine call

Per candidate, fetch:

```
POST https://api.openrouteservice.org/v2/directions/{profile}/json
Headers:  Authorization: {ORS_API_KEY}
Body:
  coordinates: [[lng,lat],...]
  elevation: true
  geometry_simplify: false
  extra_info: ["surface", "waytype"]
  instructions: false
  preference: "recommended"
```

**Profile mapping:**

| `cycling_type` | ORS profile | Notes |
|---|---|---|
| `road` | `cycling-road` | Native road profile, prefers paved |
| `gravel` | `cycling-regular` | ORS has no native gravel; combine with surface scoring to surface unpaved-friendly routes |
| `mtb` | `cycling-mountain` | Native off-road profile |

**ORS response gives us:**

- `routes[0].summary.distance` (m) — actual ridden distance
- `routes[0].summary.duration` (s) — estimate
- `routes[0].geometry` — encoded polyline (configurable: `geometry_format: "encodedpolyline"`)
- `routes[0].extras.surface.values` — segment-level surface codes
- `routes[0].extras.waytype.values` — segment-level way classification
- `routes[0].extras.elevation` (if `elevation: true`) — total ascent/descent

Parallel-fetch all 5 candidates with `Promise.all`. ORS allows up to 40 req/min; 5 in parallel is fine. Latency: typical 200–800 ms each → wall-clock ~800 ms with parallelism.

### 4.3 Surface classification

ORS surface values are integer codes mapping to OSM tags. Build a lookup:

```ts
const ORS_SURFACE_CODES: Record<number, 'asphalt' | 'gravel' | 'unpaved' | 'unknown'> = {
  1: 'asphalt',     // paved, asphalt, concrete
  2: 'asphalt',     // paving_stones
  3: 'gravel',      // gravel
  4: 'gravel',      // compacted, fine_gravel
  5: 'unpaved',     // dirt, ground
  6: 'unpaved',     // grass, mud, sand
  // ... etc, full table in routeGenAdapter
};
```

Compute dominant: weight each segment by length, sum per surface bucket, pick the largest. Return `surface_type` as the dominant.

### 4.4 Scoring

```
score = w_d * distance_match
      + w_e * elevation_match
      + w_s * surface_match
      − w_o * overlap_penalty
```

Default weights: `w_d=0.40, w_e=0.20, w_s=0.30, w_o=0.10`. Tunable via env or config.

| Component | Definition | Range |
|---|---|---|
| `distance_match` | `1 − min(\|actual − target\| / target, 1)` | 0–1 |
| `elevation_match` | Match preference band: `low <15 m/km`, `medium 15–30 m/km`, `high >30 m/km`. Bell-curve match at band center. | 0–1 |
| `surface_match` | % of route distance matching the requested cycling_type (road→asphalt, gravel→gravel, mtb→gravel+unpaved). | 0–1 |
| `overlap_penalty` | For each later route, % of polyline points within 200 m of an earlier route's points. Scored via geohash bucketing. | 0–1 |

**Validation gates** (reject before scoring):

- `actual_distance` outside `[0.9 × target, 1.1 × target]` → reject
- `overlap > 0.7` with any already-accepted route → reject
- ORS result missing geometry or returns 0 segments → reject

If fewer than 3 routes survive: return what we have with a `warnings: ["only N routes met criteria"]` field. If 0 survive: 503 with the `no_valid_paths` code, UI shows fallback message.

### 4.5 GPX serialization

Plain XML string, no library:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Cadence Club" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Cadence Club · 51 km road loop</name>
    <trkseg>
      <trkpt lat="47.3769" lon="8.5417"><ele>410</ele></trkpt>
      ...
    </trkseg>
  </trk>
</gpx>
```

Decoded from the polyline; one trkpt per coordinate. Embed elevation when ORS returned it.

### 4.6 Determinism

Seed = `SHA-256(JSON.stringify({lat, lng, distance_km, cycling_type, elevation_preference}))`. The seed feeds:

- Angle offset jitter
- Radius jitter
- Waypoint count alternation

Same input → identical waypoint scaffolds → identical ORS responses → identical scored output. Required for reproducibility and cache hit-ratio.

### 4.7 Caching

Cloudflare KV (already provisioned in this project — Redis would mean adding Upstash, unnecessary). Key:

```
routes:v1:{seed}
```

TTL: **86400 s (24 h)**. Routes don't change minute-to-minute; OSM updates propagate over days/weeks. Refresh on demand by changing the seed (e.g., user edits address).

Cache hit rate target: ≥ 70% for repeat-user planning.

---

## 5. Architecture

### 5.1 Worker integration (not Node, not Java)

The current backend is a single Cloudflare Worker (`src/worker.js`). The user's spec said "Node.js or Java" — I'm pushing back on this. The Worker is the right place because:

- Already deployed, edge-distributed (low latency for European users)
- Fetch + crypto + KV all native — no extra infra
- Stateless by design (matches the spec's "stateless backend" requirement)
- Subrequest budget on paid plan (1000/req) handles the 5 ORS parallel fetches comfortably
- Auth + rate-limit infrastructure already there

Trade-off: 30 s CPU cap on paid plan is fine for 5 parallel ORS calls totaling ~800 ms. If we ever need elevation backfill via SRTM with multiple data points per route, we'd hit subrequest limits — defer that to v10.5+ if it matters.

### 5.2 Module layout

Code split into modules (wrangler bundles them):

```
src/
├── worker.js                       # main router (existing)
├── routes/
│   ├── routeGen.js                 # POST /api/routes/generate handler
│   └── routeGenSchema.js           # input validation
└── lib/
    ├── orsAdapter.js               # ORS HTTP client + response parser
    ├── waypointGen.js              # circle-based waypoint scaffolding
    ├── routeScoring.js             # distance/elevation/surface/overlap
    ├── polyline.js                 # encode/decode (Google polyline algo)
    ├── gpxSerializer.js            # GPX 1.1 string builder
    └── seed.js                     # SHA-256 deterministic seeding
```

Each module ≤ 200 lines. Adapter pattern keeps ORS/GraphHopper swappable: `orsAdapter` could be replaced with `graphHopperAdapter` behind the same `RoutingAdapter` interface.

### 5.3 Secrets

```bash
wrangler secret put ORS_API_KEY
```

Required before deploy. Free ORS account: 2000 req/day. With 70% cache hit rate that's ~6500 generates/day capacity, plenty for the current scale.

### 5.4 Edge cases (handled in code)

| Case | Handling |
|---|---|
| Origin in water | ORS returns error → reject candidate, generate replacement with smaller radius |
| No valid paths from origin | ORS returns 4xx → fallback to **out-and-back**: `[origin, far_waypoint, origin]` straight-line target |
| Extreme elevation requested | Clamp to maximum band; warn user via `warnings` field |
| Dense urban (origin in city center) | Halve `r` for a tighter loop; spec calls this out explicitly |
| ORS down / quota exhausted | 502 with retry-after; UI shows "route service temporarily unavailable" |

---

## 6. Performance

| Step | Target | Mitigation |
|---|---|---|
| Cache lookup | <20 ms | KV read |
| 5 ORS calls (parallel) | <1 s p95 | Promise.all, regional ORS endpoint |
| Scoring | <50 ms | In-memory, vectorised |
| GPX serialization | <50 ms × 5 routes | String concat, no DOM |
| Total wall-clock (cache miss) | **<2 s p95** | Spec target |
| Cache hit | **<100 ms** | KV-only |

---

## 7. Open questions for review

1. **Routing engine:** ORS or GraphHopper? My recommendation: ORS first (better OSS docs, more predictable cycling profiles). Adapter pattern keeps both options open.
2. **API key procurement:** founder needs to register at openrouteservice.org and provide the key via `wrangler secret put ORS_API_KEY`. **Action item before v10.4.0 implementation.**
3. **Address geocoding:** the user's start-address text needs to be converted to (lat, lng) before calling `/api/routes/generate`. ORS has a free geocoding endpoint; we can wrap it in a separate handler `POST /api/geocode` or do the conversion client-side via the public Nominatim API. **Recommend client-side Nominatim** to save Worker subrequests.
4. **Surface vs cycling_type for `gravel`:** ORS has no native gravel profile. Acceptable to use `cycling-regular` + surface scoring? Alternative: weighted profile via ORS's `options.profile_params` to favor unpaved.
5. **Rate limit:** 10 generates/hour/athlete is conservative. Tune based on actual usage after v10.4.0 ships.
6. **Trackpoint elevation:** ORS provides per-point elevation when `elevation: true`. Embed in GPX or skip? **Recommend embed** — Strava and most GPX consumers expect it.
7. **Public ORS rate limits:** 2000/day on free tier. After cache, ~6500 user-generates/day. Sufficient for current scale; if MAU grows past 500–1000 active planners, consider self-hosting Valhalla or paying for ORS.

---

## 8. Release plan (where this fits)

| Release | Theme | Includes |
|---|---|---|
| **v10.1.0** (this release) | Train+Today UX completeness | Per-day "+ Schedule" buttons, streak counter |
| **v10.2.0** | TopTabs placement | Layout restructure: TopTabs under member name, matching club view |
| **v10.3.0** | Schedule polish quick-wins | Quick-add from empty calendar cell, repeat-weekly toggle, week-summary footer |
| **v10.4.0** | **Route generation service (backend)** | This document. ORS adapter, scoring, GPX, API endpoint, KV cache. No UI yet — backend-only. |
| **v10.5.0** | Route picker drawer integration | EventDetailDrawer Routes section, address input, route cards, "Start workout in Strava" CTA wired |

v10.4.0 ships behind no UI; tested via curl/Postman against staging. v10.5.0 wires the UI when the backend is solid.

---

## 9. Test strategy

- **Unit:** `waypointGen` (deterministic outputs for fixed seeds), `routeScoring` (tabular cases), `polyline.encode/decode` (round-trip), `gpxSerializer` (XML validity via small parser test)
- **Integration:** `orsAdapter` against ORS sandbox key (mock the HTTP layer in CI; live key only in staging)
- **End-to-end:** Playwright test that POSTs to `/api/routes/generate`, asserts schema, validates GPX is parseable, validates 3+ routes returned

---

## 10. Why this is worth doing

The route picker isn't a nice-to-have. It's the missing third leg of "AI brief → schedule → ride." Without it, the user has the brief and the calendar slot, but still has to manually plan a route in Komoot or RideWithGPS, copy back to Strava, and start. The picker collapses that 5-minute side-quest into one click.

Founder framed this as "a key winner equal to the calendar." The release plan lets v10.4.0 (backend) ship safely with no UX risk, then v10.5.0 turns it on.
