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
const WORKER_VERSION = 'v8.3.0';
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

        const owner = env.GITHUB_OWNER || 'jose-reboredo';
        const repo = env.GITHUB_REPO || 'cycling-coach';
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

// Map a GitHub issue to the shape the React WhatsNext page expects.
//
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
