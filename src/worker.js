// ============================================================
// Cycling Coach - SaaS Worker
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

// Bump this on every meaningful deploy so users (and you) can track which
// version is live by looking at the footer of any page.
const WORKER_VERSION = 'v9.0.0';
const BUILD_DATE = '2026-04-29';

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
 
// Resolve the user-facing origin so OAuth redirect_uri lands where the user
// actually is.
//
// Priority:
//   1. ?origin=… query param (explicit, set by the React client in dev)
//   2. X-Forwarded-Host header (in case any proxy honors xfwd)
//   3. url.origin (production: Workers Static Assets — request hits Worker directly)
//
// We only honor the query-param origin when it's a localhost loopback to keep
// it from being abused as an open redirect.
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
  const fwdHost = request.headers.get('x-forwarded-host');
  const fwdProto = request.headers.get('x-forwarded-proto');
  if (fwdHost) return `${fwdProto || 'http'}://${fwdHost}`;
  return url.origin;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = userOrigin(request, url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    // /, /dashboard, /privacy are served by the React SPA (Workers Static
    // Assets). The Worker only fires for the auth + API paths listed in
    // wrangler.jsonc → assets.run_worker_first.

    if (url.pathname === '/authorize') {
      const stravaAuth = new URL('https://www.strava.com/oauth/authorize');
      stravaAuth.searchParams.set('client_id', env.STRAVA_CLIENT_ID);
      stravaAuth.searchParams.set('redirect_uri', `${origin}/callback`);
      stravaAuth.searchParams.set('response_type', 'code');
      stravaAuth.searchParams.set('approval_prompt', 'auto');
      stravaAuth.searchParams.set('scope', 'read,activity:read_all,profile:read_all');
      // Strava round-trips the `state` param. We encode the user's origin and
      // PWA flag so /callback can land them on the same dev port (or PWA flow).
      const isPwa = url.searchParams.get('pwa') === '1';
      const state = btoa(JSON.stringify({ pwa: isPwa, origin }));
      stravaAuth.searchParams.set('state', state);
      return Response.redirect(stravaAuth.toString(), 302);
    }

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      // Decode state — supports both new JSON-encoded state and legacy 'pwa' string.
      let stateData = { pwa: false, origin };
      const rawState = url.searchParams.get('state');
      if (rawState === 'pwa') {
        stateData.pwa = true;
      } else if (rawState) {
        try {
          const decoded = JSON.parse(atob(rawState));
          if (decoded && typeof decoded === 'object') {
            stateData = { pwa: !!decoded.pwa, origin: decoded.origin || origin };
          }
        } catch {}
      }
      const fromPwa = stateData.pwa;
      const callbackOrigin = stateData.origin;
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
          // Strangler Fig: dual-write phase. Persist to D1, frontend still uses localStorage.
          await persistUserAndTokens(env.cycling_coach_db, data);
          return htmlResponse(callbackPage(data, callbackOrigin, fromPwa));
        }
        return htmlResponse(errorPage(data.message || 'Token exchange failed'));
      } catch (e) { return htmlResponse(errorPage(e.message)); }
    }
 
    if (url.pathname === '/refresh' && request.method === 'POST') {
      try {
        const { refresh_token } = await request.json();
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
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
      let clubId;
      try {
        const insertClub = await db
          .prepare('INSERT INTO clubs (name, description, owner_athlete_id, created_at) VALUES (?, ?, ?, ?) RETURNING id')
          .bind(name, description, athleteId, now)
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
      const [membershipRow, membersResult] = await db.batch([
        db.prepare('SELECT 1 AS member FROM club_members WHERE club_id = ? AND athlete_id = ? LIMIT 1').bind(clubId, authResult.athleteId),
        db.prepare(`
          SELECT u.athlete_id, u.firstname, u.lastname, u.profile_url, m.role, m.joined_at
          FROM club_members m
          INNER JOIN users u ON u.athlete_id = m.athlete_id
          WHERE m.club_id = ?
          ORDER BY m.role DESC, m.joined_at ASC
        `).bind(clubId),
      ]);
      if (!membershipRow.results || membershipRow.results.length === 0) {
        return new Response(JSON.stringify({ error: 'not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ club_id: clubId, members: membersResult.results || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname.startsWith('/api/')) {
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
      try {
        const body = await request.json();
        const { athlete, stats, recent, api_key, prefs } = body;
 
        // User must provide their own Anthropic API key
        const apiKey = api_key || env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'No API key provided. Add your Anthropic API key in the dashboard.' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
            status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const text = data.content?.find(c => c.type === 'text')?.text || '';
        const cleaned = text.replace(/```json|```/g, '').trim();
        let parsed;
        try { parsed = JSON.parse(cleaned); }
        catch { return new Response(JSON.stringify({ error: 'AI returned invalid JSON', raw: text }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
 
    // ============= AI PER-RIDE FEEDBACK =============
    if (url.pathname === '/coach-ride' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { ride, athlete, context, api_key } = body;
        const apiKey = api_key || env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'No API key' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
            status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const text = data.content?.find(c => c.type === 'text')?.text || '';
        const cleaned = text.replace(/```json|```/g, '').trim();
        let parsed;
        try { parsed = JSON.parse(cleaned); }
        catch { return new Response(JSON.stringify({ error: 'AI returned invalid JSON' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }); }
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        service: 'Cycling Coach',
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
  },
};

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
 * Defense-in-depth rate-limit for admin endpoints (#18).
 *
 * Even though /admin/* is admin-auth-gated by requireAdmin(), an ADMIN_SECRET
 * leak or a runaway-loop bug in CI could burn external API quota (Confluence,
 * GitHub) and cost real money. This adds a per-IP counter in DOCS_KV with a
 * sliding minute-bucket window: if more than `limit` requests arrive in the
 * current minute, returns a 429 sentinel that the caller surfaces as a real
 * 429 response with Retry-After header.
 *
 * Uses DOCS_KV (already bound for Confluence hash-skip, Free-plan-compatible).
 * Logs every threshold-hit attempt with source IP via safeWarn() so abuse
 * shows up in observability without leaking secrets.
 *
 * Returns:
 *   null                 — under threshold, request proceeds
 *   { retryAfter: N }    — over threshold, caller returns 429 with Retry-After: N
 */
async function checkAdminRateLimit(env, scope, request, limit, windowSeconds) {
  if (!env.DOCS_KV) {
    // KV not bound — fail-open with a warning. Better to lose the rate-limit
    // than to break the admin endpoint entirely.
    safeWarn(`[ratelimit] DOCS_KV not bound; skipping rate-limit on ${scope}`);
    return null;
  }
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds);
  const kvKey = `ratelimit:${scope}:${ip}:${bucket}`;
  const current = parseInt((await env.DOCS_KV.get(kvKey)) || '0', 10);
  if (current >= limit) {
    const retryAfter = windowSeconds - (now % windowSeconds);
    safeWarn(`[ratelimit] threshold-hit: scope=${scope} ip=${ip} count=${current} limit=${limit} retry_after=${retryAfter}s`);
    return { retryAfter };
  }
  // Best-effort increment. KV doesn't support atomic ops, but this is a
  // defense-in-depth check — strict precision isn't required. The TTL gives
  // the bucket a natural cleanup window.
  await env.DOCS_KV.put(kvKey, String(current + 1), { expirationTtl: windowSeconds * 2 });
  return null;
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

  const sharedContext = `Project: Cycling Coach
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
    const releaseStorage = `<h1>${escapeXml(releaseTitle)}</h1>
<p><strong>Date:</strong> ${date}</p>
<h2>Changelog</h2>
<pre>${escapeXml(changelog || '(no entry found in CHANGELOG.md)')}</pre>
<h2>Commits</h2>
<ul>${commits
      .map((c) => `<li><code>${escapeXml(c.sha.slice(0, 7))}</code> — ${escapeXml(c.message)}</li>`)
      .join('')}</ul>`;
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

  const body = String(i.body || '')
    .replace(/\r/g, '')
    .split(/\n\s*\n/)[0]
    .replace(/^[#>*\-\s]+/, '')
    .slice(0, 280);

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

    console.log(`[D1] Persisted user ${a.id} (${a.firstname || ''}) and Strava tokens`);
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
    console.log(`[D1] Refreshed Strava tokens for athlete ${athleteId}`);
  } catch (e) {
    safeError('[D1] updateConnectionTokens failed:', e.message);
  }

}function htmlResponse(body) {
  return new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ============================================================
// Tiny HTML responses for OAuth callback + error
// ============================================================
// These are the only HTML the Worker still emits. /, /dashboard, /privacy,
// and /whats-next are served by the React SPA in apps/web via Workers
// Static Assets. The legacy landingPage / dashboardPage / privacyPage
// functions (~2,700 lines) were pruned in v8.2.0.

function callbackPage(tokenData, origin, fromPwa) {
  const blob = JSON.stringify({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: tokenData.expires_at,
  });
  const escaped = blob.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  if (fromPwa) {
    return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connected · Cycling Coach</title>
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
<div class="ok" id="okMsg">✓ Copied — switch back to Cycling Coach.</div>
<div class="step"><b>2.</b> Open Cycling Coach from your home screen.</div>
<div class="step"><b>3.</b> On the connect screen, paste the tokens.</div>
<details style="margin-top:16px"><summary style="color:#7d8290;cursor:pointer;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase">Show raw tokens</summary>
<div class="tokens" id="rawTokens"></div></details>
</div>
<script>
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
<script>try{localStorage.setItem('cc_tokens','${escaped}');}catch(e){}setTimeout(()=>{window.location.href='${origin}/dashboard';},400);</script>
</body></html>`;
}

function errorPage(message) {
  const safe = String(message).replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Error · Cycling Coach</title>
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
