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
 
// Bump this on every meaningful deploy so users (and you) can track which
// version is live by looking at the footer of any page.
const WORKER_VERSION = 'v8.0.0';
const BUILD_DATE = '2026-04-28';
 
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

    if (url.pathname === '/' || url.pathname === '') return htmlResponse(landingPage(origin));
    if (url.pathname === '/dashboard' || url.pathname === '/dashboard/') return htmlResponse(dashboardPage(origin));
    if (url.pathname === '/privacy' || url.pathname === '/privacy/') return htmlResponse(privacyPage(origin));

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
            console.warn('[D1] Could not parse activities response for persist:', parseErr.message);
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
    // Strava webhook subscription verification (GET)
    if (url.pathname === '/webhook' && request.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      if (mode === 'subscribe' && token === (env.STRAVA_VERIFY_TOKEN || 'cycling-coach-verify')) {
        return new Response(JSON.stringify({ 'hub.challenge': challenge }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Forbidden', { status: 403 });
    }
    // Strava webhook event delivery (POST)
    // Note: We can't auto-sync tokens here because webhook events have no user context
    // beyond athlete_id. Without persistent token storage (KV/D1), we just log.
    // Browser-side polling on dashboard load handles the actual sync.
    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const event = await request.json();
        // Strava expects fast 200 response. Logging only since architecture is browser-storage.
        console.log('Webhook event:', event);
      } catch {}
      return new Response('OK', { status: 200 });
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
 
    return Response.redirect(url.origin + '/', 302);
  },
};
 
// Persist user and Strava tokens to D1.
// Failures are logged but do not block the auth flow (graceful degradation).
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
    console.error('[D1] persistUserAndTokens failed:', e.message);
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
    console.error('[D1] persistActivities failed:', e.message);
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
    console.error('[D1] updateConnectionTokens failed:', e.message);
  }

}function htmlResponse(body) {
  return new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
 
const FAVICON_B64 = 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxODAgMTgwIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImJnIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZmY4YzAwIi8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjZmY2YjM1Ii8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjE4MCIgaGVpZ2h0PSIxODAiIHJ4PSI0MCIgZmlsbD0idXJsKCNiZykiLz48ZyBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjciIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iNTUiIGN5PSIxMTUiIHI9IjI4Ii8+PGNpcmNsZSBjeD0iMTI1IiBjeT0iMTE1IiByPSIyOCIvPjxwYXRoIGQ9Ik01NSAxMTUgTDkwIDc1IEwxMjUgMTE1Ii8+PHBhdGggZD0iTTkwIDc1IEw3NSA3NSIvPjxwYXRoIGQ9Ik05MCA3NSBMMTA1IDU1IEwxMzAgNTUiLz48cGF0aCBkPSJNNTUgMTE1IEw3NSA3NSIvPjwvZz48Y2lyY2xlIGN4PSI5MCIgY3k9Ijc1IiByPSI1IiBmaWxsPSJ3aGl0ZSIvPjxjaXJjbGUgY3g9IjU1IiBjeT0iMTE1IiByPSI1IiBmaWxsPSJ3aGl0ZSIvPjxjaXJjbGUgY3g9IjEyNSIgY3k9IjExNSIgcj0iNSIgZmlsbD0id2hpdGUiLz48L3N2Zz4=';
 
const SHARED_HEAD = `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Cycling Coach">
<meta name="theme-color" content="#ff8c00">
<meta name="description" content="Your Strava data, beautifully visualized. Free, private, no signup.">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${FAVICON_B64}">
<link rel="apple-touch-icon" href="data:image/svg+xml;base64,${FAVICON_B64}">`;
 
const SHARED_BG = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap');
:root{
  --bg:#fafaf7;
  --bg-elev:#ffffff;
  --bg-subtle:#f3f2ed;
  --ink:#0a0a0a;
  --ink-2:#3f3f3f;
  --ink-3:#6b6b6b;
  --ink-4:#9a9a9a;
  --line:rgba(10,10,10,.08);
  --line-strong:rgba(10,10,10,.16);
  --accent:#fc4c02;
  --accent-soft:rgba(252,76,2,.08);
  --accent-mid:rgba(252,76,2,.18);
  --good:#15803d;
  --good-soft:rgba(21,128,61,.08);
  --warn:#a16207;
  --warn-soft:rgba(161,98,7,.08);
  --shadow-sm:0 1px 2px rgba(10,10,10,.04);
  --shadow:0 4px 16px rgba(10,10,10,.06);
  --shadow-lg:0 16px 48px rgba(10,10,10,.08);
  --radius:6px;
  --radius-lg:10px;
  --ease:cubic-bezier(.4,0,.2,1);
}
*{box-sizing:border-box}
body{
  background:var(--bg);
  min-height:100vh;
  color:var(--ink);
  font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
  margin:0;padding:0;
  -webkit-font-smoothing:antialiased;
  font-size:15px;
  line-height:1.5;
}
.serif{font-family:'Instrument Serif',Georgia,serif;font-weight:400;letter-spacing:-.01em}
.eyebrow{font-size:.7rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3)}
.tabular{font-variant-numeric:tabular-nums}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
.fade-up{animation:fadeUp .5s var(--ease) both}
.fade-up-1{animation:fadeUp .5s var(--ease) both;animation-delay:.05s}
.fade-up-2{animation:fadeUp .5s var(--ease) both;animation-delay:.1s}
`;
 
// ============================================================
// LANDING PAGE
// ============================================================
function landingPage(origin) {
  return `<!DOCTYPE html>
<html lang="en"><head>${SHARED_HEAD}<title>Cycling Coach — Your Strava data, beautifully visualized</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}${SHARED_BG}
.wrap{max-width:1100px;margin:0 auto;padding:24px}
.nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:60px}
.logo{display:flex;align-items:center;gap:10px;font-weight:900;font-size:1.2rem}
.logo-icon{width:32px;height:32px;background:linear-gradient(135deg,#ff8c00,#ff6b35);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.1rem}
.nav a{color:rgba(255,255,255,.6);text-decoration:none;font-size:.9rem;margin-left:24px}
.nav a:hover{color:white}
.hero{text-align:center;padding:40px 0 80px;max-width:780px;margin:0 auto}
.hero-emoji{font-size:5rem;margin-bottom:20px;display:inline-block;animation:gentle-bounce 3s ease-in-out infinite}
@keyframes gentle-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
h1{font-size:clamp(2.5rem,7vw,4.5rem);font-weight:900;line-height:1.05;margin-bottom:24px;letter-spacing:-.02em}
h1 .grad{background:linear-gradient(135deg,#ff8c00,#ff6b35);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.tagline{font-size:clamp(1.1rem,2.5vw,1.4rem);color:rgba(255,255,255,.75);line-height:1.5;margin-bottom:40px;font-weight:400}
.cta{display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:18px 36px;border-radius:14px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b35);color:white;font-weight:bold;font-size:1.1rem;cursor:pointer;text-decoration:none;box-shadow:0 12px 40px rgba(255,140,0,.4);transition:transform .15s}
.cta:active{transform:scale(.98)}
.trust{margin-top:24px;color:rgba(255,255,255,.5);font-size:.85rem}
.trust-icons{display:inline-flex;gap:18px;margin-top:8px;font-size:.8rem;color:rgba(255,255,255,.55);flex-wrap:wrap;justify-content:center;max-width:100%}
.section{padding:60px 0;border-top:1px solid rgba(255,255,255,.06)}
.section-title{font-size:clamp(1.8rem,4vw,2.5rem);font-weight:900;text-align:center;margin-bottom:12px;letter-spacing:-.01em}
.section-sub{color:rgba(255,255,255,.65);text-align:center;font-size:1.05rem;margin-bottom:48px;max-width:600px;margin-left:auto;margin-right:auto}
.features{display:grid;grid-template-columns:1fr;gap:20px;margin-top:32px}
@media(min-width:700px){.features{grid-template-columns:repeat(3,1fr)}}
.feature{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:28px;transition:transform .2s,border-color .2s}
.feature:hover{transform:translateY(-2px);border-color:rgba(255,140,0,.3)}
.feature-icon{font-size:2.5rem;margin-bottom:14px}
.feature-title{font-weight:bold;font-size:1.15rem;margin-bottom:8px}
.feature-desc{color:rgba(255,255,255,.65);font-size:.95rem;line-height:1.55}
.steps{display:grid;grid-template-columns:1fr;gap:16px;max-width:560px;margin:0 auto}
.step{display:flex;gap:18px;align-items:flex-start;padding:20px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:16px}
.step-num{flex-shrink:0;width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#ff8c00,#ff6b35);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:1rem}
.step-text{flex:1;padding-top:6px}
.step-title{font-weight:bold;margin-bottom:4px}
.step-desc{color:rgba(255,255,255,.65);font-size:.9rem}
.final-cta{text-align:center;padding:80px 20px;background:linear-gradient(135deg,rgba(255,140,0,.1),rgba(255,107,53,.05));border-radius:24px;margin:60px 0 40px;border:1px solid rgba(255,140,0,.2)}
.final-cta h2{font-size:clamp(1.8rem,4vw,2.5rem);margin-bottom:16px;font-weight:900}
.final-cta p{color:rgba(255,255,255,.7);margin-bottom:28px;font-size:1.05rem}
footer{padding:40px 0;text-align:center;color:rgba(255,255,255,.45);font-size:.85rem;border-top:1px solid rgba(255,255,255,.06)}
footer a{color:rgba(255,255,255,.6);text-decoration:none;margin:0 12px}
footer a:hover{color:white}
.heart{color:#ff6b35}
.tag{display:inline-block;padding:4px 10px;background:rgba(255,140,0,.15);color:#fdba74;border-radius:20px;font-size:.7rem;font-weight:bold;margin-bottom:14px}
</style></head><body>
<div class="wrap">
<nav class="nav">
  <div class="logo"><div class="logo-icon">🚴</div><div>Cycling Coach</div></div>
  <div><a href="/privacy">Privacy</a><a href="/dashboard">Dashboard</a></div>
</nav>
 
<section class="hero">
  <div class="hero-emoji">🚴</div>
  <h1>Your Strava data,<br><span class="grad">beautifully visualized</span></h1>
  <p class="tagline">Built for cyclists who want to improve. Streaks, PR celebrations, per-ride AI feedback, yearly goals — the motivation Strava doesn't give you. Connect in one click.</p>
  <a href="/authorize" class="cta">⚡ Connect with Strava</a>
  <div class="trust"><div class="trust-icons">
    <span>🔒 Private</span><span>💸 Free</span><span>📱 Works on iPhone</span><span>⚡ One-click setup</span>
  </div></div>
</section>
 
<section class="section">
  <h2 class="section-title">What you get</h2>
  <p class="section-sub">For cyclists who want to actually improve — not just log rides. Built around the things that build motivation.</p>
  <div class="features">
    <div class="feature"><div class="feature-icon">🔥</div><div class="feature-title">Streak heatmap</div><div class="feature-desc">GitHub-style calendar of every ride. Build streaks, watch your year fill in, don't break the chain.</div></div>
    <div class="feature"><div class="feature-icon">🏆</div><div class="feature-title">Wins timeline</div><div class="feature-desc">Every PR and achievement from your last 90 days, surfaced as a feed instead of buried in stats.</div></div>
    <div class="feature"><div class="feature-icon">🤖</div><div class="feature-title">Per-ride coach</div><div class="feature-desc">Tap any ride, get instant AI feedback: was it good, what to try next time. Beginner-friendly, no jargon.</div></div>
    <div class="feature"><div class="feature-icon">🎯</div><div class="feature-title">Yearly goals</div><div class="feature-desc">Set a km target, watch the progress ring fill, see your projected year-end based on current pace.</div></div>
    <div class="feature"><div class="feature-icon">📈</div><div class="feature-title">Charts & trends</div><div class="feature-desc">Distance and elevation over time. Weekly or monthly view. See your fitness arc at a glance.</div></div>
    <div class="feature"><div class="feature-icon">🔒</div><div class="feature-title">Stays in your browser</div><div class="feature-desc">Tokens and ride data live in your browser only. We never see them, never store them.</div></div>
  </div>
</section>
 
<section class="section">
  <h2 class="section-title">How it works</h2>
  <p class="section-sub">Three taps, ten seconds, then you're in.</p>
  <div class="steps">
    <div class="step"><div class="step-num">1</div><div class="step-text"><div class="step-title">Tap "Connect with Strava"</div><div class="step-desc">You'll be redirected to Strava's official login.</div></div></div>
    <div class="step"><div class="step-num">2</div><div class="step-text"><div class="step-title">Authorize the app</div><div class="step-desc">Standard Strava OAuth — say yes to share your activities.</div></div></div>
    <div class="step"><div class="step-num">3</div><div class="step-text"><div class="step-title">See your dashboard</div><div class="step-desc">Full ride history, charts, stats. Tokens auto-refresh forever after.</div></div></div>
  </div>
</section>
 
<div class="final-cta">
  <h2>Ready to keep the streak going?</h2>
  <p>One click. Full history imported. Streaks, wins, AI coach — all yours.</p>
  <a href="/authorize" class="cta">⚡ Connect with Strava</a>
</div>
 
<footer>
  <p>Built with <span class="heart">♥</span> for cycling friends</p>
  <p style="margin-top:8px">
    <a href="/privacy">Privacy</a> · <a href="/dashboard">Dashboard</a> ·
    <a href="https://www.strava.com" target="_blank" rel="noopener">Powered by Strava</a>
  </p>
  <p style="margin-top:14px;font-size:.7rem;color:rgba(255,255,255,.3);font-family:monospace">${WORKER_VERSION} · ${BUILD_DATE}</p>
</footer>
</div></body></html>`;
}
 
// ============================================================
// PRIVACY PAGE
// ============================================================
function privacyPage(origin) {
  return `<!DOCTYPE html>
<html lang="en"><head>${SHARED_HEAD}<title>Privacy — Cycling Coach</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}${SHARED_BG}
.wrap{max-width:780px;margin:0 auto;padding:24px}
.nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:40px}
.logo{display:flex;align-items:center;gap:10px;font-weight:900;font-size:1.1rem;text-decoration:none;color:white}
.logo-icon{width:32px;height:32px;background:linear-gradient(135deg,#ff8c00,#ff6b35);border-radius:8px;display:flex;align-items:center;justify-content:center}
.nav a{color:rgba(255,255,255,.6);text-decoration:none;font-size:.9rem}
.nav a:hover{color:white}
h1{font-size:2.5rem;font-weight:900;margin-bottom:12px;letter-spacing:-.02em}
.subtitle{color:rgba(255,255,255,.6);margin-bottom:48px;font-size:1.05rem}
h2{font-size:1.4rem;font-weight:bold;margin:36px 0 12px;color:#fdba74}
p{color:rgba(255,255,255,.8);line-height:1.7;margin-bottom:14px}
ul{margin:14px 0 14px 22px;color:rgba(255,255,255,.8);line-height:1.7}
li{margin-bottom:6px}
code{background:rgba(255,140,0,.1);padding:2px 6px;border-radius:4px;font-size:.9em;color:#fdba74}
.box{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:20px;margin:20px 0}
.box-good{background:rgba(52,211,153,.05);border-color:rgba(52,211,153,.25)}
.box-warn{background:rgba(251,191,36,.05);border-color:rgba(251,191,36,.25)}
.box h3{font-size:1.05rem;margin-bottom:8px;font-weight:bold}
.box-good h3{color:#6ee7b7}
.box-warn h3{color:#fde68a}
footer{margin-top:60px;padding:30px 0;border-top:1px solid rgba(255,255,255,.08);text-align:center;color:rgba(255,255,255,.5);font-size:.85rem}
.cta{display:inline-flex;align-items:center;gap:8px;padding:14px 24px;border-radius:12px;background:linear-gradient(135deg,#ff8c00,#ff6b35);color:white;font-weight:bold;text-decoration:none;margin-top:20px}
</style></head><body>
<div class="wrap">
<nav class="nav">
  <a class="logo" href="/"><div class="logo-icon">🚴</div><div>Cycling Coach</div></a>
  <a href="/dashboard">Dashboard</a>
</nav>
 
<h1>Privacy & data handling</h1>
<p class="subtitle">A short, honest explanation of what happens to your data.</p>
 
<h2>The short version</h2>
<p>Cycling Coach is a self-hosted hobby project. There's no user database, no analytics, no tracking, no ads. Your Strava data lives in <strong>your browser's localStorage</strong> — only on the device you used to log in.</p>
 
<div class="box box-good">
  <h3>✅ What stays on your device only</h3>
  <ul>
    <li>Your Strava access token and refresh token</li>
    <li>Your athlete profile (name, photo, location)</li>
    <li>Every activity you've imported (rides, stats, dates)</li>
    <li>Your yearly goal target</li>
    <li>AI coaching reports (cached locally)</li>
    <li>Your Anthropic API key (if you've added one)</li>
    <li>Last sync timestamp</li>
  </ul>
</div>
 
<div class="box box-warn">
  <h3>⚠️ What briefly passes through the worker</h3>
  <ul>
    <li><strong>Authorization codes</strong> during OAuth — exchanged for tokens, then discarded</li>
    <li><strong>API requests</strong> proxied to Strava (required for CORS) — forwarded, not logged</li>
    <li><strong>Refresh requests</strong> when access token expires — same story</li>
    <li><strong>AI coaching requests</strong> — your stats are sent to Anthropic's Claude API to generate the report; nothing is stored on the worker</li>
  </ul>
  <p style="margin-top:10px;margin-bottom:0">The worker has no database, no logging service, no persistence layer. There is nothing to query, nothing to leak.</p>
</div>
 
<h2>What about Cloudflare?</h2>
<p>This worker runs on Cloudflare Workers. Cloudflare's standard infrastructure logs (request count, error rates, regions) apply — those are aggregate metrics, not user-level data.</p>
 
<h2>What about Anthropic? (AI coaching)</h2>
<p>AI coaching is <strong>bring your own key</strong>. You sign up at Anthropic, add your own API credits, and paste your key into the dashboard. It's stored only in your browser. When you tap "Generate Report", your stats and key are sent to the worker, which forwards them to Anthropic's Claude API. The worker doesn't store your key or your reports — those stay in your browser. Anthropic's standard <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener" style="color:#fdba74">privacy policy</a> applies.</p>
<p style="color:rgba(255,255,255,.65);font-size:.95rem">This means each user pays for their own AI usage (~\$0.02 per report). There's no shared bill, no pooled API key, no rate limit games. Skip AI coaching entirely if you don't want to bother — the dashboard, charts, and goals work fully without it.</p>
 
<h2>What does Strava see?</h2>
<p>Strava sees: that you authorized this app, your activity data being pulled, and the API call patterns. Standard for any Strava-connected app. You can revoke access anytime at <code>strava.com/settings/apps</code>.</p>
 
<h2>What happens if I clear my browser?</h2>
<p>Your tokens, cached rides, AI reports, and goals are deleted. Reconnect to Strava — same one-click flow. Nothing of yours is lost on Strava's end.</p>
 
<h2>Can I delete my data?</h2>
<ul>
  <li><strong>Disconnect button</strong> on the dashboard — clears all local data instantly</li>
  <li><strong>Revoke at Strava</strong> — go to <code>strava.com/settings/apps</code> → "Revoke Access"</li>
</ul>
 
<h2>Questions?</h2>
<p>Reach out to whoever shared this app with you. There's no support team — it's a friend-built tool.</p>
 
<a href="/" class="cta">← Back to home</a>
 
<footer>
  <p>Built for cycling friends · Powered by Cloudflare & Strava · AI by Anthropic</p>
  <p style="margin-top:10px;font-size:.7rem;color:rgba(255,255,255,.3);font-family:monospace">${WORKER_VERSION} · ${BUILD_DATE}</p>
</footer>
</div></body></html>`;
}
 
// ============================================================
// CALLBACK + ERROR
// ============================================================
function callbackPage(tokenData, origin, fromPWA) {
  const blob = JSON.stringify({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: tokenData.expires_at,
  });
  const esc = blob.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `<!DOCTYPE html>
<html><head>${SHARED_HEAD}<title>Connected!</title>
<style>${SHARED_BG}
*{box-sizing:border-box;margin:0;padding:0}
body{display:flex;align-items:center;justify-content:center;padding:20px}
.card{max-width:480px;width:100%;text-align:center}
.icon{font-size:4.5rem;margin-bottom:1rem}
h1{color:#ff8c00;font-size:1.7rem;margin-bottom:.4rem}
p{opacity:.85;line-height:1.5;font-size:.95rem}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:16px 24px;border-radius:12px;border:none;background:linear-gradient(135deg,#ff8c00,#ff6b35);color:white;font-weight:bold;font-size:1rem;cursor:pointer;text-decoration:none;margin-top:14px;box-shadow:0 8px 32px rgba(255,140,0,.4)}
.btn:active{transform:scale(.98)}
.tokens-box{background:rgba(0,0,0,.5);border:1px solid rgba(255,140,0,.3);border-radius:10px;padding:12px;margin:12px 0;font-family:monospace;font-size:.7rem;color:#fdba74;word-break:break-all;text-align:left;max-height:120px;overflow:auto}
.step{background:rgba(255,140,0,.1);border:1px solid rgba(255,140,0,.3);padding:14px;border-radius:12px;margin:14px 0;text-align:left;font-size:.9rem}
.step-num{display:inline-flex;width:24px;height:24px;border-radius:50%;background:#ff8c00;color:white;align-items:center;justify-content:center;font-weight:bold;font-size:.8rem;margin-right:8px;flex-shrink:0;vertical-align:middle}
.ok-msg{display:none;background:rgba(52,211,153,.15);border:1px solid rgba(52,211,153,.4);color:#6ee7b7;padding:10px;border-radius:8px;margin-top:12px;font-size:.9rem;font-weight:500}
.ok-msg.shown{display:block}
.muted{color:rgba(255,255,255,.5);font-size:.8rem;margin-top:1rem}
</style></head><body>
<div class="card">
${fromPWA ? `
  <div class="icon">🔑</div>
  <h1>You're authorized!</h1>
  <p>Now copy your tokens and paste them into the app on your home screen.</p>
 
  <div class="step"><span class="step-num">1</span><strong>Tap "Copy tokens" below</strong></div>
  <button id="copyBtn" class="btn">📋 Copy tokens</button>
  <div class="ok-msg" id="okMsg">✓ Copied! Now switch back to Cycling Coach.</div>
 
  <div class="step"><span class="step-num">2</span><strong>Open Cycling Coach</strong> from your home screen.</div>
  <div class="step"><span class="step-num">3</span> On the connect screen, tap <strong>"I have tokens"</strong> at the bottom and paste.</div>
 
  <details style="margin-top:20px;text-align:left">
    <summary style="cursor:pointer;color:rgba(255,255,255,.5);font-size:.85rem">Show raw tokens</summary>
    <div class="tokens-box" id="rawTokens"></div>
  </details>
` : `
  <div class="icon">✅</div>
  <h1>Connected!</h1>
  <p>Loading your dashboard...</p>
`}
</div>
<script>
  const tokens = '${esc}';
  const fromPWA = ${fromPWA ? 'true' : 'false'};
  if (fromPWA) {
    document.getElementById('rawTokens').textContent = tokens;
    document.getElementById('copyBtn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(tokens);
      } catch(e) {
        const el = document.getElementById('rawTokens');
        const r = document.createRange(); r.selectNodeContents(el);
        const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        try { document.execCommand('copy'); } catch(e2) {}
      }
      document.getElementById('okMsg').classList.add('shown');
    });
  } else {
    try { localStorage.setItem('cc_tokens', tokens); } catch(e) {}
    setTimeout(() => { window.location.href = '${origin}/dashboard'; }, 600);
  }
</script></body></html>`;
}
 
function errorPage(message) {
  const safe = String(message).replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));
  return `<!DOCTYPE html><html><head>${SHARED_HEAD}<title>Error</title>
<style>${SHARED_BG}body{display:flex;align-items:center;justify-content:center;text-align:center;padding:20px}h1{color:#f87171;font-size:1.8rem}.icon{font-size:4rem;margin-bottom:1rem}p{opacity:.8;max-width:400px;line-height:1.6}.btn{display:inline-block;margin-top:24px;padding:12px 24px;background:linear-gradient(135deg,#ff8c00,#ff6b35);color:white;text-decoration:none;border-radius:10px;font-weight:bold}</style>
</head><body><div><div class="icon">❌</div><h1>Authorization failed</h1><p>${safe}</p><a class="btn" href="/">← Try again</a></div></body></html>`;
}
 
// ============================================================
// DASHBOARD - the full app with charts, AI, goals
// ============================================================
function dashboardPage(origin) {
  return `<!DOCTYPE html>
<html lang="en"><head>${SHARED_HEAD}<title>Cycling Coach Dashboard</title>
<style>
${SHARED_BG}
 
/* ============================================================
   v7.0 — Cycling Coach · Editorial Light Theme
   ============================================================ */
 
.container{max-width:780px;margin:0 auto;padding:20px 18px 80px}
.center{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
 
/* HEADER */
.head{
  display:flex;justify-content:space-between;align-items:center;
  margin-bottom:24px;padding:12px 14px;
  background:rgba(255,255,255,.85);
  border:1px solid var(--line);
  border-radius:var(--radius-lg);
  backdrop-filter:saturate(160%) blur(14px);
  -webkit-backdrop-filter:saturate(160%) blur(14px);
  position:sticky;top:8px;z-index:10;
  box-shadow:var(--shadow-sm);
}
.head-left{display:flex;align-items:center;gap:12px;min-width:0;flex:1}
.avatar{width:36px;height:36px;border-radius:50%;flex-shrink:0;border:1.5px solid var(--accent)}
.head-name{font-weight:600;font-size:.95rem;letter-spacing:-.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink)}
.head-meta,.head-sync{font-size:.72rem;color:var(--ink-3);margin-top:1px}
.head-actions{display:flex;gap:6px}
.icon-btn{
  width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;
  background:transparent;border:1px solid var(--line);border-radius:var(--radius);
  color:var(--ink-2);cursor:pointer;font-size:.95rem;font-family:inherit;
  transition:all .2s var(--ease);
}
.icon-btn:hover{background:var(--bg-subtle);border-color:var(--line-strong)}
.icon-btn:active{transform:scale(.95)}
 
/* TYPOGRAPHY */
h1{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:3rem;letter-spacing:-.02em;line-height:1;margin:0 0 .5rem;color:var(--ink)}
h1 em{font-style:italic;color:var(--accent)}
h2{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-style:italic;font-size:1.85rem;letter-spacing:-.015em;line-height:1.1;margin:28px 0 14px;color:var(--ink)}
h3{font-size:.92rem;font-weight:600;letter-spacing:-.005em;margin:0 0 8px;color:var(--ink)}
.subtitle{color:var(--ink-3);font-size:1rem;margin-bottom:2rem;line-height:1.5}
p{margin:0}
 
/* CARDS */
.card{background:var(--bg-elev);border:1px solid var(--line);border-radius:var(--radius-lg);padding:20px;margin-bottom:14px;box-shadow:var(--shadow-sm)}
 
/* HERO */
.hero{
  background:var(--bg-elev);border:1px solid var(--line);border-radius:var(--radius-lg);
  padding:28px 24px;margin-bottom:18px;box-shadow:var(--shadow-sm);
  position:relative;overflow:hidden;display:block;
}
.hero::before{content:'';position:absolute;top:0;right:0;width:140px;height:140px;background:radial-gradient(circle at top right,var(--accent-soft),transparent 70%);pointer-events:none}
.hero-eyebrow,.hero-label{font-size:.7rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);margin-bottom:10px}
.hero-num{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:4.2rem;line-height:.95;letter-spacing:-.03em;font-variant-numeric:tabular-nums;color:var(--ink)}
.hero-num em{font-style:italic;color:var(--accent)}
.hero-num span{color:var(--ink-3);font-family:'Inter',sans-serif;font-style:normal;font-size:1.1rem;font-weight:500;margin-left:6px;letter-spacing:0}
.hero-em{display:none}
.hero-meta{color:var(--ink-3);font-size:.85rem;margin-top:14px;display:flex;gap:18px;flex-wrap:wrap}
.hero-meta b{color:var(--ink);font-weight:600}
.hero-meta .year-badge{padding:3px 10px;background:var(--accent-soft);color:var(--accent);border-radius:99px;font-size:.74rem;font-weight:600}
@media(max-width:480px){.hero-num{font-size:3.4rem}}
 
/* STATS GRID */
.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:20px}
@media(min-width:600px){.stats{grid-template-columns:repeat(4,1fr)}}
.stat{padding:14px;background:var(--bg-elev);border:1px solid var(--line);border-radius:var(--radius);transition:border-color .2s var(--ease)}
.stat:hover{border-color:var(--line-strong)}
.stat-value{font-family:'Instrument Serif',Georgia,serif;font-size:1.75rem;font-weight:400;letter-spacing:-.015em;line-height:1;font-variant-numeric:tabular-nums;color:var(--ink)}
.stat-label{font-size:.7rem;color:var(--ink-3);margin-top:4px;font-weight:500;letter-spacing:.02em}
 
/* BUTTONS */
.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  padding:12px 22px;border-radius:var(--radius);border:none;
  background:var(--ink);color:var(--bg);
  font-weight:600;font-size:.92rem;cursor:pointer;text-decoration:none;
  transition:all .2s var(--ease);font-family:inherit;width:100%;
}
.btn:hover{transform:translateY(-1px);box-shadow:var(--shadow)}
.btn:active{transform:translateY(0) scale(.99)}
.btn-sec{background:var(--bg-elev);color:var(--ink);border:1px solid var(--line-strong);font-weight:500}
.btn-sec:hover{background:var(--bg-subtle)}
.btn-ai{background:var(--accent);color:white}
.btn-ai:hover{filter:brightness(1.05)}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
 
/* RIDES */
.ride{padding:16px;background:var(--bg-elev);border:1px solid var(--line);border-radius:var(--radius);margin-bottom:8px;transition:border-color .2s var(--ease)}
.ride:hover{border-color:var(--line-strong)}
.ride-name{font-weight:600;margin-bottom:4px;font-size:.95rem;letter-spacing:-.005em;color:var(--ink)}
.ride-meta{display:flex;flex-wrap:wrap;gap:14px;font-size:.78rem;color:var(--ink-3);font-variant-numeric:tabular-nums}
.ride-date{font-size:.7rem;color:var(--ink-4);float:right;letter-spacing:.02em}
 
/* ERROR */
.error{background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.2);color:#991b1b;padding:12px 14px;border-radius:var(--radius);margin:12px 0;font-size:.88rem}
 
/* SPINNER */
.spinner{width:16px;height:16px;border:2px solid var(--line-strong);border-top-color:var(--accent);border-radius:50%;animation:spin 1s linear infinite;display:inline-block}
.spinner-lg{width:32px;height:32px;border-width:3px}
 
/* TOAST */
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:11px 18px;border-radius:var(--radius);font-size:.85rem;z-index:1000;font-weight:500;box-shadow:var(--shadow-lg);animation:fadeUp .3s var(--ease) both}
 
/* CHART CARDS */
.chart-card{background:var(--bg-elev);border:1px solid var(--line);border-radius:var(--radius-lg);padding:20px;margin-bottom:14px;box-shadow:var(--shadow-sm)}
.chart-header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.chart-title{font-weight:600;font-size:.92rem;letter-spacing:-.005em;color:var(--ink)}
.chart-toggle{display:flex;background:var(--bg-subtle);border-radius:var(--radius);padding:3px;gap:2px}
.chart-toggle button{background:transparent;border:none;color:var(--ink-3);padding:6px 12px;border-radius:4px;font-size:.78rem;cursor:pointer;font-weight:500;transition:all .2s var(--ease);font-family:inherit}
.chart-toggle button.active{background:var(--bg-elev);color:var(--ink);box-shadow:var(--shadow-sm)}
.chart-wrap{position:relative;height:230px}
 
/* GOAL */
.goal-card{background:var(--bg-elev);border:1px solid var(--line);border-radius:var(--radius-lg);padding:20px;margin-bottom:14px;text-align:center;box-shadow:var(--shadow-sm)}
.goal-ring-wrap{position:relative;width:160px;height:160px;margin:14px auto}
.goal-ring{transform:rotate(-90deg)}
.goal-ring circle.bg,.goal-ring-bg{fill:none;stroke:var(--bg-subtle);stroke-width:10}
.goal-ring circle.fg,.goal-ring-fg{fill:none;stroke:var(--accent);stroke-width:10;stroke-linecap:round;transition:stroke-dashoffset 1s var(--ease)}
.goal-ring-text,.goal-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center}
.goal-ring-num,.goal-pct{font-family:'Instrument Serif',Georgia,serif;font-size:2rem;font-weight:400;line-height:1;letter-spacing:-.015em;font-variant-numeric:tabular-nums;color:var(--ink)}
.goal-ring-pct,.goal-pct-label{font-size:.7rem;color:var(--ink-3);margin-top:4px;font-weight:500;letter-spacing:.05em}
.goal-content{display:block}
.goal-info{margin-top:8px}
.goal-label{font-size:.7rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3);margin-bottom:4px}
.goal-num{font-family:'Instrument Serif',Georgia,serif;font-size:1.4rem;font-weight:400;letter-spacing:-.01em;color:var(--ink);font-variant-numeric:tabular-nums}
.goal-num-target{color:var(--ink-3);font-size:.95rem}
.goal-meta{font-size:.82rem;color:var(--ink-3);margin:8px 0;line-height:1.5}
.goal-meta strong,.goal-meta b{color:var(--ink)}
.goal-edit{background:transparent;border:1px solid var(--line-strong);color:var(--ink-2);padding:7px 14px;border-radius:var(--radius);font-size:.78rem;cursor:pointer;font-weight:500;font-family:inherit;transition:all .2s var(--ease)}
.goal-edit:hover{background:var(--bg-subtle)}
.goal-input{width:120px;background:var(--bg-elev);border:1px solid var(--line-strong);color:var(--ink);padding:7px 10px;border-radius:var(--radius);font-size:.92rem;font-family:inherit;font-variant-numeric:tabular-nums}
.goal-input-row{display:flex;gap:8px;align-items:center;justify-content:center;margin-top:10px}
 
/* AI REPORT */
.ai-prompt-card{background:var(--bg-elev);border:1px solid var(--line);border-radius:var(--radius-lg);padding:24px;margin-bottom:14px;text-align:center;box-shadow:var(--shadow-sm)}
.ai-em{font-size:2rem;margin-bottom:10px;display:block}
.ai-title{font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-size:1.4rem;font-weight:400;letter-spacing:-.01em;margin-bottom:6px;color:var(--ink)}
.ai-desc{color:var(--ink-3);font-size:.88rem;line-height:1.5;margin-bottom:16px}
.ai-report{background:var(--bg-elev);border:1px solid var(--line);border-radius:var(--radius-lg);padding:22px;margin-bottom:14px;box-shadow:var(--shadow-sm)}
.ai-section{margin-bottom:20px;padding-bottom:18px;border-bottom:1px solid var(--line)}
.ai-section:last-child{border-bottom:none;padding-bottom:0;margin-bottom:0}
.ai-section h3{font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-size:1.15rem;font-weight:400;letter-spacing:-.005em;margin-bottom:10px;color:var(--ink)}
.ai-section ul{margin:0;padding:0;list-style:none}
.ai-section li{font-size:.9rem;line-height:1.5;color:var(--ink-2);padding:8px 0 8px 18px;border-bottom:1px solid var(--line);position:relative}
.ai-section li:last-child{border-bottom:none}
.ai-section li::before{content:'';position:absolute;left:0;top:14px;width:8px;height:1px;background:var(--accent)}
.ai-summary{font-size:.92rem;line-height:1.55;color:var(--ink-2)}
.ai-motivation{font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-size:1.05rem;line-height:1.5;color:var(--ink);text-align:center;padding:14px 0;letter-spacing:-.005em}
 
/* WEEKLY PLAN — DAYS (tappable) */
.ai-plan-list{margin-top:8px}
.ai-day{border-bottom:1px solid var(--line);padding:0;transition:background .2s var(--ease)}
.ai-day:last-child{border-bottom:none}
.ai-day-row{display:flex;align-items:flex-start;gap:14px;padding:14px 4px;width:100%;background:transparent;border:none;text-align:left;color:var(--ink);font-family:inherit;cursor:pointer;transition:background .2s var(--ease)}
.ai-day:not(.rest):not(.locked) .ai-day-row:hover{background:var(--bg-subtle)}
.ai-day-row[disabled]{cursor:default}
.ai-day-name{width:90px;flex-shrink:0;font-weight:600;font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);padding-top:2px}
.ai-day-workout{flex:1;font-size:.92rem;line-height:1.45;color:var(--ink-2)}
.ai-day-chev{flex-shrink:0;color:var(--ink-4);font-size:1rem;padding-top:4px;transition:transform .25s var(--ease)}
.ai-day.expanded .ai-day-chev{transform:rotate(90deg);color:var(--accent)}
.ai-day.rest .ai-day-name{color:var(--ink-4)}
.ai-day.rest .ai-day-workout{font-style:italic;color:var(--ink-3)}
.ai-day-routes{padding:0 4px 18px 4px;animation:fadeIn .3s var(--ease) both}
 
.ai-meta{font-size:.72rem;color:var(--ink-3);text-align:center;padding-top:14px;margin-top:4px;border-top:1px solid var(--line)}
.ai-meta a{color:var(--ink-2);text-decoration:underline;text-underline-offset:2px}
 
/* STREAK */
.streak-card{background:var(--bg-elev);border:1px solid var(--line);border-radius:var(--radius-lg);padding:20px;margin-bottom:14px;box-shadow:var(--shadow-sm)}
.streak-row{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:14px;flex-wrap:wrap}
.streak-num{display:flex;align-items:baseline;gap:8px}
.streak-flame{font-size:1.4rem;line-height:1}
.streak-val{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:2.6rem;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--ink)}
.streak-unit{font-size:.85rem;color:var(--ink-3);font-weight:500}
.streak-label{font-size:.7rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3);margin-bottom:4px}
.streak-sub{color:var(--ink-3);font-size:.82rem;margin-top:4px}
.streak-best{padding:10px 14px;background:var(--bg-subtle);border-radius:var(--radius);font-size:.75rem;color:var(--ink-3);text-align:right}
.streak-best-num{color:var(--ink);font-weight:600;font-size:.95rem;font-variant-numeric:tabular-nums}
.heatmap{margin-top:6px}
.heatmap-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:3px;margin-top:8px}
.heatmap-week{display:grid;grid-template-rows:repeat(7,1fr);gap:3px}
.hm-cell{aspect-ratio:1;border-radius:2px;background:var(--bg-subtle);position:relative}
.hm-cell.l1{background:rgba(252,76,2,.25)}
.hm-cell.l2{background:rgba(252,76,2,.5)}
.hm-cell.l3{background:rgba(252,76,2,.75)}
.hm-cell.l4{background:var(--accent)}
.hm-cell.future{background:transparent;border:1px dashed var(--line)}
.hm-cell.today{box-shadow:0 0 0 1.5px var(--ink)}
.hm-legend{display:flex;align-items:center;gap:6px;font-size:.65rem;color:var(--ink-4);margin-top:8px;justify-content:flex-end}
.hm-legend-cell{width:10px;height:10px;border-radius:2px}
.hm-months{display:flex;justify-content:space-between;font-size:.62rem;color:var(--ink-4);margin-top:6px;padding:0 2px;letter-spacing:.04em}
 
/* WINS */
.wins-card{background:var(--bg-elev);border:1px solid var(--line);border-radius:var(--radius-lg);padding:20px;margin-bottom:14px;box-shadow:var(--shadow-sm)}
.wins-header{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.wins-title{font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-weight:400;font-size:1.3rem;letter-spacing:-.01em;color:var(--ink)}
.wins-count{padding:3px 9px;background:var(--accent-soft);color:var(--accent);border-radius:99px;font-size:.7rem;font-weight:600;letter-spacing:.02em}
.win-item{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--line)}
.win-item:last-child{border-bottom:none}
.win-emoji{font-size:1rem;flex-shrink:0;width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:var(--accent-soft);border-radius:50%}
.win-text{flex:1;min-width:0}
.win-name{font-weight:500;font-size:.9rem;letter-spacing:-.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink)}
.win-meta{color:var(--ink-3);font-size:.74rem;margin-top:2px;font-variant-numeric:tabular-nums}
.win-badge{font-size:.68rem;color:var(--accent);font-weight:600;flex-shrink:0;padding:3px 8px;background:var(--accent-soft);border-radius:99px;letter-spacing:.02em}
.wins-empty{text-align:center;padding:18px 8px;color:var(--ink-3);font-size:.88rem}
.wins-empty-em{font-size:1.6rem;margin-bottom:6px;opacity:.5}
 
/* RIDE CATEGORY + AI FEEDBACK */
.ride-cat{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:99px;font-size:.68rem;font-weight:600;margin-right:6px;letter-spacing:.02em;background:var(--bg-subtle);color:var(--ink-2)}
.ride-pr-badge{display:inline-flex;align-items:center;padding:3px 9px;background:var(--accent-soft);color:var(--accent);border-radius:99px;font-size:.68rem;font-weight:600;margin-right:6px;letter-spacing:.02em}
.ride-actions{margin-top:10px}
.ride-coach-btn{background:transparent;border:1px solid var(--line-strong);color:var(--ink-2);padding:7px 14px;border-radius:var(--radius);font-size:.78rem;cursor:pointer;font-weight:500;display:inline-flex;align-items:center;gap:6px;font-family:inherit;transition:all .2s var(--ease)}
.ride-coach-btn:hover{background:var(--bg-subtle);border-color:var(--ink-3)}
.ride-feedback{margin-top:12px;padding:14px;background:var(--bg-subtle);border-radius:var(--radius);animation:fadeIn .3s var(--ease) both}
.ride-fb-verdict{font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-weight:400;font-size:1.05rem;color:var(--ink);margin-bottom:6px;letter-spacing:-.005em}
.ride-fb-text{color:var(--ink-2);font-size:.88rem;line-height:1.55;margin-bottom:10px}
.ride-fb-next{font-size:.82rem;color:var(--ink-2);padding:9px 12px;background:var(--bg-elev);border-radius:var(--radius);border-left:2px solid var(--accent)}
.ride-fb-next strong{color:var(--accent);font-weight:600}
.ride-fb-loading{display:flex;align-items:center;gap:8px;padding:6px 0;color:var(--ink-3);font-size:.85rem}
 
/* RIDE DETAIL */
.ride-name-link{cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;text-align:left;background:transparent;border:none;color:var(--ink);padding:0;font-weight:600;font-size:.98rem;letter-spacing:-.005em;line-height:1.3;font-family:inherit}
.ride-name-link:hover{color:var(--accent)}
.ride-name-link .chev{font-size:.8rem;color:var(--ink-4);transition:transform .25s var(--ease);flex-shrink:0}
.ride-name-link.open .chev{transform:rotate(90deg);color:var(--accent)}
.ride-detail{margin-top:14px;padding:18px;background:var(--bg-subtle);border-radius:var(--radius);animation:fadeIn .3s var(--ease) both}
.rd-loading{display:flex;align-items:center;justify-content:center;gap:10px;padding:24px;color:var(--ink-3);font-size:.9rem}
.rd-section{margin-bottom:20px}
.rd-section:last-child{margin-bottom:0}
.rd-section h4{font-size:.7rem;color:var(--ink-3);font-weight:600;letter-spacing:.12em;text-transform:uppercase;margin-bottom:10px}
.rd-desc{color:var(--ink-2);font-size:.9rem;line-height:1.55;background:var(--bg-elev);border-left:2px solid var(--accent);padding:11px 14px;border-radius:0 var(--radius) var(--radius) 0;white-space:pre-wrap}
.rd-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.rd-stat{background:var(--bg-elev);border:1px solid var(--line);border-radius:var(--radius);padding:11px 13px}
.rd-stat-label{font-size:.65rem;color:var(--ink-3);font-weight:600;letter-spacing:.1em;text-transform:uppercase;margin-bottom:3px}
.rd-stat-value{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:1.2rem;line-height:1;color:var(--ink);font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.rd-stat-value small{font-family:'Inter',sans-serif;font-size:.7rem;color:var(--ink-3);font-weight:500;margin-left:4px}
.rd-photo{width:100%;border-radius:var(--radius);margin-bottom:6px;display:block}
.rd-list{display:flex;flex-direction:column;gap:5px}
.rd-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;background:var(--bg-elev);border-radius:var(--radius);font-size:.83rem}
.rd-row-label{color:var(--ink-2);flex:1;min-width:0;display:flex;align-items:center;gap:6px}
.rd-row-pr{color:var(--accent);font-size:.68rem;font-weight:600;padding:3px 8px;background:var(--accent-soft);border-radius:99px;flex-shrink:0;letter-spacing:.02em}
.rd-row-time{color:var(--ink);font-weight:600;font-variant-numeric:tabular-nums;flex-shrink:0;font-size:.85rem}
.rd-split-bar{flex:1;height:4px;background:var(--line);border-radius:2px;overflow:hidden;min-width:30px}
.rd-split-fill{height:100%;background:var(--accent);border-radius:2px}
.rd-meta{font-size:.75rem;color:var(--ink-3);text-align:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}
.rd-meta a{color:var(--ink-2);text-decoration:underline;text-underline-offset:2px}
.rd-empty{color:var(--ink-3);font-size:.82rem;font-style:italic;padding:8px 0}
 
/* TRAINING PREFS */
.prefs-card{background:var(--bg-elev);border:1px solid var(--line);border-radius:var(--radius-lg);padding:20px;margin-bottom:14px;box-shadow:var(--shadow-sm)}
.prefs-title{font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-weight:400;font-size:1.3rem;letter-spacing:-.01em;margin-bottom:8px;display:flex;align-items:center;gap:8px}
.prefs-desc{color:var(--ink-3);font-size:.88rem;margin-bottom:16px;line-height:1.5}
.session-picker{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:14px}
.session-btn{aspect-ratio:1;background:var(--bg-elev);border:1px solid var(--line);color:var(--ink-3);border-radius:var(--radius);font-weight:600;font-size:1rem;cursor:pointer;font-family:inherit;font-variant-numeric:tabular-nums;display:flex;align-items:center;justify-content:center;transition:all .2s var(--ease)}
.session-btn:hover{background:var(--bg-subtle);color:var(--ink)}
.session-btn.active{background:var(--ink);color:var(--bg);border-color:var(--ink);box-shadow:var(--shadow)}
.session-hint{font-size:.82rem;color:var(--ink-3);text-align:center;margin-bottom:14px;font-style:italic;min-height:1.2em}
.prefs-current{display:flex;align-items:center;gap:8px;color:var(--ink-3);font-size:.78rem;margin-top:12px;justify-content:center}
.prefs-current strong{color:var(--ink);font-weight:600}
.prefs-edit-link{background:transparent;border:none;color:var(--accent);font-size:.78rem;cursor:pointer;text-decoration:underline;text-underline-offset:2px;padding:0;font-family:inherit}
.prefs-edit-link:hover{color:var(--ink)}
 
/* NEXT RIDE — prominent section above weekly plan */
.next-ride-section{
  background:var(--bg-elev);
  border:1px solid var(--line);
  border-radius:var(--radius-lg);
  padding:22px;
  margin-bottom:14px;
  box-shadow:var(--shadow-sm);
  position:relative;
  overflow:hidden;
}
.next-ride-section::before{
  content:'';position:absolute;top:0;left:0;width:3px;height:100%;
  background:var(--accent);
}
.nr-section-eyebrow{font-size:.7rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:6px}
.nr-section-title{
  font-family:'Instrument Serif',Georgia,serif;font-style:italic;
  font-weight:400;font-size:1.6rem;letter-spacing:-.015em;line-height:1.1;
  color:var(--ink);margin-bottom:8px;
}
.nr-section-title em{font-style:italic;color:var(--accent);font-weight:400}
.nr-section-workout{
  color:var(--ink-2);font-size:.95rem;line-height:1.5;
  margin-bottom:14px;
}
.nr-panel{
  margin-top:6px;padding:0;
  background:transparent;
  border:none;
}
.nr-header{display:none}
.nr-title{font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-weight:400;font-size:1.1rem;color:var(--ink)}
.nr-rationale{color:var(--ink-3);font-size:.82rem;margin-bottom:12px;line-height:1.45}
.nr-target,.nr-panel-target{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.nr-chip{padding:4px 10px;background:var(--bg-subtle);border:1px solid var(--line);color:var(--ink-2);border-radius:99px;font-size:.74rem;font-weight:500;letter-spacing:.01em;font-variant-numeric:tabular-nums}
.nr-tabs{display:flex;background:var(--bg-subtle);padding:3px;border-radius:var(--radius);margin-bottom:12px;gap:2px}
.nr-tab-btn{flex:1;background:transparent;border:none;color:var(--ink-3);padding:8px 10px;border-radius:4px;font-size:.8rem;cursor:pointer;font-weight:500;font-family:inherit;transition:all .2s var(--ease)}
.nr-tab-btn.active{background:var(--bg-elev);color:var(--ink);box-shadow:var(--shadow-sm)}
.nr-route{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;background:var(--bg-subtle);border:1px solid var(--line);border-radius:var(--radius);margin-bottom:6px;cursor:pointer;transition:all .2s var(--ease)}
.nr-route:hover{border-color:var(--accent);transform:translateY(-1px)}
.nr-route:active{transform:translateY(0) scale(.99)}
.nr-route-info{flex:1;min-width:0}
.nr-route-name{font-weight:600;font-size:.9rem;letter-spacing:-.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px;color:var(--ink)}
.nr-route-name .star{color:var(--accent);font-size:.85rem}
.nr-route-meta{display:flex;flex-wrap:wrap;gap:10px;color:var(--ink-3);font-size:.72rem;margin-top:3px;font-variant-numeric:tabular-nums}
.nr-route-arrow{color:var(--ink-4);font-size:1rem;flex-shrink:0;margin-left:6px;transition:transform .2s var(--ease)}
.nr-route:hover .nr-route-arrow{color:var(--accent);transform:translateX(2px)}
.nr-match{display:inline-block;font-size:.62rem;font-weight:600;padding:2px 7px;border-radius:99px;margin-left:6px;letter-spacing:.02em}
.nr-match.high{background:var(--good-soft);color:var(--good)}
.nr-match.med{background:var(--warn-soft);color:var(--warn)}
.nr-match.low{background:var(--bg-subtle);color:var(--ink-4)}
.nr-empty{padding:18px 12px;text-align:center;color:var(--ink-3);font-size:.85rem;background:var(--bg-subtle);border-radius:var(--radius)}
.nr-load-btn{display:block;width:100%;padding:12px;background:var(--bg-subtle);border:1px solid var(--line);color:var(--ink-2);border-radius:var(--radius);font-size:.85rem;font-weight:500;cursor:pointer;text-align:center;font-family:inherit;transition:all .2s var(--ease)}
.nr-load-btn:hover{background:var(--bg-elev);border-color:var(--ink-3);color:var(--ink)}
.nr-discover{padding:14px;background:var(--bg-subtle);border-radius:var(--radius)}
.nr-discover-title{font-weight:600;font-size:.85rem;margin-bottom:8px;color:var(--ink);letter-spacing:-.005em}
.nr-discover-list{font-size:.85rem;color:var(--ink-2);line-height:1.7}
.nr-discover-list strong{color:var(--accent);font-weight:600}
.nr-actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.nr-action-btn{flex:1;min-width:120px;background:var(--ink);color:var(--bg);border:none;padding:10px 14px;border-radius:var(--radius);font-size:.85rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;font-family:inherit;transition:all .2s var(--ease)}
.nr-action-btn:hover{transform:translateY(-1px);box-shadow:var(--shadow)}
.nr-action-btn.copy{background:var(--bg-elev);color:var(--ink);border:1px solid var(--line-strong);box-shadow:none}
.nr-action-btn.copy:hover{background:var(--bg-subtle)}
.nr-action-btn:active{transform:scale(.99)}
.nr-address-row{display:flex;align-items:center;gap:8px;margin-top:10px;padding:9px 12px;background:var(--bg-elev);border:1px solid var(--line);border-radius:var(--radius);font-size:.78rem}
.nr-address-row span{flex:1;color:var(--ink-3)}
.nr-address-row strong{color:var(--ink);font-weight:600}
.nr-address-edit{background:transparent;border:none;color:var(--accent);font-size:.78rem;cursor:pointer;text-decoration:underline;text-underline-offset:2px;padding:0;font-family:inherit}
.nr-address-input{flex:1;background:var(--bg-elev);border:1px solid var(--line-strong);color:var(--ink);padding:8px 10px;border-radius:var(--radius);font-size:.85rem;font-family:inherit}
.nr-show-all{background:transparent;border:none;color:var(--ink-3);font-size:.78rem;cursor:pointer;text-decoration:underline;text-underline-offset:2px;display:block;margin:8px auto 0;padding:6px;font-family:inherit}
.nr-surface-gate{padding:14px;background:var(--bg-subtle);border-radius:var(--radius);margin-bottom:12px}
.nr-surface-q{font-size:.88rem;color:var(--ink);margin-bottom:10px;font-weight:600}
.nr-surface-q-sub{display:block;font-weight:400;color:var(--ink-3);font-size:.77rem;margin-top:3px}
.nr-surface-options{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.nr-surface-btn{background:var(--bg-elev);border:1px solid var(--line);color:var(--ink);padding:11px 8px;border-radius:var(--radius);font-size:.85rem;font-weight:500;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;font-family:inherit;transition:all .2s var(--ease)}
.nr-surface-btn:hover{background:var(--bg-subtle);border-color:var(--ink-3)}
.nr-surface-btn:active{transform:scale(.97)}
.nr-surface-btn .em{font-size:1.1rem}
.nr-surface-btn .sub{font-size:.65rem;color:var(--ink-3);font-weight:400}
.nr-surface-current{display:flex;align-items:center;justify-content:space-between;padding:8px 11px;background:var(--bg-subtle);border-radius:var(--radius);margin-bottom:10px;font-size:.78rem;color:var(--ink-3)}
.nr-surface-current strong{color:var(--ink);font-weight:600}
.nr-surface-change{background:transparent;border:none;color:var(--accent);font-size:.78rem;cursor:pointer;text-decoration:underline;text-underline-offset:2px;padding:0;font-family:inherit}
 
/* FOOTER */
.app-footer{margin-top:48px;padding-top:24px;border-top:1px solid var(--line);text-align:center;color:var(--ink-4);font-size:.75rem;letter-spacing:.02em}
.app-footer a{color:var(--ink-3);text-decoration:none}
.app-footer a:hover{color:var(--ink-2);text-decoration:underline;text-underline-offset:2px}
.app-footer .dot{margin:0 8px;color:var(--ink-4)}
 
/* CHANGELOG MODAL */
.modal-backdrop{position:fixed;inset:0;background:rgba(10,10,10,.4);display:flex;align-items:flex-end;justify-content:center;z-index:200;animation:fadeIn .25s var(--ease) both}
@media(min-width:600px){.modal-backdrop{align-items:center}}
.modal-sheet{background:var(--bg);width:100%;max-width:520px;max-height:85vh;border-radius:16px 16px 0 0;padding:22px 22px 80px;overflow-y:auto;animation:fadeUp .35s var(--ease) both;box-shadow:var(--shadow-lg)}
@media(min-width:600px){.modal-sheet{border-radius:16px;padding-bottom:22px}}
.modal-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;position:sticky;top:0;background:var(--bg);padding-top:4px}
.modal-title{font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-weight:400;font-size:1.7rem;letter-spacing:-.015em;color:var(--ink)}
.modal-close{background:transparent;border:1px solid var(--line);width:32px;height:32px;border-radius:50%;cursor:pointer;color:var(--ink-2);font-size:1rem;font-family:inherit;display:flex;align-items:center;justify-content:center;transition:all .2s var(--ease);line-height:1}
.modal-close:hover{background:var(--bg-subtle)}
.changelog-entry{padding:18px 0;border-bottom:1px solid var(--line)}
.changelog-entry:last-child{border-bottom:none}
.changelog-version{display:flex;align-items:baseline;gap:10px;margin-bottom:8px}
.changelog-v{font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-weight:400;font-size:1.4rem;letter-spacing:-.01em;color:var(--accent)}
.changelog-v.current::after{content:'current';font-family:'Inter',sans-serif;font-style:normal;margin-left:8px;font-size:.62rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);background:var(--bg-subtle);padding:2px 8px;border-radius:99px;vertical-align:middle}
.changelog-date{font-size:.74rem;color:var(--ink-3);letter-spacing:.04em}
.changelog-list{margin:0;padding-left:18px;color:var(--ink-2);font-size:.88rem;line-height:1.6}
.changelog-list li{margin-bottom:5px}
 
/* Empty / connect screen helpers */
.empty{text-align:center;padding:48px 24px}
.empty-em{font-size:2.5rem;display:block;margin-bottom:14px;opacity:.5}
.brand-link{display:inline-flex;align-items:center;gap:8px;text-decoration:none;color:var(--ink);font-family:'Instrument Serif',serif;font-style:italic;font-size:1.2rem;letter-spacing:-.005em}
.bike,.bounce{display:none}
.muted{color:var(--ink-3);font-size:.85rem;text-align:center;margin-top:10px}
.feature-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:24px}
.feature{background:var(--bg-elev);border:1px solid var(--line);border-radius:var(--radius);padding:12px 8px;text-align:center}
.feature-em{font-size:1.2rem;margin-bottom:6px}
.feature-title{font-weight:600;font-size:.78rem;color:var(--ink);margin-bottom:2px}
.feature-desc{font-size:.7rem;color:var(--ink-3);line-height:1.4}
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
</head><body>
 
<svg width="0" height="0" style="position:absolute"><defs>
  <linearGradient id="goal-grad" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#ff8c00"/><stop offset="100%" stop-color="#ff6b35"/>
  </linearGradient>
</defs></svg>
 
<div id="app"></div>
 
<script>
const WORKER_URL = '${origin}';
const WORKER_VERSION = '${WORKER_VERSION}';
const BUILD_DATE = '${BUILD_DATE}';
const CURRENT_YEAR = new Date().getFullYear();
 
let state = {
  view: 'loading',
  tokens: null,
  athlete: null,
  activities: [],
  syncProgress: '',
  syncCount: 0,
  error: null,
  lastSync: null,
  toast: null,
  chartMode: 'monthly', // weekly | monthly
  goal: null, // {year, target_km}
  goalEditing: false,
  aiReport: null,
  aiLoading: false,
  aiError: null,
  anthropicKey: null,
  showApiKeyInput: false,
  showPasteTokens: false,
  rideFeedback: {},      // { rideId: { verdict, feedback, next, generated_at } }
  expandedRideId: null,  // which ride's feedback panel is open
  loadingRideId: null,   // ride currently fetching feedback
  rideDetails: {},       // { rideId: { ...full detail object from Strava } } — cached forever
  expandedDetailId: null,  // which ride's detail panel is open
  loadingDetailId: null,  // ride currently fetching detail
  routes: null,          // user's saved Strava routes (array)
  routesFetchedAt: null, // timestamp of last routes fetch
  routesLoading: false,
  routesError: null,
  startAddress: null,    // saved user preference (city/area)
  routesView: 'saved',   // 'saved' | 'discover'
  showAllRoutes: false,  // expand top 3 → all
  editingAddress: false, // address input shown
  surfacePref: null,     // 'any' | 'paved' | 'dirt' — null = not yet chosen
  expandedDay: null,     // which weekly-plan day is expanded for routes
  showChangelog: false,  // changelog modal open
  trainingPrefs: { sessions_per_week: 3 },  // default 3 sessions/week
  showTrainingPrefs: false,
};
 
const Store = {
  get(k) { try { return JSON.parse(localStorage.getItem('cc_' + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('cc_' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('cc_' + k); } catch {} },
};
 
async function ensureValidToken() {
  if (!state.tokens) return null;
  const now = Math.floor(Date.now() / 1000);
  if (state.tokens.expires_at && state.tokens.expires_at > now + 300) return state.tokens.access_token;
  try {
    const r = await fetch(WORKER_URL + '/refresh', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: state.tokens.refresh_token }),
    });
    const data = await r.json();
    if (data.access_token) {
      state.tokens = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at };
      Store.set('tokens', state.tokens);
      return state.tokens.access_token;
    }
  } catch (e) { console.error('Refresh failed:', e); }
  return null;
}
 
async function api(path) {
  const token = await ensureValidToken();
  if (!token) throw new Error('Token expired or invalid');
  const r = await fetch(WORKER_URL + '/api/' + path, { headers: { 'Authorization': 'Bearer ' + token } });
  if (!r.ok) {
    if (r.status === 401) throw new Error('Session expired');
    if (r.status === 429) throw new Error('Rate limited by Strava — wait 15 min');
    throw new Error('API error ' + r.status);
  }
  return r.json();
}
 
async function fullSync() {
  state.view = 'syncing';
  state.syncProgress = 'Loading your profile...';
  state.syncCount = 0;
  render();
  try {
    state.athlete = await api('athlete');
    Store.set('athlete', state.athlete);
    const all = [];
    let page = 1;
    while (true) {
      state.syncProgress = 'Importing activities...';
      state.syncCount = all.length;
      render();
      const pd = await api('athlete/activities?per_page=200&page=' + page);
      if (!pd.length) break;
      all.push(...pd.map(compress));
      page++;
      if (page > 50) break;
      await new Promise(r => setTimeout(r, 100));
    }
    state.activities = all;
    Store.set('activities', all);
    Store.set('lastSync', Date.now());
    state.lastSync = Date.now();
    state.view = 'dashboard';
    render();
    showToast('✓ Synced ' + all.length + ' activities');
  } catch (e) {
    state.error = e.message;
    if (e.message.includes('expired') || e.message.includes('invalid')) {
      Store.del('tokens'); state.tokens = null; state.view = 'connect';
    } else {
      state.view = state.activities.length ? 'dashboard' : 'connect';
    }
    render();
  }
}
 
async function incrementalSync(silent) {
  if (!state.lastSync) return fullSync();
  try {
    const after = Math.floor(state.lastSync / 1000) - 3600;
    const fresh = [];
    let page = 1;
    while (true) {
      const pd = await api('athlete/activities?after=' + after + '&per_page=200&page=' + page);
      if (!pd.length) break;
      fresh.push(...pd.map(compress));
      page++;
      if (page > 10) break;
    }
    const ids = new Set(state.activities.map(a => a.id));
    const newOnes = fresh.filter(a => !ids.has(a.id));
    if (newOnes.length) {
      state.activities = [...newOnes, ...state.activities].sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
      Store.set('activities', state.activities);
      if (!silent) showToast('✓ ' + newOnes.length + ' new ride' + (newOnes.length > 1 ? 's' : '') + ' synced');
    } else if (!silent) {
      showToast('✓ Already up to date');
    }
    state.lastSync = Date.now();
    Store.set('lastSync', state.lastSync);
    render();
  } catch (e) {
    console.error('Sync failed:', e);
    if (!silent) showToast('⚠ Sync failed: ' + e.message);
  }
}
 
function compress(a) {
  return {
    id: a.id, name: a.name, distance: a.distance,
    moving_time: a.moving_time, total_elevation_gain: a.total_elevation_gain || 0,
    average_speed: a.average_speed || 0, max_speed: a.max_speed || 0,
    start_date: a.start_date, start_date_local: a.start_date_local,
    type: a.type, sport_type: a.sport_type,
    // Used for PRs timeline + heatmap intensity + ride feedback context
    pr_count: a.pr_count || 0,
    achievement_count: a.achievement_count || 0,
    kudos_count: a.kudos_count || 0,
    average_heartrate: a.average_heartrate || null,
    suffer_score: a.suffer_score || null,
  };
}
 
// ============= ANALYSIS =============
function getRides() {
  return state.activities.filter(a => a.type === 'Ride' || (a.sport_type && a.sport_type.includes('Ride')) || a.type === 'VirtualRide');
}
 
function analyze() {
  const rides = getRides();
  if (!rides.length) return null;
  const td = rides.reduce((s, a) => s + (a.distance || 0), 0) / 1000;
  const te = rides.reduce((s, a) => s + (a.total_elevation_gain || 0), 0);
  const tt = rides.reduce((s, a) => s + (a.moving_time || 0), 0);
  const as = (rides.reduce((s, a) => s + (a.average_speed || 0), 0) / rides.length) * 3.6;
  const lr = Math.max(...rides.map(r => r.distance / 1000));
  const fr = Math.max(...rides.map(r => r.average_speed * 3.6));
  const yr = rides.filter(r => new Date(r.start_date).getFullYear() === CURRENT_YEAR);
  const yd = yr.reduce((s, a) => s + (a.distance || 0), 0) / 1000;
  const ye = yr.reduce((s, a) => s + (a.total_elevation_gain || 0), 0);
  const tda = Date.now() - (30 * 86400 * 1000);
  const recent = rides.filter(r => new Date(r.start_date).getTime() > tda);
  return {
    rideCount: rides.length,
    totalDistance: td.toFixed(1),
    totalElevation: te.toFixed(0),
    avgSpeed: as.toFixed(1),
    totalTime: Math.round(tt / 3600),
    longestRide: lr.toFixed(1),
    fastestRide: fr.toFixed(1),
    yearDistance: yd.toFixed(0),
    yearElevation: ye.toFixed(0),
    yearRideCount: yr.length,
    recentRideCount: recent.length,
    recentDistance: (recent.reduce((s, a) => s + (a.distance || 0), 0) / 1000).toFixed(0),
    year: CURRENT_YEAR,
    recentRides: rides.slice(0, 10),
  };
}
 
// ============= STREAK ANALYSIS =============
// Returns: { current, best, daysActive (last 365), totalDays }
function analyzeStreak() {
  const rides = getRides();
  if (!rides.length) return { current: 0, best: 0, daysActive: 0, totalDays: 0 };
 
  // Set of YYYY-MM-DD strings where user rode
  const dayKeys = new Set();
  rides.forEach(r => {
    const d = new Date(r.start_date_local || r.start_date);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    dayKeys.add(key);
  });
 
  // Streak metric: consecutive WEEKS (Mon-Sun) with at least one ride
  const weekKeys = new Set();
  rides.forEach(r => {
    const d = new Date(r.start_date_local || r.start_date);
    const day = d.getDay() || 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day - 1));
    monday.setHours(0,0,0,0);
    weekKeys.add(monday.getTime());
  });
 
  // Walk back from current week (Monday)
  const now = new Date();
  const today = (now.getDay() || 7);
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - (today - 1));
  thisMonday.setHours(0,0,0,0);
 
  let current = 0;
  let cursor = thisMonday.getTime();
  // Allow current week not to have a ride yet — look at last week first
  // Strategy: start from this week. If this week has a ride, count it. If not, start from last week.
  if (!weekKeys.has(cursor)) {
    cursor -= 7 * 86400 * 1000; // go to last week
  }
  while (weekKeys.has(cursor)) {
    current++;
    cursor -= 7 * 86400 * 1000;
  }
 
  // Best streak ever
  const sortedWeeks = [...weekKeys].sort((a, b) => a - b);
  let best = 0, run = 0, prev = null;
  for (const w of sortedWeeks) {
    if (prev !== null && w - prev === 7 * 86400 * 1000) run++;
    else run = 1;
    if (run > best) best = run;
    prev = w;
  }
 
  // Days active in last 365
  const yearAgo = Date.now() - 365 * 86400 * 1000;
  const recentDays = [...dayKeys].filter(k => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d).getTime() > yearAgo;
  });
 
  return {
    current,
    best,
    daysActive: recentDays.length,
    totalDays: dayKeys.size,
  };
}
 
// ============= HEATMAP DATA =============
// Returns array of weeks, each with 7 days. Each day has {date, distance_km, count}.
// Covers last 12 weeks (84 days), aligned to Monday.
function buildHeatmap() {
  const rides = getRides();
  // Aggregate distance per day
  const dayMap = {}; // YYYY-MM-DD -> {distance_km, count}
  rides.forEach(r => {
    const d = new Date(r.start_date_local || r.start_date);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (!dayMap[key]) dayMap[key] = { distance_km: 0, count: 0 };
    dayMap[key].distance_km += (r.distance || 0) / 1000;
    dayMap[key].count++;
  });
 
  // Build last 12 weeks aligned to Monday-Sunday
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDay = today.getDay() || 7;
  // Sunday end of THIS week
  const thisSunday = new Date(today);
  thisSunday.setDate(today.getDate() + (7 - todayDay));
 
  const weeks = [];
  for (let w = 11; w >= 0; w--) {
    const weekStart = new Date(thisSunday);
    weekStart.setDate(thisSunday.getDate() - (w * 7) - 6); // Monday of week w-back
    const days = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(weekStart);
      dt.setDate(weekStart.getDate() + i);
      const key = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
      const isFuture = dt > today;
      days.push({
        date: key,
        dt: dt.getTime(),
        distance_km: dayMap[key]?.distance_km || 0,
        count: dayMap[key]?.count || 0,
        isFuture,
        isToday: dt.getTime() === today.getTime(),
      });
    }
    weeks.push(days);
  }
  return weeks;
}
 
// ============= PRs / WINS TIMELINE =============
// Returns rides with PRs/achievements, most recent first. Last 90 days.
function getPRs() {
  const rides = getRides();
  const cutoff = Date.now() - 90 * 86400 * 1000;
  return rides
    .filter(r => {
      const t = new Date(r.start_date).getTime();
      return t > cutoff && ((r.pr_count || 0) > 0 || (r.achievement_count || 0) > 0);
    })
    .slice(0, 20);
}
 
// ============= RIDE CLASSIFICATION =============
// Heuristic categorization of a ride based on its metrics. Cheap, instant.
// Returns: { category, color, emoji }
function classifyRide(r) {
  const distKm = (r.distance || 0) / 1000;
  const minutes = (r.moving_time || 0) / 60;
  const elev = r.total_elevation_gain || 0;
  const speedKmh = (r.average_speed || 0) * 3.6;
  const elevPerKm = distKm > 0 ? elev / distKm : 0;
 
  if (distKm < 5 && minutes < 30) {
    return { category: 'Quick spin', emoji: '⚡', color: 'rgba(96,165,250,.4)' };
  }
  if (elevPerKm > 18) {
    return { category: 'Climb', emoji: '⛰', color: 'rgba(167,139,250,.5)' };
  }
  if (speedKmh > 28 && distKm < 35) {
    return { category: 'Tempo', emoji: '🔥', color: 'rgba(248,113,113,.5)' };
  }
  if (distKm > 60) {
    return { category: 'Long ride', emoji: '🛣️', color: 'rgba(255,140,0,.6)' };
  }
  if (distKm > 30) {
    return { category: 'Endurance', emoji: '🚴', color: 'rgba(52,211,153,.5)' };
  }
  if (speedKmh < 18 && distKm < 25) {
    return { category: 'Recovery', emoji: '☁️', color: 'rgba(165,180,200,.4)' };
  }
  return { category: 'Steady', emoji: '🌿', color: 'rgba(120,180,140,.4)' };
}
function buildChartData(mode) {
  const rides = getRides();
  if (!rides.length) return { labels: [], distance: [], elevation: [] };
  const buckets = {};
  rides.forEach(r => {
    const d = new Date(r.start_date_local || r.start_date);
    let key;
    if (mode === 'weekly') {
      // Week starting Monday
      const day = d.getDay() || 7;
      const monday = new Date(d);
      monday.setDate(d.getDate() - (day - 1));
      monday.setHours(0,0,0,0);
      key = monday.toISOString().split('T')[0];
    } else {
      key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }
    if (!buckets[key]) buckets[key] = { distance: 0, elevation: 0 };
    buckets[key].distance += (r.distance || 0) / 1000;
    buckets[key].elevation += r.total_elevation_gain || 0;
  });
  const sortedKeys = Object.keys(buckets).sort();
  const limit = mode === 'weekly' ? 26 : 24;
  const recent = sortedKeys.slice(-limit);
  return {
    labels: recent.map(k => mode === 'weekly' ? formatWeekLabel(k) : formatMonthLabel(k)),
    distance: recent.map(k => Math.round(buckets[k].distance * 10) / 10),
    elevation: recent.map(k => Math.round(buckets[k].elevation)),
  };
}
 
function formatWeekLabel(iso) {
  const d = new Date(iso);
  return (d.getMonth() + 1) + '/' + d.getDate();
}
function formatMonthLabel(yyyymm) {
  const [y, m] = yyyymm.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[parseInt(m) - 1] + ' ' + y.slice(2);
}
 
let charts = { distance: null, elevation: null };
function renderCharts() {
  const data = buildChartData(state.chartMode);
  if (!data.labels.length) return;
  const baseOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { titleColor: '#fafaf7', bodyColor: '#fafaf7', backgroundColor: 'rgba(10,10,10,.92)', borderColor: 'rgba(252,76,2,.3)', borderWidth: 1, padding: 10, displayColors: false } },
    scales: {
      x: { ticks: { color: 'rgba(10,10,10,.5)', font: { size: 10 } }, grid: { display: false }, border: { color: 'rgba(10,10,10,.08)' } },
      y: { ticks: { color: 'rgba(10,10,10,.5)', font: { size: 10 } }, grid: { color: 'rgba(10,10,10,.06)' }, border: { display: false }, beginAtZero: true },
    },
  };
  const distEl = document.getElementById('chart-distance');
  const elevEl = document.getElementById('chart-elevation');
  if (charts.distance) charts.distance.destroy();
  if (charts.elevation) charts.elevation.destroy();
  if (distEl) {
    charts.distance = new Chart(distEl, {
      type: 'bar',
      data: { labels: data.labels, datasets: [{ data: data.distance, backgroundColor: '#fc4c02', borderRadius: 4, borderSkipped: false }] },
      options: { ...baseOpts, plugins: { ...baseOpts.plugins, tooltip: { ...baseOpts.plugins.tooltip, callbacks: { label: ctx => ctx.parsed.y.toFixed(1) + ' km' } } } },
    });
  }
  if (elevEl) {
    charts.elevation = new Chart(elevEl, {
      type: 'line',
      data: { labels: data.labels, datasets: [{ data: data.elevation, borderColor: '#0a0a0a', backgroundColor: 'rgba(10,10,10,.05)', borderWidth: 1.5, tension: .3, fill: true, pointRadius: 3, pointBackgroundColor: '#fc4c02', pointBorderColor: '#fc4c02', pointHoverRadius: 5 }] },
      options: { ...baseOpts, plugins: { ...baseOpts.plugins, tooltip: { ...baseOpts.plugins.tooltip, callbacks: { label: ctx => Math.round(ctx.parsed.y) + ' m' } } } },
    });
  }
}
 
function setChartMode(m) {
  state.chartMode = m;
  render();
  setTimeout(renderCharts, 50);
}
 
// ============= GOALS =============
function getCurrentGoal() {
  const g = state.goal;
  if (!g || g.year !== CURRENT_YEAR) return null;
  return g;
}
 
function startEditGoal() {
  state.goalEditing = true;
  render();
  setTimeout(() => {
    const inp = document.getElementById('goal-input');
    if (inp) { inp.focus(); inp.select(); }
  }, 50);
}
 
function saveGoal() {
  const v = parseInt(document.getElementById('goal-input').value);
  if (isNaN(v) || v <= 0) { showToast('⚠ Enter a positive number'); return; }
  state.goal = { year: CURRENT_YEAR, target_km: v };
  Store.set('goal', state.goal);
  state.goalEditing = false;
  render();
  showToast('✓ Goal set: ' + v + ' km');
}
 
function cancelGoal() {
  state.goalEditing = false;
  render();
}
 
function clearGoal() {
  if (!confirm('Remove your ' + CURRENT_YEAR + ' goal?')) return;
  state.goal = null;
  Store.del('goal');
  render();
}
 
function buildGoalView(yearKm) {
  const g = getCurrentGoal();
  if (!g) return null;
  const pct = Math.min(100, (yearKm / g.target_km) * 100);
  // Projected year-end based on pace
  const dayOfYear = Math.floor((Date.now() - new Date(CURRENT_YEAR, 0, 1).getTime()) / 86400000) + 1;
  const projection = Math.round((yearKm / dayOfYear) * 365);
  const onTrack = projection >= g.target_km;
  return { target: g.target_km, current: yearKm, pct, projection, onTrack };
}
 
// ============= AI COACHING =============
async function runAICoach() {
  const a = analyze();
  if (!a) return;
  // Need API key
  if (!state.anthropicKey) {
    state.showApiKeyInput = true;
    render();
    setTimeout(() => { const i = document.getElementById('api-key-input'); if (i) i.focus(); }, 50);
    return;
  }
  state.aiLoading = true;
  state.aiError = null;
  render();
  try {
    const recent = state.activities.slice(0, 15).map(act => ({
      name: act.name,
      distance_km: ((act.distance || 0) / 1000).toFixed(1),
      elevation_m: act.total_elevation_gain || 0,
      avg_speed_kmh: ((act.average_speed || 0) * 3.6).toFixed(1),
      duration_min: Math.round((act.moving_time || 0) / 60),
      date: new Date(act.start_date).toLocaleDateString(),
    }));
    const r = await fetch(WORKER_URL + '/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        athlete: { firstname: state.athlete?.firstname || 'Athlete' },
        stats: a,
        recent,
        prefs: state.trainingPrefs,
        api_key: state.anthropicKey,
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      if (data.invalid_key) {
        // Wipe the bad key so user is re-prompted
        state.anthropicKey = null;
        Store.del('anthropicKey');
        state.showApiKeyInput = true;
        throw new Error('Your API key seems invalid. Please re-enter it.');
      }
      throw new Error(data.error || 'Failed to get AI report');
    }
    state.aiReport = { ...data, generated_at: Date.now() };
    Store.set('aiReport', state.aiReport);
    showToast('✨ AI report ready');
  } catch (e) {
    state.aiError = e.message;
    showToast('⚠ ' + e.message);
  } finally {
    state.aiLoading = false;
    render();
  }
}
 
function saveApiKey() {
  const v = document.getElementById('api-key-input').value.trim();
  if (!v) { showToast('⚠ Paste your API key'); return; }
  if (!v.startsWith('sk-ant-')) { showToast('⚠ Anthropic keys start with sk-ant-'); return; }
  state.anthropicKey = v;
  Store.set('anthropicKey', v);
  state.showApiKeyInput = false;
  state.aiError = null;
  render();
  showToast('✓ API key saved');
  // Auto-trigger the AI report now
  setTimeout(runAICoach, 300);
}
 
function cancelApiKey() {
  state.showApiKeyInput = false;
  state.aiError = null;
  render();
}
 
function changeApiKey() {
  state.showApiKeyInput = true;
  render();
  setTimeout(() => { const i = document.getElementById('api-key-input'); if (i) i.focus(); }, 50);
}
 
function removeApiKey() {
  if (!confirm('Remove your saved Anthropic API key from this browser?')) return;
  state.anthropicKey = null;
  Store.del('anthropicKey');
  showToast('✓ API key removed');
  render();
}
 
function clearAIReport() {
  state.aiReport = null;
  Store.del('aiReport');
  render();
}
 
// ============= TRAINING PREFERENCES =============
function openTrainingPrefs() {
  state.showTrainingPrefs = true;
  render();
  // Scroll the prefs picker into view so the user sees what changed
  setTimeout(() => {
    const el = document.querySelector('.prefs-card');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 50);
}
 
function closeTrainingPrefs() {
  state.showTrainingPrefs = false;
  render();
}
 
function setSessionsPerWeek(n) {
  const v = Math.max(1, Math.min(7, parseInt(n) || 3));
  state.trainingPrefs = { ...state.trainingPrefs, sessions_per_week: v };
  Store.set('trainingPrefs', state.trainingPrefs);
  render();
}
 
function saveTrainingPrefsAndRegen() {
  state.showTrainingPrefs = false;
  // If a report exists, regenerate it with the new prefs
  if (state.aiReport) {
    runAICoach();
  } else {
    render();
  }
}
 
// ============= PER-RIDE FEEDBACK =============
async function toggleRideFeedback(rideId) {
  // Toggle expansion. If already expanded, collapse.
  if (state.expandedRideId === rideId) {
    state.expandedRideId = null;
    render();
    return;
  }
  state.expandedRideId = rideId;
  render();
 
  // If we already have cached feedback, just show it.
  if (state.rideFeedback[rideId]) return;
 
  // No API key? Trigger the setup flow (same as full report).
  if (!state.anthropicKey) {
    state.showApiKeyInput = true;
    state.expandedRideId = null;
    render();
    setTimeout(() => { const i = document.getElementById('api-key-input'); if (i) i.focus(); }, 50);
    return;
  }
 
  await fetchRideFeedback(rideId);
}
 
async function fetchRideFeedback(rideId) {
  const ride = state.activities.find(a => a.id === rideId);
  if (!ride) return;
  const overall = analyze();
 
  state.loadingRideId = rideId;
  render();
  try {
    const res = await fetch(WORKER_URL + '/coach-ride', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        athlete: { firstname: state.athlete?.firstname || 'Athlete' },
        ride: {
          name: ride.name,
          distance_km: ((ride.distance || 0) / 1000).toFixed(1),
          duration_min: Math.round((ride.moving_time || 0) / 60),
          elevation_m: ride.total_elevation_gain || 0,
          avg_speed_kmh: ((ride.average_speed || 0) * 3.6).toFixed(1),
          heartrate: ride.average_heartrate,
          suffer_score: ride.suffer_score,
          pr_count: ride.pr_count || 0,
        },
        context: {
          totalRides: overall?.rideCount || 0,
          avgDistance: overall ? (parseFloat(overall.totalDistance) / overall.rideCount).toFixed(1) : '0',
          longestRide: overall?.longestRide || '0',
          avgSpeed: overall?.avgSpeed || '0',
        },
        api_key: state.anthropicKey,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.invalid_key) {
        state.anthropicKey = null;
        Store.del('anthropicKey');
        state.showApiKeyInput = true;
        state.expandedRideId = null;
        throw new Error('API key invalid — please re-enter it.');
      }
      throw new Error(data.error || 'Coach unavailable');
    }
    state.rideFeedback[rideId] = { ...data, generated_at: Date.now() };
    Store.set('rideFeedback', state.rideFeedback);
  } catch (e) {
    showToast('⚠ ' + e.message);
  } finally {
    state.loadingRideId = null;
    render();
  }
}
 
// ============= RIDE DETAIL (full Strava activity object) =============
async function toggleRideDetail(rideId) {
  if (state.expandedDetailId === rideId) {
    state.expandedDetailId = null;
    render();
    return;
  }
  state.expandedDetailId = rideId;
  render();
  // Smooth-scroll the card into view
  setTimeout(() => {
    const el = document.getElementById('ride-' + rideId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);
 
  // Already cached? done.
  if (state.rideDetails[rideId]) return;
 
  await fetchRideDetail(rideId);
}
 
async function fetchRideDetail(rideId) {
  state.loadingDetailId = rideId;
  render();
  try {
    const detail = await api('activities/' + rideId);
    // Strip the bulky map.polyline since we don't render maps yet — saves localStorage space.
    // Also strip per-segment efforts heavy fields not used by UI.
    const slim = {
      id: detail.id,
      name: detail.name,
      description: detail.description,
      type: detail.type, sport_type: detail.sport_type,
      distance: detail.distance,
      moving_time: detail.moving_time,
      elapsed_time: detail.elapsed_time,
      total_elevation_gain: detail.total_elevation_gain,
      elev_high: detail.elev_high, elev_low: detail.elev_low,
      average_speed: detail.average_speed, max_speed: detail.max_speed,
      average_watts: detail.average_watts, max_watts: detail.max_watts,
      weighted_average_watts: detail.weighted_average_watts,
      kilojoules: detail.kilojoules,
      device_watts: detail.device_watts,
      has_heartrate: detail.has_heartrate,
      average_heartrate: detail.average_heartrate, max_heartrate: detail.max_heartrate,
      calories: detail.calories,
      suffer_score: detail.suffer_score,
      pr_count: detail.pr_count, achievement_count: detail.achievement_count, kudos_count: detail.kudos_count,
      comment_count: detail.comment_count, athlete_count: detail.athlete_count,
      start_date: detail.start_date, start_date_local: detail.start_date_local,
      timezone: detail.timezone,
      location_city: detail.location_city, location_state: detail.location_state, location_country: detail.location_country,
      gear: detail.gear ? {
        id: detail.gear.id, name: detail.gear.name, brand_name: detail.gear.brand_name, model_name: detail.gear.model_name,
      } : null,
      splits_metric: (detail.splits_metric || []).map(s => ({
        split: s.split, distance: s.distance, elapsed_time: s.elapsed_time, moving_time: s.moving_time,
        elevation_difference: s.elevation_difference, average_speed: s.average_speed,
        average_heartrate: s.average_heartrate, pace_zone: s.pace_zone,
      })),
      best_efforts: (detail.best_efforts || []).map(b => ({
        name: b.name, distance: b.distance, elapsed_time: b.elapsed_time, moving_time: b.moving_time,
        pr_rank: b.pr_rank,
      })),
      segment_efforts: (detail.segment_efforts || []).slice(0, 10).map(se => ({
        id: se.id, name: se.name,
        elapsed_time: se.elapsed_time, moving_time: se.moving_time,
        distance: se.distance,
        average_watts: se.average_watts, average_heartrate: se.average_heartrate,
        pr_rank: se.pr_rank,
        kom_rank: se.kom_rank,
        achievements: (se.achievements || []).map(a => ({ type: a.type, rank: a.rank })),
      })),
      photos: detail.photos?.primary ? {
        url: detail.photos.primary.urls?.['600'] || detail.photos.primary.urls?.['100'] || null,
      } : null,
      total_photo_count: detail.total_photo_count || 0,
    };
    state.rideDetails[rideId] = { ...slim, fetched_at: Date.now() };
    Store.set('rideDetails', state.rideDetails);
  } catch (e) {
    showToast('⚠ Could not load details: ' + e.message);
    state.expandedDetailId = null;
  } finally {
    state.loadingDetailId = null;
    render();
  }
}
 
function fmtPace(secondsPerKm) {
  if (!secondsPerKm || !isFinite(secondsPerKm)) return '—';
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return m + ':' + String(s).padStart(2, '0');
}
 
function fmtDuration(seconds) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
  if (m > 0) return m + 'm ' + s + 's';
  return s + 's';
}
 
// ============= ROUTES — NEXT RIDE RECOMMENDATION =============
 
// Heuristic: extract ride characteristics from the AI weekly plan.
// Looks at TODAY's session in the plan and returns target distance/elevation/intensity.
// Falls back to averages if the plan can't be parsed.
// Shared isRestDay (matches the worker validator's logic)
function isRestDay(workoutText) {
  const w = String(workoutText || '').trim().toLowerCase();
  if (!w) return true;
  if (/^rest\\b/.test(w)) return true;
  if (/^active\\s*recovery/.test(w)) return true;
  if (/^(walk|yoga|stretch)/.test(w)) return true;
  if (w.length < 25 && /\\brest\\b/.test(w)) return true;
  return false;
}
 
// Classify any workout text into a target descriptor (used per-day for routes)
function classifyWorkout(workoutText, dayName) {
  if (!workoutText || isRestDay(workoutText)) return null;
  const target = String(workoutText).trim();
  const w = target.toLowerCase();
  const rides = getRides();
  const avgKm = rides.length ? (rides.reduce((s, a) => s + (a.distance || 0), 0) / rides.length / 1000) : 30;
 
  let sessionType, distMin, distMax, elevation, intensity, elevPerKm;
  if (/long\\s*ride|endurance long|2\\s*hour/i.test(w)) {
    sessionType = 'Long ride';
    distMin = Math.round(avgKm * 1.4); distMax = Math.round(avgKm * 2.0);
    elevation = 'moderate'; intensity = 'steady, conversational pace'; elevPerKm = 12;
  } else if (/hill repeat|climb|climbing/i.test(w)) {
    sessionType = 'Hill repeats';
    distMin = Math.max(15, Math.round(avgKm * 0.6)); distMax = Math.max(30, Math.round(avgKm * 1.0));
    elevation = 'hilly'; intensity = 'hard climbing efforts with recovery'; elevPerKm = 25;
  } else if (/tempo|threshold|interval/i.test(w)) {
    sessionType = 'Tempo / intervals';
    distMin = Math.max(20, Math.round(avgKm * 0.7)); distMax = Math.max(35, Math.round(avgKm * 1.1));
    elevation = 'flat'; intensity = 'hard efforts at threshold'; elevPerKm = 6;
  } else if (/recovery|easy|gentle|spin/i.test(w)) {
    sessionType = 'Recovery';
    distMin = 15; distMax = Math.round(avgKm * 0.7);
    elevation = 'flat'; intensity = 'very easy, conversational'; elevPerKm = 5;
  } else {
    sessionType = 'Steady ride';
    distMin = Math.round(avgKm * 0.8); distMax = Math.round(avgKm * 1.3);
    elevation = 'moderate'; intensity = 'comfortable steady pace'; elevPerKm = 10;
  }
  const pace = getRecommendedPace(sessionType);
  return { day: dayName, workout: target, sessionType, distMin, distMax, elevation, elevPerKm, intensity, paceMin: pace.min, paceMax: pace.max };
}
 
function getNextRideTarget() {
  const plan = state.aiReport?.weeklyPlan;
  if (!plan) return null;
  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const todayIdx = new Date().getDay();
  for (let i = 0; i < 7; i++) {
    const idx = (todayIdx + i) % 7;
    const dayName = dayNames[idx];
    const workout = plan[dayName];
    if (workout && !isRestDay(workout)) {
      return classifyWorkout(workout, dayName);
    }
  }
  return null;
}
 
// Compute rider's recent typical pace (km/h) — last 30 days if we have data,
// else fall back to global average.
function getRiderTypicalPace() {
  const rides = getRides();
  if (!rides.length) return 22; // sensible default
  const cutoff = Date.now() - 30 * 86400 * 1000;
  const recent = rides.filter(r => new Date(r.start_date).getTime() > cutoff);
  const sample = recent.length >= 3 ? recent : rides;
  // Distance-weighted average is more meaningful than per-ride avg
  const totalDist = sample.reduce((s, a) => s + (a.distance || 0), 0);
  const totalTime = sample.reduce((s, a) => s + (a.moving_time || 0), 0);
  if (totalTime <= 0) return 22;
  return (totalDist / totalTime) * 3.6;
}
 
// Given a session type, return the ideal pace range as % of the rider's typical pace
function getRecommendedPace(sessionType) {
  const base = getRiderTypicalPace();
  // % multipliers for the lower / upper bound of the range
  const ranges = {
    'Long ride':         [0.85, 0.92],
    'Steady ride':       [0.92, 1.02],
    'Tempo / intervals': [1.05, 1.15],
    'Hill repeats':      [0.85, 0.95], // overall avg, climbs harder
    'Recovery':          [0.70, 0.78],
    'Quick spin':        [0.80, 0.92],
  };
  const [loPct, hiPct] = ranges[sessionType] || [0.90, 1.00];
  return {
    min: Math.round(base * loPct * 10) / 10,
    max: Math.round(base * hiPct * 10) / 10,
  };
}
 
// Surface preference helpers
function setSurfacePref(value) {
  state.surfacePref = value;
  Store.set('surfacePref', value);
  render();
}
 
function changeSurfacePref() {
  state.surfacePref = null;
  Store.del('surfacePref');
  render();
}
 
// Boost/penalize a route's score based on surface preference vs sub_type
// sub_type: 1=road, 2=mountain bike, 3=cross, 4=trail, 5=mixed
function surfaceFitDelta(route, surfacePref) {
  if (!surfacePref || surfacePref === 'any') return 0;
  const st = route.sub_type;
  if (st == null) return 0; // unknown sub_type — neutral
  if (surfacePref === 'paved') {
    if (st === 1) return 12;        // road = perfect match
    if (st === 5) return 4;         // mixed = okay
    if (st === 2 || st === 3 || st === 4) return -10; // MTB/trail = wrong fit
    return 0;
  }
  if (surfacePref === 'dirt') {
    if (st === 4 || st === 2) return 12;  // trail / MTB = perfect
    if (st === 3) return 8;               // cross = good
    if (st === 5) return 4;               // mixed = okay
    if (st === 1) return -10;             // road = wrong fit
    return 0;
  }
  return 0;
}
 
// Score how well a saved route matches the target. Returns 0-100.
function scoreRoute(route, target) {
  const distKm = (route.distance || 0) / 1000;
  const elev = route.elevation_gain || 0;
  const elevRatio = distKm > 0 ? elev / distKm : 0;
 
  let score = 0;
 
  // DISTANCE (max 50 points)
  if (distKm >= target.distMin && distKm <= target.distMax) {
    score += 50;
  } else {
    // Penalty proportional to distance from range
    const center = (target.distMin + target.distMax) / 2;
    const range = (target.distMax - target.distMin) / 2;
    const dev = Math.abs(distKm - center);
    const penalty = Math.min(50, (dev / Math.max(range, 5)) * 25);
    score += Math.max(0, 50 - penalty);
  }
 
  // ELEVATION RATIO (max 35 points)
  let elevDiff = 0;
  if (target.elevation === 'flat') {
    elevDiff = Math.max(0, elevRatio - 8);
    score += Math.max(0, 35 - elevDiff * 3);
  } else if (target.elevation === 'hilly') {
    if (elevRatio >= 18) score += 35;
    else score += Math.max(0, 35 - (18 - elevRatio) * 2.5);
  } else {
    // moderate: ideal 8-15 m/km
    if (elevRatio >= 8 && elevRatio <= 15) score += 35;
    else if (elevRatio < 8) score += Math.max(0, 35 - (8 - elevRatio) * 2);
    else score += Math.max(0, 35 - (elevRatio - 15) * 2);
  }
 
  // BONUS — starred / recently used (max 15 points)
  if (route.starred) score += 10;
  // Recency (favor newer)
  if (route.created_at) {
    const ageDays = (Date.now() - new Date(route.created_at).getTime()) / 86400000;
    if (ageDays < 90) score += 5;
    else if (ageDays < 365) score += 2;
  }
 
  // SURFACE preference (max +/- 12 points)
  score += surfaceFitDelta(route, state.surfacePref);
 
  return Math.max(0, Math.min(100, Math.round(score)));
}
 
// Filter to bike-only routes and score them all
function rankRoutes(target) {
  if (!state.routes || !state.routes.length || !target) return [];
  // Strava route type: 1 = ride, 2 = run
  const bikeRoutes = state.routes.filter(r => r.type === 1 || r.type === '1');
  return bikeRoutes
    .map(r => ({ ...r, _score: scoreRoute(r, target) }))
    .sort((a, b) => b._score - a._score);
}
 
async function fetchRoutes(force) {
  // Cache for 24h unless forced
  const FRESH_MS = 24 * 60 * 60 * 1000;
  if (!force && state.routes && state.routesFetchedAt && (Date.now() - state.routesFetchedAt) < FRESH_MS) {
    return;
  }
  if (!state.athlete?.id) return;
  state.routesLoading = true;
  state.routesError = null;
  render();
  try {
    const data = await api('athletes/' + state.athlete.id + '/routes?per_page=200');
    // Slim each route — keep only fields we actually use
    const slim = (Array.isArray(data) ? data : []).map(r => ({
      id: r.id || r.id_str,
      name: r.name,
      description: r.description,
      distance: r.distance,
      elevation_gain: r.elevation_gain,
      type: r.type,
      sub_type: r.sub_type,
      starred: r.starred,
      private: r.private,
      created_at: r.created_at,
      estimated_moving_time: r.estimated_moving_time,
    }));
    state.routes = slim;
    state.routesFetchedAt = Date.now();
    Store.set('routes', slim);
    Store.set('routesFetchedAt', state.routesFetchedAt);
  } catch (e) {
    state.routesError = e.message || 'Could not load routes';
    showToast('⚠ ' + state.routesError);
  } finally {
    state.routesLoading = false;
    render();
  }
}
 
function saveStartAddress() {
  const v = document.getElementById('start-address-input').value.trim();
  if (v) {
    state.startAddress = v;
    Store.set('startAddress', v);
    showToast('✓ Saved');
  } else {
    state.startAddress = null;
    Store.del('startAddress');
  }
  render();
}
 
function clearStartAddress() {
  state.startAddress = null;
  Store.del('startAddress');
  render();
}
 
function openStravaRoute(routeId) {
  // Opens the Strava route. iOS PWA + Safari handle this natively (deep links).
  window.open('https://www.strava.com/routes/' + routeId, '_blank');
}
 
function openStravaDiscoverRoutes() {
  // No public deep link to pre-fill the Route Builder filters.
  // Best we can do: open the Strava maps page; the user reads our recommended params.
  window.open('https://www.strava.com/maps', '_blank');
}
 
function setRoutesView(v) {
  state.routesView = v;
  render();
}
 
function toggleShowAllRoutes() {
  state.showAllRoutes = !state.showAllRoutes;
  render();
}
 
function startEditAddress() {
  state.editingAddress = true;
  render();
  setTimeout(() => {
    const i = document.getElementById('start-address-input');
    if (i) { i.focus(); }
  }, 50);
}
 
function commitEditAddress() {
  saveStartAddress();
  state.editingAddress = false;
  render();
}
 
function cancelEditAddress() {
  state.editingAddress = false;
  render();
}
 
function copyRouteParams() {
  const target = getNextRideTarget();
  if (!target) return;
  const surfaceLabel = state.surfacePref === 'any' ? 'Any' : (state.surfacePref === 'paved' ? 'Paved' : (state.surfacePref === 'dirt' ? 'Dirt' : 'Any'));
  const text = \`Distance: \${target.distMin}-\${target.distMax} km · Elevation: \${target.elevation} · Surface: \${surfaceLabel} · Pace: \${target.paceMin}-\${target.paceMax} km/h · Type: \${target.sessionType}\${state.startAddress ? ' · Start: ' + state.startAddress : ''}\`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('✓ Copied'));
  } else {
    showToast('⚠ Copy not supported');
  }
}
 
// ============= DAY EXPAND (weekly plan integration) =============
function toggleDayExpand(dayName) {
  // Defensive: never mark a rest day as expanded
  const plan = state.aiReport?.weeklyPlan;
  if (plan && isRestDay(plan[dayName])) return;
  if (state.expandedDay === dayName) state.expandedDay = null;
  else state.expandedDay = dayName;
  render();
}
 
// Builds the routes panel HTML for a given day's target
function renderRoutesPanelHTML(target) {
  if (!target) return '';
  const elevLabel = target.elevation === 'flat' ? 'Flat' : (target.elevation === 'hilly' ? 'Hilly' : 'Moderate');
 
  let html = \`<div class="nr-panel">
    <div class="nr-panel-target">
      <span class="nr-chip">\${target.distMin}–\${target.distMax} km</span>
      <span class="nr-chip">\${elevLabel}</span>
      <span class="nr-chip">\${target.paceMin}–\${target.paceMax} km/h</span>
      <span class="nr-chip">\${target.sessionType}</span>
    </div>\`;
 
  if (!state.surfacePref) {
    html += \`<div class="nr-surface-gate">
      <div class="nr-surface-q">What surface today?
        <span class="nr-surface-q-sub">Pick one to see route suggestions</span>
      </div>
      <div class="nr-surface-options">
        <button class="nr-surface-btn" onclick="setSurfacePref('any')"><span class="em">🌐</span><span>Any</span><span class="sub">No preference</span></button>
        <button class="nr-surface-btn" onclick="setSurfacePref('paved')"><span class="em">🛣️</span><span>Paved</span><span class="sub">Road</span></button>
        <button class="nr-surface-btn" onclick="setSurfacePref('dirt')"><span class="em">🌲</span><span>Dirt</span><span class="sub">Trail / gravel</span></button>
      </div>
    </div></div>\`;
    return html;
  }
 
  const surfaceLabel = state.surfacePref === 'paved' ? 'Paved' : (state.surfacePref === 'dirt' ? 'Dirt' : 'Any');
  html += \`<div class="nr-surface-current"><span>Surface: <strong>\${surfaceLabel}</strong></span><button class="nr-surface-change" onclick="changeSurfacePref()">change</button></div>\`;
 
  html += \`<div class="nr-tabs">
    <button class="nr-tab-btn \${state.routesView === 'saved' ? 'active' : ''}" onclick="setRoutesView('saved')">Your saved</button>
    <button class="nr-tab-btn \${state.routesView === 'discover' ? 'active' : ''}" onclick="setRoutesView('discover')">Discover new</button>
  </div>\`;
 
  if (state.routesView === 'saved') {
    if (state.routesLoading) html += \`<div class="nr-empty"><div class="spinner" style="margin-right:8px"></div> Loading routes...</div>\`;
    else if (state.routes === null) html += \`<button class="nr-load-btn" onclick="fetchRoutes()">Load my saved Strava routes</button>\`;
    else if (state.routes.length === 0) html += \`<div class="nr-empty">You don't have saved Strava routes yet. Try <strong>Discover new</strong>.</div>\`;
    else {
      const ranked = rankRoutes(target);
      if (ranked.length === 0) html += \`<div class="nr-empty">No bike routes match this target. Try <strong>Discover new</strong>.</div>\`;
      else {
        const top = state.showAllRoutes ? ranked.slice(0, 15) : ranked.slice(0, 3);
        const matchLabel = (s) => s >= 75 ? { cls: 'high', text: 'Great match' } : (s >= 55 ? { cls: 'med', text: 'Good match' } : { cls: 'low', text: 'Partial' });
        html += top.map(r => {
          const m = matchLabel(r._score);
          const km = ((r.distance || 0) / 1000).toFixed(1);
          const elev = Math.round(r.elevation_gain || 0);
          const elevPerKm = (r.distance || 0) > 0 ? Math.round((r.elevation_gain || 0) / ((r.distance || 0) / 1000)) : 0;
          return \`<div class="nr-route" onclick="openStravaRoute('\${r.id}')">
            <div class="nr-route-info">
              <div class="nr-route-name">\${r.starred ? '<span class="star">★</span>' : ''}<span style="overflow:hidden;text-overflow:ellipsis">\${escapeHtml(r.name || 'Untitled route')}</span><span class="nr-match \${m.cls}">\${m.text}</span></div>
              <div class="nr-route-meta"><span>\${km} km</span><span>\${elev} m</span><span>\${elevPerKm} m/km</span></div>
            </div>
            <div class="nr-route-arrow">→</div>
          </div>\`;
        }).join('');
        if (ranked.length > 3) html += \`<button class="nr-show-all" onclick="toggleShowAllRoutes()">\${state.showAllRoutes ? 'Show less' : 'Show all ' + Math.min(ranked.length, 15)}</button>\`;
      }
    }
  } else {
    html += \`<div class="nr-discover">
      <div class="nr-discover-title">Open Strava with these filters</div>
      <div class="nr-discover-list">
        <div>Distance: <strong>\${target.distMin}–\${target.distMax} km</strong></div>
        <div>Elevation: <strong>\${target.elevation === 'flat' ? 'Avoid hills' : (target.elevation === 'hilly' ? 'Maximize elevation' : 'Any')}</strong></div>
        <div>Surface: <strong>\${surfaceLabel}</strong></div>
      </div>\`;
    if (state.editingAddress) {
      html += \`<div class="nr-address-row" style="margin-top:10px">
        <input id="start-address-input" class="nr-address-input" placeholder="e.g. Zürich" value="\${state.startAddress ? escapeHtml(state.startAddress) : ''}" onkeydown="if(event.key==='Enter')commitEditAddress()">
        <button class="nr-action-btn copy" style="flex:0;min-width:0;padding:7px 12px" onclick="commitEditAddress()">Save</button>
      </div>\`;
    } else {
      html += \`<div class="nr-address-row">
        <span>Start: <strong>\${state.startAddress ? escapeHtml(state.startAddress) : 'Not set'}</strong></span>
        <button class="nr-address-edit" onclick="startEditAddress()">\${state.startAddress ? 'change' : 'set'}</button>
      </div>\`;
    }
    html += \`<div class="nr-actions">
      <button class="nr-action-btn copy" onclick="copyRouteParams()">Copy params</button>
      <button class="nr-action-btn" onclick="openStravaDiscoverRoutes()">Open Strava ↗</button>
    </div>
  </div>\`;
  }
 
  html += '</div>';
  return html;
}
 
// ============= CHANGELOG =============
const CHANGELOG = [
  { version: 'v7.0.3', date: 'Apr 2026', notes: [
    'Internal: first auto-deploy via GitHub to Cloudflare CI/CD',
  ]},
  { version: 'v7.0.2', date: 'Apr 2026', notes: [
    'Restored prominent "Your next ride" section above the weekly plan',
    'Routes panel now visible by default for the next non-rest day',
    'Weekly plan day expansion remains available for browsing other days',
  ]},
  { version: 'v7.0.1', date: 'Apr 2026', notes: [
    'Fixed regex escaping that broke rest-day detection in v7.0',
    'Fixed broken quote escapes in weekly-plan day buttons',
    'Sunday rest detection now actually works',
    'Workout classification (long ride, hill repeats, tempo) reliable again',
  ]},
  { version: 'v7.0', date: 'Apr 2026', notes: [
    'Light editorial theme with serif italic display type',
    'Routes recommendations now expand inline within each weekly plan day',
    'Cleaner, less colorful surface — single accent (Strava orange)',
    "New What's-new footer link with version history",
    'Removed decorative emojis throughout for editorial feel',
  ]},
  { version: 'v6.9', date: 'Apr 2026', notes: [
    'Pace recommendation per session type (% of your typical pace)',
    'Surface picker required before showing route suggestions',
    'Surface preference affects route ranking via sub_type',
  ]},
  { version: 'v6.8', date: 'Apr 2026', notes: [
    '"Your next ride" routes recommendation feature',
    'Top saved Strava routes ranked against AI plan target',
    '"Discover new" tab with parameters to copy into Strava',
  ]},
  { version: 'v6.7', date: 'Apr 2026', notes: [
    'Stricter prompt for AI weekly plan with explicit rest day rules',
    'Server validates session count and auto-corrects if exceeded',
  ]},
  { version: 'v6.6', date: 'Apr 2026', notes: [
    'Tap any ride name to expand full Strava activity details',
    'Splits, segments, gear, photos, best efforts',
  ]},
  { version: 'v6.4–6.5', date: 'Apr 2026', notes: [
    'Sessions per week training preference (1–7)',
    'AI plan adapts to chosen weekly volume',
  ]},
  { version: 'v6.3', date: 'Apr 2026', notes: [
    'GitHub-style streak heatmap (12 weeks)',
    'PRs and achievements timeline',
    'Per-ride AI feedback ("Was this ride good?")',
    'Auto-categorization of rides',
  ]},
  { version: 'v6.0–6.2', date: 'Apr 2026', notes: [
    'Multi-tenant SaaS launch',
    'Landing + privacy pages',
    'BYOK Anthropic API key',
    'PWA OAuth flow with manual token paste',
  ]},
];
 
function openChangelog() { state.showChangelog = true; render(); }
function closeChangelog() { state.showChangelog = false; render(); }
function renderChangelog() {
  return \`<div class="modal-backdrop" onclick="if(event.target===this)closeChangelog()">
    <div class="modal-sheet">
      <div class="modal-head">
        <div class="modal-title">What's new</div>
        <button class="modal-close" onclick="closeChangelog()" aria-label="Close">×</button>
      </div>
      \${CHANGELOG.map((entry, idx) => \`
        <div class="changelog-entry">
          <div class="changelog-version">
            <span class="changelog-v\${idx === 0 ? ' current' : ''}">\${entry.version}</span>
            <span class="changelog-date">\${entry.date}</span>
          </div>
          <ul class="changelog-list">
            \${entry.notes.map(n => '<li>' + escapeHtml(n) + '</li>').join('')}
          </ul>
        </div>
      \`).join('')}
    </div>
  </div>\`;
}
 
// ============= ACTIONS =============
// Detect if running as iOS Home Screen PWA (standalone mode)
function isPWA() {
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
}
 
async function connectStrava() {
  if (isPWA()) {
    // PWA standalone mode: open OAuth in Safari, since the in-PWA webview
    // has no Strava session and breaks during login. The callback page will
    // show a "copy tokens" UI for the user to paste back here.
    const url = WORKER_URL + '/authorize?pwa=1';
    // Opening with target=_blank from a standalone PWA on iOS launches Safari.
    window.open(url, '_blank');
  } else {
    // Normal Safari flow: full redirect, callback auto-saves & redirects to dashboard
    window.location.href = WORKER_URL + '/authorize';
  }
}
 
function showPasteTokens() {
  state.showPasteTokens = true;
  state.error = null;
  render();
  setTimeout(() => {
    const t = document.getElementById('paste-tokens-input');
    if (t) t.focus();
  }, 50);
}
 
function cancelPasteTokens() {
  state.showPasteTokens = false;
  state.error = null;
  render();
}
 
async function pasteTokens() {
  const raw = document.getElementById('paste-tokens-input').value.trim();
  if (!raw) { showToast('⚠ Paste tokens first'); return; }
  let tokens;
  try { tokens = JSON.parse(raw); }
  catch { state.error = 'That does not look like valid token JSON. Make sure you copied the full block.'; render(); return; }
  if (!tokens.access_token || !tokens.refresh_token) {
    state.error = 'Tokens are incomplete (missing access_token or refresh_token).'; render(); return;
  }
  state.tokens = tokens;
  Store.set('tokens', tokens);
  state.showPasteTokens = false;
  state.error = null;
  showToast('✓ Tokens saved');
  // Sync data
  await fullSync();
}
async function refresh() { showToast('Syncing...', 1000); await incrementalSync(); }
 
async function logout() {
  if (!confirm('Disconnect Strava? Your local data (including your API key) will be deleted from this browser.')) return;
  Store.del('tokens'); Store.del('athlete'); Store.del('activities');
  Store.del('lastSync'); Store.del('goal'); Store.del('aiReport'); Store.del('anthropicKey'); Store.del('rideFeedback'); Store.del('trainingPrefs'); Store.del('rideDetails'); Store.del('routes'); Store.del('routesFetchedAt'); Store.del('startAddress'); Store.del('surfacePref');
  state = { view: 'connect', tokens: null, athlete: null, activities: [], error: null, lastSync: null, toast: null, chartMode: 'monthly', goal: null, goalEditing: false, aiReport: null, aiLoading: false, anthropicKey: null, showApiKeyInput: false, showPasteTokens: false, rideFeedback: {}, expandedRideId: null, loadingRideId: null, trainingPrefs: { sessions_per_week: 3 }, showTrainingPrefs: false, rideDetails: {}, expandedDetailId: null, loadingDetailId: null, routes: null, routesFetchedAt: null, routesLoading: false, routesError: null, startAddress: null, routesView: 'saved', showAllRoutes: false, editingAddress: false, surfacePref: null, expandedDay: null, showChangelog: false };
  render();
}
 
function showToast(msg, ms) {
  state.toast = msg;
  render();
  setTimeout(() => { state.toast = null; render(); }, ms || 2500);
}
 
function fmtSync(t) {
  if (!t) return 'Never';
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}
 
function escapeHtml(s) { return String(s == null ? '' : s).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c])); }
 
// ============= RENDER =============
function render() {
  const app = document.getElementById('app');
  let html = '';
 
  if (state.view === 'loading') {
    html = \`<div class="center"><div style="text-align:center"><div class="spinner spinner-lg"></div></div></div>\`;
  } else if (state.view === 'syncing') {
    html = \`
      <div class="center"><div style="max-width:400px;text-align:center;width:100%">
        <h1><em>Syncing</em></h1>
        <p class="subtitle">Pulling your rides from Strava</p>
        <div class="card">
          <div class="spinner spinner-lg" style="margin-bottom:14px"></div>
          <div style="font-weight:600;color:var(--ink)">\${state.syncProgress}</div>
          \${state.syncCount > 0 ? '<div style="color:var(--accent);margin-top:8px;font-size:.9rem;font-weight:500">' + state.syncCount + ' activities loaded</div>' : ''}
        </div>
        <p style="color:var(--ink-3);font-size:.85rem;margin-top:12px">First-time sync only — future visits are instant</p>
      </div></div>\`;
  } else if (state.view === 'connect') {
    html = \`
      <div class="center"><div style="max-width:460px;width:100%">
        <div style="text-align:center;margin-bottom:32px;font-family:'Instrument Serif',serif;font-style:italic;font-size:1.4rem;color:var(--ink-2);letter-spacing:-.005em">Cycling Coach</div>
 
        \${state.showPasteTokens ? \`
          <div style="text-align:center;margin-bottom:24px">
            <h1><em>Paste</em> your tokens</h1>
            <p class="subtitle" style="margin-bottom:0">From the "Copy tokens" page in Safari</p>
          </div>
 
          \${state.error ? '<div class="error">' + escapeHtml(state.error) + '</div>' : ''}
 
          <textarea id="paste-tokens-input" placeholder='{"access_token":"...","refresh_token":"...","expires_at":...}' rows="6"
            style="width:100%;background:var(--bg-elev);border:1px solid var(--line-strong);color:var(--ink);padding:12px;border-radius:var(--radius);font-size:.8rem;font-family:ui-monospace,monospace;margin-bottom:12px;resize:vertical"></textarea>
 
          <button class="btn" onclick="pasteTokens()">Save & sync</button>
          <button onclick="cancelPasteTokens()" style="background:transparent;border:none;color:var(--ink-3);width:100%;padding:14px;cursor:pointer;margin-top:8px;font-family:inherit">← Back</button>
        \` : \`
          <div style="text-align:center;margin-bottom:32px">
            <h1>Welcome <em>back</em></h1>
            <p class="subtitle">Connect your Strava to see your dashboard</p>
          </div>
          \${state.error ? '<div class="error">' + escapeHtml(state.error) + '</div>' : ''}
          \${isPWA() ? \`
            <div style="background:var(--bg-elev);border:1px solid var(--line);color:var(--ink-2);padding:14px;border-radius:var(--radius);margin-bottom:14px;font-size:.85rem;line-height:1.5">
              <strong>You're using the home-screen app.</strong> Tapping "Connect" opens Safari for login. After authorizing, you'll copy your tokens and paste them here.
            </div>
          \` : ''}
          <button class="btn" onclick="connectStrava()">Connect with Strava</button>
          <p style="text-align:center;color:var(--ink-3);font-size:.82rem;margin-top:12px">Takes you to Strava's official login — your data stays in this browser</p>
 
          <button onclick="showPasteTokens()" style="background:transparent;border:none;color:var(--ink-3);width:100%;padding:12px;cursor:pointer;margin-top:4px;font-size:.85rem;text-decoration:underline;text-underline-offset:3px;font-family:inherit">I have tokens to paste</button>
        \`}
 
        <p style="text-align:center;margin-top:32px;font-size:.7rem;color:var(--ink-4);font-family:ui-monospace,monospace;letter-spacing:.05em">\${WORKER_VERSION} · \${BUILD_DATE}</p>
      </div></div>\`;
  } else if (state.view === 'dashboard') {
    const a = analyze();
    if (!a) {
      html = \`
        <div class="container">
          <div class="head">
            <div style="font-family:'Instrument Serif',serif;font-style:italic;font-size:1.2rem;letter-spacing:-.005em;color:var(--ink-2)">Cycling Coach</div>
            <button class="icon-btn" onclick="logout()" title="Disconnect">⏻</button>
          </div>
          <div class="card empty">
            <h2 style="margin-top:0">No rides yet</h2>
            <p style="color:var(--ink-3);margin:12px 0 24px">Once you log rides on Strava, they'll show up here automatically.</p>
            <button class="btn btn-sec" onclick="refresh()" style="max-width:200px;margin:0 auto">↻ Check again</button>
          </div>
        </div>\`;
    } else {
      const ath = state.athlete || {};
      const goalView = buildGoalView(parseFloat(a.yearDistance));
 
      // GOAL CARD
      let goalHtml = '';
      if (state.goalEditing) {
        const cur = getCurrentGoal();
        goalHtml = \`
          <div class="goal-card">
            <div class="goal-label">\${CURRENT_YEAR} GOAL</div>
            <div class="goal-input-row">
              <input type="number" id="goal-input" class="goal-input" min="1" step="50" placeholder="e.g. 5000" value="\${cur ? cur.target_km : ''}">
              <span style="color:var(--ink-3);font-weight:500">km</span>
            </div>
            <div style="display:flex;gap:8px;margin-top:12px;justify-content:center;flex-wrap:wrap">
              <button class="btn" style="max-width:160px" onclick="saveGoal()">Save</button>
              <button class="goal-edit" onclick="cancelGoal()">Cancel</button>
              \${cur ? '<button class="goal-edit" onclick="clearGoal()" style="color:#991b1b">Remove</button>' : ''}
            </div>
          </div>\`;
      } else if (goalView) {
        const dash = 2 * Math.PI * 60;
        const offset = dash * (1 - goalView.pct / 100);
        goalHtml = \`
          <div class="goal-card fade-up">
            <div class="goal-content">
              <div class="goal-ring-wrap" style="width:140px;height:140px">
                <svg class="goal-ring" width="140" height="140">
                  <circle class="bg" cx="70" cy="70" r="60"></circle>
                  <circle class="fg" cx="70" cy="70" r="60" stroke-dasharray="\${dash.toFixed(2)}" stroke-dashoffset="\${offset.toFixed(2)}"></circle>
                </svg>
                <div class="goal-center">
                  <div class="goal-pct">\${goalView.pct.toFixed(0)}%</div>
                  <div class="goal-pct-label">of goal</div>
                </div>
              </div>
              <div class="goal-info">
                <div class="goal-label">\${CURRENT_YEAR} GOAL</div>
                <div class="goal-num tabular">\${goalView.current.toFixed(0)} <span class="goal-num-target">/ \${goalView.target} km</span></div>
                <div class="goal-meta">
                  Projected: <strong style="color:\${goalView.onTrack ? 'var(--good)' : 'var(--warn)'}">\${goalView.projection} km</strong> by year-end<br>
                  \${goalView.onTrack ? 'On track' : 'Pick up the pace'}
                </div>
                <button class="goal-edit" onclick="startEditGoal()">Edit goal</button>
              </div>
            </div>
          </div>\`;
      } else {
        goalHtml = \`
          <div class="goal-card">
            <div class="goal-label">\${CURRENT_YEAR} GOAL</div>
            <div style="color:var(--ink-3);margin:8px 0 14px;font-size:.95rem">Set a yearly km target to track your progress</div>
            <button class="btn" style="max-width:240px;margin:0 auto" onclick="startEditGoal()">Set \${CURRENT_YEAR} goal</button>
          </div>\`;
      }
 
      // AI SECTION
      let aiHtml = '';
      if (state.showTrainingPrefs) {
        const cur = state.trainingPrefs.sessions_per_week;
        const sessionHints = {
          1: 'Once a week — a gentle start',
          2: 'Weekend warrior',
          3: 'Consistent recreational rider',
          4: 'Building real fitness',
          5: 'Serious about improving',
          6: 'Training for an event',
          7: 'Daily rider — careful with recovery',
        };
        aiHtml = \`
          <div class="prefs-card">
            <div class="prefs-title">Training preference</div>
            <div class="prefs-desc">How many cycling sessions do you want each week? Your AI plan will adapt to fit.</div>
            <div class="session-picker">
              \${[1,2,3,4,5,6,7].map(n => \`
                <button class="session-btn \${cur === n ? 'active' : ''}" onclick="setSessionsPerWeek(\${n})">\${n}</button>
              \`).join('')}
            </div>
            <div class="session-hint">\${sessionHints[cur] || ''}</div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-ai" style="flex:1" onclick="saveTrainingPrefsAndRegen()">\${state.aiReport ? 'Save & regenerate plan' : 'Save'}</button>
              <button class="goal-edit" onclick="closeTrainingPrefs()">Cancel</button>
            </div>
          </div>\`;
      } else if (state.showApiKeyInput) {
        aiHtml = \`
          <div class="ai-prompt-card" style="text-align:left">
            <div style="text-align:center;margin-bottom:18px">
              <div class="ai-title">Add your Anthropic API key</div>
              <div class="ai-desc">AI coaching uses your own key so you control the cost. Stored only in your browser.</div>
            </div>
 
            <details style="background:var(--bg-subtle);border-radius:var(--radius);padding:14px;margin-bottom:14px;font-size:.85rem">
              <summary style="cursor:pointer;color:var(--accent);font-weight:600">How to get an API key (3 minutes)</summary>
              <ol style="margin:12px 0 0 22px;color:var(--ink-2);line-height:1.8">
                <li>Go to <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" style="color:var(--accent)">console.anthropic.com</a></li>
                <li>Sign up (free, ~30 seconds)</li>
                <li>Add credits (\$5 minimum — lasts ~800 reports)</li>
                <li>Click "Create Key" → copy the key (starts with <code style="background:var(--bg-elev);padding:1px 4px;border-radius:3px;font-size:.85em">sk-ant-</code>)</li>
                <li>Paste below</li>
              </ol>
              <p style="margin-top:10px;color:var(--ink-3);font-size:.8rem">Each report costs ~\$0.005-0.01. You'll be billed by Anthropic, not us.</p>
            </details>
 
            <input id="api-key-input" type="password" placeholder="sk-ant-api03-..." 
              style="width:100%;background:var(--bg-elev);border:1px solid var(--line-strong);color:var(--ink);padding:12px;border-radius:var(--radius);font-size:.9rem;font-family:ui-monospace,monospace;margin-bottom:12px"
              onkeydown="if(event.key==='Enter')saveApiKey()">
 
            \${state.aiError ? '<div class="error" style="margin-bottom:12px">' + escapeHtml(state.aiError) + '</div>' : ''}
 
            <div style="display:flex;gap:8px">
              <button class="btn btn-ai" style="flex:1" onclick="saveApiKey()">Save & generate report</button>
              <button class="goal-edit" onclick="cancelApiKey()">Cancel</button>
            </div>
            <p style="text-align:center;margin-top:12px;color:var(--ink-3);font-size:.75rem">Stored locally — never sent to anyone except Anthropic</p>
          </div>\`;
      } else if (state.aiReport) {
        const r = state.aiReport;
        aiHtml = \`
          <div class="ai-report">
            \${r.summary ? \`<div class="ai-section ai-summary"><h3>Summary</h3><div style="color:var(--ink-2);line-height:1.6;font-size:.95rem">\${escapeHtml(r.summary)}</div></div>\` : ''}
            \${r.strengths?.length ? \`<div class="ai-section ai-strengths"><h3>Strengths</h3><ul>\${r.strengths.map(s => '<li>' + escapeHtml(s) + '</li>').join('')}</ul></div>\` : ''}
            \${r.areasToImprove?.length ? \`<div class="ai-section ai-improve"><h3>To improve</h3><ul>\${r.areasToImprove.map(s => '<li>' + escapeHtml(s) + '</li>').join('')}</ul></div>\` : ''}
            \${(() => {
              const target = getNextRideTarget();
              if (!target) return '';
              const dayLabel = target.day.charAt(0).toUpperCase() + target.day.slice(1);
              return \`<div class="next-ride-section fade-up">
                <div class="nr-section-eyebrow">Your next ride · \${dayLabel}</div>
                <div class="nr-section-title"><em>\${escapeHtml(target.sessionType)}</em></div>
                <div class="nr-section-workout">\${escapeHtml(target.workout)}</div>
                \${renderRoutesPanelHTML(target)}
              </div>\`;
            })()}
            \${r.weeklyPlan ? \`<div class="ai-section ai-plan"><h3>Weekly plan <span style="font-size:.75rem;font-weight:400;color:var(--ink-3);margin-left:6px;font-family:'Inter',sans-serif;font-style:normal">\${state.trainingPrefs.sessions_per_week} session\${state.trainingPrefs.sessions_per_week === 1 ? '' : 's'}/week · <a href="javascript:openTrainingPrefs()" style="color:var(--accent);text-decoration:underline;text-underline-offset:2px">change</a></span></h3>
            <div class="ai-plan-list">
              \${Object.entries(r.weeklyPlan).map(([day, w]) => {
                const dayTarget = classifyWorkout(w, day);
                const isRest = !dayTarget;
                const isExpanded = state.expandedDay === day;
                const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
                const expandable = !isRest;
                const dayClass = \`ai-day\${isRest ? ' rest' : ''}\${isExpanded ? ' expanded' : ''}\${!expandable ? ' locked' : ''}\`;
                return \`<div class="\${dayClass}">
                  <button class="ai-day-row" \${expandable ? \`onclick="toggleDayExpand('\${day}')"\` : 'disabled'}>
                    <div class="ai-day-name">\${dayLabel}</div>
                    <div class="ai-day-workout">\${escapeHtml(w)}</div>
                    \${expandable ? '<div class="ai-day-chev">›</div>' : ''}
                  </button>
                  \${isExpanded && dayTarget ? '<div class="ai-day-routes">' + renderRoutesPanelHTML(dayTarget) + '</div>' : ''}
                </div>\`;
              }).join('')}
            </div>
            </div>\` : ''}
            \${r.motivation ? \`<div class="ai-section ai-motivation">"\${escapeHtml(r.motivation)}"</div>\` : ''}
            <div class="ai-meta">
              Generated \${fmtSync(r.generated_at)} · 
              <a href="javascript:runAICoach()" style="color:var(--accent)">Regenerate</a> · 
              <a href="javascript:openTrainingPrefs()">Change sessions</a> · 
              <a href="javascript:clearAIReport()">Clear</a> · 
              <a href="javascript:changeApiKey()">Change key</a>
            </div>
          </div>\`;
      } else {
        const hasKey = !!state.anthropicKey;
        const sess = state.trainingPrefs.sessions_per_week;
        aiHtml = \`
          <div class="ai-prompt-card">
            <div class="ai-title">Personalized AI coaching</div>
            <div class="ai-desc">\${hasKey ? 'Get a detailed analysis of your training and a custom weekly plan.' : 'Bring your own Anthropic API key — costs ~\$0.01 per report.'}</div>
            \${state.aiError ? '<div class="error" style="margin-bottom:12px">' + escapeHtml(state.aiError) + '</div>' : ''}
            <button class="btn btn-ai" \${state.aiLoading ? 'disabled' : ''} onclick="runAICoach()">
              \${state.aiLoading ? '<div class="spinner" style="border-color:rgba(255,255,255,.4);border-top-color:white"></div> Analyzing...' : (hasKey ? 'Generate report' : 'Set up AI coaching')}
            </button>
            <div class="prefs-current">
              <span>Plan for <strong>\${sess} session\${sess === 1 ? '' : 's'}/week</strong></span>
              <button class="prefs-edit-link" onclick="openTrainingPrefs()">change</button>
            </div>
            \${hasKey ? \`<div style="margin-top:10px;font-size:.74rem;color:var(--ink-3);text-align:center">API key saved · <a href="javascript:changeApiKey()" style="color:var(--ink-2)">Change</a> · <a href="javascript:removeApiKey()" style="color:var(--ink-2)">Remove</a></div>\` : ''}
          </div>\`;
      }
 
      html = \`
        <div class="container">
          <div class="head fade-up">
            <div class="head-left">
              \${ath.profile_medium ? '<img class="avatar" src="' + ath.profile_medium + '" alt="">' : '<div style="font-size:1.3rem">🚴</div>'}
              <div style="min-width:0">
                <div class="head-name">\${escapeHtml((ath.firstname || 'Athlete') + ' ' + (ath.lastname || '').charAt(0) + '.')}</div>
                <div class="head-meta">\${fmtSync(state.lastSync)}</div>
              </div>
            </div>
            <div class="head-actions">
              <button class="icon-btn" onclick="refresh()" title="Sync">↻</button>
              <button class="icon-btn" onclick="logout()" title="Disconnect">⏻</button>
            </div>
          </div>
 
          <div class="hero fade-up-1">
            <div class="hero-eyebrow">Your cycling journey</div>
            <div class="hero-num"><em>\${a.totalDistance}</em><span>km</span></div>
            <div class="hero-meta">
              <span><b>\${a.rideCount}</b> rides</span>
              <span><b>\${a.totalTime}</b> hours</span>
              <span><b>\${a.yearDistance}</b>km in \${a.year}</span>
            </div>
          </div>
 
          <div class="stats fade-up-2">
            <div class="stat"><div class="stat-value tabular">\${a.avgSpeed}</div><div class="stat-label">Avg Speed · km/h</div></div>
            <div class="stat"><div class="stat-value tabular">\${a.totalElevation}</div><div class="stat-label">Elevation · m</div></div>
            <div class="stat"><div class="stat-value tabular">\${a.longestRide}</div><div class="stat-label">Longest · km</div></div>
            <div class="stat"><div class="stat-value tabular">\${a.fastestRide}</div><div class="stat-label">Top Speed · km/h</div></div>
          </div>
 
          \${(() => {
            const s = analyzeStreak();
            const heat = buildHeatmap();
            // Determine max distance in the heatmap window for scaling cell intensity
            let maxKm = 0;
            heat.forEach(week => week.forEach(d => { if (d.distance_km > maxKm) maxKm = d.distance_km; }));
            const cellLevel = (km) => {
              if (km === 0) return '';
              if (maxKm <= 0) return 'l1';
              const r = km / maxKm;
              if (r > 0.75) return 'l4';
              if (r > 0.5) return 'l3';
              if (r > 0.25) return 'l2';
              return 'l1';
            };
            // Month labels — show month name when first week of that month
            const monthLabels = heat.map((week) => {
              const firstNonFuture = week.find(d => !d.isFuture) || week[0];
              const dt = new Date(firstNonFuture.dt);
              return dt.getDate() <= 7 ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getMonth()] : '';
            });
            const streakSub = s.current === 0
              ? "Ride this week to start a streak"
              : s.current === 1 ? "First week — keep going!" : "Don't break the chain 🔗";
            return \`
            <div class="streak-card">
              <div class="streak-row">
                <div>
                  <div class="streak-label">Current streak</div>
                  <div class="streak-num">
                    <span class="streak-flame">\${s.current > 0 ? '🔥' : '🌱'}</span>
                    <span class="streak-val">\${s.current}</span>
                    <span class="streak-unit">week\${s.current === 1 ? '' : 's'}</span>
                  </div>
                  <div class="streak-sub">\${streakSub}</div>
                </div>
                <div class="streak-best">
                  <div>Best ever</div>
                  <div class="streak-best-num">\${s.best} week\${s.best === 1 ? '' : 's'}</div>
                  <div style="margin-top:4px">\${s.daysActive} days ridden in last year</div>
                </div>
              </div>
              <div class="heatmap">
                <div class="heatmap-grid">
                  \${heat.map((week, wIdx) => \`
                    <div class="heatmap-week">
                      \${week.map(d => {
                        const cls = d.isFuture ? 'future' : (cellLevel(d.distance_km) || '');
                        const todayCls = d.isToday ? ' today' : '';
                        const title = d.isFuture ? '' : (d.count > 0 ? \`\${d.date}: \${d.distance_km.toFixed(1)}km\` : \`\${d.date}: rest\`);
                        return \`<div class="hm-cell \${cls}\${todayCls}" title="\${title}"></div>\`;
                      }).join('')}
                    </div>
                  \`).join('')}
                </div>
                <div class="hm-months">\${monthLabels.map(m => \`<span>\${m}</span>\`).join('')}</div>
                <div class="hm-legend">
                  Less
                  <div class="hm-legend-cell hm-cell"></div>
                  <div class="hm-legend-cell hm-cell l1"></div>
                  <div class="hm-legend-cell hm-cell l2"></div>
                  <div class="hm-legend-cell hm-cell l3"></div>
                  <div class="hm-legend-cell hm-cell l4"></div>
                  More
                </div>
              </div>
            </div>\`;
          })()}
 
          \${goalHtml}
 
          \${(() => {
            const wins = getPRs();
            if (wins.length === 0) {
              return \`
                <div class="wins-card">
                  <div class="wins-header">
                    <div class="wins-title">Your wins</div>
                  </div>
                  <div class="wins-empty">
                    <div class="wins-empty-em">🌱</div>
                    No PRs in the last 90 days yet — keep riding, they'll come.
                  </div>
                </div>\`;
            }
            return \`
              <div class="wins-card">
                <div class="wins-header">
                  <div class="wins-title">Your wins</div>
                  <div class="wins-count">\${wins.length} in 90 days</div>
                </div>
                \${wins.map(w => {
                  const prCount = w.pr_count || 0;
                  const achCount = w.achievement_count || 0;
                  const date = new Date(w.start_date_local || w.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  const distKm = (w.distance / 1000).toFixed(1);
                  const labelText = prCount > 0
                    ? (prCount === 1 ? 'New PR' : prCount + ' PRs')
                    : (achCount + ' achievement' + (achCount === 1 ? '' : 's'));
                  return \`
                    <div class="win-item">
                      <div class="win-emoji">\${prCount > 0 ? '🏅' : '⭐'}</div>
                      <div class="win-text">
                        <div class="win-name">\${escapeHtml(w.name)}</div>
                        <div class="win-meta">\${date} · \${distKm}km · \${w.total_elevation_gain}m</div>
                      </div>
                      <div class="win-badge">\${labelText}</div>
                    </div>\`;
                }).join('')}
              </div>\`;
          })()}
 
          <div class="chart-card">
            <div class="chart-header">
              <div class="chart-title">Distance over time</div>
              <div class="chart-toggle">
                <button class="\${state.chartMode === 'weekly' ? 'active' : ''}" onclick="setChartMode('weekly')">Weekly</button>
                <button class="\${state.chartMode === 'monthly' ? 'active' : ''}" onclick="setChartMode('monthly')">Monthly</button>
              </div>
            </div>
            <div class="chart-wrap"><canvas id="chart-distance"></canvas></div>
          </div>
 
          <div class="chart-card">
            <div class="chart-header"><div class="chart-title">Elevation over time</div></div>
            <div class="chart-wrap"><canvas id="chart-elevation"></canvas></div>
          </div>
 
          \${aiHtml}
 
          <h2>Recent rides</h2>
          <div>
            \${a.recentRides.map(r => {
              const cat = classifyRide(r);
              const expanded = state.expandedRideId === r.id;
              const fb = state.rideFeedback[r.id];
              const loading = state.loadingRideId === r.id;
              const prCount = r.pr_count || 0;
              const detailOpen = state.expandedDetailId === r.id;
              const detail = state.rideDetails[r.id];
              const detailLoading = state.loadingDetailId === r.id;
 
              // Pre-build detail panel HTML
              let detailHtml = '';
              if (detailOpen) {
                if (detailLoading && !detail) {
                  detailHtml = \`<div class="ride-detail"><div class="rd-loading"><div class="spinner"></div> Loading full ride details...</div></div>\`;
                } else if (detail) {
                  // Compute split max for bar scaling
                  const splits = detail.splits_metric || [];
                  const splitSpeedMax = splits.length ? Math.max(...splits.map(s => s.average_speed || 0)) : 0;
 
                  // Top stats grid
                  const stats = [];
                  if (detail.average_speed) stats.push({ label: 'Avg speed', value: (detail.average_speed * 3.6).toFixed(1), unit: 'km/h' });
                  if (detail.max_speed) stats.push({ label: 'Top speed', value: (detail.max_speed * 3.6).toFixed(1), unit: 'km/h' });
                  if (detail.average_heartrate) stats.push({ label: 'Avg heart rate', value: Math.round(detail.average_heartrate), unit: 'bpm' });
                  if (detail.max_heartrate) stats.push({ label: 'Max heart rate', value: Math.round(detail.max_heartrate), unit: 'bpm' });
                  if (detail.average_watts) stats.push({ label: 'Avg power', value: Math.round(detail.average_watts), unit: 'W' });
                  if (detail.max_watts) stats.push({ label: 'Max power', value: Math.round(detail.max_watts), unit: 'W' });
                  if (detail.weighted_average_watts) stats.push({ label: 'Weighted power', value: Math.round(detail.weighted_average_watts), unit: 'W' });
                  if (detail.kilojoules) stats.push({ label: 'Energy', value: Math.round(detail.kilojoules), unit: 'kJ' });
                  if (detail.calories) stats.push({ label: 'Calories', value: Math.round(detail.calories), unit: 'kcal' });
                  if (detail.suffer_score) stats.push({ label: 'Effort score', value: Math.round(detail.suffer_score), unit: '' });
                  if (detail.elev_high) stats.push({ label: 'Highest point', value: Math.round(detail.elev_high), unit: 'm' });
                  if (detail.athlete_count > 1) stats.push({ label: 'Athletes', value: detail.athlete_count, unit: '' });
                  if (detail.kudos_count) stats.push({ label: 'Kudos', value: detail.kudos_count, unit: '' });
                  if (detail.comment_count) stats.push({ label: 'Comments', value: detail.comment_count, unit: '' });
 
                  detailHtml = \`<div class="ride-detail">
                    \${detail.photos?.url ? \`<div class="rd-section"><img class="rd-photo" src="\${detail.photos.url}" alt="Ride photo" loading="lazy"></div>\` : ''}
 
                    \${detail.description ? \`
                      <div class="rd-section">
                        <h4>Notes</h4>
                        <div class="rd-desc">\${escapeHtml(detail.description)}</div>
                      </div>
                    \` : ''}
 
                    <div class="rd-section">
                      <h4>Performance</h4>
                      <div class="rd-grid">
                        \${stats.map(s => \`
                          <div class="rd-stat">
                            <div class="rd-stat-label">\${s.label}</div>
                            <div class="rd-stat-value">\${s.value}\${s.unit ? \`<small>\${s.unit}</small>\` : ''}</div>
                          </div>
                        \`).join('')}
                      </div>
                    </div>
 
                    \${detail.gear ? \`
                      <div class="rd-section">
                        <h4>Bike</h4>
                        <div class="rd-row">
                          <div class="rd-row-label">\${escapeHtml(detail.gear.name || (detail.gear.brand_name + ' ' + detail.gear.model_name))}</div>
                        </div>
                      </div>
                    \` : ''}
 
                    \${(detail.location_city || detail.location_state || detail.location_country) ? \`
                      <div class="rd-section">
                        <h4>Where</h4>
                        <div class="rd-row">
                          <div class="rd-row-label">\${[detail.location_city, detail.location_state, detail.location_country].filter(Boolean).map(escapeHtml).join(', ')}</div>
                        </div>
                      </div>
                    \` : ''}
 
                    \${detail.best_efforts && detail.best_efforts.length ? \`
                      <div class="rd-section">
                        <h4>Best efforts on this ride</h4>
                        <div class="rd-list">
                          \${detail.best_efforts.map(b => \`
                            <div class="rd-row">
                              <div class="rd-row-label">\${escapeHtml(b.name)}</div>
                              \${b.pr_rank === 1 ? '<span class="rd-row-pr">PR</span>' : (b.pr_rank ? \`<span class="rd-row-pr">#\${b.pr_rank}</span>\` : '')}
                              <div class="rd-row-time">\${fmtDuration(b.elapsed_time)}</div>
                            </div>
                          \`).join('')}
                        </div>
                      </div>
                    \` : ''}
 
                    \${detail.segment_efforts && detail.segment_efforts.length ? \`
                      <div class="rd-section">
                        <h4>Top segments (\${detail.segment_efforts.length})</h4>
                        <div class="rd-list">
                          \${detail.segment_efforts.slice(0, 8).map(se => {
                            const isKom = se.kom_rank === 1;
                            const isPr = se.pr_rank === 1;
                            const badge = isKom ? '<span class="rd-row-pr" style="background:#fde68a;color:#92400e">KOM</span>'
                                        : isPr ? '<span class="rd-row-pr">PR</span>'
                                        : se.kom_rank ? \`<span class="rd-row-pr">KOM #\${se.kom_rank}</span>\`
                                        : '';
                            return \`<div class="rd-row">
                              <div class="rd-row-label">\${escapeHtml(se.name)}</div>
                              \${badge}
                              <div class="rd-row-time">\${fmtDuration(se.elapsed_time)}</div>
                            </div>\`;
                          }).join('')}
                        </div>
                      </div>
                    \` : ''}
 
                    \${splits.length > 1 ? \`
                      <div class="rd-section">
                        <h4>Splits per km</h4>
                        <div class="rd-list">
                          \${splits.map((s, i) => {
                            const speedKmh = (s.average_speed || 0) * 3.6;
                            const pct = splitSpeedMax > 0 ? (s.average_speed / splitSpeedMax) * 100 : 0;
                            return \`<div class="rd-row">
                              <div class="rd-row-label" style="max-width:30px">km \${s.split}</div>
                              <div class="rd-split-bar"><div class="rd-split-fill" style="width:\${pct.toFixed(0)}%"></div></div>
                              <div class="rd-row-time">\${speedKmh.toFixed(1)} km/h</div>
                            </div>\`;
                          }).join('')}
                        </div>
                      </div>
                    \` : ''}
 
                    <div class="rd-meta">
                      <a href="https://www.strava.com/activities/\${detail.id}" target="_blank" rel="noopener">View on Strava ↗</a>
                    </div>
                  </div>\`;
                }
              }
 
              return \`
              <div class="ride" id="ride-\${r.id}">
                <div class="ride-date">\${new Date(r.start_date_local).toLocaleDateString()}</div>
                <div style="margin-bottom:6px">
                  <span class="ride-cat">\${cat.category}</span>
                  \${prCount > 0 ? \`<span class="ride-pr-badge">\${prCount === 1 ? 'PR' : prCount + ' PRs'}</span>\` : ''}
                </div>
                <button class="ride-name-link \${detailOpen ? 'open' : ''}" onclick="toggleRideDetail(\${r.id})">
                  <span>\${escapeHtml(r.name)}</span>
                  <span class="chev">\${detailOpen ? '▾' : '›'}</span>
                </button>
                <div class="ride-meta tabular" style="margin-top:6px">
                  <span>\${(r.distance / 1000).toFixed(1)} km</span>
                  <span>\${Math.round(r.moving_time / 60)} min</span>
                  <span>\${r.total_elevation_gain} m</span>
                  <span>\${(r.average_speed * 3.6).toFixed(1)} km/h</span>
                </div>
                \${detailHtml}
                <div class="ride-actions">
                  <button class="ride-coach-btn" onclick="toggleRideFeedback(\${r.id})">
                    \${expanded ? 'Hide coach' : (fb ? 'Show coach' : 'Was this ride good?')}
                  </button>
                </div>
                \${expanded ? \`
                  <div class="ride-feedback">
                    \${loading ? \`
                      <div class="ride-fb-loading"><div class="spinner"></div> Coach is reviewing your ride...</div>
                    \` : (fb ? \`
                      <div class="ride-fb-verdict">\${escapeHtml(fb.verdict || '')}</div>
                      <div class="ride-fb-text">\${escapeHtml(fb.feedback || '')}</div>
                      \${fb.next ? \`<div class="ride-fb-next"><strong>Next time:</strong> \${escapeHtml(fb.next)}</div>\` : ''}
                    \` : '<div class="ride-fb-loading">Tap to get feedback</div>')}
                  </div>
                \` : ''}
              </div>\`;
            }).join('')}
          </div>
 
          <footer class="app-footer">
            <a href="/">Cycling Coach</a>
            <span class="dot">·</span>
            <a href="/privacy">Privacy</a>
            <span class="dot">·</span>
            <a href="javascript:openChangelog()">What's new</a>
            <div style="margin-top:8px;font-size:.68rem;color:var(--ink-4);font-family:ui-monospace,monospace;letter-spacing:.05em">\${WORKER_VERSION} · \${BUILD_DATE}</div>
          </footer>
          \${state.showChangelog ? renderChangelog() : ''}
        </div>\`;
    }
  }
 
  if (state.toast) html += \`<div class="toast">\${escapeHtml(state.toast)}</div>\`;
  app.innerHTML = html;
 
  // Render charts after DOM update
  if (state.view === 'dashboard' && getRides().length) {
    setTimeout(renderCharts, 50);
  }
}
 
// ============= INIT =============
async function init() {
  state.tokens = Store.get('tokens');
  state.athlete = Store.get('athlete');
  state.activities = Store.get('activities') || [];
  state.lastSync = Store.get('lastSync');
  state.goal = Store.get('goal');
  state.aiReport = Store.get('aiReport');
  state.rideFeedback = Store.get('rideFeedback') || {};
  state.rideDetails = Store.get('rideDetails') || {};
  state.routes = Store.get('routes');
  state.routesFetchedAt = Store.get('routesFetchedAt');
  state.startAddress = Store.get('startAddress');
  state.surfacePref = Store.get('surfacePref');
  const savedPrefs = Store.get('trainingPrefs');
  if (savedPrefs && typeof savedPrefs.sessions_per_week === 'number') {
    state.trainingPrefs = savedPrefs;
  }
  state.anthropicKey = Store.get('anthropicKey');
 
  if (!state.tokens) { state.view = 'connect'; render(); return; }
 
  if (state.athlete && state.activities.length) {
    state.view = 'dashboard';
    render();
    incrementalSync(true);
  } else {
    await fullSync();
  }
}
 
init();
</script>
</body></html>`;
}
