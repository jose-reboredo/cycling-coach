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
// One-shot roadmap bootstrap (kept for reference / future re-seeding).
// Endpoint removed in v8.3.0 — to invoke again, re-add the route handler in
// the fetch() block above. Idempotent — safe to re-run.
// Files the v8.x backlog (still-open items from the original v8.0.0 issue list)
// as real GitHub issues. Idempotent — skips titles that already exist.
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
