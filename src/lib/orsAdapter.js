// OpenRouteService adapter — request directions for a set of waypoints,
// parse the response into a normalized shape the rest of the service
// understands. Pluggable: a graphHopperAdapter could replace this with the
// same interface and the rest of the pipeline wouldn't change.
//
// Security: ORS_API_KEY is read from `env.ORS_API_KEY` only (never logged,
// never returned to the client). Failures map to opaque errors.

const ORS_BASE = 'https://api.openrouteservice.org';

// Map ORS surface code → coarse bucket. Codes per ORS extras.surface:
// 1 = paved, 2 = unpaved, 3 = asphalt, 4 = concrete, 5 = cobblestone, etc.
// See https://openrouteservice.org/dev/#/api-docs/v2/directions/{profile}/get
// for the canonical list. Adapter normalises into our 3 buckets.
const SURFACE_BUCKETS = {
  1: 'asphalt',     // paved
  2: 'unpaved',     // unpaved
  3: 'asphalt',     // asphalt
  4: 'asphalt',     // concrete
  5: 'gravel',      // cobblestone (rough but rideable)
  6: 'unpaved',     // metal
  7: 'unpaved',     // wood
  8: 'gravel',      // compacted
  9: 'gravel',      // fine gravel
  10: 'gravel',     // gravel
  11: 'unpaved',    // dirt
  12: 'unpaved',    // ground
  13: 'unpaved',    // ice / sand / mud
  14: 'unpaved',
  15: 'unpaved',
  16: 'unpaved',
  17: 'unpaved',
  18: 'unpaved',
  19: 'unpaved',
};

/**
 * @typedef {Object} ORSRoute
 * @property {number} distanceM             Real ridden distance (metres)
 * @property {number} durationS             Engine estimate (seconds)
 * @property {number} ascentM               Total elevation gain (metres)
 * @property {string} polyline              Encoded polyline (geometry)
 * @property {Array<number>} elevations     Per-trkpt elevation (metres)
 * @property {Object} surfaceMix            { asphalt: pctMeters, gravel: pctMeters, unpaved: pctMeters }
 * @property {string} dominantSurface       'asphalt' | 'gravel' | 'unpaved'
 */

/**
 * Request a route from ORS for the given waypoints + profile.
 * @param {object} args
 * @param {string} args.apiKey
 * @param {string} args.profile        'cycling-road' | 'cycling-mountain' | 'cycling-regular'
 * @param {Array<[number, number]>} args.waypoints   [[lat, lng], ...]
 * @param {AbortSignal} [args.signal]
 * @returns {Promise<ORSRoute|null>} null on a recoverable failure (rejected candidate).
 */
export async function requestOrsRoute({ apiKey, profile, waypoints, signal }) {
  if (!apiKey) throw new Error('ORS_API_KEY missing');
  // ORS expects [lng, lat] order. Reverse pairs:
  const coordinates = waypoints.map(([lat, lng]) => [lng, lat]);
  const body = {
    coordinates,
    elevation: true,
    geometry_simplify: false,
    extra_info: ['surface', 'waytype'],
    instructions: false,
    preference: 'recommended',
  };
  let res;
  try {
    res = await fetch(`${ORS_BASE}/v2/directions/${profile}/json`, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    // Network error / timeout / abort — treat as a recoverable candidate
    // failure so the caller can fall back. Don't leak err.message into
    // logs in case it contains the URL with a query string (defensive).
    return null;
  }
  if (!res.ok) {
    // 400 = bad waypoints (e.g. unroutable pair). 401/403 = key issue.
    // 503 / 429 = upstream rate-limit. Treat all as recoverable here;
    // the orchestrator decides whether to bubble up.
    return null;
  }
  let json;
  try {
    json = await res.json();
  } catch {
    return null;
  }
  const route = json && json.routes && json.routes[0];
  if (!route) return null;
  const polyline = route.geometry;
  if (!polyline || typeof polyline !== 'string') return null;
  const summary = route.summary || {};
  const distanceM = Number(summary.distance) || 0;
  const durationS = Number(summary.duration) || 0;
  const ascentM = Number((route.summary && route.summary.ascent) ?? 0);

  // Surface mix: extras.surface.values is [[startIdx, endIdx, code], ...]
  // alongside extras.surface.summary which gives totals per code already.
  const surfaceMix = { asphalt: 0, gravel: 0, unpaved: 0 };
  const surfaceSummary = route.extras && route.extras.surface && route.extras.surface.summary;
  if (Array.isArray(surfaceSummary)) {
    for (const entry of surfaceSummary) {
      const bucket = SURFACE_BUCKETS[entry.value] || 'asphalt';
      surfaceMix[bucket] = (surfaceMix[bucket] || 0) + (Number(entry.distance) || 0);
    }
  } else {
    // Fallback: assume asphalt if the engine didn't return surface extras.
    surfaceMix.asphalt = distanceM;
  }
  let dominantSurface = 'asphalt';
  let maxDist = surfaceMix.asphalt;
  for (const [k, v] of Object.entries(surfaceMix)) {
    if (v > maxDist) {
      maxDist = v;
      dominantSurface = k;
    }
  }

  // Per-coordinate elevation. ORS returns elevations on the geometry but
  // they're embedded in the encoded polyline as a 3D variant; for the
  // simple v1 we extract from the optional `extras.elevation` summary
  // when present, else leave empty (GPX serializer skips ele when so).
  const elevations = Array.isArray(route.elevation) ? route.elevation : [];

  return {
    distanceM,
    durationS,
    ascentM,
    polyline,
    elevations,
    surfaceMix,
    dominantSurface,
  };
}

/** Cycling type (api input) → ORS profile. */
export function profileForCyclingType(cyclingType) {
  switch (cyclingType) {
    case 'road': return 'cycling-road';
    case 'mtb': return 'cycling-mountain';
    // ORS has no native gravel profile — use cycling-regular and let
    // surface scoring surface unpaved-friendly routes from candidates.
    case 'gravel': return 'cycling-regular';
    default: return 'cycling-regular';
  }
}
