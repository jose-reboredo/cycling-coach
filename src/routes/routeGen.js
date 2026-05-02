// POST /api/routes/generate — Sprint 5+ / v10.4.0.
// Orchestrates loop-route generation: validate → seed → scaffold → ORS
// fan-out → score → GPX → cache. Returns 3-5 routes sorted by score.
//
// Security:
//   - Auth required (resolveAthleteId)
//   - Rate limit: 10 generates / hour / athlete
//   - ORS_API_KEY accessed via env only; never logged, never returned
//   - Disabled-if-not-set: 503 + safeWarn (matches SYSTEM_ANTHROPIC_KEY pattern)

import { generateLoopCandidates, makeRng } from '../lib/waypointGen.js';
import { requestOrsRoute, profileForCyclingType } from '../lib/orsAdapter.js';
import { scoreCandidate } from '../lib/routeScoring.js';
import { decodePolyline } from '../lib/polyline.js';
import { buildGpx } from '../lib/gpxSerializer.js';

const CYCLING_TYPES = new Set(['road', 'gravel', 'mtb']);
const ELEVATION_PREFS = new Set(['low', 'medium', 'high']);
// v10.5.3 — bumped 5 → 6 to give the loosened distance gate more candidates
// to choose from when the road network is sparse or dense urban routing
// rejects some scaffolds.
const CANDIDATE_COUNT = 6;
const TARGET_RESULTS = 5;
const MIN_RESULTS = 3;
const CACHE_TTL_S = 86400; // 24h
// v10.5.3 — bumped to v2 so cached 1-route responses from the strict v1
// gate are invalidated. New requests re-generate with the loosened gate.
// v10.10.1 — bumped to v4 to invalidate "no_valid_paths" cached entries
// from when the proximity gate was 1.5×(d/2π) (too strict). Real loops
// in dense road networks (Zurich Röntgenstrasse case) were rejected.
const CACHE_PREFIX = 'routes:v4:';

/**
 * Public handler. Wired in worker.js when the URL matches.
 * @param {Request} request
 * @param {object} env       Cloudflare bindings (env.ORS_API_KEY, env.DOCS_KV, ...)
 * @param {object} ctx       Worker context (ctx.waitUntil for cache write fire-forget)
 * @param {object} deps      Injected helpers from worker.js
 * @param {Function} deps.resolveAthleteId
 * @param {Function} deps.checkRateLimit
 * @param {Function} deps.safeWarn
 * @param {object} deps.corsHeaders
 */
export async function handleRoutesGenerate({ request, env, ctx, deps }) {
  const { resolveAthleteId, checkRateLimit, safeWarn, corsHeaders } = deps;

  // 1. Disabled if no API key — 503, never crash, never log the key.
  if (!env.ORS_API_KEY) {
    safeWarn('[routes-gen] ORS_API_KEY not set — endpoint disabled');
    return jsonResponse({ error: 'route_service_disabled' }, 503, corsHeaders);
  }

  // 2. Auth.
  const authResult = await resolveAthleteId(request);
  if (authResult.error) {
    return jsonResponse(authResult.body, authResult.error, corsHeaders);
  }
  const athleteId = authResult.athleteId;

  // 3. Rate limit (10 generates / hour / athlete; tune after launch).
  const rl = await checkRateLimit(env, 'routes-gen', String(athleteId), 10, 3600);
  if (rl) {
    return jsonResponse(
      { error: 'rate-limited', retry_after_seconds: rl.retryAfter },
      429,
      corsHeaders,
      { 'Retry-After': String(rl.retryAfter) },
    );
  }

  // 4. Parse + validate input.
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const validation = validateInput(body);
  if (validation.error) {
    return jsonResponse({ error: 'invalid_input', detail: validation.error }, 400, corsHeaders);
  }
  const input = validation.value;

  // 5. Cache lookup. Key derived from input only (not athlete) so that
  //    co-located riders share a cache entry — multiplies hit rate.
  const cacheKey = await cacheKeyForInput(input);
  if (env.DOCS_KV) {
    try {
      const cached = await env.DOCS_KV.get(cacheKey);
      if (cached) {
        return jsonResponse(JSON.parse(cached), 200, corsHeaders);
      }
    } catch (e) {
      safeWarn(`[routes-gen] cache read error: ${e.message}`);
      // Cache failure is non-fatal — fall through to generate.
    }
  }

  // 6. Seed → scaffold → ORS fan-out.
  const seedHex = await sha256Hex(JSON.stringify(input));
  const rng = makeRng(seedHex);
  const candidates = generateLoopCandidates({
    lat: input.lat,
    lng: input.lng,
    distanceKm: input.distance_km,
    candidateCount: CANDIDATE_COUNT,
    rng,
  });
  const profile = profileForCyclingType(input.cycling_type);

  const orsResults = await Promise.all(
    candidates.map((waypoints) =>
      requestOrsRoute({ apiKey: env.ORS_API_KEY, profile, waypoints }),
    ),
  );

  // 7. Score + dedupe.
  const accepted = [];
  const acceptedDecoded = [];
  for (const route of orsResults) {
    if (!route) continue;
    const decoded = decodePolyline(route.polyline);
    if (decoded.length < 2) continue;
    const scored = scoreCandidate({
      route,
      targetDistanceKm: input.distance_km,
      cyclingType: input.cycling_type,
      elevationPref: input.elevation_preference,
      priorPoints: acceptedDecoded,
      decodedPoints: decoded,
      origin: [input.lat, input.lng], // v10.7.0 — proximity gate
    });
    if (!scored) continue; // failed validation gates
    accepted.push({ route, decoded, scored });
    acceptedDecoded.push(decoded);
    if (accepted.length >= TARGET_RESULTS) break;
  }

  if (accepted.length < MIN_RESULTS) {
    safeWarn(`[routes-gen] only ${accepted.length} valid routes for athlete=${athleteId} (under min ${MIN_RESULTS})`);
    if (accepted.length === 0) {
      return jsonResponse({ error: 'no_valid_paths' }, 503, corsHeaders);
    }
    // Fewer than MIN_RESULTS — still useful, return what we have with a warning.
  }

  accepted.sort((a, b) => b.scored.score - a.scored.score);

  // 8. Build response (GPX + polyline + scores).
  const response = accepted.map((a, i) => {
    const km = a.route.distanceM / 1000;
    const titleHint = `${Math.round(km)} km ${input.cycling_type} loop`;
    const gpx = buildGpx({
      name: `Cadence Club · ${titleHint}`,
      points: a.decoded,
      elevations: a.route.elevations,
    });
    return {
      id: `route_${i + 1}`,
      distance_km: Number(km.toFixed(1)),
      elevation_gain_m: Math.round(a.route.ascentM),
      surface_type: a.route.dominantSurface,
      polyline: a.route.polyline,
      gpx,
      score: a.scored.score,
      score_breakdown: a.scored.breakdown,
    };
  });

  // 9. Cache (fire-and-forget; cache miss next time is acceptable).
  if (env.DOCS_KV) {
    ctx.waitUntil(
      env.DOCS_KV
        .put(cacheKey, JSON.stringify(response), { expirationTtl: CACHE_TTL_S })
        .catch((e) => safeWarn(`[routes-gen] cache write error: ${e.message}`)),
    );
  }

  return jsonResponse(response, 200, corsHeaders);
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

function validateInput(body) {
  if (!body || typeof body !== 'object') return { error: 'body must be JSON object' };
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { error: 'lat must be -90..90' };
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return { error: 'lng must be -180..180' };
  const distance = Number(body.distance_km);
  if (!Number.isFinite(distance) || distance < 5 || distance > 300) {
    return { error: 'distance_km must be 5..300' };
  }
  if (!CYCLING_TYPES.has(body.cycling_type)) return { error: 'cycling_type must be road/gravel/mtb' };
  if (!ELEVATION_PREFS.has(body.elevation_preference)) {
    return { error: 'elevation_preference must be low/medium/high' };
  }
  return {
    value: {
      lat,
      lng,
      distance_km: Math.round(distance * 10) / 10,
      cycling_type: body.cycling_type,
      elevation_preference: body.elevation_preference,
    },
  };
}

async function cacheKeyForInput(input) {
  const canon = JSON.stringify({
    lat: Number(input.lat.toFixed(4)),    // ~11m granularity
    lng: Number(input.lng.toFixed(4)),
    distance_km: input.distance_km,
    cycling_type: input.cycling_type,
    elevation_preference: input.elevation_preference,
  });
  return `${CACHE_PREFIX}${await sha256Hex(canon)}`;
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function jsonResponse(obj, status, corsHeaders, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  });
}
