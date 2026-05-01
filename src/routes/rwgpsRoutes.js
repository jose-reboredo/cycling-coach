// Ride with GPS OAuth + saved-routes proxy — Sprint 5+ / v10.6.0.
//
// Three exported handlers (wired in src/worker.js):
//   handleAuthorizeRwgps   — GET /authorize-rwgps
//   handleCallbackRwgps    — GET /callback-rwgps
//   handleRwgpsStatus      — GET /api/rwgps/status
//   handleRwgpsDisconnect  — POST /api/rwgps/disconnect
//   handleRwgpsRoutes      — GET /api/routes/rwgps-saved
//
// Mirrors the existing Strava OAuth pattern (single-use UUID state in KV,
// 10-min TTL, single-use deletion). Tokens stored per-athlete in the
// rwgps_tokens table (Migration 0010).
//
// Security notes:
//   - RWGPS_CLIENT_ID / RWGPS_CLIENT_SECRET only ever read from env;
//     never logged, never returned to the client.
//   - Disabled-if-missing — endpoint returns 503 + safeWarn (matches
//     SYSTEM_ANTHROPIC_KEY / ORS_API_KEY pattern).
//   - State nonce single-use (replay-safe) via OAUTH_STATE KV.
//   - All proxy endpoints behind resolveAthleteId; per-user rate-limited.

const RWGPS_AUTHORIZE_URL = 'https://ridewithgps.com/oauth/authorize';
const RWGPS_TOKEN_URL = 'https://ridewithgps.com/oauth/token.json';
const RWGPS_API_BASE = 'https://ridewithgps.com/api/v1';

// v10.7.0 — Try to refresh tokens before giving up. Returns the new token
// row (and persists it) on success, null when refresh isn't possible (no
// refresh_token stored, or RWGPS rejected the refresh).
async function refreshRwgpsTokens({ env, athleteId, currentTokens, safeWarn }) {
  const refreshToken = currentTokens.refresh_token;
  if (!refreshToken) return null;
  try {
    const res = await fetch(RWGPS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.RWGPS_CLIENT_ID,
        client_secret: env.RWGPS_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) {
      safeWarn(`[rwgps] refresh returned ${res.status}`);
      return null;
    }
    const json = await res.json();
    const accessToken = json.access_token;
    const newRefresh = json.refresh_token ?? refreshToken;
    const authToken = json.auth_token ?? accessToken;
    const expiresAt = json.expires_at
      ?? (typeof json.expires_in === 'number'
        ? Math.floor(Date.now() / 1000) + json.expires_in
        : null);
    if (!accessToken || !authToken) return null;
    const now = Math.floor(Date.now() / 1000);
    await env.cycling_coach_db.prepare(`
      UPDATE rwgps_tokens
      SET access_token = ?, refresh_token = ?, auth_token = ?, expires_at = ?, updated_at = ?
      WHERE athlete_id = ?
    `).bind(accessToken, newRefresh, authToken, expiresAt, now, athleteId).run();
    return { access_token: accessToken, auth_token: authToken };
  } catch (e) {
    safeWarn(`[rwgps] refresh error: ${e.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// /authorize-rwgps — kick off OAuth.
// ---------------------------------------------------------------------------
export async function handleAuthorizeRwgps({ request, env, deps }) {
  const { safeWarn } = deps;
  const url = new URL(request.url);

  if (!env.RWGPS_CLIENT_ID || !env.RWGPS_CLIENT_SECRET) {
    safeWarn('[rwgps] RWGPS_CLIENT_ID/SECRET not set — endpoint disabled');
    return htmlErrorPage('Ride with GPS connection is not configured. Try again later.');
  }

  // Single-use state nonce — same pattern as Strava OAuth.
  const stateNonce = crypto.randomUUID();
  const origin = `${url.protocol}//${url.host}`;
  try {
    await env.OAUTH_STATE.put(
      `rwgps:${stateNonce}`,
      JSON.stringify({ origin, issued_at: Date.now() }),
      { expirationTtl: 600 },
    );
  } catch (e) {
    safeWarn(`[rwgps] failed to write state nonce to KV: ${e.message}`);
    return htmlErrorPage('Could not initiate Ride with GPS connection — try again');
  }

  const auth = new URL(RWGPS_AUTHORIZE_URL);
  auth.searchParams.set('client_id', env.RWGPS_CLIENT_ID);
  auth.searchParams.set('redirect_uri', `${origin}/callback-rwgps`);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('state', stateNonce);
  // RWGPS scope `read` covers /api/v1/routes.json reads.
  auth.searchParams.set('scope', 'read');
  return Response.redirect(auth.toString(), 302);
}

// ---------------------------------------------------------------------------
// /callback-rwgps — exchange code, store tokens, redirect to /dashboard/today.
// ---------------------------------------------------------------------------
export async function handleCallbackRwgps({ request, env, deps }) {
  const { safeWarn } = deps;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const rawState = url.searchParams.get('state');

  // Verify state (single-use, single-deletion).
  let stateData = null;
  if (rawState) {
    const isUuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawState);
    if (isUuidLike) {
      try {
        const stored = await env.OAUTH_STATE.get(`rwgps:${rawState}`);
        if (stored) {
          stateData = JSON.parse(stored);
          await env.OAUTH_STATE.delete(`rwgps:${rawState}`);
        }
      } catch (e) {
        safeWarn(`[rwgps] state KV read error: ${e.message}`);
      }
    }
  }
  if (!stateData) {
    return htmlErrorPage('Ride with GPS authentication expired. Please try connecting again.');
  }
  if (error || !code) {
    return htmlErrorPage(error || 'No authorization code received from Ride with GPS');
  }

  // Resolve the calling athlete via the Strava session token in cookies/headers.
  // OAuth-callback flows in this app don't have a Bearer token in the URL
  // because the user is mid-redirect from a third party. We rely on the
  // existing Strava session cookie that's already on the browser.
  const authResult = await deps.resolveAthleteId(request);
  if (authResult.error) {
    return htmlErrorPage('Please log in to Cadence Club before connecting Ride with GPS.');
  }
  const athleteId = authResult.athleteId;

  // Exchange code for tokens.
  let tokenJson;
  try {
    const origin = stateData.origin;
    const tokenRes = await fetch(RWGPS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.RWGPS_CLIENT_ID,
        client_secret: env.RWGPS_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${origin}/callback-rwgps`,
      }),
    });
    if (!tokenRes.ok) {
      safeWarn(`[rwgps] token exchange returned ${tokenRes.status}`);
      return htmlErrorPage('Ride with GPS rejected the token exchange. Try again.');
    }
    tokenJson = await tokenRes.json();
  } catch (e) {
    safeWarn(`[rwgps] token exchange error: ${e.message}`);
    return htmlErrorPage('Could not contact Ride with GPS — try again.');
  }

  const accessToken = tokenJson.access_token;
  const refreshToken = tokenJson.refresh_token ?? null;
  // RWGPS docs describe `auth_token` as a separate user-bound token returned
  // alongside access_token. Fall back to access_token if not present.
  const authToken = tokenJson.auth_token ?? accessToken;
  const rwgpsUserId = tokenJson.user_id ?? null;
  const expiresAt = tokenJson.expires_at
    ?? (typeof tokenJson.expires_in === 'number'
      ? Math.floor(Date.now() / 1000) + tokenJson.expires_in
      : null);

  if (!accessToken || !authToken) {
    safeWarn('[rwgps] token response missing access_token / auth_token');
    return htmlErrorPage('Ride with GPS returned an unexpected response. Try again.');
  }

  // UPSERT — re-connecting overwrites prior tokens.
  const now = Math.floor(Date.now() / 1000);
  await env.cycling_coach_db.prepare(`
    INSERT INTO rwgps_tokens (athlete_id, access_token, refresh_token, auth_token, rwgps_user_id, expires_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(athlete_id) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      auth_token = excluded.auth_token,
      rwgps_user_id = excluded.rwgps_user_id,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at
  `).bind(athleteId, accessToken, refreshToken, authToken, rwgpsUserId, expiresAt, now, now).run();

  // Redirect back to the app — Today tab. The picker re-fetches status
  // when it mounts, so the user sees "Connected" immediately.
  const target = `${stateData.origin}/dashboard/today?rwgps=connected`;
  return Response.redirect(target, 302);
}

// ---------------------------------------------------------------------------
// GET /api/rwgps/status — { connected, rwgps_user_id?, expires_at? }
// ---------------------------------------------------------------------------
export async function handleRwgpsStatus({ request, env, deps }) {
  const { resolveAthleteId, corsHeaders } = deps;
  const authResult = await resolveAthleteId(request);
  if (authResult.error) return jsonResponse(authResult.body, authResult.error, corsHeaders);
  const athleteId = authResult.athleteId;
  const row = await env.cycling_coach_db
    .prepare('SELECT rwgps_user_id, expires_at FROM rwgps_tokens WHERE athlete_id = ? LIMIT 1')
    .bind(athleteId)
    .first();
  return jsonResponse({
    connected: !!row,
    rwgps_user_id: row?.rwgps_user_id ?? null,
    expires_at: row?.expires_at ?? null,
  }, 200, corsHeaders);
}

// ---------------------------------------------------------------------------
// POST /api/rwgps/disconnect — delete the user's tokens row.
// ---------------------------------------------------------------------------
export async function handleRwgpsDisconnect({ request, env, deps }) {
  const { resolveAthleteId, checkRateLimit, corsHeaders } = deps;
  const authResult = await resolveAthleteId(request);
  if (authResult.error) return jsonResponse(authResult.body, authResult.error, corsHeaders);
  const athleteId = authResult.athleteId;
  const rl = await checkRateLimit(env, 'rwgps-write', String(athleteId), 10, 60);
  if (rl) {
    return jsonResponse(
      { error: 'rate-limited', retry_after_seconds: rl.retryAfter },
      429,
      corsHeaders,
      { 'Retry-After': String(rl.retryAfter) },
    );
  }
  await env.cycling_coach_db
    .prepare('DELETE FROM rwgps_tokens WHERE athlete_id = ?')
    .bind(athleteId)
    .run();
  return jsonResponse({ disconnected: true }, 200, corsHeaders);
}

// ---------------------------------------------------------------------------
// GET /api/routes/rwgps-saved?distance=NN&difficulty=flat|rolling|hilly
//   — proxies GET /api/v1/routes.json for the authenticated user, with
//   distance/elevation filters mapped to RWGPS query params, then sorts
//   client-side by closeness to the target distance.
// ---------------------------------------------------------------------------
export async function handleRwgpsRoutes({ request, env, deps }) {
  const { resolveAthleteId, checkRateLimit, safeWarn, corsHeaders } = deps;
  if (!env.RWGPS_CLIENT_ID || !env.RWGPS_CLIENT_SECRET) {
    safeWarn('[rwgps-saved] RWGPS not configured');
    return jsonResponse({ error: 'rwgps_not_configured' }, 503, corsHeaders);
  }
  const authResult = await resolveAthleteId(request);
  if (authResult.error) return jsonResponse(authResult.body, authResult.error, corsHeaders);
  const athleteId = authResult.athleteId;

  const rl = await checkRateLimit(env, 'rwgps-read', String(athleteId), 30, 60);
  if (rl) {
    return jsonResponse(
      { error: 'rate-limited', retry_after_seconds: rl.retryAfter },
      429,
      corsHeaders,
      { 'Retry-After': String(rl.retryAfter) },
    );
  }

  let tokens = await env.cycling_coach_db
    .prepare('SELECT access_token, auth_token, refresh_token, expires_at FROM rwgps_tokens WHERE athlete_id = ? LIMIT 1')
    .bind(athleteId)
    .first();
  if (!tokens) {
    return jsonResponse({ error: 'rwgps_not_connected' }, 404, corsHeaders);
  }

  // v10.7.0 — proactive refresh if expires_at is in the past or within 60s.
  // Avoids one wasted /api/v1/routes.json call → 401 → refresh round-trip.
  const nowSec = Math.floor(Date.now() / 1000);
  if (tokens.expires_at && tokens.expires_at < nowSec + 60 && tokens.refresh_token) {
    const refreshed = await refreshRwgpsTokens({ env, athleteId, currentTokens: tokens, safeWarn });
    if (refreshed) {
      tokens = { ...tokens, ...refreshed };
    } else {
      // Refresh failed — surface as reauth_required so the UI can prompt.
      return jsonResponse({ error: 'rwgps_reauth_required' }, 401, corsHeaders);
    }
  }

  const url = new URL(request.url);
  const distanceParam = url.searchParams.get('distance');
  const distanceKm = distanceParam ? parseFloat(distanceParam) : null;
  const difficulty = (url.searchParams.get('difficulty') || '').toLowerCase();

  // RWGPS distance filters are in metres. Apply ±20% band when target known.
  const params = new URLSearchParams();
  params.set('page_size', '50');
  if (distanceKm != null && Number.isFinite(distanceKm) && distanceKm > 0) {
    params.set('distance_min', String(Math.round(distanceKm * 800)));   // km → m × 0.8
    params.set('distance_max', String(Math.round(distanceKm * 1200)));  // km → m × 1.2
  }

  let rwgpsRoutes;
  // v10.7.0 — single-retry on 401: if the request lands a 401, attempt
  // a refresh once and re-issue. Avoids forcing reconnect when access
  // token expired without a known expires_at hint.
  const callRwgps = async (authToken) =>
    fetch(`${RWGPS_API_BASE}/routes.json?${params.toString()}`, {
      headers: {
        'x-rwgps-api-key': env.RWGPS_CLIENT_ID,
        'x-rwgps-auth-token': authToken,
        Accept: 'application/json',
      },
    });
  try {
    let apiRes = await callRwgps(tokens.auth_token);
    if (apiRes.status === 401 && tokens.refresh_token) {
      const refreshed = await refreshRwgpsTokens({ env, athleteId, currentTokens: tokens, safeWarn });
      if (refreshed) {
        apiRes = await callRwgps(refreshed.auth_token);
      }
    }
    if (apiRes.status === 401) {
      // Refresh either unavailable or rejected — user must reconnect.
      return jsonResponse({ error: 'rwgps_reauth_required' }, 401, corsHeaders);
    }
    if (!apiRes.ok) {
      safeWarn(`[rwgps-saved] RWGPS returned ${apiRes.status}`);
      return jsonResponse({ error: 'rwgps_unavailable' }, 502, corsHeaders);
    }
    const json = await apiRes.json();
    rwgpsRoutes = Array.isArray(json) ? json : (json.routes || []);
  } catch (e) {
    safeWarn(`[rwgps-saved] fetch error: ${e.message}`);
    return jsonResponse({ error: 'rwgps_unavailable' }, 502, corsHeaders);
  }

  // Map to the unified shape the picker expects. RWGPS route fields are
  // documented at https://ridewithgps.com/api/v1/doc/endpoints/routes —
  // we read distance (m), elevation_gain (m), id, name, surface_composition.
  const mapped = rwgpsRoutes.map((r) => {
    const distance_m = Number(r.distance) || 0;
    const elevation_gain_m = Number(r.elevation_gain) || 0;
    return {
      id: r.id,
      name: r.name || 'Untitled route',
      distance_m,
      elevation_gain_m,
      // RWGPS routes don't always carry a structured surface field; infer
      // from `surface_composition` when present (e.g. { paved: 0.85, ... }).
      surface: inferRwgpsSurface(r),
      rwgps_url: `https://ridewithgps.com/routes/${r.id}`,
    };
  });

  // Difficulty filter (m/km bands) — RWGPS doesn't expose this server-side.
  const filtered = mapped.filter((r) => {
    const km = r.distance_m / 1000;
    if (km <= 0) return false;
    const elevPerKm = r.elevation_gain_m / km;
    if (difficulty === 'flat' && elevPerKm >= 5) return false;
    if (difficulty === 'rolling' && (elevPerKm < 5 || elevPerKm > 15)) return false;
    if (difficulty === 'hilly' && elevPerKm <= 15) return false;
    return true;
  });

  // Sort by closeness to target distance — picker uses the order directly.
  if (distanceKm != null) {
    filtered.sort((a, b) =>
      Math.abs(a.distance_m / 1000 - distanceKm) - Math.abs(b.distance_m / 1000 - distanceKm),
    );
  }

  return jsonResponse({ routes: filtered.slice(0, 10) }, 200, corsHeaders);
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

function inferRwgpsSurface(route) {
  const sc = route.surface_composition;
  if (sc && typeof sc === 'object') {
    // Pick the dominant key by value (e.g. { paved: 0.92, dirt: 0.08 }).
    let bestKey = null;
    let bestVal = 0;
    for (const [k, v] of Object.entries(sc)) {
      const num = Number(v);
      if (Number.isFinite(num) && num > bestVal) {
        bestVal = num;
        bestKey = k;
      }
    }
    if (bestKey === 'paved') return 'paved';
    if (bestKey === 'gravel' || bestKey === 'dirt' || bestKey === 'unpaved') return 'gravel';
  }
  return 'unknown';
}

function jsonResponse(obj, status, corsHeaders, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  });
}

function htmlErrorPage(message) {
  const safe = String(message).replace(/[<>&"']/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;',
  })[c] || c);
  return new Response(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Ride with GPS — Connection error</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 20px;background:#0a0a0c;color:#f0f1f3}h1{font-size:18px;margin-bottom:8px}p{color:#7d8290;line-height:1.5}a{color:#ff7a3d}</style>
</head><body><h1>Couldn't connect Ride with GPS</h1><p>${safe}</p><p><a href="/dashboard/today">← Back to Cadence Club</a></p></body></html>`,
    { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
