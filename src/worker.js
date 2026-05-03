// ============================================================
// Cadence Club - SaaS Worker
// Landing + Dashboard + Privacy + AI Coaching + Charts + Goals + Webhooks
// ============================================================
// Required environment variables in Cloudflare:
//   STRAVA_CLIENT_ID      - your Strava app client ID
//   STRAVA_CLIENT_SECRET  - your Strava app client secret  (mark as Secret)
//   ANTHROPIC_API_KEY     - OPTIONAL fallback. Users supply their own key
//                           via the dashboard. If not set, AI works only
//                           for users who add their key.
//   STRAVA_VERIFY_TOKEN   - any string for webhook verification (optional)
// ============================================================
 
import { SPEC_PAGES, LEGACY_PAGES_TO_REMOVE } from './docs.js';
import { handleRoutesGenerate } from './routes/routeGen.js';
import {
  handleAuthorizeRwgps,
  handleCallbackRwgps,
  handleRwgpsStatus,
  handleRwgpsDisconnect,
  handleRwgpsRoutes,
} from './routes/rwgpsRoutes.js';
import {
  handlePlanGenerate,
  handlePlanCurrent,
  handlePlanSchedule,
  regenerateForAthlete,
} from './routes/aiPlan.js';

// Bump this on every meaningful deploy so users (and you) can track which
// version is live by looking at the footer of any page.
const WORKER_VERSION = 'v11.1.0';
const BUILD_DATE = '2026-05-03';

// Defensive log redaction — strips api_key, access_token, refresh_token,
// and Anthropic key prefixes from anything that would otherwise hit
// Cloudflare's persistent log store. Wrapped console.* helpers below.
function redactSensitive(s) {
  return String(s)
    .replace(/api_key["\s:]*"?[a-zA-Z0-9_-]+/g, 'api_key="[redacted]"')
    .replace(/sk-ant-[a-zA-Z0-9_-]+/g, '[redacted-anthropic-key]')
    .replace(/access_token["\s:]*"?[a-zA-Z0-9_-]+/g, 'access_token="[redacted]"')
    .replace(/refresh_token["\s:]*"?[a-zA-Z0-9_-]+/g, 'refresh_token="[redacted]"');
}
function safeArg(a) {
  if (typeof a === 'string') return redactSensitive(a);
  if (typeof a === 'object' && a !== null) {
    try { return redactSensitive(JSON.stringify(a)); } catch { return a; }
  }
  return a;
}
function safeLog(...args) { console.log(...args.map(safeArg)); }
function safeWarn(...args) { console.warn(...args.map(safeArg)); }
function safeError(...args) { console.error(...args.map(safeArg)); }

// v9.12.0 (#76) — shared row mapper for planned_sessions. Used by
// GET /api/me/sessions and GET /api/me/schedule.
function mapSessionRow(row) {
  return {
    id: row.id,
    athlete_id: row.athlete_id,
    session_date: row.session_date,
    title: row.title,
    description: row.description ?? null,
    zone: row.zone ?? null,
    duration_minutes: row.duration_minutes ?? null,
    target_watts: row.target_watts ?? null,
    source: row.source ?? 'manual',
    ai_report_id: row.ai_report_id ?? null,
    completed_at: row.completed_at ?? null,
    cancelled_at: row.cancelled_at ?? null,
    // v10.8.0 — AI plan link + auto-update lock + extended targets.
    ai_plan_session_id: row.ai_plan_session_id ?? null,
    elevation_gained: row.elevation_gained ?? null,
    surface: row.surface ?? null,
    user_edited_at: row.user_edited_at ?? null,
    // v10.12.0 — repeat-group identifier. NULL = standalone session.
    recurring_group_id: row.recurring_group_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
 
// v9.3.0 (#34) — allowlist of origins the Worker will mint OAuth redirect URLs
// to and accept browser CORS calls from on the AI proxy endpoints (/coach,
// /coach-ride). The list is canonical: anything outside it is treated as
// hostile (open-redirect/phishing vector).
const ALLOWED_ORIGINS = [
  'https://cycling-coach.josem-reboredo.workers.dev',
  'https://cadenceclub.cc',
  'http://localhost:5173',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
];

// Resolve the user-facing origin so OAuth redirect_uri lands where the user
// actually is. Returns null if the origin can't be trusted.
//
// Sprint 13 / v11.1.0 — base64 helpers for ciphertext / iv / salt round-tripping.
// D1 BLOB columns are passed as Uint8Array on the way in and surfaced as
// ArrayBuffer on the way out; the client uses base64 over JSON.
function bufToB64(buf) {
  if (!buf) return null;
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64ToBuf(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

//
// v9.3.0 (#34): X-Forwarded-Host is ignored entirely — trusting it created an
// open-redirect / OAuth-phishing vector. The actual origin Cloudflare received
// (url.origin) is gated against ALLOWED_ORIGINS. Localhost dev keeps an
// explicit ?origin=… loopback override (still bound to the loopback hostname).
function userOrigin(request, url) {
  const explicit = url.searchParams.get('origin');
  if (explicit) {
    try {
      const u = new URL(explicit);
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
        return u.origin;
      }
    } catch {}
  }
  const requested = url.origin;
  return ALLOWED_ORIGINS.includes(requested) ? requested : null;
}

// v9.5.1 (#15) — security headers applied to every Worker response. CSP is
// permissive enough not to break the running app: same-origin everything via
// the proxy, Google Fonts (preconnect in index.html), Strava CDN images
// (cloudfront), Google user-content (placeholder for future avatars),
// React inline styles ('unsafe-inline' on style-src). Tighten later as the
// app drops 'unsafe-inline' for nonce-based or external styles.
const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://*.cloudfront.net https://*.googleusercontent.com",
    // v10.5.1 — Nominatim is the address geocoder for the route picker
    // (apps/web/src/lib/geocode.ts). Free, OSM-backed, browser-CORS-friendly.
    // Added to connect-src so the SPA can call it directly without proxying
    // through the Worker (saves subrequest budget, keeps geocoding cheap).
    "connect-src 'self' https://nominatim.openstreetmap.org",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
};

function withSecurityHeaders(res) {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(k)) headers.set(k, v);
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

// v10.11.3 — Default cache policy for /api/* responses: never browser-cache.
// Backstops the v10.11.2 fix at the entry layer so any endpoint that forgets
// to set Cache-Control inherits `private, no-store` automatically. Endpoints
// that DO set their own Cache-Control (e.g. /roadmap with public, max-age)
// take precedence — `headers.has()` check skips defaulting.
//
// Why /api/* (not all paths): static assets (/assets/...) MUST be cacheable;
// browsers and the SW rely on long-cache hashed asset URLs for performance.
// Worker dynamic responses for non-/api/ paths are auth flows + /version +
// /roadmap, all of which set their own headers explicitly.
function withApiCacheDefault(res, pathname) {
  if (!pathname.startsWith('/api/')) return res;
  const headers = new Headers(res.headers);
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'private, no-store');
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export default {
  async fetch(request, env, ctx) {
    const response = await handleRequest(request, env, ctx);
    const url = new URL(request.url);
    const withCache = withApiCacheDefault(response, url.pathname);
    return withSecurityHeaders(withCache);
  },
};

async function handleRequest(request, env, ctx) {
    const url = new URL(request.url);
    const origin = userOrigin(request, url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // v9.3.0 (#33) — /coach + /coach-ride get tightened CORS (separate from
    // the wildcard policy used by /api/*, /version, /roadmap). Preflight
    // requests from non-allowlisted origins are rejected here, before the
    // global wildcard handler below would have echoed a permissive `*`.
    const isAiPath = url.pathname === '/coach' || url.pathname === '/coach-ride';
    if (isAiPath && request.method === 'OPTIONS') {
      const reqOrigin = request.headers.get('Origin') || '';
      if (!ALLOWED_ORIGINS.includes(reqOrigin)) {
        const ip = request.headers.get('cf-connecting-ip') || 'unknown';
        safeWarn(`[coach] CORS preflight rejected — origin="${reqOrigin}" path=${url.pathname} ip=${ip}`);
        return new Response(null, { status: 403 });
      }
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': reqOrigin,
          'Vary': 'Origin',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    // /, /dashboard, /privacy are served by the React SPA (Workers Static
    // Assets). The Worker only fires for the auth + API paths listed in
    // wrangler.jsonc → assets.run_worker_first.

    if (url.pathname === '/authorize') {
      // v9.2.0 (#14) — OAuth state is now a single-use nonce stored in KV
      // with a 10-min TTL. Replaces the deterministic base64({pwa,origin})
      // state which was vulnerable to CSRF / replay attacks. The actual
      // origin + pwa flag round-trip via the KV value, never on the wire,
      // so an attacker can't construct a valid /callback URL even if they
      // can guess a state nonce.
      // v9.3.0 (#34): origin is allowlist-gated. Reject OAuth init from
      // any host not on the list to prevent phishing-redirect setup.
      if (!origin) {
        const ip = request.headers.get('cf-connecting-ip') || 'unknown';
        safeWarn(`[oauth] /authorize rejected — host not in allowlist from IP ${ip}, host="${url.host}"`);
        return new Response('Forbidden — origin not allowed', { status: 400 });
      }
      const stravaAuth = new URL('https://www.strava.com/oauth/authorize');
      stravaAuth.searchParams.set('client_id', env.STRAVA_CLIENT_ID);
      stravaAuth.searchParams.set('redirect_uri', `${origin}/callback`);
      stravaAuth.searchParams.set('response_type', 'code');
      stravaAuth.searchParams.set('approval_prompt', 'auto');
      stravaAuth.searchParams.set('scope', 'read,activity:read_all,profile:read_all');
      const isPwa = url.searchParams.get('pwa') === '1';
      const stateNonce = crypto.randomUUID();
      try {
        await env.OAUTH_STATE.put(
          stateNonce,
          JSON.stringify({ pwa: isPwa, origin, issued_at: Date.now() }),
          { expirationTtl: 600 }, // 10 minutes — covers slow OAuth round-trips
        );
      } catch (e) {
        safeError(`[oauth] failed to write state nonce to KV: ${e.message}`);
        return htmlResponse(errorPage('Could not initiate OAuth — try again'));
      }
      stravaAuth.searchParams.set('state', stateNonce);
      return Response.redirect(stravaAuth.toString(), 302);
    }

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      const rawState = url.searchParams.get('state');

      // v9.2.0 (#14) — verify state nonce against KV. Single-use: delete
      // immediately after read. Reject missing/unknown/expired with 403.
      let stateData = null;
      if (rawState) {
        // UUID-format check (avoids a pointless KV lookup for garbage values)
        const isUuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawState);
        if (isUuidLike) {
          try {
            const stored = await env.OAUTH_STATE.get(rawState);
            if (stored) {
              stateData = JSON.parse(stored);
              // Single-use: delete immediately so a replay can't exchange
              // the same code twice.
              await env.OAUTH_STATE.delete(rawState);
            }
          } catch (e) {
            safeWarn(`[oauth] KV read error during /callback: ${e.message}`);
          }
        }
      }

      if (!stateData) {
        const ip = request.headers.get('cf-connecting-ip') || 'unknown';
        safeWarn(`[oauth] /callback rejected — invalid/missing state from IP ${ip}, raw="${rawState ? rawState.slice(0, 16) : ''}"`);
        return htmlResponse(errorPage('OAuth session expired or invalid. Please try connecting again.'));
      }

      const fromPwa = !!stateData.pwa;
      const callbackOrigin = stateData.origin || origin;
      if (error || !code) return htmlResponse(errorPage(error || 'No authorization code'));
      try {
        const tokenRes = await fetch('https://www.strava.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: env.STRAVA_CLIENT_ID,
            client_secret: env.STRAVA_CLIENT_SECRET,
            code, grant_type: 'authorization_code',
          }),
        });
        const data = await tokenRes.json();
        if (data.access_token) {
          await persistUserAndTokens(env.cycling_coach_db, data);
          // v9.6.1 hotfix — generate per-request nonce so the inline script
          // that writes tokens to localStorage + redirects to /dashboard can
          // run despite the strict global CSP script-src 'self' (#15). Without
          // this, the OAuth callback hangs at "Loading dashboard…" forever
          // because the inline script is silently blocked.
          const cbNonce = crypto.randomUUID().replace(/-/g, '');
          return htmlResponse(callbackPage(data, callbackOrigin, fromPwa, cbNonce), {
            'Content-Security-Policy': cspWithScriptNonce(cbNonce),
          });
        }
        return htmlResponse(errorPage(data.message || 'Token exchange failed'));
      } catch (e) {
        safeWarn(`[oauth] token exchange error: ${e.message}`);
        return htmlResponse(errorPage('Token exchange failed — try again'));
      }
    }
 
    if (url.pathname === '/refresh' && request.method === 'POST') {
      try {
        const body = await request.json();
        const refresh_token = body?.refresh_token;
        if (!refresh_token || typeof refresh_token !== 'string') {
          return new Response(JSON.stringify({ error: 'refresh_token required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        // v9.2.0 (#36): verify the refresh_token corresponds to a known athlete
        // before forwarding to Strava. user_connections.credentials_json is a
        // JSON blob containing { access_token, refresh_token, expires_at, ... };
        // we look for the literal refresh_token substring. Bounds the attack
        // surface to athletes whose tokens we've previously seen and gives us
        // a log trail. Doesn't prevent token theft, but slows brute-forcing
        // and rejects garbage requests before they hit Strava.
        const known = await env.cycling_coach_db
          .prepare(
            "SELECT athlete_id FROM user_connections WHERE source = 'strava' AND credentials_json LIKE ? LIMIT 1",
          )
          .bind(`%"refresh_token":"${refresh_token}"%`)
          .first();
        if (!known) {
          safeWarn(`[refresh] unknown refresh_token from IP ${request.headers.get('cf-connecting-ip') || 'unknown'}`);
          return new Response(JSON.stringify({ error: 'invalid refresh_token' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const refreshRes = await fetch('https://www.strava.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: env.STRAVA_CLIENT_ID,
            client_secret: env.STRAVA_CLIENT_SECRET,
            refresh_token, grant_type: 'refresh_token',
          }),
        });
        const data = await refreshRes.json();
        // Strangler Fig: persist refreshed tokens to D1 if athlete present in response
        if (data.access_token && data.athlete?.id) {
          await updateConnectionTokens(env.cycling_coach_db, data.athlete.id, data);
        }
        return new Response(JSON.stringify(data), {
          status: refreshRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        safeWarn(`[refresh] error: ${e.message}`);
        return new Response(JSON.stringify({ error: 'refresh failed' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
 
    // ============= CLUBS =============
    // /api/clubs* endpoints — D1-backed. Identity resolved server-side via Strava
    // /athlete round-trip (resolveAthleteId helper). Membership-gated reads return
    // 404 (OWASP — don't leak existence of clubs the caller doesn't belong to).
    // Must be matched BEFORE the generic /api/* Strava proxy fall-through below.
    if (url.pathname === '/api/clubs' && request.method === 'POST') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify(authResult.body), {
          status: authResult.error,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const athleteId = authResult.athleteId;
      // #42 — clubs-write rate-limit (30/min/athlete shared across all
      // clubs POST endpoints). 31st write inside the 60s bucket → 429.
      const rl = await checkRateLimit(env, 'clubs-write', String(athleteId), 30, 60);
      if (rl) {
        return new Response(JSON.stringify({ error: 'rate-limited', retry_after_seconds: rl.retryAfter }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) },
        });
      }
      let body;
      try { body = await request.json(); } catch {
        return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const name = (body?.name || '').toString().trim();
      const description = body?.description ? body.description.toString().trim().slice(0, 500) : null;
      if (!name || name.length > 100) {
        return new Response(JSON.stringify({ error: 'name required (1-100 chars)' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const db = env.cycling_coach_db;
      const now = Math.floor(Date.now() / 1000);
      // Generate a 16-char hex invite code per club. v9.1.4 fix — until this
      // release, the INSERT omitted invite_code, leaving every club with a
      // NULL value. The InviteLinkCard renders only when invite_code is
      // truthy, so F4 (invite-by-link, v9.0.0) was silently broken for every
      // real user. crypto.randomUUID() gives 122 bits of entropy; sliced to
      // 16 hex chars = 64 bits, plenty for the small invite-link namespace.
      const inviteCode = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      let clubId;
      try {
        const insertClub = await db
          .prepare('INSERT INTO clubs (name, description, owner_athlete_id, invite_code, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id')
          .bind(name, description, athleteId, inviteCode, now)
          .first();
        clubId = insertClub?.id;
        if (!clubId) throw new Error('club insert returned no id');
        await db
          .prepare("INSERT INTO club_members (club_id, athlete_id, role, joined_at) VALUES (?, ?, 'admin', ?)")
          .bind(clubId, athleteId, now)
          .run();
      } catch (e) {
        if (clubId) {
          try {
            await db.prepare('DELETE FROM clubs WHERE id = ?').bind(clubId).run();
            safeWarn(`[clubs] member insert failed, cleaned up orphan club ${clubId}: ${e.message}`);
          } catch (cleanupErr) {
            safeError(`[clubs] FAILED to clean up orphan club ${clubId}: ${cleanupErr.message}`);
          }
        } else {
          safeWarn(`[clubs] club creation failed before any insert: ${e.message}`);
        }
        return new Response(JSON.stringify({ error: 'club creation failed' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        id: clubId,
        name,
        description,
        invite_code: inviteCode,
        role: 'admin',
      }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/api/clubs' && request.method === 'GET') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify(authResult.body), {
          status: authResult.error,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { results } = await env.cycling_coach_db
        .prepare(`
          SELECT c.id, c.name, c.description, c.owner_athlete_id, c.invite_code, c.created_at, m.role
          FROM clubs c
          INNER JOIN club_members m ON m.club_id = c.id
          WHERE m.athlete_id = ?
          ORDER BY c.created_at DESC
        `)
        .bind(authResult.athleteId)
        .all();
      return new Response(JSON.stringify({ clubs: results || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /api/clubs/join/:code — Strava-auth required. Looks up club by
    // invite_code, INSERTs caller as 'member' (idempotent — composite PK on
    // club_members blocks duplicates; we surface the existing membership
    // gracefully). 404 for unknown codes (OWASP — don't leak which codes are valid).
    const joinMatch = url.pathname.match(/^\/api\/clubs\/join\/([A-Za-z0-9_-]+)$/);
    if (joinMatch && request.method === 'POST') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify(authResult.body), {
          status: authResult.error,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // #42 — clubs-write rate-limit (shared 30/min/athlete scope).
      const rl = await checkRateLimit(env, 'clubs-write', String(authResult.athleteId), 30, 60);
      if (rl) {
        return new Response(JSON.stringify({ error: 'rate-limited', retry_after_seconds: rl.retryAfter }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) },
        });
      }
      const code = joinMatch[1];
      const db = env.cycling_coach_db;
      const club = await db
        .prepare('SELECT id, name, description, owner_athlete_id FROM clubs WHERE invite_code = ? LIMIT 1')
        .bind(code)
        .first();
      if (!club) {
        return new Response(JSON.stringify({ error: 'invite link not found or expired' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Idempotent join: try INSERT, swallow PK conflict (already member).
      const now = Math.floor(Date.now() / 1000);
      let role = 'member';
      try {
        await db
          .prepare("INSERT INTO club_members (club_id, athlete_id, role, joined_at) VALUES (?, ?, 'member', ?)")
          .bind(club.id, authResult.athleteId, now)
          .run();
      } catch (e) {
        // Already a member — look up actual role (could be 'admin' if they're the owner).
        const existing = await db
          .prepare('SELECT role FROM club_members WHERE club_id = ? AND athlete_id = ? LIMIT 1')
          .bind(club.id, authResult.athleteId)
          .first();
        if (existing?.role) {
          role = existing.role;
        } else {
          // Genuinely unexpected error — log and 500.
          safeWarn(`[clubs] join failed for athlete ${authResult.athleteId} club ${club.id}: ${e.message}`);
          return new Response(JSON.stringify({ error: 'could not join club' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      return new Response(JSON.stringify({
        id: club.id,
        name: club.name,
        description: club.description,
        role,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // /api/clubs/:id/events — list upcoming + create. Membership-gated reads
    // (404 if not a member, OWASP). v9.1.3 spec: ANY member can create events,
    // not just admins. Past events optionally returned via ?include=past.
    const eventsMatch = url.pathname.match(/^\/api\/clubs\/(\d+)\/events$/);
    if (eventsMatch && (request.method === 'GET' || request.method === 'POST')) {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify(authResult.body), {
          status: authResult.error,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const clubId = parseInt(eventsMatch[1], 10);
      const db = env.cycling_coach_db;

      // Membership check (any role qualifies — not admin-only per spec)
      const membership = await db
        .prepare('SELECT 1 AS member FROM club_members WHERE club_id = ? AND athlete_id = ? LIMIT 1')
        .bind(clubId, authResult.athleteId)
        .first();
      if (!membership) {
        return new Response(JSON.stringify({ error: 'not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'POST') {
        // #42 — clubs-write rate-limit (shared 30/min/athlete scope). Only
        // gates POST; the GET branch above is read-only and unmetered.
        const rl = await checkRateLimit(env, 'clubs-write', String(authResult.athleteId), 30, 60);
        if (rl) {
          return new Response(JSON.stringify({ error: 'rate-limited', retry_after_seconds: rl.retryAfter }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) },
          });
        }
        let body;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const title = (body?.title || '').toString().trim();
        const description = body?.description ? body.description.toString().trim().slice(0, 2000) : null;
        const location = body?.location ? body.location.toString().trim().slice(0, 200) : null;
        const eventDateRaw = body?.event_date;
        const eventDate = typeof eventDateRaw === 'number'
          ? Math.floor(eventDateRaw)
          : eventDateRaw ? Math.floor(new Date(eventDateRaw).getTime() / 1000) : NaN;

        if (!title || title.length > 200) {
          return new Response(JSON.stringify({ error: 'title required (1-200 chars)' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (!Number.isFinite(eventDate) || eventDate < 0) {
          return new Response(JSON.stringify({ error: 'event_date required (ISO string or unix seconds)' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const now = Math.floor(Date.now() / 1000);
        // Sanity guard: ±5 years
        const fiveYears = 5 * 365 * 24 * 3600;
        if (eventDate < now - fiveYears || eventDate > now + fiveYears) {
          return new Response(JSON.stringify({ error: 'event_date out of range (±5 years)' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // v9.7.3 (Migration 0007) — event_type + new model columns.
        // Allowlists guard against bad inputs.
        const TYPE_ALLOWLIST = new Set(['ride', 'social', 'race']);
        const SURFACE_ALLOWLIST = new Set(['road', 'gravel', 'mixed']);
        const eventType = TYPE_ALLOWLIST.has(body?.event_type) ? body.event_type : 'ride';
        const distanceKm = typeof body?.distance_km === 'number' && body.distance_km >= 0 && body.distance_km < 1000
          ? body.distance_km : null;
        const speedKmh = typeof body?.expected_avg_speed_kmh === 'number' && body.expected_avg_speed_kmh > 0 && body.expected_avg_speed_kmh < 100
          ? body.expected_avg_speed_kmh : null;
        const surface = SURFACE_ALLOWLIST.has(body?.surface) ? body.surface : null;
        const startPoint = body?.start_point ? body.start_point.toString().trim().slice(0, 200) : null;
        const routeStravaId = body?.route_strava_id ? body.route_strava_id.toString().trim().slice(0, 64) : null;
        const descAi = body?.description_ai_generated === true || body?.description_ai_generated === 1 ? 1 : 0;

        // v9.12.2 (#79): duration_minutes mandatory on POST. Range 0–600
        // (10h max). Migration 0009 made the column nullable for legacy rows
        // but new events MUST include it.
        const durationMinutes = typeof body?.duration_minutes === 'number'
          && body.duration_minutes >= 0 && body.duration_minutes <= 600
          ? Math.floor(body.duration_minutes) : null;
        if (durationMinutes === null) {
          return new Response(JSON.stringify({ error: 'duration_minutes required (0-600)' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const inserted = await db
          .prepare(
            'INSERT INTO club_events (club_id, created_by, title, description, event_date, location, created_at, ' +
            '  event_type, distance_km, expected_avg_speed_kmh, surface, start_point, route_strava_id, description_ai_generated, duration_minutes) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?,  ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
          )
          .bind(clubId, authResult.athleteId, title, description, eventDate, location, now,
                eventType, distanceKm, speedKmh, surface, startPoint, routeStravaId, descAi, durationMinutes)
          .first();
        if (!inserted?.id) {
          safeWarn(`[clubs] event insert returned no id for club ${clubId}`);
          return new Response(JSON.stringify({ error: 'event creation failed' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({
          id: inserted.id,
          club_id: clubId,
          created_by: authResult.athleteId,
          title,
          description,
          location,
          event_date: eventDate,
          created_at: now,
          event_type: eventType,
          distance_km: distanceKm,
          expected_avg_speed_kmh: speedKmh,
          surface,
          start_point: startPoint,
          route_strava_id: routeStravaId,
          description_ai_generated: descAi,
          cancelled_at: null,
          duration_minutes: durationMinutes,
        }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // GET — three modes:
      //   ?range=YYYY-MM → Schedule tab month view (Sprint 5 Phase 3, v9.7.0).
      //                    Returns events in that UTC month with event_type +
      //                    confirmed_count via LEFT JOIN event_rsvps.
      //   ?include=past  → all events, newest first, cap 50.
      //   (default)      → upcoming events (event_date >= now), cap 50.
      const rangeParam = url.searchParams.get('range');
      if (rangeParam) {
        // Validate YYYY-MM. SQL injection-safe: epoch math is integer-only;
        // bind params handle clubId + epochs.
        const rangeMatch = rangeParam.match(/^(\d{4})-(\d{2})$/);
        if (!rangeMatch) {
          return new Response(JSON.stringify({ error: 'range must be YYYY-MM (e.g. 2026-05)' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const yr = parseInt(rangeMatch[1], 10);
        const mo = parseInt(rangeMatch[2], 10);
        if (yr < 2000 || yr > 2100 || mo < 1 || mo > 12) {
          return new Response(JSON.stringify({ error: 'range out of bounds' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        // v10.11.0 — pad month range by 7 days each side. Mirrors the
        // /api/me/schedule fix in v10.10.3: weeks that span month
        // boundaries (e.g. Apr 27 - May 3 = "2026-05" range but Apr 27
        // sits in April) need the boundary days included. Frontend
        // de-dupes by id; over-fetch is safe.
        const PAD_SEC = 7 * 86400;
        const startEpoch = Math.floor(Date.UTC(yr, mo - 1, 1) / 1000) - PAD_SEC;
        const endEpoch = Math.floor(Date.UTC(yr, mo, 1) / 1000) - 1 + PAD_SEC;
        const { results: rangeRows } = await db.prepare(
          'SELECT e.id, e.club_id, e.created_by, e.title, e.description, e.location, ' +
          '       e.event_date, e.event_type, e.created_at, ' +
          '       e.distance_km, e.expected_avg_speed_kmh, e.surface, e.start_point, ' +
          '       e.route_strava_id, e.description_ai_generated, e.cancelled_at, e.duration_minutes, ' +
          '       u.firstname AS creator_firstname, u.lastname AS creator_lastname, ' +
          '       COUNT(CASE WHEN r.status = \'going\' THEN 1 END) AS confirmed_count ' +
          'FROM club_events e ' +
          'LEFT JOIN users u ON u.athlete_id = e.created_by ' +
          'LEFT JOIN event_rsvps r ON r.event_id = e.id ' +
          'WHERE e.club_id = ? AND e.event_date BETWEEN ? AND ? ' +
          'GROUP BY e.id, e.club_id, e.created_by, e.title, e.description, e.location, ' +
          '         e.event_date, e.event_type, e.created_at, ' +
          '         e.distance_km, e.expected_avg_speed_kmh, e.surface, e.start_point, ' +
          '         e.route_strava_id, e.description_ai_generated, e.cancelled_at, e.duration_minutes, ' +
          '         u.firstname, u.lastname ' +
          'ORDER BY e.event_date ASC',
        ).bind(clubId, startEpoch, endEpoch).all();
        const events = (rangeRows || []).map((e) => ({
          ...e,
          confirmed_count: Number(e.confirmed_count ?? 0),
        }));
        return new Response(JSON.stringify({
          club_id: clubId,
          range: { year: yr, month: mo, start: startEpoch, end: endEpoch },
          events,
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            // v10.11.2 — no-store. The previous max-age=300 caused the
            // browser to serve stale data for 5 minutes. TanStack invalidate
            // triggered fetches but the browser short-circuited to disk
            // cache before reaching the network. This was the root cause
            // of every "edit doesn't register / cancel doesn't disappear"
            // symptom across v10.10.x and v10.11.0. User data MUST be fresh.
            'Cache-Control': 'private, no-store',
          },
        });
      }
      const includePast = url.searchParams.get('include') === 'past';
      const now = Math.floor(Date.now() / 1000);
      const sql = includePast
        ? 'SELECT e.id, e.club_id, e.created_by, e.title, e.description, e.location, e.event_date, e.event_type, e.created_at, ' +
          '       u.firstname AS creator_firstname, u.lastname AS creator_lastname ' +
          'FROM club_events e LEFT JOIN users u ON u.athlete_id = e.created_by ' +
          'WHERE e.club_id = ? ORDER BY e.event_date DESC LIMIT 50'
        : 'SELECT e.id, e.club_id, e.created_by, e.title, e.description, e.location, e.event_date, e.event_type, e.created_at, ' +
          '       u.firstname AS creator_firstname, u.lastname AS creator_lastname ' +
          'FROM club_events e LEFT JOIN users u ON u.athlete_id = e.created_by ' +
          'WHERE e.club_id = ? AND e.event_date >= ? ORDER BY e.event_date ASC LIMIT 50';
      const stmt = includePast ? db.prepare(sql).bind(clubId) : db.prepare(sql).bind(clubId, now);
      const { results } = await stmt.all();
      return new Response(JSON.stringify({ club_id: clubId, events: results || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PATCH /api/clubs/:id/events/:eventId — Sprint 5 / v9.7.3 (#60).
    // Edit an existing event. Creator OR admin only (403 otherwise; 404 if
    // not a club member, OWASP). Same field set as POST + the new model
    // columns from Migration 0007. Rate-limited on clubs-write 30/min.
    const eventEditMatch = url.pathname.match(/^\/api\/clubs\/(\d+)\/events\/(\d+)$/);
    if (eventEditMatch && request.method === 'PATCH') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify(authResult.body), {
          status: authResult.error,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const clubId = parseInt(eventEditMatch[1], 10);
      const eventId = parseInt(eventEditMatch[2], 10);
      const db = env.cycling_coach_db;

      // Membership + role check + event ownership in one batch.
      const [memberRow, eventRow] = await db.batch([
        db.prepare('SELECT m.role FROM club_members m WHERE m.club_id = ? AND m.athlete_id = ? LIMIT 1')
          .bind(clubId, authResult.athleteId),
        db.prepare('SELECT id, club_id, created_by FROM club_events WHERE id = ? AND club_id = ? LIMIT 1')
          .bind(eventId, clubId),
      ]);
      const membership = memberRow?.results?.[0];
      const event = eventRow?.results?.[0];
      if (!membership || !event) {
        return new Response(JSON.stringify({ error: 'not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const isAdmin = membership.role === 'admin';
      const isCreator = event.created_by === authResult.athleteId;
      if (!isAdmin && !isCreator) {
        return new Response(JSON.stringify({ error: 'creator or admin only' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const rl = await checkRateLimit(env, 'clubs-write', String(authResult.athleteId), 30, 60);
      if (rl) {
        return new Response(JSON.stringify({ error: 'rate-limited', retry_after_seconds: rl.retryAfter }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) },
        });
      }

      let body;
      try { body = await request.json(); } catch {
        return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Allowlist of patchable fields. Caller sends partial body — only
      // present keys are updated. Empty-string clears nullable text fields
      // (so the UI can erase them).
      const TYPE_ALLOWLIST = new Set(['ride', 'social', 'race']);
      const SURFACE_ALLOWLIST = new Set(['road', 'gravel', 'mixed']);
      const updates = [];
      const params = [];
      const out = {};

      const setIfPresent = (key, sqlCol, parser) => {
        if (key in body) {
          const value = parser(body[key]);
          if (value === undefined) return; // parser rejected; skip silently
          updates.push(`${sqlCol} = ?`);
          params.push(value);
          out[sqlCol] = value;
        }
      };

      setIfPresent('title', 'title', (v) => {
        const s = String(v || '').trim();
        return s && s.length <= 200 ? s : undefined;
      });
      setIfPresent('description', 'description', (v) => v == null || v === '' ? null : String(v).trim().slice(0, 2000));
      setIfPresent('location', 'location', (v) => v == null || v === '' ? null : String(v).trim().slice(0, 200));
      setIfPresent('event_date', 'event_date', (v) => {
        const n = typeof v === 'number' ? Math.floor(v) : v ? Math.floor(new Date(v).getTime() / 1000) : NaN;
        return Number.isFinite(n) && n > 0 ? n : undefined;
      });
      setIfPresent('event_type', 'event_type', (v) => TYPE_ALLOWLIST.has(v) ? v : undefined);
      setIfPresent('distance_km', 'distance_km', (v) => v === null ? null : (typeof v === 'number' && v >= 0 && v < 1000 ? v : undefined));
      setIfPresent('expected_avg_speed_kmh', 'expected_avg_speed_kmh', (v) => v === null ? null : (typeof v === 'number' && v > 0 && v < 100 ? v : undefined));
      setIfPresent('surface', 'surface', (v) => v === null ? null : (SURFACE_ALLOWLIST.has(v) ? v : undefined));
      setIfPresent('start_point', 'start_point', (v) => v == null || v === '' ? null : String(v).trim().slice(0, 200));
      setIfPresent('route_strava_id', 'route_strava_id', (v) => v == null || v === '' ? null : String(v).trim().slice(0, 64));
      // v9.12.2 (#79): duration_minutes patchable. Null clears (legacy events
      // without duration); 0–600 valid range.
      setIfPresent('duration_minutes', 'duration_minutes', (v) => v === null ? null : (typeof v === 'number' && v >= 0 && v <= 600 ? Math.floor(v) : undefined));

      if (updates.length === 0) {
        return new Response(JSON.stringify({ error: 'no patchable fields' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Sprint 11 sec audit (#sec-1) — defense-in-depth: scope by club_id
      // too. The handler already verifies the caller is creator-or-admin
      // of THIS club (lines above), but pinning the UPDATE to (id, club_id)
      // means a future regression that drops the membership check still
      // can't cross-club edit by sending the wrong /api/clubs/:id/ prefix.
      params.push(eventId, clubId);
      await db.prepare(`UPDATE club_events SET ${updates.join(', ')} WHERE id = ? AND club_id = ?`).bind(...params).run();

      return new Response(JSON.stringify({ id: eventId, club_id: clubId, ...out }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /api/clubs/:id/events/:eventId/cancel — Sprint 5 / v9.7.3 (#60).
    // Soft-cancel an event. Sets cancelled_at = now. Creator OR admin only.
    // Idempotent — second call is a no-op (cancelled_at unchanged on already-
    // cancelled events; UI is responsible for un-cancel UX if needed later).
    const eventCancelMatch = url.pathname.match(/^\/api\/clubs\/(\d+)\/events\/(\d+)\/cancel$/);
    if (eventCancelMatch && request.method === 'POST') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify(authResult.body), {
          status: authResult.error,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const clubId = parseInt(eventCancelMatch[1], 10);
      const eventId = parseInt(eventCancelMatch[2], 10);
      const db = env.cycling_coach_db;

      const [memberRow, eventRow] = await db.batch([
        db.prepare('SELECT m.role FROM club_members m WHERE m.club_id = ? AND m.athlete_id = ? LIMIT 1')
          .bind(clubId, authResult.athleteId),
        db.prepare('SELECT id, club_id, created_by, cancelled_at FROM club_events WHERE id = ? AND club_id = ? LIMIT 1')
          .bind(eventId, clubId),
      ]);
      const membership = memberRow?.results?.[0];
      const event = eventRow?.results?.[0];
      if (!membership || !event) {
        return new Response(JSON.stringify({ error: 'not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const isAdmin = membership.role === 'admin';
      const isCreator = event.created_by === authResult.athleteId;
      if (!isAdmin && !isCreator) {
        return new Response(JSON.stringify({ error: 'creator or admin only' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const rl = await checkRateLimit(env, 'clubs-write', String(authResult.athleteId), 30, 60);
      if (rl) {
        return new Response(JSON.stringify({ error: 'rate-limited', retry_after_seconds: rl.retryAfter }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) },
        });
      }

      const now = Math.floor(Date.now() / 1000);
      // Idempotent — preserves the original cancellation time if already set.
      if (event.cancelled_at) {
        return new Response(JSON.stringify({ id: eventId, club_id: clubId, cancelled_at: event.cancelled_at, already_cancelled: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Sprint 11 sec audit (#sec-1) — defense-in-depth: scope by club_id.
      await db.prepare('UPDATE club_events SET cancelled_at = ? WHERE id = ? AND club_id = ?').bind(now, eventId, clubId).run();
      return new Response(JSON.stringify({ id: eventId, club_id: clubId, cancelled_at: now }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /api/clubs/:id/events/draft-description — Sprint 5 / v9.8.0 (#60).
    // Generates a 2-3 sentence event description via system-paid Haiku.
    // Used by ClubEventModal's "Generate with AI" button on create + edit
    // flows. Members of the club only (404 OWASP). Rate-limited 5/min/athlete
    // on the new event-ai-draft scope per ADR-S5.3. ~$0.001 / draft.
    const draftDescMatch = url.pathname.match(/^\/api\/clubs\/(\d+)\/events\/draft-description$/);
    if (draftDescMatch && request.method === 'POST') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify(authResult.body), {
          status: authResult.error,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const clubId = parseInt(draftDescMatch[1], 10);
      const db = env.cycling_coach_db;

      // Membership gate (404 OWASP).
      const membership = await db
        .prepare('SELECT 1 AS member FROM club_members WHERE club_id = ? AND athlete_id = ? LIMIT 1')
        .bind(clubId, authResult.athleteId)
        .first();
      if (!membership) {
        return new Response(JSON.stringify({ error: 'not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Rate limit: 5/min/athlete on the new event-ai-draft scope.
      const rl = await checkRateLimit(env, 'event-ai-draft', String(authResult.athleteId), 5, 60);
      if (rl) {
        return new Response(JSON.stringify({ error: 'rate-limited', retry_after_seconds: rl.retryAfter }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) },
        });
      }

      let body;
      try { body = await request.json(); } catch {
        return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const TYPE_ALLOWLIST = new Set(['ride', 'social', 'race']);
      const SURFACE_ALLOWLIST = new Set(['road', 'gravel', 'mixed']);
      const title = (body?.title || '').toString().trim().slice(0, 200);
      const eventType = TYPE_ALLOWLIST.has(body?.event_type) ? body.event_type : 'ride';
      const distanceKm = typeof body?.distance_km === 'number' && body.distance_km > 0 ? body.distance_km : null;
      const speedKmh = typeof body?.expected_avg_speed_kmh === 'number' && body.expected_avg_speed_kmh > 0 ? body.expected_avg_speed_kmh : null;
      const surface = SURFACE_ALLOWLIST.has(body?.surface) ? body.surface : null;
      const startPoint = body?.start_point ? body.start_point.toString().trim().slice(0, 200) : null;
      const location = body?.location ? body.location.toString().trim().slice(0, 200) : null;

      if (!title) {
        return new Response(JSON.stringify({ error: 'title required for draft' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // System-paid key (Sprint 4 ADR — club AI moments are free for users).
      const systemKey = env.SYSTEM_ANTHROPIC_KEY || env.ANTHROPIC_API_KEY;
      if (!systemKey) {
        safeWarn('[draft-description] SYSTEM_ANTHROPIC_KEY not set — endpoint disabled');
        return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const formatLabel = eventType === 'ride' ? 'cycling ride' : eventType === 'race' ? 'race' : 'social meetup';
      const promptLines = [
        'You are drafting a short event description for a cycling club.',
        '',
        `EVENT TITLE: ${title}`,
        `FORMAT: ${formatLabel}`,
      ];
      if (distanceKm) promptLines.push(`DISTANCE: ${distanceKm} km`);
      if (speedKmh) promptLines.push(`EXPECTED PACE: ${speedKmh} km/h average`);
      if (surface) promptLines.push(`SURFACE: ${surface}`);
      if (startPoint) promptLines.push(`START POINT: ${startPoint}`);
      if (location) promptLines.push(`AREA: ${location}`);
      promptLines.push(
        '',
        'Write a 2-3 sentence event description in casual, club-friendly tone. Speak directly to members ("we", "the crew"). Mention pace/effort honestly so newer members know if they can hang. End with one practical detail (coffee stop, regroup point, meet-time reminder) if appropriate.',
        '',
        'Respond with ONLY the description text — no markdown, no quotes, no preface, no labels.',
      );
      const prompt = promptLines.join('\n');

      let aiResp;
      try {
        aiResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': systemKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 250,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
      } catch (e) {
        safeWarn(`[draft-description] Anthropic fetch error: ${e.message}`);
        return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!aiResp.ok) {
        const errText = await aiResp.text().catch(() => '');
        safeWarn(`[draft-description] Anthropic returned ${aiResp.status}: ${errText.slice(0, 200)}`);
        return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let description;
      try {
        const data = await aiResp.json();
        description = data.content?.find((c) => c.type === 'text')?.text?.trim() || '';
      } catch (e) {
        safeWarn(`[draft-description] Anthropic response parse error: ${e.message}`);
        return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!description) {
        return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Cap to 2000 chars (matches club_events.description column upper bound).
      return new Response(JSON.stringify({ description: description.slice(0, 2000) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /api/clubs/:id/overview — single D1 batch powering the Overview tab:
    // club row, 28-day stat aggregations, upcoming events, and latest Circle Note
    // (null in Phase 1; club_circle_notes table lands Phase 5).
    // Membership-gated 404 (OWASP — don't leak existence of clubs the caller
    // isn't in). Slots in alongside /api/clubs/:id/members per architect §B row 1.
    const overviewMatch = url.pathname.match(/^\/api\/clubs\/(\d+)\/overview$/);
    if (overviewMatch && request.method === 'GET') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify(authResult.body), {
          status: authResult.error,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const clubId = parseInt(overviewMatch[1], 10);
      const db = env.cycling_coach_db;
      const now = Math.floor(Date.now() / 1000);
      const twentyEightDaysAgo = now - 28 * 24 * 3600;
      // activities.start_date_local is TEXT (ISO), club_members.joined_at is
      // INTEGER (unix epoch seconds). Use the right form of the cutoff for each.
      const cutoffEpoch = twentyEightDaysAgo;
      const cutoffIso = new Date(twentyEightDaysAgo * 1000).toISOString().slice(0, 19);

      let batchResults;
      try {
        batchResults = await db.batch([
          // [0] Club row + caller's role
          db.prepare(`
            SELECT c.id, c.name, c.description, c.owner_athlete_id, c.invite_code, c.created_at, m.role
            FROM clubs c
            INNER JOIN club_members m ON m.club_id = c.id AND m.athlete_id = ?
            WHERE c.id = ?
            LIMIT 1
          `).bind(authResult.athleteId, clubId),

          // [1] 28-day stat aggregations from activities + new-member count.
          // Schema: activities.moving_time INTEGER seconds (no elapsed_time column);
          //         activities.start_date_local TEXT ISO; club_members.joined_at INTEGER.
          db.prepare(`
            SELECT
              ROUND(COALESCE(SUM(a.moving_time), 0) / 3600.0, 1) AS hours_28d,
              ROUND(COALESCE(SUM(a.distance), 0) / 1000.0, 1)    AS distance_28d,
              COUNT(DISTINCT a.id)                                AS ride_count_28d,
              (SELECT COUNT(*) FROM club_members
               WHERE club_id = ? AND joined_at >= ?)              AS new_members_28d
            FROM activities a
            INNER JOIN club_members cm ON cm.athlete_id = a.athlete_id AND cm.club_id = ?
            WHERE a.start_date_local >= ?
          `).bind(clubId, cutoffEpoch, clubId, cutoffIso),

          // [2] Upcoming events (next 20) + live confirmed_count via LEFT JOIN
          // event_rsvps (Phase 2 — was hardcoded 0 in Phase 1; v9.6.2 hotfix).
          // v9.11.0 (#75): expanded SELECT to return the full event shape so
          // the EventDetailDrawer can render Edit/Cancel UX from the Overview
          // tab too. v9.11.0 (#74): cancelled_at IS NULL filter excludes
          // cancelled events from the upcoming list.
          db.prepare(`
            SELECT
              e.id, e.club_id, e.created_by, e.title, e.description, e.location,
              e.event_date, e.event_type, e.created_at,
              e.distance_km, e.expected_avg_speed_kmh, e.surface, e.start_point,
              e.route_strava_id, e.description_ai_generated, e.cancelled_at, e.duration_minutes,
              COUNT(CASE WHEN r.status = 'going' THEN 1 END) AS confirmed_count
            FROM club_events e
            LEFT JOIN event_rsvps r ON r.event_id = e.id
            WHERE e.club_id = ? AND e.event_date >= ? AND e.cancelled_at IS NULL
            GROUP BY e.id, e.club_id, e.created_by, e.title, e.description, e.location,
                     e.event_date, e.event_type, e.created_at,
                     e.distance_km, e.expected_avg_speed_kmh, e.surface, e.start_point,
                     e.route_strava_id, e.description_ai_generated, e.cancelled_at, e.duration_minutes
            ORDER BY e.event_date ASC
            LIMIT 20
          `).bind(clubId, now),

          // [3] Latest published Circle Note — Phase 1 returns null (table lands Phase 5)
          // Stub: SELECT NULL so batch always has 4 statements; ignored in response.
          db.prepare('SELECT NULL AS stub'),
        ]);
      } catch (e) {
        safeWarn(`[clubs/overview] D1 batch failed for club ${clubId}: ${e.message}`);
        return new Response(JSON.stringify({ error: 'internal error' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // [0] Membership + club row — 404 if the caller is not a member (OWASP).
      const clubRow = batchResults[0]?.results?.[0];
      if (!clubRow) {
        return new Response(JSON.stringify({ error: 'not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // [1] Stat aggregations
      const stats = batchResults[1]?.results?.[0] ?? {};

      // [2] Upcoming events with live confirmed_count from event_rsvps
      // (Phase 2 — v9.6.2 hotfix; Phase 1 had this hardcoded to 0).
      // v9.11.0 (#75): full event shape returned so the drawer can render
      // Edit/Cancel from Overview tap-to-open.
      const upcomingRaw = batchResults[2]?.results ?? [];
      const upcomingEvents = upcomingRaw.map((e) => ({
        id: e.id,
        club_id: e.club_id,
        created_by: e.created_by,
        title: e.title,
        description: e.description ?? null,
        location: e.location ?? null,
        event_date: e.event_date,
        event_type: e.event_type ?? 'ride',
        created_at: e.created_at,
        distance_km: e.distance_km ?? null,
        expected_avg_speed_kmh: e.expected_avg_speed_kmh ?? null,
        surface: e.surface ?? null,
        start_point: e.start_point ?? null,
        route_strava_id: e.route_strava_id ?? null,
        description_ai_generated: e.description_ai_generated ?? 0,
        cancelled_at: e.cancelled_at ?? null,
        duration_minutes: e.duration_minutes ?? null,
        confirmed_count: Number(e.confirmed_count ?? 0),
      }));

      return new Response(JSON.stringify({
        club: {
          id: clubRow.id,
          name: clubRow.name,
          description: clubRow.description ?? null,
          owner_athlete_id: clubRow.owner_athlete_id,
          invite_code: clubRow.invite_code ?? null,
          created_at: clubRow.created_at,
          role: clubRow.role,
        },
        stat_tiles: {
          hours_28d: Number(stats.hours_28d ?? 0),
          distance_28d: Number(stats.distance_28d ?? 0),
          ride_count_28d: Number(stats.ride_count_28d ?? 0),
          new_members_28d: Number(stats.new_members_28d ?? 0),
        },
        upcoming_events: upcomingEvents,
        circle_note: null, // Phase 5: club_circle_notes table + AI draft
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET /api/clubs/:id/members — extended Phase 2 (v9.6.2):
    //   - Server-side FTP mask per ADR-S4.4: caller role 'admin' sees all members'
    //     FTP; otherwise ftp_w is null unless the target member's ftp_visibility='public'.
    //     NOTE: users.ftp_w column does not exist yet (lands with #52 Sprint 5). The
    //     masking logic is wired and ready; server returns null for ftp_w until then.
    //   - Optional sort/dir query params (allowlist: name|role|joined_at, default joined_at DESC).
    //     FTP-sort deferred — requires users.ftp_w column (#52 / Sprint 5).
    const membersMatch = url.pathname.match(/^\/api\/clubs\/(\d+)\/members$/);
    if (membersMatch && request.method === 'GET') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify(authResult.body), {
          status: authResult.error,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const clubId = parseInt(membersMatch[1], 10);
      const db = env.cycling_coach_db;

      // Sort / direction — allowlist guards against SQL injection.
      // FTP sort deliberately absent: users.ftp_w lands in #52 (Sprint 5).
      const SORT_ALLOWLIST = { name: 'u.firstname', role: 'm.role', joined_at: 'm.joined_at' };
      const sortParam = url.searchParams.get('sort') || 'joined_at';
      const dirParam = (url.searchParams.get('dir') || 'desc').toLowerCase();
      const sortCol = SORT_ALLOWLIST[sortParam] || 'm.joined_at';
      const sortDir = dirParam === 'asc' ? 'ASC' : 'DESC';

      const [callerRow, membersResult] = await db.batch([
        db.prepare(
          'SELECT m.role FROM club_members m WHERE m.club_id = ? AND m.athlete_id = ? LIMIT 1',
        ).bind(clubId, authResult.athleteId),
        db.prepare(`
          SELECT u.athlete_id, u.firstname, u.lastname, u.profile_url,
                 u.ftp_visibility,
                 m.role, m.joined_at, m.trend_arrow, m.trend_updated_at
          FROM club_members m
          INNER JOIN users u ON u.athlete_id = m.athlete_id
          WHERE m.club_id = ?
          ORDER BY ${sortCol} ${sortDir}
        `).bind(clubId),
      ]);

      if (!callerRow.results || callerRow.results.length === 0) {
        return new Response(JSON.stringify({ error: 'not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const callerRole = callerRow.results[0].role;
      const callerIsPrivileged = callerRole === 'admin';
      // Phase 5 note: 'pace_setter' role will also be privileged once it ships.

      const members = (membersResult.results || []).map((m) => {
        // ADR-S4.4 FTP mask. ftp_w column absent from schema until #52 ships;
        // always null today. Masking logic is wired so it works transparently
        // when the column appears.
        const ftpVisible = callerIsPrivileged || m.ftp_visibility === 'public';
        return {
          athlete_id: m.athlete_id,
          firstname: m.firstname,
          lastname: m.lastname,
          profile_url: m.profile_url,
          role: m.role,
          joined_at: m.joined_at,
          trend_arrow: m.trend_arrow ?? null,
          trend_updated_at: m.trend_updated_at ?? null,
          // ftp_w: null today (column lands #52); masking applied when it exists.
          ftp_w: ftpVisible ? (m.ftp_w ?? null) : null,
        };
      });

      return new Response(JSON.stringify({ club_id: clubId, members }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST /api/clubs/:id/events/:eventId/rsvp — upsert RSVP state (Phase 2, v9.6.2).
    // Body: { status: 'going' | 'not_going' }. Idempotent via ON CONFLICT DO UPDATE.
    // Returns { status, confirmed_count }. Rate-limited 30/min/athlete on clubs-write scope.
    const rsvpWriteMatch = url.pathname.match(/^\/api\/clubs\/(\d+)\/events\/(\d+)\/rsvp$/);
    if (rsvpWriteMatch && request.method === 'POST') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify(authResult.body), {
          status: authResult.error,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { athleteId } = authResult;
      const clubId = parseInt(rsvpWriteMatch[1], 10);
      const eventId = parseInt(rsvpWriteMatch[2], 10);
      const db = env.cycling_coach_db;

      // Membership gate — 404 on non-member (OWASP: don't leak club existence)
      const membershipRow = await db.prepare(
        'SELECT 1 FROM club_members WHERE club_id = ? AND athlete_id = ? LIMIT 1',
      ).bind(clubId, athleteId).first();
      if (!membershipRow) {
        return new Response(JSON.stringify({ error: 'not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Rate limit — shared clubs-write scope (30/min/athlete).
      // checkRateLimit returns null when under threshold; { retryAfter } when over.
      const rl = await checkRateLimit(env, 'clubs-write', String(athleteId), 30, 60);
      if (rl) {
        return new Response(JSON.stringify({ error: 'rate-limited', retry_after_seconds: rl.retryAfter }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) },
        });
      }

      let body;
      try { body = await request.json(); } catch { body = {}; }
      const { status } = body;
      if (status !== 'going' && status !== 'not_going') {
        return new Response(JSON.stringify({ error: 'status must be "going" or "not_going"' }), {
          status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const now = Math.floor(Date.now() / 1000);
      // UPSERT — idempotent. Re-posting same status is safe.
      await db.prepare(`
        INSERT INTO event_rsvps (event_id, athlete_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(event_id, athlete_id) DO UPDATE
          SET status = excluded.status, updated_at = excluded.updated_at
      `).bind(eventId, athleteId, status, now, now).run();

      const countRow = await db.prepare(
        "SELECT COUNT(*) AS cnt FROM event_rsvps WHERE event_id = ? AND status = 'going'",
      ).bind(eventId).first();

      return new Response(JSON.stringify({
        status,
        confirmed_count: Number(countRow?.cnt ?? 0),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /api/clubs/:id/events/:eventId/rsvps — confirmed count + top-12 avatars (Phase 2).
    // ADR-S4.5: visible to all members (no FTP in this payload).
    const rsvpReadMatch = url.pathname.match(/^\/api\/clubs\/(\d+)\/events\/(\d+)\/rsvps$/);
    if (rsvpReadMatch && request.method === 'GET') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify(authResult.body), {
          status: authResult.error,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { athleteId } = authResult;
      const clubId = parseInt(rsvpReadMatch[1], 10);
      const eventId = parseInt(rsvpReadMatch[2], 10);
      const db = env.cycling_coach_db;

      // Membership gate
      const membershipRow = await db.prepare(
        'SELECT 1 FROM club_members WHERE club_id = ? AND athlete_id = ? LIMIT 1',
      ).bind(clubId, athleteId).first();
      if (!membershipRow) {
        return new Response(JSON.stringify({ error: 'not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const [countRow, avatarRows] = await db.batch([
        db.prepare(
          "SELECT COUNT(*) AS cnt FROM event_rsvps WHERE event_id = ? AND status = 'going'",
        ).bind(eventId),
        db.prepare(`
          SELECT r.athlete_id, u.firstname, u.profile_url
          FROM event_rsvps r
          INNER JOIN users u ON u.athlete_id = r.athlete_id
          WHERE r.event_id = ? AND r.status = 'going'
          ORDER BY r.created_at ASC
          LIMIT 12
        `).bind(eventId),
      ]);

      return new Response(JSON.stringify({
        confirmed_count: Number(countRow.results?.[0]?.cnt ?? 0),
        avatars: avatarRows.results ?? [],
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /api/me/schedule?range=YYYY-MM — Personal scheduler (Sprint 5).
    // v9.11.0 (#61): clubs-only aggregation.
    // v9.12.0 (#76 + #77): now returns BOTH streams in a single batch:
    //   - club_events: events I'm going to OR I created (existing)
    //   - planned_sessions: my personal training sessions (NEW table from
    //     migration 0008)
    // Cancelled events/sessions excluded per #74. 5-min edge cache.
    if (url.pathname === '/api/me/schedule' && request.method === 'GET') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify(authResult.body), {
          status: authResult.error,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const rangeParam = url.searchParams.get('range');
      const rangeMatch = rangeParam?.match(/^(\d{4})-(\d{2})$/);
      if (!rangeMatch) {
        return new Response(JSON.stringify({ error: 'range must be YYYY-MM (e.g. 2026-05)' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const yr = parseInt(rangeMatch[1], 10);
      const mo = parseInt(rangeMatch[2], 10);
      if (yr < 2000 || yr > 2100 || mo < 1 || mo > 12) {
        return new Response(JSON.stringify({ error: 'range out of bounds' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // v10.10.3 — pad the month range by 7 days each side so week views
      // that span month boundaries (e.g., Apr 27 - May 3 = "2026-05" range
      // but Apr 27 falls outside) include the boundary days. Founder bug:
      // session created Apr 27 not visible when current week was visible.
      // Frontend de-dupes by id; over-fetching is safe.
      const PAD_SEC = 7 * 86400;
      const startEpoch = Math.floor(Date.UTC(yr, mo - 1, 1) / 1000) - PAD_SEC;
      const endEpoch = Math.floor(Date.UTC(yr, mo, 1) / 1000) - 1 + PAD_SEC;
      const db = env.cycling_coach_db;

      const { results: rows } = await db.prepare(
        'SELECT DISTINCT ' +
        '  e.id, e.club_id, e.created_by, e.title, e.description, e.location, ' +
        '  e.event_date, e.event_type, e.created_at, ' +
        '  e.distance_km, e.expected_avg_speed_kmh, e.surface, e.start_point, ' +
        '  e.route_strava_id, e.description_ai_generated, e.cancelled_at, e.duration_minutes, ' +
        '  c.name AS club_name, ' +
        '  (SELECT COUNT(*) FROM event_rsvps r2 WHERE r2.event_id = e.id AND r2.status = \'going\') AS confirmed_count, ' +
        '  CASE WHEN e.created_by = ? THEN 1 ELSE 0 END AS is_creator, ' +
        '  CASE WHEN my_rsvp.status = \'going\' THEN 1 ELSE 0 END AS is_going ' +
        'FROM club_events e ' +
        'INNER JOIN clubs c ON c.id = e.club_id ' +
        'INNER JOIN club_members me ON me.club_id = e.club_id AND me.athlete_id = ? ' +
        'LEFT JOIN event_rsvps my_rsvp ON my_rsvp.event_id = e.id AND my_rsvp.athlete_id = ? ' +
        'WHERE e.event_date BETWEEN ? AND ? ' +
        '  AND e.cancelled_at IS NULL ' +
        '  AND (e.created_by = ? OR my_rsvp.status = \'going\') ' +
        'ORDER BY e.event_date ASC ' +
        'LIMIT 200',
      ).bind(authResult.athleteId, authResult.athleteId, authResult.athleteId,
             startEpoch, endEpoch, authResult.athleteId).all();

      const events = (rows || []).map((e) => ({
        id: e.id,
        club_id: e.club_id,
        club_name: e.club_name ?? null,
        created_by: e.created_by,
        title: e.title,
        description: e.description ?? null,
        location: e.location ?? null,
        event_date: e.event_date,
        event_type: e.event_type ?? 'ride',
        created_at: e.created_at,
        distance_km: e.distance_km ?? null,
        expected_avg_speed_kmh: e.expected_avg_speed_kmh ?? null,
        surface: e.surface ?? null,
        start_point: e.start_point ?? null,
        route_strava_id: e.route_strava_id ?? null,
        description_ai_generated: e.description_ai_generated ?? 0,
        cancelled_at: e.cancelled_at ?? null,
        duration_minutes: e.duration_minutes ?? null,
        confirmed_count: Number(e.confirmed_count ?? 0),
        is_creator: !!e.is_creator,
        is_going: !!e.is_going,
      }));

      // v9.12.0 — second stream: personal planned sessions in the same range.
      const { results: sessionRows } = await db.prepare(
        'SELECT id, athlete_id, session_date, title, description, zone, ' +
        '       duration_minutes, target_watts, source, ai_report_id, ' +
        '       completed_at, cancelled_at, ai_plan_session_id, ' +
        '       elevation_gained, surface, user_edited_at, ' +
        '       recurring_group_id, created_at, updated_at ' +
        'FROM planned_sessions ' +
        'WHERE athlete_id = ? AND session_date BETWEEN ? AND ? ' +
        '  AND cancelled_at IS NULL ' +
        'ORDER BY session_date ASC',
      ).bind(authResult.athleteId, startEpoch, endEpoch).all();
      const planned_sessions = (sessionRows || []).map(mapSessionRow);

      return new Response(JSON.stringify({
        athlete_id: authResult.athleteId,
        range: { year: yr, month: mo, start: startEpoch, end: endEpoch },
        club_events: events,    // v9.12.0 rename: was `events` in v9.11.0
        planned_sessions,
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          // v10.11.2 — see /api/clubs/:id/events comment. No browser cache.
          'Cache-Control': 'private, no-store',
        },
      });
    }

    // GET /api/me/sessions?range=YYYY-MM — list personal planned sessions for
    // the requested month. Sprint 5 / v9.12.0 (#76).
    if (url.pathname === '/api/me/sessions' && request.method === 'GET') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify(authResult.body), {
          status: authResult.error,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const rangeParam = url.searchParams.get('range');
      const m = rangeParam?.match(/^(\d{4})-(\d{2})$/);
      if (!m) {
        return new Response(JSON.stringify({ error: 'range must be YYYY-MM' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const yr = parseInt(m[1], 10), mo = parseInt(m[2], 10);
      if (yr < 2000 || yr > 2100 || mo < 1 || mo > 12) {
        return new Response(JSON.stringify({ error: 'range out of bounds' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // v10.10.3 — pad the month range by 7 days each side so week views
      // that span month boundaries (e.g., Apr 27 - May 3 = "2026-05" range
      // but Apr 27 falls outside) include the boundary days. Founder bug:
      // session created Apr 27 not visible when current week was visible.
      // Frontend de-dupes by id; over-fetching is safe.
      const PAD_SEC = 7 * 86400;
      const startEpoch = Math.floor(Date.UTC(yr, mo - 1, 1) / 1000) - PAD_SEC;
      const endEpoch = Math.floor(Date.UTC(yr, mo, 1) / 1000) - 1 + PAD_SEC;
      const db = env.cycling_coach_db;
      const { results: rows } = await db.prepare(
        'SELECT id, athlete_id, session_date, title, description, zone, ' +
        '       duration_minutes, target_watts, source, ai_report_id, ' +
        '       completed_at, cancelled_at, ai_plan_session_id, ' +
        '       elevation_gained, surface, user_edited_at, ' +
        '       recurring_group_id, created_at, updated_at ' +
        'FROM planned_sessions ' +
        'WHERE athlete_id = ? AND session_date BETWEEN ? AND ? ' +
        'ORDER BY session_date ASC',
      ).bind(authResult.athleteId, startEpoch, endEpoch).all();
      return new Response(JSON.stringify({
        athlete_id: authResult.athleteId,
        range: { year: yr, month: mo, start: startEpoch, end: endEpoch },
        sessions: (rows || []).map(mapSessionRow),
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          // v10.11.2 — see /api/clubs/:id/events comment. No browser cache.
          'Cache-Control': 'private, no-store',
        },
      });
    }

    // ============= RIDE WITH GPS OAUTH + ROUTES — v10.6.0 =============
    // Mirrors the Strava OAuth flow at /authorize → /callback. RWGPS is a
    // second route source for the picker (alongside Strava saved + ORS-
    // generated). Each user connects once; tokens stored in rwgps_tokens
    // (Migration 0010). All five endpoints disabled-if-not-configured.
    const rwgpsDeps = { resolveAthleteId, checkRateLimit, safeWarn, corsHeaders };
    if (url.pathname === '/authorize-rwgps' && request.method === 'GET') {
      return handleAuthorizeRwgps({ request, env, deps: rwgpsDeps });
    }
    if (url.pathname === '/callback-rwgps' && request.method === 'GET') {
      return handleCallbackRwgps({ request, env, deps: rwgpsDeps });
    }
    if (url.pathname === '/api/rwgps/status' && request.method === 'GET') {
      return handleRwgpsStatus({ request, env, deps: rwgpsDeps });
    }
    if (url.pathname === '/api/rwgps/disconnect' && request.method === 'POST') {
      return handleRwgpsDisconnect({ request, env, deps: rwgpsDeps });
    }
    if (url.pathname === '/api/routes/rwgps-saved' && request.method === 'GET') {
      return handleRwgpsRoutes({ request, env, deps: rwgpsDeps });
    }

    // GET /api/auth/strava-status — v10.9.0.
    // Reports whether the authenticated athlete has a server-side Strava
    // token row (i.e. completed the post-v10.9.0 hybrid migration). UI
    // surfaces this on Train tab so the user knows when auto-regen is
    // active vs. manual-only.
    if (url.pathname === '/api/auth/strava-status' && request.method === 'GET') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify(authResult.body), {
          status: authResult.error,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const row = await env.cycling_coach_db
        .prepare('SELECT expires_at FROM strava_tokens WHERE athlete_id = ? LIMIT 1')
        .bind(authResult.athleteId)
        .first();
      return new Response(JSON.stringify({
        server_side: !!row,
        expires_at: row?.expires_at ?? null,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============= AI PLAN — v10.8.0 Phase A =============
    // Goal-driven AI training plan generation. Reads goal + recent rides
    // + user prefs from D1, calls Anthropic Haiku, persists to ai_plan_sessions.
    // Phase B (next release) wires POST /api/plan/schedule into the calendar.
    // Phase C (v10.8.2) integrates with Today tab + route picker.
    // Phase D (v10.8.3) adds Strava-webhook-triggered cascade-update.
    const planDeps = { resolveAthleteId, checkRateLimit, safeWarn, corsHeaders };
    if (url.pathname === '/api/plan/generate' && request.method === 'POST') {
      return handlePlanGenerate({ request, env, deps: planDeps });
    }
    if (url.pathname === '/api/plan/current' && request.method === 'GET') {
      return handlePlanCurrent({ request, env, deps: planDeps });
    }
    if (url.pathname === '/api/plan/schedule' && request.method === 'POST') {
      return handlePlanSchedule({ request, env, deps: planDeps });
    }

    // POST /api/routes/generate — Sprint 5+ / v10.4.0.
    // OSM-based loop route generation via OpenRouteService. Returns 3-5
    // candidate routes scored against (distance / surface / elevation /
    // overlap). Auth + rate-limited (10/h/athlete) + KV-cached (24h).
    // Full design in docs/route-generation-service.md.
    if (url.pathname === '/api/routes/generate' && request.method === 'POST') {
      return handleRoutesGenerate({
        request,
        env,
        ctx,
        deps: { resolveAthleteId, checkRateLimit, safeWarn, corsHeaders },
      });
    }

    // POST /api/me/sessions — create a manual session (Sprint 5 / v9.12.0, #76).
    if (url.pathname === '/api/me/sessions' && request.method === 'POST') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify(authResult.body), {
          status: authResult.error,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const rl = await checkRateLimit(env, 'me-sessions-write', String(authResult.athleteId), 30, 60);
      if (rl) {
        return new Response(JSON.stringify({ error: 'rate-limited', retry_after_seconds: rl.retryAfter }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) },
        });
      }
      let body;
      try { body = await request.json(); } catch {
        return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const title = (body?.title || '').toString().trim().slice(0, 200);
      const description = body?.description ? body.description.toString().trim().slice(0, 2000) : null;
      const sessionDateRaw = body?.session_date;
      const sessionDate = typeof sessionDateRaw === 'number'
        ? Math.floor(sessionDateRaw)
        : sessionDateRaw ? Math.floor(new Date(sessionDateRaw).getTime() / 1000) : NaN;
      const zone = typeof body?.zone === 'number' && body.zone >= 1 && body.zone <= 7 ? body.zone : null;
      const duration = typeof body?.duration_minutes === 'number' && body.duration_minutes >= 0 && body.duration_minutes <= 600
        ? Math.floor(body.duration_minutes) : null;
      const watts = typeof body?.target_watts === 'number' && body.target_watts >= 0 && body.target_watts <= 2000
        ? Math.floor(body.target_watts) : null;
      const SOURCE_ALLOWLIST = new Set(['manual', 'ai-coach', 'imported']);
      const source = SOURCE_ALLOWLIST.has(body?.source) ? body.source : 'manual';
      // v10.12.0 — optional recurring_group_id ties this session to siblings
      // for the repeat-weekly feature. Hex string, 8-32 chars; null when
      // standalone. Frontend generates a random group id when creating a
      // multi-week repeat batch and passes it on every iteration.
      const recurringGroupId = typeof body?.recurring_group_id === 'string'
        && /^[a-f0-9]{8,32}$/i.test(body.recurring_group_id)
        ? body.recurring_group_id
        : null;

      if (!title) {
        return new Response(JSON.stringify({ error: 'title required (1-200 chars)' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!Number.isFinite(sessionDate) || sessionDate < 0) {
        return new Response(JSON.stringify({ error: 'session_date required (ISO string or unix seconds)' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const now = Math.floor(Date.now() / 1000);
      const fiveYears = 5 * 365 * 24 * 3600;
      if (sessionDate < now - fiveYears || sessionDate > now + fiveYears) {
        return new Response(JSON.stringify({ error: 'session_date out of range (±5 years)' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const inserted = await env.cycling_coach_db
        .prepare(
          'INSERT INTO planned_sessions (athlete_id, session_date, title, description, zone, ' +
          '  duration_minutes, target_watts, source, recurring_group_id, created_at, updated_at) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
        )
        .bind(authResult.athleteId, sessionDate, title, description, zone, duration, watts, source, recurringGroupId, now, now)
        .first();
      if (!inserted?.id) {
        safeWarn(`[me/sessions] insert returned no id for athlete ${authResult.athleteId}`);
        return new Response(JSON.stringify({ error: 'session creation failed' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        id: inserted.id,
        athlete_id: authResult.athleteId,
        session_date: sessionDate,
        title,
        description,
        zone,
        duration_minutes: duration,
        target_watts: watts,
        source,
        ai_report_id: null,
        completed_at: null,
        cancelled_at: null,
        created_at: now,
        updated_at: now,
      }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============================================================
    // Sprint 13 / v11.1.0 — credentials substrate.
    //
    // POST   /api/me/passphrase/setup   — first-time passphrase setup
    // POST   /api/me/passphrase/recover — recovery code → return salt + nuke ciphertexts
    // GET    /api/me/credentials        — list ciphertexts for this athlete
    // PATCH  /api/me/credentials        — upsert one provider's ciphertext
    // DELETE /api/me/credentials/:provider — remove one provider's ciphertext
    //
    // The Worker stores ciphertext + IV + salt only. Decryption happens
    // in the browser; the master key never crosses this boundary.
    // See docs/post-demo-sprint/sprint-13/adr-credentials-substrate.md.
    // ============================================================

    if (url.pathname === '/api/me/passphrase/setup' && request.method === 'POST') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: authResult.error,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      let body;
      try { body = await request.json(); } catch {
        return new Response(JSON.stringify({ error: 'invalid_body' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!body || typeof body.recovery_code_hash !== 'string'
          || typeof body.passphrase_set_at !== 'number') {
        return new Response(JSON.stringify({ error: 'invalid_body' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      await env.cycling_coach_db.prepare(
        'UPDATE users SET recovery_code_hash = ?, passphrase_set_at = ? WHERE athlete_id = ?',
      ).bind(body.recovery_code_hash, body.passphrase_set_at, authResult.athleteId).run();
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/api/me/passphrase/recover' && request.method === 'POST') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: authResult.error,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      let body;
      try { body = await request.json(); } catch {
        return new Response(JSON.stringify({ error: 'invalid_body' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!body || typeof body.recovery_code_hash !== 'string') {
        return new Response(JSON.stringify({ error: 'invalid_body' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const row = await env.cycling_coach_db.prepare(
        'SELECT recovery_code_hash FROM users WHERE athlete_id = ?',
      ).bind(authResult.athleteId).first();
      if (!row || row.recovery_code_hash !== body.recovery_code_hash) {
        return new Response(JSON.stringify({ error: 'recovery_failed' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // On match: clear hash + nuke ciphertexts. Old master key is gone with
      // the passphrase; ciphertexts are unrecoverable garbage.
      await env.cycling_coach_db.batch([
        env.cycling_coach_db.prepare(
          'UPDATE users SET recovery_code_hash = NULL, passphrase_set_at = NULL WHERE athlete_id = ?',
        ).bind(authResult.athleteId),
        env.cycling_coach_db.prepare(
          'DELETE FROM user_credentials WHERE athlete_id = ?',
        ).bind(authResult.athleteId),
      ]);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/api/me/credentials' && request.method === 'GET') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: authResult.error,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { results: rows } = await env.cycling_coach_db.prepare(
        'SELECT provider, managed, ciphertext, iv, kdf_salt, kdf_iterations, updated_at ' +
        'FROM user_credentials WHERE athlete_id = ?',
      ).bind(authResult.athleteId).all();
      const items = (rows ?? []).map((r) => ({
        provider: r.provider,
        managed: !!r.managed,
        ciphertext: r.managed ? null : bufToB64(r.ciphertext),
        iv: r.managed ? null : bufToB64(r.iv),
        kdf_salt: bufToB64(r.kdf_salt),
        kdf_iterations: r.kdf_iterations,
        updated_at: r.updated_at,
      }));
      return new Response(JSON.stringify({ items }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/api/me/credentials' && request.method === 'PATCH') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: authResult.error,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      let body;
      try { body = await request.json(); } catch {
        return new Response(JSON.stringify({ error: 'invalid_body' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!body || typeof body.provider !== 'string'
          || typeof body.ciphertext !== 'string'
          || typeof body.iv !== 'string'
          || typeof body.kdf_salt !== 'string'
          || typeof body.kdf_iterations !== 'number') {
        return new Response(JSON.stringify({ error: 'invalid_body' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const now = Math.floor(Date.now() / 1000);
      await env.cycling_coach_db.prepare(
        'INSERT INTO user_credentials ' +
        '  (athlete_id, provider, managed, ciphertext, iv, kdf_salt, kdf_iterations, created_at, updated_at) ' +
        'VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(athlete_id, provider) DO UPDATE SET ' +
        '  ciphertext = excluded.ciphertext, ' +
        '  iv = excluded.iv, ' +
        '  kdf_salt = excluded.kdf_salt, ' +
        '  kdf_iterations = excluded.kdf_iterations, ' +
        '  updated_at = excluded.updated_at',
      ).bind(
        authResult.athleteId, body.provider,
        b64ToBuf(body.ciphertext), b64ToBuf(body.iv),
        b64ToBuf(body.kdf_salt), body.kdf_iterations,
        now, now,
      ).run();
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const credDelMatch = url.pathname.match(/^\/api\/me\/credentials\/([a-z0-9-]+)$/i);
    if (credDelMatch && request.method === 'DELETE') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: authResult.error,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const provider = credDelMatch[1];
      await env.cycling_coach_db.prepare(
        'DELETE FROM user_credentials WHERE athlete_id = ? AND provider = ?',
      ).bind(authResult.athleteId, provider).run();
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PATCH /api/me/sessions/:id — partial update; own-only (Sprint 5 / v9.12.0, #76).
    // POST /api/me/sessions/:id/cancel — soft-delete; idempotent.
    // POST /api/me/sessions/:id/uncancel — restore.
    const sessionByIdMatch = url.pathname.match(/^\/api\/me\/sessions\/(\d+)(\/cancel|\/uncancel)?$/);
    if (sessionByIdMatch && (request.method === 'PATCH' || request.method === 'POST')) {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify(authResult.body), {
          status: authResult.error,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const sessionId = parseInt(sessionByIdMatch[1], 10);
      const action = sessionByIdMatch[2];
      const db = env.cycling_coach_db;
      const existing = await db
        .prepare('SELECT id, athlete_id, cancelled_at FROM planned_sessions WHERE id = ? LIMIT 1')
        .bind(sessionId)
        .first();
      // 404 OWASP: don't leak existence — same response whether session
      // doesn't exist OR belongs to another user.
      if (!existing || existing.athlete_id !== authResult.athleteId) {
        return new Response(JSON.stringify({ error: 'not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const rl = await checkRateLimit(env, 'me-sessions-write', String(authResult.athleteId), 30, 60);
      if (rl) {
        return new Response(JSON.stringify({ error: 'rate-limited', retry_after_seconds: rl.retryAfter }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) },
        });
      }
      const now = Math.floor(Date.now() / 1000);
      // Cancel/uncancel = idempotent state toggle.
      if (action === '/cancel') {
        if (existing.cancelled_at) {
          return new Response(JSON.stringify({ id: sessionId, cancelled_at: existing.cancelled_at, already_cancelled: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        // Sprint 11 sec audit (#sec-1) — defense-in-depth: scope every
        // mutation by athlete_id, NOT just id. The pre-check above (lines
        // 1757-1767) already returns 404 when athlete_id mismatches, but
        // belt-and-braces — any future refactor that drops the pre-check
        // (or introduces a TOCTOU window) would otherwise let one user
        // mutate another user's row. Same pattern applied to PATCH and
        // /uncancel below.
        await db.prepare('UPDATE planned_sessions SET cancelled_at = ?, updated_at = ? WHERE id = ? AND athlete_id = ?')
          .bind(now, now, sessionId, authResult.athleteId).run();
        return new Response(JSON.stringify({ id: sessionId, cancelled_at: now }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (action === '/uncancel') {
        await db.prepare('UPDATE planned_sessions SET cancelled_at = NULL, updated_at = ? WHERE id = ? AND athlete_id = ?')
          .bind(now, sessionId, authResult.athleteId).run();
        return new Response(JSON.stringify({ id: sessionId, cancelled_at: null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // PATCH: allowlisted partial update.
      if (request.method !== 'PATCH') {
        return new Response(JSON.stringify({ error: 'method not allowed' }), {
          status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      let body;
      try { body = await request.json(); } catch {
        return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const SOURCE_ALLOWLIST = new Set(['manual', 'ai-coach', 'imported']);
      const updates = [];
      const params = [];
      const applied = {};
      const apply = (key, sqlCol, parser) => {
        if (key in body) {
          const v = parser(body[key]);
          if (v === undefined) return;
          updates.push(`${sqlCol} = ?`);
          params.push(v);
          applied[sqlCol] = v;
        }
      };
      apply('title', 'title', (v) => { const s = String(v || '').trim(); return s && s.length <= 200 ? s : undefined; });
      apply('description', 'description', (v) => v == null || v === '' ? null : String(v).trim().slice(0, 2000));
      apply('session_date', 'session_date', (v) => {
        const n = typeof v === 'number' ? Math.floor(v) : v ? Math.floor(new Date(v).getTime() / 1000) : NaN;
        return Number.isFinite(n) && n > 0 ? n : undefined;
      });
      apply('zone', 'zone', (v) => v === null ? null : (typeof v === 'number' && v >= 1 && v <= 7 ? Math.floor(v) : undefined));
      apply('duration_minutes', 'duration_minutes', (v) => v === null ? null : (typeof v === 'number' && v >= 0 && v <= 600 ? Math.floor(v) : undefined));
      apply('target_watts', 'target_watts', (v) => v === null ? null : (typeof v === 'number' && v >= 0 && v <= 2000 ? Math.floor(v) : undefined));
      apply('source', 'source', (v) => SOURCE_ALLOWLIST.has(v) ? v : undefined);
      apply('completed_at', 'completed_at', (v) => v === null ? null : (typeof v === 'number' && v > 0 ? Math.floor(v) : undefined));
      // v10.9.0 — extended fields from AI plan integration.
      apply('elevation_gained', 'elevation_gained', (v) => v === null ? null : (typeof v === 'number' && v >= 0 && v <= 20000 ? Math.floor(v) : undefined));
      apply('surface', 'surface', (v) => v === null ? null : (typeof v === 'string' && v.length <= 32 ? v : undefined));
      if (updates.length === 0) {
        return new Response(JSON.stringify({ error: 'no patchable fields' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // v10.9.0 — user_edited_at lock. Any field mutation marks the row
      // as user-touched so Phase D auto-regen skips it. Excludes the
      // completed_at flip (mark-done isn't a structural edit). The lock
      // is set on the FIRST user edit only; subsequent edits don't reset.
      const isOnlyCompletedAt = updates.length === 1 && updates[0]?.startsWith('completed_at');
      if (!isOnlyCompletedAt) {
        updates.push('user_edited_at = COALESCE(user_edited_at, ?)');
        params.push(now);
      }
      updates.push('updated_at = ?');
      params.push(now);

      // v10.12.0 — repeat-group cascade. ?cascade=group propagates the
      // PATCH to every sibling session sharing this row's recurring_group_id
      // (forward-only: only sessions on this date or later, so past rides
      // aren't retroactively edited). Used by drawer's "Edit all upcoming"
      // button. NULL recurring_group_id = behaves as single-session edit.
      const cascade = url.searchParams.get('cascade') === 'group';
      if (cascade) {
        // Look up this session's group + date.
        const me = await db.prepare(
          'SELECT recurring_group_id, session_date FROM planned_sessions WHERE id = ? AND athlete_id = ? LIMIT 1',
        ).bind(sessionId, authResult.athleteId).first();
        if (!me?.recurring_group_id) {
          // Cascade requested but session has no group — fall back to single-row update.
          params.push(sessionId);
          await db.prepare(
            `UPDATE planned_sessions SET ${updates.join(', ')} WHERE id = ? AND athlete_id = ?`,
          ).bind(...params, authResult.athleteId).run();
          return new Response(JSON.stringify({
            id: sessionId, ...applied, updated_at: now, cascaded: 0,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        // Cascade: every sibling on or after this session's date, owned by
        // the same athlete, where the user hasn't manually edited (so the
        // cascade respects user_edited_at locks from v10.9.0). The session
        // _itself_ always updates (we want the user's edit applied).
        // Two queries: one for self (always), one for siblings (gated).
        // For siblings, we shift session_date by the same delta as the
        // user's edit if session_date was changed, OR keep their dates
        // intact if not. Simpler v1: skip session_date in cascade to avoid
        // moving sibling dates around unintentionally.
        const cascadeUpdates = updates.filter((u) => !u.startsWith('session_date'));
        const cascadeParams = params.filter((_, i) => !updates[i]?.startsWith('session_date'));
        // Self update (with session_date if user changed it)
        await db.prepare(
          `UPDATE planned_sessions SET ${updates.join(', ')} WHERE id = ? AND athlete_id = ?`,
        ).bind(...params, sessionId, authResult.athleteId).run();
        // Sibling cascade — exclude self (already updated), respect user_edited_at lock
        const cascadeRes = await db.prepare(
          `UPDATE planned_sessions SET ${cascadeUpdates.join(', ')}
           WHERE recurring_group_id = ?
             AND athlete_id = ?
             AND id != ?
             AND session_date >= ?
             AND user_edited_at IS NULL
             AND completed_at IS NULL
             AND cancelled_at IS NULL`,
        ).bind(...cascadeParams, me.recurring_group_id, authResult.athleteId, sessionId, me.session_date).run();
        return new Response(JSON.stringify({
          id: sessionId,
          ...applied,
          updated_at: now,
          cascaded: cascadeRes?.meta?.changes ?? 0,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Sprint 11 sec audit (#sec-1) — defense-in-depth: scope by
      // athlete_id, not just id. See note on /cancel branch above.
      params.push(sessionId, authResult.athleteId);
      await db.prepare(`UPDATE planned_sessions SET ${updates.join(', ')} WHERE id = ? AND athlete_id = ?`).bind(...params).run();
      return new Response(JSON.stringify({ id: sessionId, ...applied, updated_at: now }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PATCH /api/users/me/profile — update user profile fields (Phase 2, v9.6.2).
    // Column allowlist enforced in handler: never interpolate user-supplied column names.
    // Currently supports: ftp_visibility ('private'|'public'). Extensible.
    // Rate-limited 10/min/athlete on profile-write scope.
    if (url.pathname === '/api/users/me/profile' && request.method === 'PATCH') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify(authResult.body), {
          status: authResult.error,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { athleteId } = authResult;
      const db = env.cycling_coach_db;

      // checkRateLimit returns null when under threshold; { retryAfter } when over.
      const rl = await checkRateLimit(env, 'profile-write', String(athleteId), 10, 60);
      if (rl) {
        return new Response(JSON.stringify({ error: 'rate-limited', retry_after_seconds: rl.retryAfter }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) },
        });
      }

      let body;
      try { body = await request.json(); } catch { body = {}; }

      // Column allowlist — NEVER interpolate user-supplied column names into SQL.
      const PROFILE_ALLOWLIST = new Set(['ftp_visibility']);
      const updates = {};
      for (const key of Object.keys(body)) {
        if (!PROFILE_ALLOWLIST.has(key)) {
          return new Response(JSON.stringify({ error: `field '${key}' is not updatable via this endpoint` }), {
            status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        updates[key] = body[key];
      }
      if (Object.keys(updates).length === 0) {
        return new Response(JSON.stringify({ error: 'no updatable fields provided' }), {
          status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate ftp_visibility value if present
      if ('ftp_visibility' in updates && updates.ftp_visibility !== 'private' && updates.ftp_visibility !== 'public') {
        return new Response(JSON.stringify({ error: 'ftp_visibility must be "private" or "public"' }), {
          status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Build SET clause using only allowlisted column names (safe — keys validated above).
      const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
      const values = [...Object.values(updates), athleteId];
      await db.prepare(`UPDATE users SET ${setClauses} WHERE athlete_id = ?`).bind(...values).run();

      const updatedRow = await db.prepare(
        'SELECT athlete_id, ftp_visibility FROM users WHERE athlete_id = ? LIMIT 1',
      ).bind(athleteId).first();

      return new Response(JSON.stringify({
        athlete_id: updatedRow?.athlete_id ?? athleteId,
        ftp_visibility: updatedRow?.ftp_visibility ?? 'private',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============= ROUTES (#47 Phase 1, v9.3.0) =============
    // GET /api/routes/saved — proxies Strava /athlete/routes with worker-side
    // filtering by surface, distance (±20% band), and difficulty (m/km bands).
    // Strava's saved-routes shape doesn't always carry a surface attribute;
    // we infer from sub_type when present and fall back to 'unknown'.
    // 'unknown' surface always passes the filter (graceful degradation per spec).
    //
    // v10.13.0 (Sprint 11 bug 2): two layered fixes after the founder
    // reported "Path of Gods (Positano hike)" appearing for a Zurich
    // session.
    //   1. Type filter — Strava's SummaryRoute has `type` (1 = Ride,
    //      2 = Run/Hike). Path-of-Gods is type 2. Filter to type === 1.
    //   2. Anchor-relevance gate — when the client passes ?lat=&lng=
    //      query params (the geocoded session anchor), reject routes
    //      whose first geometry point is more than 50 km away from the
    //      anchor. 50 km is loose enough to handle Strava saved routes
    //      starting at "the next town over" (Strava saved routes don't
    //      always anchor at the user's home — some are Sunday-ride
    //      routes from a friend's house) but tight enough to throw out
    //      "1000 km away" trash. Documented in SPRINT_11_BUGS_REPORT.md.
    if (url.pathname === '/api/routes/saved' && request.method === 'GET') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const auth = request.headers.get('Authorization');
      const surface = (url.searchParams.get('surface') || 'any').toLowerCase();
      const distanceParam = url.searchParams.get('distance');
      const distanceKm = distanceParam ? parseInt(distanceParam, 10) : null;
      const difficulty = (url.searchParams.get('difficulty') || '').toLowerCase();

      // v10.13.0 Sprint 11 bug 2: anchor-relevance ranking inputs.
      const anchorLatParam = url.searchParams.get('lat');
      const anchorLngParam = url.searchParams.get('lng');
      const anchorLat = anchorLatParam !== null ? Number(anchorLatParam) : null;
      const anchorLng = anchorLngParam !== null ? Number(anchorLngParam) : null;
      const hasAnchor =
        Number.isFinite(anchorLat) && Number.isFinite(anchorLng) &&
        anchorLat >= -90 && anchorLat <= 90 &&
        anchorLng >= -180 && anchorLng <= 180;
      // Sane radius for Strava saved routes (see top-of-handler comment).
      const STRAVA_ANCHOR_RADIUS_KM = 50;

      let stravaRoutes;
      try {
        const stravaResp = await fetch(
          'https://www.strava.com/api/v3/athlete/routes?per_page=200',
          { headers: { Authorization: auth } },
        );
        if (!stravaResp.ok) {
          safeWarn(`[routes] Strava /athlete/routes returned ${stravaResp.status}`);
          return new Response(JSON.stringify({ error: 'strava unavailable' }), {
            status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        stravaRoutes = await stravaResp.json();
      } catch (e) {
        safeWarn(`[routes] Strava fetch error: ${e.message}`);
        return new Response(JSON.stringify({ error: 'internal error' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!Array.isArray(stravaRoutes)) {
        safeWarn('[routes] Strava response was not an array');
        return new Response(JSON.stringify({ error: 'strava unavailable' }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Strava SummaryRoute.sub_type: 1 road, 2 MTB, 3 cross, 4 trail, 5 mixed.
      // Best-effort map to our surface vocabulary.
      const inferSurface = (route) => {
        if (route.surface_type) {
          const t = typeof route.surface_type === 'number' ? route.surface_type : null;
          if (t === 2 || t === 3) return 'paved';
          if (t === 4 || t === 5) return 'gravel';
        }
        if (typeof route.surface === 'string') {
          const lower = route.surface.toLowerCase();
          if (lower.includes('paved')) return 'paved';
          if (lower.includes('dirt') || lower.includes('gravel') || lower.includes('unpaved')) return 'gravel';
        }
        if (route.sub_type === 1) return 'paved';
        if (route.sub_type === 2 || route.sub_type === 4) return 'gravel';
        return 'unknown';
      };

      // v10.13.0 — decode the first lat/lng of an encoded polyline so
      // we can rank Strava saved routes by anchor proximity. We only
      // need the first point (~30 chars in) — no need to decode the
      // whole geometry. Returns null on malformed input.
      const decodeFirstLatLng = (poly) => {
        if (typeof poly !== 'string' || poly.length === 0) return null;
        let index = 0;
        let lat = 0;
        let lng = 0;
        let result = 0;
        let shift = 0;
        let b;
        do {
          if (index >= poly.length) return null;
          b = poly.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        lat += (result & 1) ? ~(result >> 1) : (result >> 1);
        result = 0;
        shift = 0;
        do {
          if (index >= poly.length) return null;
          b = poly.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        lng += (result & 1) ? ~(result >> 1) : (result >> 1);
        return { lat: lat / 1e5, lng: lng / 1e5 };
      };

      // v10.13.0 — Haversine great-circle distance in km.
      const haversineKm = (lat1, lng1, lat2, lng2) => {
        const R = 6371;
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const dφ = ((lat2 - lat1) * Math.PI) / 180;
        const dλ = ((lng2 - lng1) * Math.PI) / 180;
        const a =
          Math.sin(dφ / 2) * Math.sin(dφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) * Math.sin(dλ / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };

      const mapped = stravaRoutes.map((r) => {
        const distance_m = Number(r.distance) || 0;
        const elevation_gain_m = Number(r.elevation_gain) || 0;
        const idStr = r.id_str || (r.id != null ? String(r.id) : null);
        const summaryPoly = r.map?.summary_polyline || null;
        const firstPoint = summaryPoly ? decodeFirstLatLng(summaryPoly) : null;
        return {
          id: r.id,
          name: r.name || 'Untitled route',
          distance_m,
          elevation_gain_m,
          surface: inferSurface(r),
          map_url: summaryPoly,
          strava_url: idStr ? `https://www.strava.com/routes/${idStr}` : null,
          // Internal fields used for filtering — stripped from the
          // response below so the public shape doesn't change.
          _type: typeof r.type === 'number' ? r.type : null,
          _firstPoint: firstPoint,
        };
      });

      let droppedByType = 0;
      let droppedByAnchor = 0;
      const filtered = mapped.filter((r) => {
        // Sprint 11 bug 2 fix #1: type filter. Strava saved routes
        // include `type` (1 = Ride, 2 = Run/Hike). Drop non-rides.
        // We're permissive when `type` is missing (older API entries)
        // — better to keep an unknown-type ride than to over-filter
        // and surprise the user with an empty list.
        if (r._type !== null && r._type !== 1) {
          droppedByType++;
          return false;
        }
        // Surface filter — 'unknown' always passes (graceful degradation)
        if (surface !== 'any' && r.surface !== 'unknown' && r.surface !== surface) return false;
        // Distance filter — ±20% band around target km
        if (distanceKm !== null && Number.isFinite(distanceKm) && distanceKm > 0) {
          const km = r.distance_m / 1000;
          if (km < distanceKm * 0.8 || km > distanceKm * 1.2) return false;
        }
        // Difficulty filter — elevation gain per km bands
        if (difficulty === 'flat' || difficulty === 'rolling' || difficulty === 'hilly') {
          const km = r.distance_m / 1000;
          if (km > 0) {
            const elevPerKm = r.elevation_gain_m / km;
            if (difficulty === 'flat' && elevPerKm >= 5) return false;
            if (difficulty === 'rolling' && (elevPerKm < 5 || elevPerKm > 15)) return false;
            if (difficulty === 'hilly' && elevPerKm <= 15) return false;
          }
        }
        // Sprint 11 bug 2 fix #2: anchor-relevance gate. Only applied
        // when the client supplies a valid anchor. Routes without a
        // decodable first-point are kept (graceful degradation — same
        // policy as the surface filter).
        if (hasAnchor && r._firstPoint) {
          const d = haversineKm(anchorLat, anchorLng, r._firstPoint.lat, r._firstPoint.lng);
          if (d > STRAVA_ANCHOR_RADIUS_KM) {
            droppedByAnchor++;
            return false;
          }
        }
        return true;
      }).map((r) => {
        // Strip internal fields before returning to the client.
        const { _type, _firstPoint, ...publicShape } = r;
        return publicShape;
      });

      if (droppedByType > 0 || droppedByAnchor > 0) {
        safeWarn(`[routes] Strava saved-routes filtered: type=${droppedByType}, anchor>${STRAVA_ANCHOR_RADIUS_KM}km=${droppedByAnchor}`);
      }

      return new Response(JSON.stringify({ routes: filtered }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // PATCH /api/training-prefs — partial-update of training_prefs row keyed
    // by athlete_id. Powers the routes filter persistence (#47): the picker
    // saves the user's home_region / preferred_distance_km / preferred_difficulty
    // / surface_pref so subsequent visits load with the same defaults.
    // UPSERT pattern: INSERT on first save, ON CONFLICT update only provided fields.
    if (url.pathname === '/api/training-prefs' && request.method === 'PATCH') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const athleteId = authResult.athleteId;

      let body;
      try { body = await request.json(); } catch {
        return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const ALLOWED_DIFFICULTY = ['flat', 'rolling', 'hilly'];
      const ALLOWED_SURFACE = ['paved', 'gravel', 'any'];
      const updates = {};
      const reject = (msg) => new Response(JSON.stringify({ error: msg }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

      if (body?.home_region !== undefined) {
        if (typeof body.home_region !== 'string' || body.home_region.length > 100) {
          return reject('invalid value for home_region');
        }
        updates.home_region = body.home_region.trim();
      }
      if (body?.preferred_distance_km !== undefined) {
        const n = Number(body.preferred_distance_km);
        if (!Number.isInteger(n) || n < 1 || n > 500) {
          return reject('invalid value for preferred_distance_km (integer 1-500)');
        }
        updates.preferred_distance_km = n;
      }
      if (body?.preferred_difficulty !== undefined) {
        if (!ALLOWED_DIFFICULTY.includes(body.preferred_difficulty)) {
          return reject('invalid value for preferred_difficulty');
        }
        updates.preferred_difficulty = body.preferred_difficulty;
      }
      if (body?.surface_pref !== undefined) {
        if (!ALLOWED_SURFACE.includes(body.surface_pref)) {
          return reject('invalid value for surface_pref');
        }
        updates.surface_pref = body.surface_pref;
      }
      if (body?.sessions_per_week !== undefined) {
        const n = Number(body.sessions_per_week);
        if (!Number.isInteger(n) || n < 1 || n > 14) {
          return reject('invalid value for sessions_per_week (integer 1-14)');
        }
        updates.sessions_per_week = n;
      }
      if (body?.start_address !== undefined) {
        if (typeof body.start_address !== 'string' || body.start_address.length > 200) {
          return reject('invalid value for start_address');
        }
        updates.start_address = body.start_address.trim();
      }

      const fields = Object.keys(updates);
      if (fields.length === 0) return reject('no fields provided');

      const db = env.cycling_coach_db;
      const now = Math.floor(Date.now() / 1000);
      try {
        const insertCols = ['athlete_id', ...fields, 'updated_at'];
        const placeholders = insertCols.map(() => '?').join(', ');
        const values = [athleteId, ...fields.map((f) => updates[f]), now];
        const setClause = [...fields.map((f) => `${f} = excluded.${f}`), 'updated_at = excluded.updated_at'].join(', ');
        const sql = `
          INSERT INTO training_prefs (${insertCols.join(', ')})
          VALUES (${placeholders})
          ON CONFLICT(athlete_id) DO UPDATE SET ${setClause}
        `;
        await db.prepare(sql).bind(...values).run();

        const row = await db.prepare(
          'SELECT athlete_id, sessions_per_week, surface_pref, start_address, home_region, preferred_distance_km, preferred_difficulty, updated_at FROM training_prefs WHERE athlete_id = ?',
        ).bind(athleteId).first();

        return new Response(JSON.stringify(row), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        safeError(`[training-prefs] PATCH error: ${e.message}`);
        return new Response(JSON.stringify({ error: 'internal error' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ============= ROUTES DISCOVERY (#47 Phase 2, v9.3.1) =============
    // POST /api/routes/discover — system-paid Haiku call returning 3-5 narrative
    // route briefs based on the caller's location + today's session intent.
    // Used by the Today session card when zero saved Strava routes match.
    // Rate-limit: 10/hour/athlete via DOCS_KV (per architect spec §C.3).
    // Output is explicitly framed as "narrative briefs" — NOT GPX. The user
    // takes the brief to Komoot / RideWithGPS / Strava-create to plan the
    // actual route.
    if (url.pathname === '/api/routes/discover' && request.method === 'POST') {
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const athleteId = authResult.athleteId;

      // Rate-limit: 10 calls / hour / athlete (system-paid Haiku — bound spend).
      const rl = await checkRateLimit(env, 'discover', String(athleteId), 10, 3600);
      if (rl) {
        return new Response(JSON.stringify({ error: 'rate-limited', retry_after_seconds: rl.retryAfter }), {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(rl.retryAfter),
          },
        });
      }

      let body;
      try { body = await request.json(); } catch {
        return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const ALLOWED_SURFACE = ['paved', 'gravel', 'any'];
      const ALLOWED_DIFFICULTY = ['flat', 'rolling', 'hilly'];
      const required = (msg) => new Response(JSON.stringify({ error: msg }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

      const location = typeof body?.location === 'string' ? body.location.trim() : '';
      if (!location) return required('missing required field: location');
      if (location.length > 200) return required('location too long (max 200 chars)');

      if (!ALLOWED_SURFACE.includes(body?.surface)) return required('missing required field: surface');

      const distance_km = Number(body?.distance_km);
      if (!Number.isFinite(distance_km) || distance_km < 1 || distance_km > 500) {
        return required('distance_km must be between 1 and 500');
      }

      if (!ALLOWED_DIFFICULTY.includes(body?.difficulty)) return required('missing required field: difficulty');

      // System-paid key (set via `wrangler secret put SYSTEM_ANTHROPIC_KEY`).
      // Falls back to the legacy ANTHROPIC_API_KEY if set (single-user dev).
      const systemKey = env.SYSTEM_ANTHROPIC_KEY || env.ANTHROPIC_API_KEY;
      if (!systemKey) {
        safeWarn('[discover] SYSTEM_ANTHROPIC_KEY not set — endpoint disabled');
        return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const prompt = `You are a cycling coach helping a rider find a route for today's training session.

LOCATION: ${location}
TARGET DISTANCE: ${distance_km} km (acceptable range: ${Math.round(distance_km * 0.8)}-${Math.round(distance_km * 1.2)} km)
TERRAIN: ${body.difficulty} (${body.difficulty === 'flat' ? '<5 m/km' : body.difficulty === 'rolling' ? '5-15 m/km' : '>15 m/km'} elevation gain)
SURFACE: ${body.surface === 'any' ? 'any (rider has no preference)' : body.surface}

Generate 3 to 5 route SUGGESTIONS as narrative briefs. These are NOT real GPX files — they are starting points for the rider to plan in Komoot / RideWithGPS / Strava-create.

For each suggestion provide:
- name: short, evocative route name
- narrative: 2-3 sentences describing the route (what the rider experiences — terrain, scenery, key climbs/sections)
- start_address: a real, plausible starting point in or near ${location} (street name + neighbourhood / suburb if available)
- target_distance_km: integer km target (within the acceptable range)
- estimated_elevation_m: integer estimated total elevation gain in metres (consistent with the ${body.difficulty} terrain band)

Respond ONLY with valid JSON, no markdown, no code fences:
{"routes": [{"name": "…", "narrative": "…", "start_address": "…", "target_distance_km": 0, "estimated_elevation_m": 0}, ...]}`;

      let aiResp;
      try {
        aiResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': systemKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1500,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
      } catch (e) {
        safeWarn(`[discover] Anthropic fetch error: ${e.message}`);
        return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!aiResp.ok) {
        const errText = await aiResp.text().catch(() => '');
        safeWarn(`[discover] Anthropic returned ${aiResp.status}: ${errText.slice(0, 200)}`);
        return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let parsed;
      try {
        const data = await aiResp.json();
        const text = data.content?.find((c) => c.type === 'text')?.text || '';
        const cleaned = text.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (e) {
        safeWarn(`[discover] Anthropic response parse error: ${e.message}`);
        return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!parsed?.routes || !Array.isArray(parsed.routes) || parsed.routes.length === 0) {
        safeWarn('[discover] Anthropic response missing routes array');
        return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Best-effort shape validation — drop malformed entries rather than 503ing
      // when at least one is well-formed.
      const validRoutes = parsed.routes
        .filter((r) =>
          typeof r?.name === 'string' &&
          typeof r?.narrative === 'string' &&
          typeof r?.start_address === 'string' &&
          Number.isFinite(Number(r?.target_distance_km)) &&
          Number.isFinite(Number(r?.estimated_elevation_m)),
        )
        .map((r) => ({
          name: r.name.slice(0, 200),
          narrative: r.narrative.slice(0, 600),
          start_address: r.start_address.slice(0, 200),
          target_distance_km: Math.round(Number(r.target_distance_km)),
          estimated_elevation_m: Math.round(Number(r.estimated_elevation_m)),
        }));

      if (validRoutes.length === 0) {
        return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        routes: validRoutes,
        generated_at: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname.startsWith('/api/')) {
      // ADR-S3.4 Option B (#41): only forward GET and POST to Strava. DELETE,
      // PUT, PATCH would mutate Strava data the app never intends to change.
      // Per-path handlers (e.g. PATCH /api/training-prefs) are matched ABOVE
      // this block and are unaffected.
      if (!['GET', 'POST'].includes(request.method)) {
        return new Response(JSON.stringify({ error: 'method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Allow': 'GET, POST' },
        });
      }
      const stravaPath = url.pathname.replace(/^\/api\//, '');
      const stravaUrl = `https://www.strava.com/api/v3/${stravaPath}${url.search}`;
      const auth = request.headers.get('Authorization');
      if (!auth) return new Response(JSON.stringify({ error: 'Missing Authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
try {
        const proxied = await fetch(stravaUrl, { method: request.method, headers: { 'Authorization': auth } });
        const body = await proxied.text();
        // Strangler Fig: persist activities to D1 when proxying athlete/activities responses
        if (proxied.ok && stravaPath === 'athlete/activities') {
          try {
            const parsed = JSON.parse(body);
            if (Array.isArray(parsed)) {
              await persistActivities(env.cycling_coach_db, parsed);
            }
          } catch (parseErr) {
            safeWarn('[D1] Could not parse activities response for persist:', parseErr.message);
          }
        }
        return new Response(body, {
          status: proxied.status,
          headers: { ...corsHeaders, 'Content-Type': proxied.headers.get('Content-Type') || 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
 
    // ============= AI COACHING (BYOK - user provides own API key) =============
    if (url.pathname === '/coach' && request.method === 'POST') {
      // v9.3.0 (#33) — pre-handler gates: origin allowlist, bearer auth, per-athlete
      // rate limit. Built to prevent the previous open-Anthropic-proxy posture where
      // anyone on the internet could POST a leaked api_key and burn through the
      // owning user's Claude credits.
      const reqOrigin = request.headers.get('Origin') || '';
      if (reqOrigin && !ALLOWED_ORIGINS.includes(reqOrigin)) {
        safeWarn(`[coach] POST origin not allowed: "${reqOrigin}"`);
        return new Response(JSON.stringify({ error: 'origin not allowed' }), {
          status: 403, headers: { 'Content-Type': 'application/json' },
        });
      }
      const aiCorsHeaders = reqOrigin
        ? { 'Access-Control-Allow-Origin': reqOrigin, 'Vary': 'Origin' }
        : {}; // no Origin header (curl/server-to-server) → omit CORS headers
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify(authResult.body), {
          status: authResult.error,
          headers: { ...aiCorsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const athleteId = authResult.athleteId;
      // 20 requests per athlete per 60s — issue #33 acceptance: 21st in 60s → 429.
      const rl = await checkRateLimit(env, 'coach', String(athleteId), 20, 60);
      if (rl) {
        return new Response(JSON.stringify({ error: 'rate-limited', retry_after_seconds: rl.retryAfter }), {
          status: 429,
          headers: {
            ...aiCorsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(rl.retryAfter),
          },
        });
      }
      try {
        const body = await request.json();
        const { athlete, stats, recent, api_key, prefs } = body;

        // User must provide their own Anthropic API key
        const apiKey = api_key || env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'No API key provided. Add your Anthropic API key in the dashboard.' }), {
            status: 401, headers: { ...aiCorsHeaders, 'Content-Type': 'application/json' },
          });
        }
 
        const sessions = Math.max(1, Math.min(7, parseInt(prefs?.sessions_per_week) || 3));
        const restDays = 7 - sessions;
 
        // Build an example to show the model exactly what we want
        const dayNames = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
        const exampleSchedules = {
          1: ['Rest','Rest','Rest','Rest','Rest','Long ride: 60 min steady, conversational pace','Rest'],
          2: ['Rest','Rest','Tempo intervals: 10 min warm-up + 4×4 min hard with 3 min easy + 10 min cool-down','Rest','Rest','Long ride: 75-90 min steady at conversational pace','Rest'],
          3: ['Rest','Tempo intervals: 10 min warm-up + 4×5 min hard + 10 min cool-down','Rest','Easy ride: 40 min flat, conversational pace','Rest','Long ride: 90 min steady with rolling terrain','Rest'],
          4: ['Rest','Tempo intervals: 5×5 min hard with 3 min recovery','Rest','Easy ride: 45 min recovery pace','Hill repeats: 6×3 min climbing efforts','Long ride: 90-120 min steady','Rest'],
          5: ['Rest','Tempo intervals: 5×5 min hard','Easy ride: 45 min flat','Hill repeats: 6×3 min climbs','Easy ride: 30 min recovery','Long ride: 2 hours steady','Rest'],
          6: ['Easy ride: 45 min recovery','Tempo intervals: 5×5 min hard','Easy ride: 45 min flat','Hill repeats: 6×3 min climbs','Easy ride: 30 min recovery','Long ride: 2 hours steady','Rest'],
          7: ['Easy ride: 30 min recovery','Tempo intervals: 5×5 min hard','Easy ride: 45 min flat','Hill repeats: 6×3 min climbs','Easy ride: 30 min recovery','Long ride: 2 hours steady','Easy spin: 30 min recovery'],
        };
        const example = {};
        dayNames.forEach((d, i) => { example[d] = exampleSchedules[sessions][i]; });
 
        const prompt = `You are a cycling coach for a beginner-to-intermediate cyclist named ${athlete.firstname || 'this athlete'}. Be warm, specific, and grounded in their actual data — no generic advice.
 
THEIR DATA:
Career: ${stats.rideCount} rides, ${stats.totalDistance}km total, ${stats.totalElevation}m elevation. Average pace ${stats.avgSpeed} km/h. Longest ride ${stats.longestRide}km. Top speed ${stats.fastestRide} km/h. This year: ${stats.yearDistance}km. Last 30 days: ${stats.recentRideCount} rides covering ${stats.recentDistance}km.
 
Recent rides:
${JSON.stringify(recent, null, 2)}
 
==================================================
WEEKLY PLAN — STRICT RULES (FOLLOW EXACTLY)
==================================================
The athlete wants EXACTLY ${sessions} cycling session${sessions === 1 ? '' : 's'} per week. This means:
• ${sessions} day${sessions === 1 ? '' : 's'} of CYCLING
• ${restDays} day${restDays === 1 ? '' : 's'} of REST (NO cycling at all)
 
A "cycling session" is ANY ride: tempo, intervals, endurance, recovery spin, easy ride, long ride, hill repeats, anything that involves getting on the bike.
 
A "rest day" means the value MUST be one of:
- "Rest"
- "Rest day"
- "Rest or 20 min walk"
- "Rest or light yoga/stretching"
- "Active recovery: 20 min walk"
 
A rest day must NEVER contain words like "ride", "spin", "km/h", "easy 30 min", "recovery ride", or any cycling activity. Even "easy spin" counts as a session — do NOT use it on rest days.
 
Count carefully before responding:
- Total days in plan: 7
- Days that say anything other than "Rest" / walking: must equal exactly ${sessions}
- Days that say "Rest" (or walking only): must equal exactly ${restDays}
 
PLACEMENT RULES:
- If ${sessions} = 1: put it on Saturday (long ride). Everything else is Rest.
- If ${sessions} = 2: put a tempo/interval workout midweek (Wed) and a long ride on Saturday. Everything else is Rest.
- If ${sessions} = 3: tempo on Tue, easy on Thu, long on Sat. Rest other days.
- If ${sessions} >= 4: distribute sensibly, never two hard days in a row.
- Adapt to the rider's history — if they always ride Sundays, use Sunday instead of Saturday.
 
EXAMPLE for ${sessions} session${sessions === 1 ? '' : 's'}/week (you can vary the workouts but keep this exact balance of session-days vs rest-days):
${JSON.stringify(example, null, 2)}
 
==================================================
 
Respond ONLY with valid JSON, no markdown:
{"summary":"2-3 sentence overview of their fitness and trajectory","strengths":["3 specific data-grounded strengths"],"areasToImprove":["2 specific areas with actionable advice"],"weeklyPlan":{"monday":"...","tuesday":"...","wednesday":"...","thursday":"...","friday":"...","saturday":"...","sunday":"..."},"sessions_per_week":${sessions},"motivation":"2-3 sentence motivational closing"}`;
 
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1500,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          // Detect invalid API key specifically
          const msg = data.error?.message || 'AI request failed';
          const isAuthError = res.status === 401 || /authentication|api[_ ]key|invalid/i.test(msg);
          return new Response(JSON.stringify({
            error: msg,
            invalid_key: isAuthError,
          }), {
            status: res.status, headers: { ...aiCorsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const text = data.content?.find(c => c.type === 'text')?.text || '';
        const cleaned = text.replace(/```json|```/g, '').trim();
        let parsed;
        try { parsed = JSON.parse(cleaned); }
        catch { return new Response(JSON.stringify({ error: 'AI returned invalid JSON', raw: text }), {
          status: 500, headers: { ...aiCorsHeaders, 'Content-Type': 'application/json' },
        }); }
 
        // VALIDATION: ensure the weekly plan respects the session count.
        // Count cycling days (anything not starting with "rest" or "active recovery: walk")
        if (parsed.weeklyPlan && typeof parsed.weeklyPlan === 'object') {
          const isRestDay = (workout) => {
            const w = String(workout || '').trim().toLowerCase();
            if (!w) return true;
            if (/^rest\b/.test(w)) return true;
            // Active recovery only counts as rest if it's walking/yoga (no riding)
            if (/^active recovery:?\s*(20|30)?\s*min\s*walk/.test(w)) return true;
            if (/^active recovery:?\s*(yoga|stretch|walk)/.test(w)) return true;
            // Anything containing "ride", "spin", "km", "min" with cycling context = session
            return false;
          };
          const dayKeys = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
          const sessionCount = dayKeys.filter(d => parsed.weeklyPlan[d] && !isRestDay(parsed.weeklyPlan[d])).length;
 
          // If the AI gave more sessions than asked, force-rest the extra ones (keep the most demanding days, rest the rest)
          if (sessionCount > sessions) {
            // Score each day: bigger workout = higher score (keep these)
            const scored = dayKeys
              .filter(d => parsed.weeklyPlan[d] && !isRestDay(parsed.weeklyPlan[d]))
              .map(d => {
                const w = String(parsed.weeklyPlan[d]).toLowerCase();
                let score = 0;
                if (/long\s*ride|long ride/i.test(w)) score += 100;
                if (/tempo|interval|threshold|hard/i.test(w)) score += 80;
                if (/hill|climb/i.test(w)) score += 70;
                if (/recovery|easy|gentle|conversational/i.test(w)) score += 10;
                // Plus length hint
                const m = w.match(/(\d+)\s*(km|min|hour)/);
                if (m) score += parseInt(m[1]);
                return { day: d, score };
              })
              .sort((a, b) => b.score - a.score);
            // Keep top N, rest the rest
            const keep = new Set(scored.slice(0, sessions).map(x => x.day));
            dayKeys.forEach(d => {
              if (parsed.weeklyPlan[d] && !isRestDay(parsed.weeklyPlan[d]) && !keep.has(d)) {
                parsed.weeklyPlan[d] = 'Rest';
              }
            });
            parsed._adjusted = true;
          }
          parsed.sessions_per_week = sessions;
        }
 
        return new Response(JSON.stringify(parsed), {
          headers: { ...aiCorsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { ...aiCorsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ============= AI PER-RIDE FEEDBACK =============
    if (url.pathname === '/coach-ride' && request.method === 'POST') {
      // v9.3.0 (#33) — same gate stack as /coach above. Per-ride feedback is
      // smaller per-call but called once per ride sync, so the rate limit is
      // looser (60/min — sync of a backlog of recent rides).
      const reqOrigin = request.headers.get('Origin') || '';
      if (reqOrigin && !ALLOWED_ORIGINS.includes(reqOrigin)) {
        safeWarn(`[coach-ride] POST origin not allowed: "${reqOrigin}"`);
        return new Response(JSON.stringify({ error: 'origin not allowed' }), {
          status: 403, headers: { 'Content-Type': 'application/json' },
        });
      }
      const aiCorsHeaders = reqOrigin
        ? { 'Access-Control-Allow-Origin': reqOrigin, 'Vary': 'Origin' }
        : {};
      const authResult = await resolveAthleteId(request);
      if (authResult.error) {
        return new Response(JSON.stringify(authResult.body), {
          status: authResult.error,
          headers: { ...aiCorsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const athleteId = authResult.athleteId;
      const rl = await checkRateLimit(env, 'coach-ride', String(athleteId), 60, 60);
      if (rl) {
        return new Response(JSON.stringify({ error: 'rate-limited', retry_after_seconds: rl.retryAfter }), {
          status: 429,
          headers: {
            ...aiCorsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(rl.retryAfter),
          },
        });
      }
      try {
        const body = await request.json();
        const { ride, athlete, context, api_key } = body;
        const apiKey = api_key || env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'No API key' }), {
            status: 401, headers: { ...aiCorsHeaders, 'Content-Type': 'application/json' },
          });
        }
 
        const prompt = `You are a friendly cycling coach giving quick, encouraging feedback to a beginner-to-intermediate cyclist named ${athlete?.firstname || 'this rider'}. They just completed this ride:
 
Ride: "${ride.name}"
Distance: ${ride.distance_km} km
Duration: ${ride.duration_min} min
Elevation gain: ${ride.elevation_m} m
Average speed: ${ride.avg_speed_kmh} km/h
${ride.heartrate ? `Avg heart rate: ${ride.heartrate} bpm\n` : ''}${ride.suffer_score ? `Effort score: ${ride.suffer_score}\n` : ''}${ride.pr_count ? `Personal records set: ${ride.pr_count}\n` : ''}
For context, this rider's overall stats:
- ${context.totalRides} total rides, averaging ${context.avgDistance}km
- Their longest ride ever is ${context.longestRide}km
- Their typical pace is ${context.avgSpeed} km/h
 
Give a SHORT (3 sentences max), specific, encouraging assessment. Then ONE concrete suggestion for next time. Be warm but direct — no platitudes, no fluff. Talk to them, not about them. Don't ask questions.
 
Respond ONLY with valid JSON, no markdown:
{"verdict":"one short sentence — e.g. 'Solid endurance ride' or 'Strong climbing effort'","feedback":"2-3 sentences of specific feedback grounded in the numbers","next":"one specific concrete suggestion for next time"}`;
 
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 500,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          const msg = data.error?.message || 'AI request failed';
          const isAuthError = res.status === 401 || /authentication|api[_ ]key|invalid/i.test(msg);
          return new Response(JSON.stringify({ error: msg, invalid_key: isAuthError }), {
            status: res.status, headers: { ...aiCorsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const text = data.content?.find(c => c.type === 'text')?.text || '';
        const cleaned = text.replace(/```json|```/g, '').trim();
        let parsed;
        try { parsed = JSON.parse(cleaned); }
        catch { return new Response(JSON.stringify({ error: 'AI returned invalid JSON' }), {
          status: 500, headers: { ...aiCorsHeaders, 'Content-Type': 'application/json' },
        }); }
        return new Response(JSON.stringify(parsed), {
          headers: { ...aiCorsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { ...aiCorsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ============= STRAVA WEBHOOK =============
    // Path-secret defence (#17): canonical URL is /webhook/<env.STRAVA_WEBHOOK_PATH_SECRET>.
    // Worker registers only the secret URL with Strava when multi-user approval lands.
    // Legacy /webhook and any /webhook/<wrong-secret> return 404 (OWASP — don't leak
    // existence of the canonical path to attackers).
    //
    // v8.5.2 hardening: STRAVA_WEBHOOK_PATH_SECRET must match /^[0-9a-f]{32,}$/i — i.e.
    // 32+ lowercase hex chars (matches `openssl rand -hex 16+`). Whitespace, too-short,
    // or non-hex values are rejected at runtime (entire /webhook* surface returns 404).
    //
    // Without STRAVA_WEBHOOK_PATH_SECRET set, the surface is also dormant (404). That's
    // intentional — single-user mode today, no active webhook subscription. See
    // SECURITY.md "Deploy runbook".
    const SECRET_PATTERN = /^[0-9a-f]{32,}$/i;

    // Server-side warning if a secret is set but malformed — visible only in Cloudflare
    // logs (not surfaced to attackers). Gate behind /webhook* path check to limit noise
    // (we'd otherwise log on every request to /, /dashboard, etc.).
    if (
      (url.pathname === '/webhook' || url.pathname.startsWith('/webhook/')) &&
      env.STRAVA_WEBHOOK_PATH_SECRET &&
      !SECRET_PATTERN.test(env.STRAVA_WEBHOOK_PATH_SECRET)
    ) {
      safeWarn('[webhook] STRAVA_WEBHOOK_PATH_SECRET set but format invalid; expected /^[0-9a-f]{32,}$/i');
    }

    const webhookPathOk =
      typeof env.STRAVA_WEBHOOK_PATH_SECRET === 'string' &&
      SECRET_PATTERN.test(env.STRAVA_WEBHOOK_PATH_SECRET) &&
      url.pathname === `/webhook/${env.STRAVA_WEBHOOK_PATH_SECRET}`;

    // Strava webhook subscription verification (GET).
    // Fail-closed: if STRAVA_VERIFY_TOKEN isn't set, return 503 rather than
    // accepting any guess that matches a hardcoded fallback (#19).
    if (webhookPathOk && request.method === 'GET') {
      if (!env.STRAVA_VERIFY_TOKEN) {
        return new Response('Webhook verification not configured', { status: 503 });
      }
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      if (mode === 'subscribe' && token === env.STRAVA_VERIFY_TOKEN) {
        return new Response(JSON.stringify({ 'hub.challenge': challenge }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // v8.5.2 hardening: return 404 (not 403) when verify_token mismatches even though
      // the path-secret was correct. Returning 403 here would leak that the path-secret
      // is valid (attacker probes /webhook/<random> → 404, then /webhook/<guessed> with
      // any token → 403 confirms the guess). 404 keeps opacity throughout.
      // Log server-side for our own debugging (env var drift between Worker + Strava).
      const ip = request.headers.get('cf-connecting-ip') || 'unknown';
      safeWarn(`[webhook] path matched but verify_token mismatch from IP ${ip}`);
      return new Response('Not Found', { status: 404 });
    }
    // Strava webhook event delivery (POST).
    // Note: We can't auto-sync tokens here because webhook events have no user context
    // beyond athlete_id. Without persistent token storage (KV/D1), we just log.
    // Browser-side polling on dashboard load handles the actual sync.
    if (webhookPathOk && request.method === 'POST') {
      try {
        const event = await request.json();
        // Strava expects fast 200 response. Logging only since architecture is browser-storage.
        // safeLog redacts any sensitive patterns before they hit persistent logs (#20).
        safeLog('Webhook event:', event);

        // v10.9.0 Phase D — auto-regenerate AI plan when a new activity
        // arrives. Fire-and-forget so we still return 200 fast (Strava's
        // 2-second deadline). regenerateForAthlete checks strava_tokens
        // first; users still on browser-only auth get reason: 'no_server_token'
        // and no AI cost is incurred.
        if (
          event &&
          event.object_type === 'activity' &&
          event.aspect_type === 'create' &&
          typeof event.owner_id === 'number'
        ) {
          ctx.waitUntil(
            regenerateForAthlete({
              env,
              athleteId: event.owner_id,
              deps: { safeWarn },
            })
              .then((res) => safeLog('[plan-regen-webhook]', res))
              .catch((e) => safeWarn(`[plan-regen-webhook] error: ${e.message}`)),
          );
        }
      } catch { /* malformed body — Strava expects 200 anyway */ }
      return new Response('OK', { status: 200 });
    }
    // Catch-all for /webhook* paths that don't match the secret path.
    // Returns 404 (not 403) per OWASP — don't leak existence of the canonical path.
    if (url.pathname === '/webhook' || url.pathname.startsWith('/webhook/')) {
      return new Response('Not Found', { status: 404 });
    }
 
    // Version endpoint for quick health/version check
    if (url.pathname === '/version') {
      return new Response(JSON.stringify({
        service: 'Cadence Club',
        version: WORKER_VERSION,
        build_date: BUILD_DATE,
        status: 'ok',
      }, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============= ADMIN: DOCUMENT RELEASE =============
    // Fulfils issue #23 — auto-updates Confluence project docs on every deploy.
    // Admin-gated. Returns 503 if Confluence secrets aren't configured (so the
    // endpoint is safe to ship before the user adds the API token).
    // Also rate-limited (#18) — KV-based, 5 attempts/min/IP, defends against
    // ADMIN_SECRET leak and runaway-loop bugs in CI.
    if (url.pathname === '/admin/document-release' && request.method === 'POST') {
      const adminCheck = requireAdmin(request, env);
      if (adminCheck) return adminCheck;
      const rl = await checkAdminRateLimit(env, 'document-release', request, 5, 60);
      if (rl) {
        return new Response(JSON.stringify({ error: 'rate-limited', retry_after_seconds: rl.retryAfter }), {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(rl.retryAfter),
          },
        });
      }
      if (!env.CONFLUENCE_API_TOKEN || !env.CONFLUENCE_USER_EMAIL) {
        return new Response(
          JSON.stringify({
            error: 'Confluence not configured',
            missing: [
              !env.CONFLUENCE_API_TOKEN && 'CONFLUENCE_API_TOKEN',
              !env.CONFLUENCE_USER_EMAIL && 'CONFLUENCE_USER_EMAIL',
            ].filter(Boolean),
            hint: 'wrangler secret put CONFLUENCE_API_TOKEN  /  wrangler secret put CONFLUENCE_USER_EMAIL',
          }, null, 2),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      try {
        const result = await documentRelease(env);
        return new Response(JSON.stringify(result, null, 2), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ============= ROADMAP =============
    // GitHub Issues are the source of truth for the public roadmap. The
    // /whats-next page in the React SPA fetches this endpoint, which proxies
    // GitHub's REST API and caches the response at the edge for 5 minutes.
    if (url.pathname === '/roadmap') {
      try {
        const cacheKey = new Request(`${url.origin}/__roadmap-cache`, { method: 'GET' });
        const cache = caches.default;
        const cached = await cache.match(cacheKey);
        if (cached) {
          return new Response(cached.body, {
            status: cached.status,
            headers: { ...Object.fromEntries(cached.headers), 'X-Cache': 'HIT' },
          });
        }

        // GITHUB_REPO is in the standard "owner/repo" form. Split for /roadmap.
        const repoFull = env.GITHUB_REPO || 'jose-reboredo/cycling-coach';
        const [owner, repo] = repoFull.includes('/') ? repoFull.split('/') : [env.GITHUB_OWNER || 'jose-reboredo', repoFull];
        const ghHeaders = {
          'User-Agent': 'cycling-coach-worker',
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        };
        if (env.GITHUB_TOKEN) ghHeaders['Authorization'] = `Bearer ${env.GITHUB_TOKEN}`;

        const ghRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100&sort=updated&direction=desc`,
          { headers: ghHeaders },
        );
        if (!ghRes.ok) {
          return new Response(
            JSON.stringify({ error: 'GitHub fetch failed', status: ghRes.status, items: [] }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
        const issues = await ghRes.json();
        const items = issues
          .filter((i) => !i.pull_request)
          .map(normalizeGhIssue);

        const body = JSON.stringify({
          repo: `${owner}/${repo}`,
          fetched_at: Date.now(),
          count: items.length,
          items,
        });
        const response = new Response(body, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300, s-maxage=300',
            'X-Cache': 'MISS',
          },
        });
        await cache.put(cacheKey, response.clone());
        return response;
      } catch (e) {
        return new Response(
          JSON.stringify({ error: e.message, items: [] }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    return Response.redirect(url.origin + '/', 302);
}

// ============================================================
// CONFLUENCE INTEGRATION (issue #23)
// ============================================================
function requireAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const expected = env.ADMIN_SECRET ? `Bearer ${env.ADMIN_SECRET}` : '';
  if (!expected) {
    return new Response(JSON.stringify({ error: 'ADMIN_SECRET not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (auth.length !== expected.length || auth !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

/**
 * Generic per-identifier rate-limit on top of DOCS_KV (Free-plan-compatible).
 *
 * Sliding minute-bucket window: if more than `limit` requests arrive in the
 * current bucket from `identifier`, returns a 429 sentinel that the caller
 * surfaces as a real 429 with Retry-After. KV doesn't support atomic ops,
 * but this is defense-in-depth — strict precision isn't required.
 *
 * Used by:
 *   - /admin/* (per-IP, abuse-protection — #18, v8.5.2)
 *   - /coach + /coach-ride (per-athlete, cost-runaway protection — #33, v9.3.0)
 *
 * Returns:
 *   null              — under threshold, request proceeds
 *   { retryAfter: N } — over threshold, caller returns 429 with Retry-After: N
 */
async function checkRateLimit(env, scope, identifier, limit, windowSeconds) {
  if (!env.DOCS_KV) {
    safeWarn(`[ratelimit] DOCS_KV not bound; skipping rate-limit on ${scope}`);
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds);
  const kvKey = `ratelimit:${scope}:${identifier}:${bucket}`;
  const current = parseInt((await env.DOCS_KV.get(kvKey)) || '0', 10);
  if (current >= limit) {
    const retryAfter = windowSeconds - (now % windowSeconds);
    safeWarn(`[ratelimit] threshold-hit: scope=${scope} id=${identifier} count=${current} limit=${limit} retry_after=${retryAfter}s`);
    return { retryAfter };
  }
  await env.DOCS_KV.put(kvKey, String(current + 1), { expirationTtl: windowSeconds * 2 });
  return null;
}

/**
 * Per-IP rate-limit for /admin/* — thin wrapper around checkRateLimit.
 * Even though /admin/* is admin-auth-gated by requireAdmin(), an ADMIN_SECRET
 * leak or runaway-loop bug in CI could burn external API quota (Confluence,
 * GitHub) and cost real money. See checkRateLimit() docstring for behavior.
 */
async function checkAdminRateLimit(env, scope, request, limit, windowSeconds) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  return checkRateLimit(env, scope, ip, limit, windowSeconds);
}

function confluenceClient(env) {
  const base = (env.CONFLUENCE_BASE_URL || 'https://josemreboredo.atlassian.net').replace(/\/$/, '');
  const auth = btoa(`${env.CONFLUENCE_USER_EMAIL}:${env.CONFLUENCE_API_TOKEN}`);
  const headers = {
    Authorization: `Basic ${auth}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  async function call(path, init = {}) {
    const r = await fetch(`${base}/wiki/api/v2${path}`, { ...init, headers });
    const text = await r.text();
    let body;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!r.ok) {
      throw new Error(`Confluence ${init.method || 'GET'} ${path} → ${r.status}: ${text.slice(0, 300)}`);
    }
    return body;
  }
  return {
    async spaceId(spaceKey) {
      const data = await call(`/spaces?keys=${encodeURIComponent(spaceKey)}`);
      const id = data?.results?.[0]?.id;
      if (!id) throw new Error(`Space '${spaceKey}' not found`);
      return id;
    },
    async children(parentId) {
      const data = await call(`/pages/${parentId}/children?limit=100`);
      return data?.results ?? [];
    },
    async create({ spaceId, parentId, title, storage }) {
      return call('/pages', {
        method: 'POST',
        body: JSON.stringify({
          spaceId,
          ...(parentId ? { parentId } : {}),
          status: 'current',
          title,
          body: { representation: 'storage', value: storage },
        }),
      });
    },
    async getPage(id) {
      return call(`/pages/${id}?body-format=storage`);
    },
    async update(id, { title, storage, version }) {
      return call(`/pages/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          id,
          status: 'current',
          title,
          body: { representation: 'storage', value: storage },
          version: { number: version },
        }),
      });
    },
    /**
     * Confluence v2 delete is two-step: first DELETE moves to trash, second
     * DELETE with `purge=true` permanently removes. We do both for a true
     * cleanup, swallowing the second error if the page is already gone.
     */
    async deletePage(id) {
      await call(`/pages/${id}`, { method: 'DELETE' });
      try {
        await call(`/pages/${id}?purge=true`, { method: 'DELETE' });
      } catch {
        /* purge race / not-yet-in-trash — first DELETE moved it, that's enough */
      }
    },
  };
}

// SHA-256 of a string. Used to skip Confluence PUTs when content didn't
// actually change (avoids spurious version bumps + page-history noise).
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Upsert a single spec page. Hash check is on the BODY only (page.storage),
// not on the rendered output — so the footer can carry per-deploy info that
// changes every release without forcing a body-rewrite skip.
//
// On every deploy:
//   - ensurePage (cached id in DOCS_KV)
//   - always replacePage with body + footer (so footer reflects current deploy)
//   - hash check on body determines status: 'unchanged' / 'updated' / 'initialised'
async function upsertSpecPage(env, conf, { spaceId, parentId, page, footer }) {
  const renderedStorage = page.storage + (footer || '');
  const id = await ensurePage(env, conf, {
    spaceId,
    parentId,
    title: page.title,
    initialStorage: renderedStorage,
  });
  const newBodyHash = await sha256(page.storage);
  const kv = env.DOCS_KV;
  const cachedHash = kv ? await kv.get(`hash:${page.slug}`) : null;
  const bodyChanged = cachedHash !== newBodyHash;

  // Always write — even when body is unchanged, the footer reflects the
  // current deploy version + date so the per-page audit trail stays current.
  await replacePage(conf, id, { title: page.title, storage: renderedStorage });
  if (kv && bodyChanged) await kv.put(`hash:${page.slug}`, newBodyHash);

  return {
    slug: page.slug,
    id,
    status: cachedHash === null ? 'initialised' : bodyChanged ? 'updated' : 'unchanged',
  };
}

async function ensurePage(env, conf, { spaceId, parentId, title, initialStorage }) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const cacheKey = `page:${slug}`;
  const kv = env.DOCS_KV;
  if (kv) {
    const cached = await kv.get(cacheKey);
    if (cached) return cached;
  }
  const kids = await conf.children(parentId);
  let id = kids.find((k) => k.title === title)?.id;
  if (!id) {
    const created = await conf.create({ spaceId, parentId, title, storage: initialStorage });
    id = created.id;
  }
  if (kv && id) await kv.put(cacheKey, id);
  return id;
}

async function replacePage(conf, id, { title, storage }) {
  const current = await conf.getPage(id);
  const nextVersion = (current?.version?.number ?? 0) + 1;
  return conf.update(id, { title, storage, version: nextVersion });
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function generateDocs(env, ctx) {
  const apiKey = env.SYSTEM_ANTHROPIC_KEY || env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      functional: `<h1>Functional documentation</h1><p>Auto-generated for <strong>${escapeXml(ctx.version)}</strong> on ${ctx.date}.</p><ac:structured-macro ac:name="info"><ac:rich-text-body><p>Set <code>SYSTEM_ANTHROPIC_KEY</code> Worker secret to enable AI-generated docs.</p></ac:rich-text-body></ac:structured-macro><h2>Latest changes</h2><pre>${escapeXml(ctx.changelog || '(no changelog entry found)')}</pre>`,
      technical: `<h1>Technical documentation</h1><p>Auto-generated for <strong>${escapeXml(ctx.version)}</strong> on ${ctx.date}.</p><ac:structured-macro ac:name="info"><ac:rich-text-body><p>Set <code>SYSTEM_ANTHROPIC_KEY</code> Worker secret to enable AI-generated docs.</p></ac:rich-text-body></ac:structured-macro><h2>Recent commits</h2><ul>${ctx.commits.map((c) => `<li><code>${escapeXml(c.sha.slice(0, 7))}</code> ${escapeXml(c.message)}</li>`).join('')}</ul>`,
    };
  }

  const sharedContext = `Project: Cadence Club
Latest release: ${ctx.version} (${ctx.date})
Roadmap: ${ctx.openIssues} open / ${ctx.shippedIssues} shipped (across milestones)

CHANGELOG entry for this release:
${ctx.changelog || '(no entry found)'}

Recent commits since last release:
${ctx.commits.map((c) => `- ${c.sha.slice(0, 7)} ${c.message}`).join('\n')}`;

  const functionalPrompt = `You are a technical writer producing user-facing project documentation in Confluence storage format (XHTML).

${sharedContext}

TASK: Generate the FUNCTIONAL documentation page. Cover:
1. What the app does (one paragraph)
2. Per-route UX: Landing, Dashboard, Privacy, What's next, OAuth flow
3. Key features (AI Coach, Routes picker, Onboarding, Goal event, Ride detail)
4. User-facing changes since the last release (synthesise from CHANGELOG; don't repeat verbatim)

FORMAT: Confluence storage XHTML. Use <h1>, <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <code>.
For callouts use <ac:structured-macro ac:name="info"><ac:rich-text-body><p>...</p></ac:rich-text-body></ac:structured-macro>.
Keep it tight — 600 words max.
OUTPUT: just the XHTML, no markdown fences, no commentary.`;

  const technicalPrompt = `You are a technical writer producing engineering documentation in Confluence storage format (XHTML).

${sharedContext}

TASK: Generate the TECHNICAL documentation page. Cover:
1. Architecture (Cloudflare Worker + React SPA via Workers Static Assets + D1 + Anthropic Claude + GitHub Issues)
2. Stack: React 19, Vite, TypeScript, Tanstack Router/Query, Motion, CSS Modules
3. Data model: D1 schema (users, activities, daily_load, goals, training_prefs, ai_reports, ride_feedback) — high-level, not column-level
4. Auth flow: Strava OAuth → Worker /authorize → /callback → tokens in localStorage (Strangler-Fig dual-write to D1)
5. API endpoint inventory (/api/*, /authorize, /callback, /refresh, /coach, /coach-ride, /webhook, /version, /roadmap, /admin/*)
6. Worker file map (src/worker.js sections)
7. Security posture (current state + open hardening issues from this release)

FORMAT: Confluence storage XHTML, same vocab as above.
Length: ~800 words.
OUTPUT: just the XHTML, no markdown fences, no commentary.`;

  const callClaude = async (prompt) => {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      throw new Error(`Claude ${r.status}: ${err.slice(0, 300)}`);
    }
    const data = await r.json();
    return (data.content?.find((c) => c.type === 'text')?.text || '')
      .replace(/^```(?:html|xml)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
  };

  const [functional, technical] = await Promise.all([
    callClaude(functionalPrompt),
    callClaude(technicalPrompt),
  ]);
  return { functional, technical };
}

function renderRoadmapPage(roadmap) {
  const items = (roadmap?.items ?? []).slice().sort((a, b) => (a.number || 0) - (b.number || 0));
  const byMilestone = new Map();
  for (const it of items) {
    const k = it.target || '— no milestone';
    if (!byMilestone.has(k)) byMilestone.set(k, []);
    byMilestone.get(k).push(it);
  }
  const sections = Array.from(byMilestone.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([milestone, list]) => {
      const rows = list
        .map(
          (it) =>
            `<tr><td><a href="${escapeXml(it.url || '#')}">#${it.number || it.id}</a></td><td>${escapeXml(it.title)}</td><td>${escapeXml(it.priority)}</td><td>${escapeXml(it.area)}</td><td>${escapeXml(it.status)}</td></tr>`,
        )
        .join('');
      return `<h2>${escapeXml(milestone)}</h2><table><thead><tr><th>#</th><th>Title</th><th>Priority</th><th>Area</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
    })
    .join('');
  const counts = items.reduce((acc, it) => { acc[it.status] = (acc[it.status] || 0) + 1; return acc; }, {});
  return `<h1>Roadmap</h1>
<ac:structured-macro ac:name="info"><ac:rich-text-body><p>Auto-mirrored from <a href="https://cycling-coach.josem-reboredo.workers.dev/whats-next">/whats-next</a> on every prod deploy. GitHub Issues are the source of truth.</p></ac:rich-text-body></ac:structured-macro>
<p><strong>Total:</strong> ${items.length} · <strong>Open:</strong> ${counts.open || 0} · <strong>In progress:</strong> ${counts['in-progress'] || 0} · <strong>Shipped:</strong> ${counts.shipped || 0}</p>
${sections}`;
}

async function recentCommits(env) {
  if (!env.GITHUB_TOKEN) return [];
  const REPO = env.GITHUB_REPO || 'jose-reboredo/cycling-coach';
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const r = await fetch(
    `https://api.github.com/repos/${REPO}/commits?per_page=30&since=${since}`,
    {
      headers: {
        'User-Agent': 'cycling-coach-worker',
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      },
    },
  );
  if (!r.ok) return [];
  const data = await r.json();
  return data.map((c) => ({
    sha: c.sha,
    message: (c.commit?.message || '').split('\n')[0].slice(0, 120),
  }));
}

/**
 * Doc-sync orchestrator. Three update modes co-exist:
 *
 *   • Spec pages (SPEC_PAGES from src/docs.js): canonical content lives in
 *     code. Each spec page is upserted; a content-hash check skips PUT when
 *     storage XHTML hasn't changed (no spurious version bumps).
 *   • Roadmap page: always regenerated fresh from GitHub Issues.
 *   • Releases page: append-only — one child per WORKER_VERSION.
 *
 * On first run after the doc-structure refactor, legacy pages from the prior
 * 2-page structure ('Functional documentation' / 'Technical documentation')
 * are deleted via the v2 API.
 */
async function documentRelease(env) {
  const conf = confluenceClient(env);
  const spaceKey = env.CONFLUENCE_SPACE_KEY || 'CC';
  const homepageId = env.CONFLUENCE_HOMEPAGE_ID || '262256';
  const spaceId = await conf.spaceId(spaceKey);
  const version = WORKER_VERSION;
  const date = new Date().toISOString().slice(0, 10);

  const result = {
    version,
    date,
    spec_pages: [],
    legacy_removed: [],
    roadmap: null,
    releases_parent: null,
    release_entry: null,
  };

  // -------- 1. Cleanup legacy pages --------
  const homepageChildren = await conf.children(homepageId);
  for (const legacyTitle of LEGACY_PAGES_TO_REMOVE) {
    const legacy = homepageChildren.find((c) => c.title === legacyTitle);
    if (!legacy) continue;
    try {
      await conf.deletePage(legacy.id);
      if (env.DOCS_KV) {
        const slug = legacyTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        await env.DOCS_KV.delete(`page:${slug}`);
        await env.DOCS_KV.delete(`hash:${slug}`);
      }
      result.legacy_removed.push({ title: legacyTitle, id: legacy.id, status: 'deleted' });
    } catch (e) {
      result.legacy_removed.push({ title: legacyTitle, id: legacy.id, status: 'error', error: e.message });
    }
  }

  // -------- 2. Upsert spec pages (init-once + content-hash delta) --------
  // Per-page footer carries the current deploy info — overlaid on every page
  // every deploy. Body hash check still skips body rewrites when content
  // didn't change, but the footer always reflects the latest deploy so the
  // audit trail "this page was reviewed during deploy vX.Y.Z" stays accurate.
  const pageFooter =
    `\n<hr/>\n<p style="color:#7d8290; font-size:12px; margin-top:24px;">` +
    `<em>Last touched by deploy <strong>${WORKER_VERSION}</strong> on <strong>${date}</strong>. ` +
    `Auto-managed — content lives in <code>src/docs.js</code>; ` +
    `regenerated by <code>/admin/document-release</code> on every <code>npm run deploy</code>.</em></p>`;
  for (const page of SPEC_PAGES) {
    const r = await upsertSpecPage(env, conf, { spaceId, parentId: homepageId, page, footer: pageFooter });
    result.spec_pages.push(r);
  }

  // -------- 3. Roadmap (always regenerated fresh) --------
  const REPO_FULL = env.GITHUB_REPO || 'jose-reboredo/cycling-coach';
  let roadmap = { items: [] };
  if (env.GITHUB_TOKEN) {
    const ghRes = await fetch(
      `https://api.github.com/repos/${REPO_FULL}/issues?state=all&per_page=100&sort=updated&direction=desc`,
      {
        headers: {
          'User-Agent': 'cycling-coach-worker',
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        },
      },
    );
    if (ghRes.ok) {
      const issues = await ghRes.json();
      roadmap.items = issues.filter((i) => !i.pull_request).map(normalizeGhIssue);
    }
  }
  const roadmapId = await ensurePage(env, conf, {
    spaceId,
    parentId: homepageId,
    title: 'Roadmap',
    initialStorage: '<h1>Roadmap</h1><p>Initialising…</p>',
  });
  await replacePage(conf, roadmapId, { title: 'Roadmap', storage: renderRoadmapPage(roadmap) });
  result.roadmap = {
    id: roadmapId,
    status: 'updated',
    count: roadmap.items.length,
    open: roadmap.items.filter((i) => i.status !== 'shipped').length,
    shipped: roadmap.items.filter((i) => i.status === 'shipped').length,
  };

  // -------- 4. Releases (append-only child per release) --------
  const releasesId = await ensurePage(env, conf, {
    spaceId,
    parentId: homepageId,
    title: 'Releases',
    initialStorage:
      '<h1>Releases</h1><p>Auto-appended on every prod deploy. One child page per release.</p>',
  });
  result.releases_parent = { id: releasesId };

  let changelog = '';
  if (env.GITHUB_TOKEN) {
    const r = await fetch(`https://raw.githubusercontent.com/${REPO_FULL}/main/CHANGELOG.md`, {
      headers: { 'User-Agent': 'cycling-coach-worker' },
    });
    if (r.ok) {
      const md = await r.text();
      const versionEsc = version.replace(/^v/, '').replace(/\./g, '\\.');
      const re = new RegExp(`## \\[${versionEsc}\\][\\s\\S]*?(?=\\n## \\[|$)`, 'm');
      const match = md.match(re);
      changelog = (match?.[0] || '').slice(0, 4000);
    }
  }
  const commits = await recentCommits(env);
  const releaseTitle = `Release ${version}`;
  const releaseChildren = await conf.children(releasesId);
  let releaseChildId = releaseChildren.find((c) => c.title === releaseTitle)?.id;
  let releaseStatus = 'unchanged';
  if (!releaseChildId) {
    // Detect migrations + breaking-change flags in the CHANGELOG entry so the
    // release page surfaces them as Confluence callouts (warnings) at the top
    // — readers don't have to read the whole entry to know whether the deploy
    // was schema-affecting or backwards-incompatible.
    const migrationMatches = (changelog || '').match(/Migration\s+\d{4}[^\.\n]*/gi) || [];
    const breakingDetected = /\bBREAKING\b|\bBREAKING CHANGE\b|\bbreaking change\b/.test(changelog || '');
    const migrationCallout = migrationMatches.length
      ? `<ac:structured-macro ac:name="warning"><ac:rich-text-body><p><strong>Schema-affecting deploy.</strong> This release shipped D1 migration(s):</p><ul>${migrationMatches.map((m) => `<li><code>${escapeXml(m.trim())}</code></li>`).join('')}</ul><p>Apply order is strict. Verify <code>schema.sql</code> matches cumulative state before next bootstrap.</p></ac:rich-text-body></ac:structured-macro>`
      : '';
    const breakingCallout = breakingDetected
      ? `<ac:structured-macro ac:name="warning"><ac:rich-text-body><p><strong>Breaking change in this release.</strong> See the changelog body for the contract delta and migration steps for clients.</p></ac:rich-text-body></ac:structured-macro>`
      : '';
    const releaseStorage = `<h1>${escapeXml(releaseTitle)}</h1>
<p><strong>Date:</strong> ${date} · <strong>Worker:</strong> <code>${escapeXml(version)}</code> · <strong>Repo:</strong> <a href="https://github.com/jose-reboredo/cycling-coach/blob/main/CHANGELOG.md">CHANGELOG.md</a></p>
${breakingCallout}
${migrationCallout}
<h2>Changelog entry</h2>
<pre>${escapeXml(changelog || '(no entry found in CHANGELOG.md)')}</pre>
<h2>Commits in this window</h2>
<p><em>Most recent commits to <code>main</code>; the release ships everything up to + including the <code>chore(release)</code> commit. Cross-reference the changelog above for the curated narrative.</em></p>
<ul>${commits
      .map((c) => `<li><code>${escapeXml(c.sha.slice(0, 7))}</code> — ${escapeXml(c.message)}</li>`)
      .join('')}</ul>
<h2>Verification</h2>
<p>Smoke checks that ran post-deploy:</p>
<ul>
  <li><code>GET /version</code> reports <code>${escapeXml(version)}</code> + <code>build_date: ${date}</code></li>
  <li><code>GET /roadmap</code> returns 200 with non-zero <code>count</code></li>
  <li><code>POST /admin/document-release</code> without bearer returns 401 (this page proves it succeeded with bearer)</li>
</ul>
<p>If a regression was found post-deploy, the corresponding rollback / hotfix entry is its own child page. See the <strong>Runbook</strong> page for the rollback procedure.</p>`;
    const created = await conf.create({
      spaceId,
      parentId: releasesId,
      title: releaseTitle,
      storage: releaseStorage,
    });
    releaseChildId = created.id;
    releaseStatus = 'created';
  }
  result.release_entry = { id: releaseChildId, title: releaseTitle, status: releaseStatus };

  result.commits_in_window = commits.length;
  return result;
}

// Map a GitHub issue to the shape the React WhatsNext page expects.
//
// One-shot roadmap bootstrap (kept for reference / future re-seeding).
// Endpoint removed in v8.3.0 — to invoke again, re-add the route handler in
// the fetch() block above. Idempotent — safe to re-run.
// Files the v8.x backlog (still-open items from the original v8.0.0 issue list)
// as real GitHub issues. Idempotent — skips titles that already exist.
// Files the security audit batch. Idempotent — skips titles that already exist.
async function fileSecurityIssues(env) {
  const REPO = env.GITHUB_REPO || 'jose-reboredo/cycling-coach';
  const ghHeaders = {
    'User-Agent': 'cycling-coach-bootstrap',
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
  const out = { issues: [] };

  const msRes = await fetch(`https://api.github.com/repos/${REPO}/milestones?state=all&per_page=100`, { headers: ghHeaders });
  const existingMs = msRes.ok ? await msRes.json() : [];
  const msByTitle = new Map(existingMs.map((m) => [m.title, m.number]));

  const isRes = await fetch(`https://api.github.com/repos/${REPO}/issues?state=all&per_page=100`, { headers: ghHeaders });
  const existingIs = isRes.ok ? await isRes.json() : [];
  const existingIsTitles = new Set(existingIs.filter((i) => !i.pull_request).map((i) => i.title));

  const ISSUES = [
    {
      title: 'OAuth state parameter is predictable JSON, not a CSRF nonce',
      labels: ['priority:high', 'area:auth', 'type:bug'],
      milestone: 'v8.4.0',
      body:
        '## Bug\n`/authorize` currently sets:\n```js\nconst state = btoa(JSON.stringify({ pwa: isPwa, origin }));\n```\nThe state value is deterministic — same input produces the same output. `/callback` decodes it to extract origin + pwa flag, but never verifies the value was issued by us.\n\n## Risk (CSRF)\n1. Attacker initiates OAuth in their own browser, gets a `code`.\n2. Tricks victim into clicking `https://cycling-coach.../callback?code=<attacker_code>&state=<predictable>`.\n3. Victim\'s browser exchanges the attacker\'s code → Strava returns *attacker\'s* tokens → written to victim\'s localStorage.\n4. Victim now sees attacker\'s data; any actions are logged against the attacker.\n\nThe OAuth spec mandates `state` be a single-use, unguessable nonce.\n\n## Fix\n- `/authorize`: generate `crypto.randomUUID()` per call. Store in KV (`key=uuid`, `value={pwa,origin,expires_at}`, TTL 10 min). Set `state` param to the uuid only.\n- `/callback`: read uuid from `state`, look up KV, verify exists + not expired, delete on use (single-use).\n- Move pwa + origin metadata into the KV value, off the wire.\n\n## Acceptance\n- [ ] KV namespace bound to Worker (`OAUTH_STATE`)\n- [ ] `/authorize` generates random uuid, stores in KV with 10-min TTL\n- [ ] `/callback` rejects requests where state isn\'t in KV (returns 403)\n- [ ] State is single-use (deleted from KV after first read)\n- [ ] PWA + origin metadata still round-trips correctly\n- [ ] Smoke: full OAuth flow works end-to-end after change',
    },
    {
      title: 'Add security headers to all Worker responses (CSP, HSTS, X-Frame-Options)',
      labels: ['priority:high', 'area:backend', 'type:feature'],
      milestone: 'v8.4.0',
      body:
        '## Feature\nNone of these headers are currently set on Worker responses or static assets:\n- `Content-Security-Policy`\n- `Strict-Transport-Security` (HSTS)\n- `X-Frame-Options` (clickjack protection)\n- `X-Content-Type-Options: nosniff`\n- `Referrer-Policy: strict-origin-when-cross-origin`\n- `Permissions-Policy: camera=(), microphone=(), geolocation=()`\n\n## Implementation\nWrap Worker responses with a `securityHeaders(res)` helper. For static assets, prepend response headers via the asset-handler `_headers` file or runtime middleware.\n\n## Recommended CSP (provisional, tighten later)\n```\ndefault-src \'self\';\nscript-src \'self\';\nstyle-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com;\nfont-src \'self\' https://fonts.gstatic.com;\nimg-src \'self\' https://images.unsplash.com https://*.strava.com data: blob:;\nconnect-src \'self\' https://api.anthropic.com https://www.strava.com https://api.github.com;\nframe-ancestors \'none\';\nbase-uri \'self\';\n```\n\n## Acceptance\n- [ ] `securityHeaders()` helper applies the 6 headers above\n- [ ] All Worker JSON/HTML responses include them\n- [ ] Static assets (SPA, /sw.js, /manifest, icons) include them\n- [ ] HSTS only enabled on the `*.workers.dev` host (not localhost dev)\n- [ ] Verified via securityheaders.com or `curl -I` — score ≥ A\n- [ ] No regression: SPA loads, fonts render, /api proxy works',
    },
    {
      title: 'Lock down CORS on /coach + /coach-ride — replace * with allowlist',
      labels: ['priority:medium', 'area:backend', 'type:chore'],
      milestone: 'v8.4.0',
      body:
        '## Chore\nThe Worker sets `Access-Control-Allow-Origin: *` on every response. For:\n- `/api/*` — fine (Authorization header is the gate)\n- `/roadmap` — fine (public read)\n- `/version` — fine (public read)\n- `/coach`, `/coach-ride` — **not fine**: any third-party page can POST to these endpoints with the user\'s `api_key` in the body if they trick the user into providing it\n\n## Fix\nReplace blanket `*` for the AI endpoints with a per-route allowlist:\n```js\nconst ALLOWED_ORIGINS = [\n  \'https://cycling-coach.josem-reboredo.workers.dev\',\n  \'http://localhost:5173\',\n];\nconst origin = request.headers.get(\'Origin\') || \'\';\nconst aiCors = {\n  \'Access-Control-Allow-Origin\': ALLOWED_ORIGINS.includes(origin) ? origin : \'null\',\n  Vary: \'Origin\',\n  ...\n};\n```\n\n## Acceptance\n- [ ] /coach + /coach-ride only return CORS headers when Origin is in allowlist\n- [ ] /api/*, /roadmap, /version keep `*` (no credentials, no per-user data)\n- [ ] OPTIONS preflight handled correctly for both modes\n- [ ] No regression: the React SPA still calls /coach successfully from prod + dev',
    },
    {
      title: '/webhook POST has no source verification',
      labels: ['priority:medium', 'area:backend', 'type:bug'],
      milestone: 'v8.5.0',
      body:
        '## Bug\n`POST /webhook` accepts any payload and logs it via `console.log`. Currently low-impact — the handler doesn\'t write to D1 — but as soon as we wire D1 sync to webhook events (depends on backfill flow), an attacker can spam fake events and corrupt our state.\n\n## Strava webhook signing\nStrava webhooks don\'t carry HMAC signatures, but they do come from a small set of [published IP ranges](https://developers.strava.com/docs/webhookexamples/). Two viable defences:\n1. **IP allowlist** at the Worker — verify `request.headers.get(\'cf-connecting-ip\')` is in Strava\'s range\n2. **Path-based shared secret** — register the webhook with a path like `/webhook/<random-secret>` (Strava\'s API allows arbitrary URL); attacker can\'t hit it without the URL\n\n## Acceptance\n- [ ] Either IP allowlist OR path-based shared secret implemented\n- [ ] Spam request to /webhook (from non-Strava IP / wrong path) returns 403, not 200\n- [ ] Legitimate Strava webhook events still flow through\n- [ ] Document the choice in CONTRIBUTING.md\n\n## Depends on\n- Schema v2 migration applied (#7) — until D1 webhook sync ships, this is hardening, not blocking',
    },
    {
      title: 'Rate-limit /coach + /coach-ride to prevent abuse + cost runaway',
      labels: ['priority:medium', 'area:backend', 'type:feature'],
      milestone: 'v8.5.0',
      body:
        '## Feature\nBoth `/coach` and `/coach-ride` proxy to Anthropic Claude. With no rate limits, a malicious script that obtains a user\'s `api_key` can spam Claude indefinitely through us, burning the user\'s Anthropic credits.\n\nWorse: if `env.ANTHROPIC_API_KEY` (the optional fallback) is ever set, the endpoints would use *our* key for any unauthenticated request.\n\n## Implementation\nUse [Cloudflare Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/):\n\n```jsonc\n"rate_limiting": [\n  { "name": "AI_RATE", "namespace_id": "1001", "simple": { "limit": 60, "period": 60 } }\n]\n```\n\n- Per-IP: 60 req/hour for `/coach`, 120 req/hour for `/coach-ride`.\n- Per-token (athlete_id parsed from Strava token): 100 reports/day for `/coach`, 500 verdicts/day for `/coach-ride`.\n\n## Acceptance\n- [ ] Rate-limit binding wired in `wrangler.jsonc`\n- [ ] Worker checks limit before forwarding to Anthropic\n- [ ] Returns 429 with `Retry-After` header when exceeded\n- [ ] Logs/metrics: counter for "rate-limited requests" per endpoint\n- [ ] Smoke: 61st request from same IP within 1h returns 429',
    },
    {
      title: 'STRAVA_VERIFY_TOKEN has insecure fallback string in source',
      labels: ['priority:low', 'area:backend', 'type:chore'],
      milestone: 'v8.5.0',
      body:
        '## Chore\nIn `src/worker.js`:\n```js\nif (mode === \'subscribe\' && token === (env.STRAVA_VERIFY_TOKEN || \'cycling-coach-verify\')) {\n```\n\nIf the env var isn\'t set in Cloudflare (current state likely), anyone reading the source on GitHub knows the verify token. They can subscribe arbitrary endpoints to the cycling-coach Strava app\'s webhooks if they have OAuth access — minor but an easy win.\n\n## Fix\nFail-closed if the env var is missing:\n```js\nif (!env.STRAVA_VERIFY_TOKEN) {\n  return new Response(\'Webhook verification not configured\', { status: 503 });\n}\nif (mode === \'subscribe\' && token === env.STRAVA_VERIFY_TOKEN) { ... }\n```\n\nThen set the env var:\n```\necho -n "<random-string>" | npx wrangler secret put STRAVA_VERIFY_TOKEN\n```\n\n## Acceptance\n- [ ] Hardcoded fallback removed\n- [ ] `STRAVA_VERIFY_TOKEN` secret set in Cloudflare\n- [ ] Webhook GET returns 503 if env missing\n- [ ] Webhook subscription via Strava UI still works after rotation',
    },
    {
      title: 'Redact api_key from any logged error paths in Worker',
      labels: ['priority:low', 'area:backend', 'type:chore'],
      milestone: 'v8.5.0',
      body:
        '## Chore\nThe Worker has `observability.logs.persist: true` in `wrangler.jsonc` — all console output is retained. `/coach` and `/coach-ride` accept `api_key` in the JSON body. If the request handler throws on a path that includes the body in the error message, the key ends up in persistent logs.\n\n## Audit + fix\nGrep `src/worker.js` for `console.log` and `console.error` paths in `/coach` and `/coach-ride`. Today they look clean — but defensive: add a global `redactSensitive(s)` that strips `api_key`, `access_token`, `refresh_token` from any log message.\n\n```js\nfunction redactSensitive(s) {\n  return String(s)\n    .replace(/api_key["\\s:]*"?[a-zA-Z0-9_-]+/g, \'api_key="[redacted]"\')\n    .replace(/sk-ant-[a-zA-Z0-9_-]+/g, \'[redacted-anthropic-key]\')\n    .replace(/access_token["\\s:]*"?[a-zA-Z0-9_-]+/g, \'access_token="[redacted]"\');\n}\n```\n\n## Acceptance\n- [ ] `redactSensitive` helper added\n- [ ] All `console.log`/`error` paths in `/coach` + `/coach-ride` wrap their args\n- [ ] Cloudflare log search for `sk-ant-` or `api_key=` returns no real values',
    },
    {
      title: '/admin/* endpoint pattern needs explicit auth, not just developer discipline',
      labels: ['priority:low', 'area:backend', 'type:chore'],
      milestone: 'v8.5.0',
      body:
        '## Chore\nThe bootstrap pattern we used for `/admin/file-backlog`, `/admin/file-security`, `/admin/close-issue`, `/admin/bootstrap-roadmap` relies on the developer remembering to: add → deploy → run → remove → redeploy. If any step is interrupted, the endpoint stays publicly accessible (only gated by `env.GITHUB_TOKEN`\'s existence — anyone who finds the path can hit it and trigger writes).\n\n## Fix\nAdd an `Authorization: Bearer <ADMIN_SECRET>` check on every `/admin/*` endpoint. `ADMIN_SECRET` stored as Worker secret (separate from `GITHUB_TOKEN`). Even if an endpoint is forgotten in code, it can\'t be exploited without the secret.\n\n```js\nfunction requireAdmin(request, env) {\n  const auth = request.headers.get(\'Authorization\');\n  if (!env.ADMIN_SECRET || auth !== `Bearer ${env.ADMIN_SECRET}`) {\n    return new Response(\'Unauthorized\', { status: 401 });\n  }\n  return null;\n}\n```\n\n## Acceptance\n- [ ] `ADMIN_SECRET` Worker secret created\n- [ ] Every `/admin/*` handler calls `requireAdmin` first\n- [ ] curl without header returns 401\n- [ ] Future admin endpoints inherit this guard automatically',
    },
    {
      title: 'Document localStorage tokens / XSS threat model in SECURITY.md',
      labels: ['priority:low', 'area:auth', 'type:chore'],
      milestone: 'v8.5.0',
      body:
        '## Documentation\nWe store Strava tokens (`cc_tokens`) + Anthropic API key (`cc_anthropicKey`) + athlete profile (`cc_athleteProfile`) in localStorage. Standard pattern, but vulnerable to XSS — if any XSS sink lands in the React code, attacker exfiltrates everything.\n\nToday there are zero `dangerouslySetInnerHTML` / `innerHTML` usages. React\'s default escaping is the only XSS defence. Stacking CSP (separate issue) is the real defence.\n\n## What to write\nNew `SECURITY.md` at repo root with:\n- **Threat model** — assets stored locally, attack vectors, current mitigations\n- **Defences in place** — React escaping, planned CSP, Strangler-Fig server-side migration path\n- **Future considerations** — httpOnly cookies for Strava tokens, encrypted storage for Anthropic key\n- **Disclosure policy** — how to report security issues (email or GitHub Security Advisory)\n\n## Acceptance\n- [ ] `SECURITY.md` created at repo root\n- [ ] Linked from README + CONTRIBUTING\n- [ ] GitHub Security Advisory enabled in repo settings',
    },
  ];

  for (const issue of ISSUES) {
    if (existingIsTitles.has(issue.title)) {
      out.issues.push({ title: issue.title, status: 'exists' });
      continue;
    }
    const milestoneNum = msByTitle.get(issue.milestone);
    const payload = { title: issue.title, body: issue.body, labels: issue.labels };
    if (milestoneNum) payload.milestone = milestoneNum;
    const r = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST', headers: ghHeaders, body: JSON.stringify(payload),
    });
    if (r.ok) {
      const created = await r.json();
      out.issues.push({ title: issue.title, status: 'created', number: created.number, url: created.html_url });
    } else {
      const err = await r.text().catch(() => '');
      out.issues.push({ title: issue.title, status: r.status, error: err.slice(0, 200) });
    }
  }
  return out;
}

async function fileBacklogIssues(env) {
  const REPO = env.GITHUB_REPO || 'jose-reboredo/cycling-coach';
  const ghHeaders = {
    'User-Agent': 'cycling-coach-bootstrap',
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
  const out = { issues: [] };

  // Resolve milestone titles → numbers (created during the previous bootstrap).
  const msRes = await fetch(`https://api.github.com/repos/${REPO}/milestones?state=all&per_page=100`, { headers: ghHeaders });
  const existingMs = msRes.ok ? await msRes.json() : [];
  const msByTitle = new Map(existingMs.map((m) => [m.title, m.number]));

  // Pre-fetch existing issue titles for de-dup.
  const isRes = await fetch(`https://api.github.com/repos/${REPO}/issues?state=all&per_page=100`, { headers: ghHeaders });
  const existingIs = isRes.ok ? await isRes.json() : [];
  const existingIsTitles = new Set(existingIs.filter((i) => !i.pull_request).map((i) => i.title));

  const ISSUES = [
    {
      title: 'Apply schema v2 migration to remote D1',
      labels: ['priority:high', 'area:db', 'type:chore'],
      milestone: 'v8.3.0',
      body:
        '## Chore\nThe schema v2 migration at `migrations/0001_pmc_and_events.sql` has been written but never applied to the remote D1. It adds:\n- `users.ftp_w / weight_kg / hr_max / ftp_set_at`\n- `activities.duration_s / average_watts / np_w / if_pct / tss / primary_zone`\n- new `daily_load` rollup table for fast PMC reads\n- event extension columns on `goals` (`event_name / event_type / event_distance_km / event_elevation_m / event_location / event_priority`)\n\n## Run\n```bash\nnpx wrangler d1 execute cycling_coach_db --file migrations/0001_pmc_and_events.sql --remote\n```\n\n## Acceptance\n- [ ] Migration applied to remote D1\n- [ ] Verified with `wrangler d1 execute --command "PRAGMA table_info(activities);" --remote` — new columns visible\n- [ ] Verified with `wrangler d1 execute --command "PRAGMA table_info(daily_load);" --remote` — new table visible\n- [ ] Existing rows untouched (additive migration)\n\n## Blocks\n- #2 backfill (depends on these columns existing)',
    },
    {
      title: 'Retroactive TSS backfill from strava_raw_json',
      labels: ['priority:high', 'area:backend', 'type:feature'],
      milestone: 'v8.3.0',
      body:
        '## Feature\nOnce schema v2 is applied AND the user has set their FTP, walk every existing `activities` row, extract `weighted_average_watts` / `average_watts` from the stored `strava_raw_json`, and compute:\n\n```\nIF  = NP / FTP\nTSS = duration_h × IF² × 100\n```\n\nWrite back to the new columns. Idempotent — re-running shouldn\'t double-count.\n\n## Implementation\n- Worker endpoint `POST /admin/backfill-tss` (auth-gated, single-user-only for now).\n- For each row: parse `strava_raw_json`, compute, UPDATE.\n- Seed `daily_load` from the resulting per-day TSS sums so the PMC has a real starting series.\n- Remove the endpoint after running (same pattern as the issue-bootstrap endpoint).\n\n## Acceptance\n- [ ] Endpoint computes TSS for every ride that has watts data\n- [ ] Activities without watts get a duration-based proxy (≈70 TSS / hour) — clearly tagged\n- [ ] `daily_load` rolled up across all backfilled rides\n- [ ] PMC strip on dashboard shows real numbers, not duration proxy\n- [ ] Re-running is a no-op (no double-counting)\n\n## Depends on\n- Schema v2 migration applied (separate issue)',
    },
    {
      title: 'Update Cloudflare CI build command to `npm run build:web`',
      labels: ['priority:high', 'area:ci', 'type:chore'],
      milestone: 'v8.3.0',
      body:
        '## Chore\nThe Cloudflare Workers Builds CI is still using the legacy build command (likely just `wrangler deploy` with no SPA build step). Today every release goes out via local `npx wrangler deploy` because CI would deploy a stale `apps/web/dist`.\n\n## Steps\n1. Workers & Pages → cycling-coach → Settings → Builds\n2. **Build command** → `npm run build:web`\n3. **Deploy command** → leave as `npx wrangler deploy` (default)\n4. Save\n\n## Acceptance\n- [ ] CI build command updated\n- [ ] Push to main triggers full SPA rebuild → Worker deploy with fresh assets\n- [ ] Smoke: `/`, `/dashboard`, `/privacy`, `/whats-next` all 200 with the latest React shell\n- [ ] No more need for manual `npx wrangler deploy` from local',
    },
    {
      title: 'iOS home-screen install + offline PMC tile',
      labels: ['priority:low', 'area:pwa', 'type:feature'],
      milestone: 'v8.4.0',
      body:
        '## Polish\nv8.2.0 ships the PWA shell (`manifest.webmanifest`, maskable icon, service worker). Two things still need work:\n\n### 1. iOS install flow validation\nVerify Add-to-Home-Screen on iOS Safari produces a clean standalone-mode app (no browser chrome, correct icon, correct splash colour). Document the flow in CONTRIBUTING.\n\n### 2. Offline PMC tile\nWhen offline (`navigator.onLine === false` OR fetch fails), render the **last-cached** PMC strip + greeting + recents from IndexedDB instead of a blank screen. Cache the most recent `/api/athlete` + `/api/athlete/activities` payloads in IndexedDB on every successful fetch; rehydrate from there when network fails.\n\n## Acceptance\n- [ ] iOS Add-to-Home-Screen tested, splash + icon render correctly\n- [ ] Cached athlete + activities written to IndexedDB after every successful fetch\n- [ ] Dashboard reads from IndexedDB when fetch fails\n- [ ] PMC strip + recents render with last-known data offline\n- [ ] "Last updated 2h ago · offline" pill visible when serving cached data\n- [ ] Coming back online auto-refreshes\n\n## Distinct from issue #1\nThis is polish + offline UX. Issue #1 is the OAuth-in-PWA-mode bug (different problem).',
    },
    {
      title: 'Persist training prefs to D1 (Strangler-Fig)',
      labels: ['priority:low', 'area:db', 'type:chore'],
      milestone: 'v8.5.0',
      body:
        '## Chore\nToday `surface_pref` and `start_address` (from the routes picker) only live in `localStorage` under `cc_trainingPrefs`. The legacy schema has a `training_prefs` table ready (`athlete_id, sessions_per_week, surface_pref, start_address, updated_at`).\n\n## Implementation (Strangler-Fig)\n- Worker endpoint `POST /training-prefs` writes the row keyed by `athlete_id`.\n- React `useTrainingPrefs` POSTs on update — keep writing to localStorage too until parity is confirmed.\n- Initial load: read from D1 on auth, fall back to localStorage if D1 row is empty (migration path).\n- After ~2 weeks of dual-write with no divergence, remove the localStorage path.\n\n## Acceptance\n- [ ] `/training-prefs` POST endpoint live\n- [ ] React hook dual-writes\n- [ ] On fresh device with stored prefs in D1, settings load from D1 on first dashboard render\n- [ ] No regression: localStorage continues working in parallel',
    },
    {
      title: 'Lighthouse mobile ≥ 90 across all public routes',
      labels: ['priority:medium', 'area:perf', 'type:chore'],
      milestone: 'v8.5.0',
      body:
        '## Performance audit\nThe original brief mandates Lighthouse mobile ≥ 90 (Performance / Accessibility / Best Practices / SEO). Verify and fix.\n\n## Likely fixes (audit first)\n- Bundle: Motion is currently 18.8 KB gzipped — split or replace if it tips the score.\n- Fonts: preload `Geist` + `Geist Mono` first weights, set `display: swap` on the rest.\n- Images: ensure all explicit `width` / `height` (no layout shift).\n- Hover-only interactions audited (none for primary actions).\n\n## Acceptance\n- [ ] Lighthouse mobile ≥ 90 on `/`\n- [ ] Lighthouse mobile ≥ 90 on `/dashboard` (authed + demo modes)\n- [ ] Lighthouse mobile ≥ 90 on `/privacy`\n- [ ] Lighthouse mobile ≥ 90 on `/whats-next`\n- [ ] Lighthouse desktop ≥ 95 on all routes (bonus)\n- [ ] Results documented in CHANGELOG with before/after',
    },
    {
      title: 'In-app "What\'s new" modal',
      labels: ['priority:low', 'area:dashboard', 'type:feature'],
      milestone: 'v8.5.0',
      body:
        '## Feature\nThe legacy v7 dashboard had a changelog modal accessible from a small badge in the top bar. Port it: when a new release ships, users see a discreet badge in the TopBar (`cc_lastSeenVersion < currentVersion`). Click → modal renders the latest 3 entries from `CHANGELOG.md`.\n\n## Implementation\n- Build a tiny CHANGELOG → JSON parser at compile time (Vite import or a build script that emits `apps/web/src/data/changelog.json`).\n- `<WhatsNewBadge>` in the TopBar trailing slot — only renders when there\'s an unseen newer version.\n- Modal: latest 3 release entries with rendered Markdown, dismiss button.\n- "Don\'t show again for vX.Y.Z" stores `cc_lastSeenVersion` in localStorage.\n\n## Acceptance\n- [ ] Badge appears on first dashboard load after a release\n- [ ] Click opens modal with latest 3 entries\n- [ ] Dismiss persists `cc_lastSeenVersion`\n- [ ] No badge on subsequent visits at the same version\n- [ ] Works in both authed + demo modes',
    },
  ];

  for (const issue of ISSUES) {
    if (existingIsTitles.has(issue.title)) {
      out.issues.push({ title: issue.title, status: 'exists' });
      continue;
    }
    const milestoneNum = msByTitle.get(issue.milestone);
    const payload = { title: issue.title, body: issue.body, labels: issue.labels };
    if (milestoneNum) payload.milestone = milestoneNum;
    const r = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST', headers: ghHeaders, body: JSON.stringify(payload),
    });
    if (r.ok) {
      const created = await r.json();
      out.issues.push({ title: issue.title, status: 'created', number: created.number, url: created.html_url });
    } else {
      const err = await r.text().catch(() => '');
      out.issues.push({ title: issue.title, status: r.status, error: err.slice(0, 200) });
    }
  }
  return out;
}

// Files the 4 audit deferrals from the 2026-04-28 dashboard design audit
// against the v8.5.0 milestone. Idempotent — skips titles that already exist.
// Same wire format as fileBacklogIssues / fileSecurityIssues.
//
// Route handler removed after one-shot run on 2026-04-28 (issues #24–#27).
// To re-invoke: re-add the /admin/file-audit-issues block in fetch() above.
// eslint-disable-next-line no-unused-vars
async function fileAuditIssues(env) {
  const REPO = env.GITHUB_REPO || 'jose-reboredo/cycling-coach';
  const ghHeaders = {
    'User-Agent': 'cycling-coach-bootstrap',
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
  const out = { issues: [] };

  // Ensure v8.5.0 milestone exists.
  const msRes = await fetch(`https://api.github.com/repos/${REPO}/milestones?state=all&per_page=100`, { headers: ghHeaders });
  const existingMs = msRes.ok ? await msRes.json() : [];
  const msByTitle = new Map(existingMs.map((m) => [m.title, m.number]));
  if (!msByTitle.has('v8.5.0')) {
    const r = await fetch(`https://api.github.com/repos/${REPO}/milestones`, {
      method: 'POST', headers: ghHeaders,
      body: JSON.stringify({ title: 'v8.5.0', description: 'Weekly release' }),
    });
    if (r.ok) {
      const created = await r.json();
      msByTitle.set('v8.5.0', created.number);
    }
  }

  // De-dup by title.
  const isRes = await fetch(`https://api.github.com/repos/${REPO}/issues?state=all&per_page=100`, { headers: ghHeaders });
  const existingIs = isRes.ok ? await isRes.json() : [];
  const existingIsTitles = new Set(existingIs.filter((i) => !i.pull_request).map((i) => i.title));

  const ISSUES = [
    {
      title: 'RideDetail expand: animate transform/opacity, not height: auto',
      labels: ['priority:medium', 'area:dashboard', 'type:perf'],
      milestone: 'v8.5.0',
      body:
        '## Audit deferral — H6b\n2026-04-28 dashboard audit (`docs/superpowers/specs/2026-04-28-dashboard-design-audit.md`).\n\n### Problem\n`RideDetail` expand animation uses `initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: \'auto\' }}`. Animating to `height: auto` forces Motion to measure target height each frame and triggers layout — it\'s the explicit anti-pattern called out in the ui-ux-pro-max react-performance.csv: \'Use transform and opacity for animations\'.\n\n`VolumeChart` bars were already swapped to `scaleY` in commit `426f24e`; this issue tracks the trickier RideDetail case.\n\n### Options\n- (a) Drop the height animation entirely, keep opacity-fade. Layout snap is OK for an expand panel; Strava does the same.\n- (b) Use `<details>` element with CSS `interpolate-size: allow-keywords` (Chromium-only, recent — would need fallback).\n- (c) Measure with `ResizeObserver` on first open, cache the height per-rideId, animate to a number.\n\nRecommendation: (a) — simplest, removes the anti-pattern entirely. The opacity fade alone reads as \'expand\'.\n\n### Acceptance\n- [ ] RideDetail.tsx initial/animate/exit no longer reference `height`\n- [ ] Visual smoke test: expand a ride at 375px, confirm content reveals smoothly\n- [ ] React DevTools Profiler shows no layout passes during expand',
    },
    {
      title: 'Accent #ff4d00 fails AA contrast for small text — introduce --c-accent-light',
      labels: ['priority:medium', 'area:design-system', 'type:a11y'],
      milestone: 'v8.5.0',
      body:
        '## Audit deferral — H8\n2026-04-28 dashboard audit. Touches the design system, deferred for a deliberate pass.\n\n### Problem\nMolten orange `#ff4d00` on canvas `#0a0a0c` is approximately 3.9:1 — fails WCAG AA for normal text (<24px / <19px bold), passes for large text. PARS uses the accent for some small mono labels:\n\n- `Pill.accent` (10px mono uppercase)\n- `.brandBadge` \'v8\' (9px mono)\n- `.surfaceEm` icon 12px\n- `.matchHigh` 22px is borderline (large-text threshold 19px bold / 24px regular)\n- `.bulletGood::before` decorative line — not text, exempt\n\n### Proposal\nIntroduce a sibling token `--c-accent-light: #ff7a3d` (≈ 5.2:1 on canvas), specifically for ≤14px usage. Don\'t change `--c-accent` itself — the brand call-to-action color stays. Audit the call-sites and swap the accent token for accent-light only on small-text instances.\n\n### Open question\nDoes the accent-light shift the brand feel? If so, alternative: brighten `--c-accent` itself slightly (e.g. `#ff5e1a`) to lift the whole system above 4.5:1. Single-source change, but every accent surface gets warmer.\n\n### Acceptance\n- [ ] Decision logged: introduce token vs. shift the existing one\n- [ ] All accent-on-canvas text ≤14px audited and brought to 4.5:1\n- [ ] Confluence "User Interfaces" page updated with the contrast rule\n- [ ] No regressions in PARS "feel" — review with design eye after change',
    },
    {
      title: 'BottomNav active tab should sync to scroll position, not last click',
      labels: ['priority:medium', 'area:dashboard', 'type:enhancement'],
      milestone: 'v8.5.0',
      body:
        '## Audit deferral — M2\n2026-04-28 dashboard audit.\n\n### Problem\n`BottomNav` (mobile) tracks an `activeId` from `useState`, set on click. Once the user scrolls naturally — which is most of the time — the active orange dot stays on whichever tab they last tapped, not on the section currently in view. Skill rule: \'Navigation: Active State — Highlight active nav item with color/underline. Don\'t have no visual feedback on current location.\'\n\n### Approach\n`IntersectionObserver` over the four section IDs (`#today`, `#train`, `#stats`, `#you`). Threshold ~0.5; the section with the highest intersection ratio in the viewport wins. Update `activeId` on changes; debounce (rAF) to avoid thrash on fast scroll.\n\n`#you` doesn\'t exist as a section yet (it goes to UserMenu? to a settings page?) — decide as part of this work. Could leave as scrolling to the bottom of the dashboard for now.\n\n### Acceptance\n- [ ] BottomNav active state updates as the user scrolls (no click required)\n- [ ] Tapping a tab still scrolls to + activates its section\n- [ ] No re-render storms — observer fires reasonably (every section transition)\n- [ ] \'#you\' has a defined target (or removed from BottomNav)\n- [ ] Manual smoke at 375px',
    },
    {
      title: 'UserMenu: arrow-key navigation + focus management (extract useFocusTrap)',
      labels: ['priority:medium', 'area:dashboard', 'type:a11y'],
      milestone: 'v8.5.0',
      body:
        '## Audit deferral — M5 (+ refactors H3 into shared util)\n2026-04-28 dashboard audit. The OnboardingModal got an inline focus trap in commit `0e168a1`; this issue extracts it into a reusable hook and applies it to UserMenu.\n\n### Problem (UserMenu)\nThe popover has `role="menu"` + `role="menuitem"` (good), `aria-expanded`, `aria-haspopup`, ESC + click-outside close (good). Missing per ARIA:\n- ↑/↓ to move between menu items\n- Focus moves into menu when opened\n- Focus returns to the trigger when closed\n\n### Approach\n1. Extract `useFocusTrap(active: boolean, opts: { restore: boolean })` from `OnboardingModal.tsx` into `apps/web/src/hooks/useFocusTrap.ts`. Returns a ref to attach to the trapping container.\n2. Add `useArrowMenu` companion hook for ↑/↓/Home/End within a list of refs.\n3. Apply both to `UserMenu`. `OnboardingModal` re-uses the trap.\n\n### Acceptance\n- [ ] `useFocusTrap` hook in `apps/web/src/hooks/` with unit notes in JSDoc\n- [ ] OnboardingModal swapped to use the hook (delete inline trap, no behavior change)\n- [ ] UserMenu uses the hook + arrow nav: open menu → first item focused → ↓/↑ moves → ESC closes → trigger refocused\n- [ ] Tab still works to leave the menu (closes it)\n- [ ] Manual keyboard probe of both surfaces',
    },
  ];

  for (const issue of ISSUES) {
    if (existingIsTitles.has(issue.title)) {
      out.issues.push({ title: issue.title, status: 'exists' });
      continue;
    }
    const milestoneNum = msByTitle.get(issue.milestone);
    const payload = { title: issue.title, body: issue.body, labels: issue.labels };
    if (milestoneNum) payload.milestone = milestoneNum;
    const r = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST', headers: ghHeaders, body: JSON.stringify(payload),
    });
    if (r.ok) {
      const created = await r.json();
      out.issues.push({ title: issue.title, status: 'created', number: created.number, url: created.html_url });
    } else {
      const err = await r.text().catch(() => '');
      out.issues.push({ title: issue.title, status: r.status, error: err.slice(0, 200) });
    }
  }
  return out;
}

// Closes the two v8.5.0 issues that are de-facto already shipped:
//   #21  /admin/* explicit auth — requireAdmin() shipped in v8.3.0
//   #23  Auto-update Confluence on prod deploy — npm run docs:sync since v8.3.0
// Idempotent — skips issues already in 'closed' state.
//
// Route handler removed after one-shot run on 2026-04-28 (Phase 0a of the
// v8.5.0 backlog burn). To re-invoke: re-add the /admin/close-issues block
// in fetch().
// eslint-disable-next-line no-unused-vars
async function closeAuditTriageIssues(env) {
  const REPO = env.GITHUB_REPO || 'jose-reboredo/cycling-coach';
  const ghHeaders = {
    'User-Agent': 'cycling-coach-bootstrap',
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  const TRIAGE = [
    {
      number: 21,
      comment:
        'Closing as already-shipped. `requireAdmin()` was added in v8.3.0 (commit `2766753`) ' +
        'and is now used by every `/admin/*` endpoint that exists today (`/admin/document-release`, ' +
        '`/admin/file-audit-issues` while it was active). The acceptance criteria here are met:\n\n' +
        '- ✅ ADMIN_SECRET Worker secret created\n' +
        '- ✅ Every /admin/* handler calls `requireAdmin` first\n' +
        '- ✅ curl without header returns 401\n' +
        '- ✅ Future admin endpoints inherit the guard automatically\n\n' +
        'Closed via the v8.5.0 Phase 0 triage pass.',
    },
    {
      number: 23,
      comment:
        'Closing as already-shipped. The auto-doc Worker endpoint `/admin/document-release` ' +
        'shipped in v8.3.0 and runs on every `npm run deploy` (build:web → wrangler deploy → ' +
        'docs:sync). Verified working through v8.3.0, v8.4.0, v8.4.1 deploys this week.\n\n' +
        '- ✅ Confluence Releases parent page seeded\n' +
        '- ✅ Per-release child pages created automatically\n' +
        '- ✅ Spec pages hash-skip to avoid pointless rewrites\n' +
        '- ✅ Roadmap page regenerated on each deploy\n\n' +
        'Closed via the v8.5.0 Phase 0 triage pass.',
    },
  ];

  const out = { closed: [] };
  for (const item of TRIAGE) {
    // Check current state.
    const getRes = await fetch(`https://api.github.com/repos/${REPO}/issues/${item.number}`, { headers: ghHeaders });
    if (!getRes.ok) {
      out.closed.push({ number: item.number, status: getRes.status, error: 'fetch failed' });
      continue;
    }
    const issue = await getRes.json();
    if (issue.state === 'closed') {
      out.closed.push({ number: item.number, status: 'already-closed', url: issue.html_url });
      continue;
    }

    // Post the closing comment first, then close.
    await fetch(`https://api.github.com/repos/${REPO}/issues/${item.number}/comments`, {
      method: 'POST', headers: ghHeaders, body: JSON.stringify({ body: item.comment }),
    });
    const closeRes = await fetch(`https://api.github.com/repos/${REPO}/issues/${item.number}`, {
      method: 'PATCH', headers: ghHeaders, body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
    });
    if (closeRes.ok) {
      const updated = await closeRes.json();
      out.closed.push({ number: item.number, status: 'closed', url: updated.html_url });
    } else {
      out.closed.push({ number: item.number, status: closeRes.status, error: await closeRes.text().catch(() => '') });
    }
  }
  return out;
}

async function bootstrapRoadmap(env) { // eslint-disable-line no-unused-vars
  const REPO = env.GITHUB_REPO || 'jose-reboredo/cycling-coach';
  const ghHeaders = {
    'User-Agent': 'cycling-coach-bootstrap',
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  const out = { labels: [], milestones: [], issues: [], errors: [] };

  // ---- LABELS ----
  const LABELS = [
    { name: 'priority:high', color: 'B91C1C', description: 'Blocks something or a release' },
    { name: 'priority:medium', color: 'F59E0B', description: 'Important, scheduled' },
    { name: 'priority:low', color: '6B7280', description: 'Nice to have' },
    { name: 'area:dashboard', color: 'FF4D00', description: 'Dashboard surface' },
    { name: 'area:design-system', color: 'C4FF3A', description: 'Tokens, components, motion' },
    { name: 'area:auth', color: '3B8CE8', description: 'OAuth, tokens, session' },
    { name: 'area:db', color: '4ADE80', description: 'D1, schema, migrations' },
    { name: 'area:backend', color: 'A855F7', description: 'Worker logic, API proxy' },
    { name: 'area:ci', color: 'FACC15', description: 'Cloudflare Builds, CI/CD' },
    { name: 'area:pwa', color: '8B5CF6', description: 'Service worker, manifest, offline' },
    { name: 'area:perf', color: 'EF4444', description: 'Lighthouse, bundle, runtime' },
    { name: 'area:routes', color: 'FB923C', description: 'Saved routes, picker' },
    { name: 'type:feature', color: 'C4FF3A', description: 'New capability' },
    { name: 'type:bug', color: 'EF4444', description: 'Defect / regression' },
    { name: 'type:chore', color: '6B7280', description: 'Maintenance / cleanup' },
    { name: 'status:in-progress', color: 'FF4D00', description: 'Actively being worked on' },
  ];

  // Pre-fetch existing labels
  const lblRes = await fetch(`https://api.github.com/repos/${REPO}/labels?per_page=100`, { headers: ghHeaders });
  const existingLabels = lblRes.ok ? (await lblRes.json()).map((l) => l.name) : [];
  for (const l of LABELS) {
    if (existingLabels.includes(l.name)) {
      out.labels.push({ name: l.name, status: 'exists' });
      continue;
    }
    const r = await fetch(`https://api.github.com/repos/${REPO}/labels`, {
      method: 'POST', headers: ghHeaders, body: JSON.stringify(l),
    });
    out.labels.push({ name: l.name, status: r.status });
  }

  // ---- MILESTONES ----
  const MILESTONES = [
    { title: 'v8.3.0', description: 'Weekly release — backfill, live routes, CI build cmd' },
    { title: 'v8.4.0', description: 'Weekly release — dashboard footer, goal editor, route fixes' },
    { title: 'v8.5.0', description: 'Weekly release — perf + Lighthouse 90' },
  ];
  const msRes = await fetch(`https://api.github.com/repos/${REPO}/milestones?state=all&per_page=100`, { headers: ghHeaders });
  const existingMs = msRes.ok ? await msRes.json() : [];
  const msByTitle = new Map(existingMs.map((m) => [m.title, m.number]));
  for (const m of MILESTONES) {
    if (msByTitle.has(m.title)) {
      out.milestones.push({ title: m.title, status: 'exists', number: msByTitle.get(m.title) });
      continue;
    }
    const r = await fetch(`https://api.github.com/repos/${REPO}/milestones`, {
      method: 'POST', headers: ghHeaders, body: JSON.stringify(m),
    });
    if (r.ok) {
      const created = await r.json();
      msByTitle.set(m.title, created.number);
      out.milestones.push({ title: m.title, status: 'created', number: created.number });
    } else {
      out.milestones.push({ title: m.title, status: r.status });
    }
  }

  // ---- ISSUES ----
  const ISSUES = [
    {
      title: 'Dashboard is missing the site footer',
      labels: ['priority:medium', 'area:dashboard', 'type:bug'],
      milestone: 'v8.4.0',
      body:
        '## Bug\nFooter renders on /, /privacy, and /whats-next but is missing on /dashboard.\n\n## Expected\nThe dashboard surface should carry the same editorial footer (brand mark, blurb, navigation columns, version stamp) so users have a consistent way to reach Privacy / What\'s next / Powered-by links from anywhere in the app.\n\n## Suggestion\n- Extract the existing Landing footer into a shared `<SiteFooter/>` component (apps/web/src/components/SiteFooter/).\n- Render it at the bottom of /dashboard (above BottomNav offset on mobile so it isn\'t covered) and on /whats-next + /privacy too.\n- Drop the "Revoke access" link from the public list while we\'re at it — see separate issue.',
    },
    {
      title: 'Remove "Revoke access" from the public footer',
      labels: ['priority:low', 'area:design-system', 'type:chore'],
      milestone: 'v8.4.0',
      body:
        '## Cleanup\nThe Landing footer\'s "Trust" column currently exposes `https://www.strava.com/settings/apps` as "Revoke access". That action is only meaningful for an authenticated user — it confuses anonymous visitors and clutters the marketing surface.\n\n## Acceptance\n- Remove "Revoke access" from the public footer (Landing + WhatsNext).\n- Keep it inside the authenticated UserMenu where it already exists (avatar pill → "Revoke at Strava ↗").\n- Replace the slot with something useful for anon visitors: e.g. "Status" link to /version, or simply drop the column.',
    },
    {
      title: 'Yearly km goal is not editable + clarify how it\'s set',
      labels: ['priority:high', 'area:dashboard', 'type:feature'],
      milestone: 'v8.4.0',
      body:
        '## Bug + question\nYearly distance goal is currently hardcoded at 8,000 km in MOCK_GOAL. The user can\'t change it. We also haven\'t decided how the goal is defined: AI-suggested or user-set?\n\n## Decision needed\n**Recommendation: user-set, with an AI-suggested default.**\n- On first visit (or if no goal is saved), the AI Coach panel can suggest a target based on (a) the rider\'s last 12 months of volume, (b) their declared goal event distance/elevation, (c) FTP-trend during build phase. We propose a number.\n- The user can accept it, override it, or clear it. Edits inline on the goal-ring card.\n\n## Acceptance\n- New `useYearlyGoal` hook backed by localStorage (cc_yearlyGoal { kmTarget, set_at, source: \'ai\'|\'user\' }).\n- Goal-ring card on the dashboard gets an "Edit" pencil that flips the ring tile into a numeric input.\n- AI Coach output extended with an optional `suggested_goal_km` field that pre-fills the input on first run, tagged as "AI-suggested" until the user touches it.\n- Persists alongside other prefs; will move to D1 `goals` table when schema v2 is applied remotely.',
    },
    {
      title: 'Show distance + elevation numbers per bucket in the Volume chart',
      labels: ['priority:medium', 'area:dashboard', 'type:feature'],
      milestone: 'v8.4.0',
      body:
        '## Feature\nThe Volume chart (Distance & Elevation, weekly/monthly toggle) currently renders proportional bars with a tiny km value under each. Users want the full numeric breakdown alongside the bars: total distance per period AND total elevation per period.\n\n## Acceptance\n- Each bucket renders `<km>` AND `<m>` under the bar (mono, tabular numerals, slightly different weight to differentiate distance from elevation).\n- Hover/tap on a bar surfaces a tooltip with: km, m, ride count, TSS sum.\n- The header total already shows km + m for the visible window — keep that.\n- Mobile: if both labels don\'t fit, the elevation number sits in a smaller pill under the km value (don\'t truncate).\n- Maintain Lighthouse mobile ≥ 90 — no JS-heavy charting library, stick to inline SVG + Motion.',
    },
    {
      title: 'Suggested routes broken + generate routes from AI plan + use Strava surface labels',
      labels: ['priority:high', 'area:routes', 'type:bug'],
      milestone: 'v8.4.0',
      body:
        '## Three problems in the Routes panel\n\n### 1. Currently broken\nThe Routes for today panel renders MOCK_ROUTES (Albis Loop, Üetliberg, Greifensee, etc.) — those don\'t reflect the user\'s actual saved routes and the scoring against today\'s plan is meaningless without real data.\n\n### 2. AI-generated route suggestions\nWe need a real path from "AI Coach said today is Sweet-spot 3×12 / 1h15" → "here are 3 routes that match". Two complementary sources:\n- **Strava saved routes**: hit /api/athlete/routes via the Worker proxy, score them against today\'s target zone + duration + elevation profile.\n- **AI-generated route brief**: when no saved route fits today\'s plan, the Claude weekly-plan prompt should include a "route brief" per day (start address + target distance + target elevation + terrain hint). Render that as a card the user can paste into Komoot/Ride With GPS to plan the route.\n\n### 3. Surface filter mismatch\nToday the picker offers "Tarmac / Gravel / Any". Strava\'s actual surface options are **Any / Paved / Dirt**. Match Strava labels exactly so the filter maps 1:1 to the API.\n\n## Acceptance\n- Replace MOCK_ROUTES with /api/athlete/routes results when tokens are present (live-routes issue already filed for v8.3.0 — link).\n- Surface picker copy: `Any`, `Paved`, `Dirt`. Map internal values: \'paved\' | \'dirt\' | \'any\'.\n- Coach output schema extended with `route_briefs: Record<DayName, { intent, target_distance_km, target_elevation_m, surface_hint }>`.\n- When today has no matching saved route OR the user has zero saved routes, show the AI route-brief card with a "Plan in Komoot ↗" deeplink.\n- Score: distance fit (40), zone overlap (30), surface fit (20), starred bonus (10) — same as today. Add elevation-fit (matches AI brief target ±20%) as a tie-breaker.',
    },
  ];

  // Pre-fetch existing issues
  const isRes = await fetch(`https://api.github.com/repos/${REPO}/issues?state=all&per_page=100`, { headers: ghHeaders });
  const existingIs = isRes.ok ? await isRes.json() : [];
  const existingIsTitles = new Set(existingIs.filter((i) => !i.pull_request).map((i) => i.title));

  for (const issue of ISSUES) {
    if (existingIsTitles.has(issue.title)) {
      out.issues.push({ title: issue.title, status: 'exists' });
      continue;
    }
    const milestoneNum = msByTitle.get(issue.milestone);
    const payload = {
      title: issue.title,
      body: issue.body,
      labels: issue.labels,
    };
    if (milestoneNum) payload.milestone = milestoneNum;
    const r = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST', headers: ghHeaders, body: JSON.stringify(payload),
    });
    if (r.ok) {
      const created = await r.json();
      out.issues.push({ title: issue.title, status: 'created', number: created.number, url: created.html_url });
    } else {
      const err = await r.text().catch(() => '');
      out.issues.push({ title: issue.title, status: r.status, error: err.slice(0, 200) });
    }
  }

  return out;
}

// Conventions (enforced by labels + milestones on github.com):
//   • status:     state == 'closed' → 'shipped'
//                 'status:in-progress' label OR has assignee → 'in-progress'
//                 else → 'open'
//   • area:       'area:<name>' label  (dashboard / design-system / auth / db /
//                                       backend / ci / pwa / perf / routes)
//   • priority:   'priority:high|medium|low'
//   • type:       'type:feature|bug|chore'
//   • target:     milestone title (e.g. 'v8.3.0')
function normalizeGhIssue(i) {
  const labels = (i.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
  const stripPrefix = (prefix) => {
    const hit = labels.find((l) => l.startsWith(prefix));
    return hit ? hit.slice(prefix.length) : null;
  };
  const inProgress =
    labels.includes('status:in-progress') || (i.assignees && i.assignees.length > 0);
  let status = 'open';
  if (i.state === 'closed') status = 'shipped';
  else if (inProgress) status = 'in-progress';

  // v9.2.5 (FIX 6) — strip fenced + inline code BEFORE splitting on paragraphs.
  // Issues that opened with a ```sql ... ``` block leaked migration DDL into /whats-next.
  const body = (() => {
    const cleaned = String(i.body || '')
      .replace(/\r/g, '')
      .replace(/```[\s\S]*?```/g, '')   // fenced code blocks
      .replace(/`[^`]+`/g, '');         // inline code
    const firstPara = cleaned
      .split(/\n\s*\n/)
      .map((p) => p.replace(/^[#>*\-\s]+/, '').trim())
      .find((p) => p.length > 0);
    return firstPara ? firstPara.slice(0, 280) : '';
  })();

  return {
    id: i.number,
    number: i.number,
    title: i.title,
    body,
    url: i.html_url,
    area: stripPrefix('area:') || 'dashboard',
    priority: stripPrefix('priority:') || 'medium',
    type: stripPrefix('type:') || 'feature',
    status,
    target: i.milestone?.title || null,
    closed_at: i.closed_at,
    updated_at: i.updated_at,
  };
}
 
// Persist user and Strava tokens to D1.
// Failures are logged but do not block the auth flow (graceful degradation).
// resolveAthleteId — derives the calling user's athlete_id from the Authorization
// bearer by round-tripping to Strava's /athlete endpoint (the canonical identity
// oracle). Used by /api/clubs* endpoints. Returns { athleteId } on success or
// { error, body } on failure (always 401 — the user's session is invalid and they
// need to re-auth, regardless of whether the underlying issue is expired token,
// network error, or malformed Strava response).
async function resolveAthleteId(request) {
  const auth = request.headers.get('Authorization');
  if (!auth) {
    return { error: 401, body: { error: 'authentication required' } };
  }
  try {
    const stravaResp = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: { Authorization: auth },
    });
    if (!stravaResp.ok) {
      safeWarn(`[clubs] resolveAthleteId: Strava /athlete returned ${stravaResp.status}`);
      return { error: 401, body: { error: 'authentication required' } };
    }
    const stravaUser = await stravaResp.json();
    if (!stravaUser?.id) {
      safeWarn('[clubs] resolveAthleteId: Strava response missing athlete.id');
      return { error: 401, body: { error: 'authentication required' } };
    }
    return { athleteId: stravaUser.id };
  } catch (e) {
    safeWarn(`[clubs] resolveAthleteId: network error: ${e.message}`);
    return { error: 401, body: { error: 'authentication required' } };
  }
}

async function persistUserAndTokens(db, tokenData) {
  if (!db) {
    console.warn('[D1] cycling_coach_db binding missing, skipping persist');
    return;
  }
  if (!tokenData?.athlete?.id) {
    console.warn('[D1] No athlete data in token response, skipping persist');
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const a = tokenData.athlete;

  try {
    await db.prepare(`
      INSERT INTO users (athlete_id, firstname, lastname, profile_url, raw_athlete_json, created_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(athlete_id) DO UPDATE SET
        firstname = excluded.firstname,
        lastname = excluded.lastname,
        profile_url = excluded.profile_url,
        raw_athlete_json = excluded.raw_athlete_json,
        last_seen_at = excluded.last_seen_at
    `).bind(
      a.id,
      a.firstname || null,
      a.lastname || null,
      a.profile_medium || a.profile || null,
      JSON.stringify(a),
      now,
      now
    ).run();

    const credentials = JSON.stringify({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
    });
    await db.prepare(`
      INSERT INTO user_connections (athlete_id, source, credentials_json, connected_at, last_sync_at, is_active)
      VALUES (?, 'strava', ?, ?, NULL, 1)
      ON CONFLICT(athlete_id, source) DO UPDATE SET
        credentials_json = excluded.credentials_json,
        is_active = 1
    `).bind(a.id, credentials, now).run();

    // v10.9.0 — also write to the new strava_tokens table (mirrors the
    // rwgps_tokens shape from v10.6.0). Eventually the user_connections
    // credentials_json blob can retire; for now both stay in sync.
    await db.prepare(`
      INSERT INTO strava_tokens (athlete_id, access_token, refresh_token, expires_at, scope, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(athlete_id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at,
        scope = excluded.scope,
        updated_at = excluded.updated_at
    `).bind(
      a.id,
      tokenData.access_token,
      tokenData.refresh_token,
      tokenData.expires_at,
      tokenData.scope ?? null,
      now, now,
    ).run();

    console.log(`[D1] Persisted user ${a.id} (${a.firstname || ''}) and Strava tokens (D1 + strava_tokens)`);
  } catch (e) {
    safeError('[D1] persistUserAndTokens failed:', e.message);
  }
}

// Persist activities to D1.
// Failures are logged but do not block the proxy response (graceful degradation).
async function persistActivities(db, activities) {
  if (!db) {
    console.warn('[D1] cycling_coach_db binding missing, skipping activity persist');
    return;
  }
  if (!Array.isArray(activities) || activities.length === 0) {
    return;
  }

  const athleteId = activities[0]?.athlete?.id;
  if (!athleteId) {
    console.warn('[D1] No athlete.id in first activity, skipping persist');
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  let persisted = 0;

  try {
    const stmt = db.prepare(`
      INSERT INTO activities (
        athlete_id, start_date_local, sport_type, distance, moving_time,
        total_elevation_gain, average_speed, average_heartrate, max_heartrate,
        pr_count, achievement_count, strava_id, primary_source,
        strava_raw_json, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'strava', ?, ?)
      ON CONFLICT(strava_id) DO UPDATE SET
        start_date_local = excluded.start_date_local,
        sport_type = excluded.sport_type,
        distance = excluded.distance,
        moving_time = excluded.moving_time,
        total_elevation_gain = excluded.total_elevation_gain,
        average_speed = excluded.average_speed,
        average_heartrate = excluded.average_heartrate,
        max_heartrate = excluded.max_heartrate,
        pr_count = excluded.pr_count,
        achievement_count = excluded.achievement_count,
        strava_raw_json = excluded.strava_raw_json,
        synced_at = excluded.synced_at
    `);

    for (const a of activities) {
      if (!a.id) continue;
      await stmt.bind(
        athleteId,
        a.start_date_local || a.start_date || null,
        a.sport_type || a.type || 'Unknown',
        a.distance || 0,
        a.moving_time || 0,
        a.total_elevation_gain || null,
        a.average_speed || null,
        a.average_heartrate || null,
        a.max_heartrate || null,
        a.pr_count || 0,
        a.achievement_count || 0,
        a.id,
        JSON.stringify(a),
        now
      ).run();
      persisted++;
    }

    console.log(`[D1] Persisted ${persisted} activities for athlete ${athleteId}`);
  } catch (e) {
    safeError('[D1] persistActivities failed:', e.message);
  }
}

// Update Strava connection tokens after a refresh.
// Failures are logged but do not block the refresh response.
async function updateConnectionTokens(db, athleteId, tokenData) {
  if (!db || !athleteId) return;

  const now = Math.floor(Date.now() / 1000);
  const credentials = JSON.stringify({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: tokenData.expires_at,
  });

  try {
    await db.prepare(`
      UPDATE user_connections
      SET credentials_json = ?, last_sync_at = ?
      WHERE athlete_id = ? AND source = 'strava'
    `).bind(credentials, now, athleteId).run();

    // v10.9.0 — also upsert into strava_tokens. Hybrid-window migration:
    // legacy clients refreshing through /refresh self-migrate without
    // forcing OAuth re-auth.
    await db.prepare(`
      INSERT INTO strava_tokens (athlete_id, access_token, refresh_token, expires_at, scope, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(athlete_id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at,
        scope = excluded.scope,
        updated_at = excluded.updated_at
    `).bind(
      athleteId,
      tokenData.access_token,
      tokenData.refresh_token,
      tokenData.expires_at,
      tokenData.scope ?? null,
      now, now,
    ).run();

    console.log(`[D1] Refreshed Strava tokens for athlete ${athleteId} (D1 + strava_tokens)`);
  } catch (e) {
    safeError('[D1] updateConnectionTokens failed:', e.message);
  }

}function htmlResponse(body, extraHeaders) {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...(extraHeaders || {}),
    },
  });
}

// v9.6.1 (#53 Phase 1 hotfix) — Build a per-request CSP that allows ONE
// inline script identified by nonce. Used by /callback so the
// localStorage.setItem('cc_tokens', …) + redirect inline script can run
// despite the strict global script-src 'self' policy from #15. Other CSP
// directives are inherited verbatim from SECURITY_HEADERS so the rest of
// the page surface stays as locked-down as everywhere else.
function cspWithScriptNonce(nonce) {
  return SECURITY_HEADERS['Content-Security-Policy']
    .replace("script-src 'self'", `script-src 'self' 'nonce-${nonce}'`);
}

// ============================================================
// Tiny HTML responses for OAuth callback + error
// ============================================================
// These are the only HTML the Worker still emits. /, /dashboard, /privacy,
// and /whats-next are served by the React SPA in apps/web via Workers
// Static Assets. The legacy landingPage / dashboardPage / privacyPage
// functions (~2,700 lines) were pruned in v8.2.0.

function callbackPage(tokenData, origin, fromPwa, nonce) {
  const blob = JSON.stringify({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: tokenData.expires_at,
  });
  const escaped = blob.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const nonceAttr = nonce ? ` nonce="${nonce}"` : '';
  if (fromPwa) {
    return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connected · Cadence Club</title>
<style>
html,body{background:#08090b;color:#f0f1f3;font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:0;padding:24px;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{max-width:480px;background:#16181d;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:32px;box-shadow:0 24px 64px rgba(0,0,0,.5)}
h1{font-weight:700;font-size:28px;letter-spacing:-.025em;margin:0 0 12px}
em{font-style:italic;color:#ff4d00}
p{color:#7d8290;line-height:1.5;margin:0 0 16px}
.tokens{font-family:ui-monospace,monospace;background:#000;border:1px solid rgba(255,77,0,.3);border-radius:8px;padding:14px;font-size:11px;color:#ff8c44;word-break:break-all;max-height:120px;overflow:auto;margin:12px 0}
.btn{display:inline-flex;align-items:center;justify-content:center;width:100%;padding:14px;border-radius:6px;background:#ff4d00;color:#000;font-weight:600;font-size:13px;letter-spacing:.1em;text-transform:uppercase;border:none;cursor:pointer;text-decoration:none;font-family:inherit}
.btn:hover{filter:brightness(1.1)}
.ok{display:none;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);color:#4ade80;padding:10px;border-radius:6px;margin-top:12px;font-size:13px}
.ok.shown{display:block}
.step{padding:12px;background:#1f232a;border-radius:6px;margin:10px 0;font-size:13px;color:#b8bcc4}
.step b{color:#f0f1f3}
</style></head><body>
<div class="card">
<h1>You're <em>authorized</em>.</h1>
<p>Copy your tokens, then paste them in the home-screen app.</p>
<div class="step"><b>1.</b> Tap "Copy tokens" below.</div>
<button id="copyBtn" class="btn">Copy tokens</button>
<div class="ok" id="okMsg">✓ Copied — switch back to Cadence Club.</div>
<div class="step"><b>2.</b> Open Cadence Club from your home screen.</div>
<div class="step"><b>3.</b> On the connect screen, paste the tokens.</div>
<details style="margin-top:16px"><summary style="color:#7d8290;cursor:pointer;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase">Show raw tokens</summary>
<div class="tokens" id="rawTokens"></div></details>
</div>
<script${nonceAttr}>
const tokens='${escaped}';
document.getElementById('rawTokens').textContent=tokens;
document.getElementById('copyBtn').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(tokens);}catch(e){
    const el=document.getElementById('rawTokens');const r=document.createRange();r.selectNodeContents(el);
    const s=window.getSelection();s.removeAllRanges();s.addRange(r);try{document.execCommand('copy');}catch(e2){}
  }
  document.getElementById('okMsg').classList.add('shown');
});
</script></body></html>`;
  }
  // Standard browser flow: drop tokens into localStorage and bounce to /dashboard.
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>Connecting…</title>
<style>html,body{background:#08090b;color:#f0f1f3;font-family:-apple-system,sans-serif;margin:0;height:100vh;display:flex;align-items:center;justify-content:center}.dot{width:8px;height:8px;background:#ff4d00;border-radius:50%;animation:p 1.2s ease-in-out infinite;margin-right:10px}@keyframes p{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}</style>
</head><body>
<div style="display:flex;align-items:center"><span class="dot"></span><span style="color:#7d8290;font-size:14px">Loading dashboard…</span></div>
<script${nonceAttr}>try{localStorage.setItem('cc_tokens','${escaped}');}catch(e){}setTimeout(()=>{window.location.href='${origin}/dashboard';},400);</script>
</body></html>`;
}

function errorPage(message) {
  const safe = String(message).replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Error · Cadence Club</title>
<style>
html,body{background:#08090b;color:#f0f1f3;font-family:-apple-system,sans-serif;margin:0;padding:24px;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{max-width:440px;background:#16181d;border:1px solid rgba(255,255,255,.1);border-left:2px solid #ef4444;border-radius:10px;padding:32px}
h1{font-weight:700;font-size:24px;letter-spacing:-.02em;margin:0 0 16px}em{font-style:italic;color:#ef4444}
.msg{font-family:ui-monospace,monospace;background:#1f232a;border-left:2px solid #ef4444;padding:12px;border-radius:0 6px 6px 0;font-size:13px;color:#b8bcc4;word-break:break-word;margin:16px 0}
.btn{display:inline-flex;align-items:center;gap:8px;padding:12px 20px;background:#ff4d00;color:#000;font-weight:600;font-size:13px;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;border-radius:6px}
</style></head><body>
<div class="card">
<h1>Authorization <em>failed</em>.</h1>
<div class="msg">${safe}</div>
<a class="btn" href="/">← Try again</a>
</div></body></html>`;
}
