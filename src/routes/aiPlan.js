// AI training plan generator — Sprint 5++ / v10.8.0 Phase A.
//
// Three exported handlers:
//   handlePlanGenerate  — POST /api/plan/generate  (force / weeks)
//   handlePlanCurrent   — GET  /api/plan/current
//   handlePlanSchedule  — POST /api/plan/schedule  (Phase B)
//
// AI generation uses SYSTEM_ANTHROPIC_KEY (falls back to ANTHROPIC_API_KEY).
// Haiku model — plan generation is short structured JSON, doesn't need
// reasoning depth. ~3000 input + ~1500 output tokens per call.
//
// Storage:
//   ai_plan_sessions (Migration 0011) — pre-scheduled plan rows
//   planned_sessions (existing)        — scheduled rows with FK back

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const ZONE_LABELS = new Set(['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7', 'Recovery']);
const SURFACE_LABELS = new Set(['Paved', 'Mixed', 'Gravel', 'Any']);

// ---------------------------------------------------------------------------
// POST /api/plan/generate
// ---------------------------------------------------------------------------
export async function handlePlanGenerate({ request, env, deps }) {
  const { resolveAthleteId, checkRateLimit, safeWarn, corsHeaders } = deps;

  const systemKey = env.SYSTEM_ANTHROPIC_KEY || env.ANTHROPIC_API_KEY;
  if (!systemKey) {
    safeWarn('[plan-gen] SYSTEM_ANTHROPIC_KEY not set — endpoint disabled');
    return jsonResponse({ error: 'system_anthropic_key_missing' }, 503, corsHeaders);
  }

  const authResult = await resolveAthleteId(request);
  if (authResult.error) return jsonResponse(authResult.body, authResult.error, corsHeaders);
  const athleteId = authResult.athleteId;

  const rl = await checkRateLimit(env, 'plan-gen', String(athleteId), 5, 3600);
  if (rl) {
    return jsonResponse(
      { error: 'rate-limited', retry_after_seconds: rl.retryAfter },
      429, corsHeaders, { 'Retry-After': String(rl.retryAfter) },
    );
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const weeks = clamp(Number(body?.weeks) || 4, 1, 12);
  const force = body?.force === true;

  // Gather inputs.
  const inputs = await gatherInputs(env.cycling_coach_db, athleteId);

  // Client-side feasibility gate — avoids burning AI tokens on infeasible goals.
  if (inputs.goal && !force) {
    const feasibility = checkGoalFeasibility(inputs);
    if (!feasibility.feasible) {
      return jsonResponse({
        feasible: false,
        block_reason: feasibility.reason,
        alternative_goal: feasibility.alternative,
      }, 200, corsHeaders);
    }
  }

  // Prompt.
  const prompt = buildPrompt(inputs, weeks);

  let aiResp;
  try {
    aiResp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': systemKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 2400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (e) {
    safeWarn(`[plan-gen] Anthropic fetch error: ${e.message}`);
    return jsonResponse({ error: 'ai_unavailable' }, 503, corsHeaders);
  }
  if (!aiResp.ok) {
    const errText = await aiResp.text().catch(() => '');
    safeWarn(`[plan-gen] Anthropic returned ${aiResp.status}: ${errText.slice(0, 200)}`);
    return jsonResponse({ error: 'ai_unavailable' }, 503, corsHeaders);
  }

  let parsed;
  try {
    const data = await aiResp.json();
    const text = data.content?.find((c) => c.type === 'text')?.text || '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    safeWarn(`[plan-gen] Anthropic response parse error: ${e.message}`);
    return jsonResponse({ error: 'ai_unavailable' }, 503, corsHeaders);
  }

  if (parsed?.feasible === false) {
    return jsonResponse({
      feasible: false,
      block_reason: parsed.block_reason || 'Goal infeasible.',
      alternative_goal: parsed.alternative_goal || null,
    }, 200, corsHeaders);
  }

  const validSessions = (Array.isArray(parsed?.sessions) ? parsed.sessions : [])
    .filter(validateSession);
  if (validSessions.length === 0) {
    safeWarn('[plan-gen] no valid sessions returned');
    return jsonResponse({ error: 'ai_invalid_response' }, 503, corsHeaders);
  }

  // Persist — UPSERT semantics keyed by (athlete_id, suggested_date, title).
  const now = Math.floor(Date.now() / 1000);
  const inserted = [];
  for (const s of validSessions) {
    try {
      const result = await env.cycling_coach_db.prepare(`
        INSERT INTO ai_plan_sessions (athlete_id, week_start_date, suggested_date, title, target_zone, duration, elevation_gained, surface, reasoning, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(athlete_id, suggested_date, title) DO UPDATE SET
          week_start_date = excluded.week_start_date,
          target_zone = excluded.target_zone,
          duration = excluded.duration,
          elevation_gained = excluded.elevation_gained,
          surface = excluded.surface,
          reasoning = excluded.reasoning,
          updated_at = excluded.updated_at
        RETURNING id
      `).bind(
        athleteId,
        s.week_start_date,
        s.suggested_date,
        s.title,
        s.target_zone,
        s.duration,
        s.elevation_gained,
        s.surface,
        s.reasoning,
        now, now,
      ).first();
      inserted.push({ ...s, id: result?.id });
    } catch (e) {
      safeWarn(`[plan-gen] insert error for ${s.suggested_date} ${s.title}: ${e.message}`);
    }
  }

  // v10.8.3 (Phase D) will add cascade-update of planned_sessions here.
  // For Phase A, regeneration just refreshes the AI plan rows; the user
  // re-schedules manually if they want changes propagated.

  return jsonResponse({
    feasible: true,
    plan: {
      athlete_id: athleteId,
      generated_at: now,
      weeks_count: weeks,
      sessions: inserted,
    },
  }, 200, corsHeaders);
}

// ---------------------------------------------------------------------------
// GET /api/plan/current
// ---------------------------------------------------------------------------
export async function handlePlanCurrent({ request, env, deps }) {
  const { resolveAthleteId, corsHeaders } = deps;
  const authResult = await resolveAthleteId(request);
  if (authResult.error) return jsonResponse(authResult.body, authResult.error, corsHeaders);
  const athleteId = authResult.athleteId;

  // Today's Monday + N forward weeks.
  const todayIso = isoDateToday();
  const monday = mondayOf(todayIso);
  const horizon = addDays(monday, 7 * 4); // current + 4 weeks ahead

  const rows = await env.cycling_coach_db.prepare(`
    SELECT id, week_start_date, suggested_date, title, target_zone, duration, elevation_gained, surface, reasoning
    FROM ai_plan_sessions
    WHERE athlete_id = ?
      AND week_start_date >= ?
      AND week_start_date <= ?
    ORDER BY suggested_date ASC, id ASC
  `).bind(athleteId, monday, horizon).all();

  const sessions = (rows?.results || []).map((r) => ({
    id: r.id,
    week_start_date: r.week_start_date,
    suggested_date: r.suggested_date,
    title: r.title,
    target_zone: r.target_zone,
    duration: r.duration,
    elevation_gained: r.elevation_gained,
    surface: r.surface,
    reasoning: r.reasoning,
  }));

  if (sessions.length === 0) {
    return jsonResponse({ error: 'no_plan' }, 404, corsHeaders);
  }

  return jsonResponse({
    feasible: true,
    plan: {
      athlete_id: athleteId,
      week_start_date: monday,
      weeks_count: 4,
      sessions,
    },
  }, 200, corsHeaders);
}

// ---------------------------------------------------------------------------
// POST /api/plan/schedule  (Phase B)
// ---------------------------------------------------------------------------
export async function handlePlanSchedule({ request, env, deps }) {
  const { resolveAthleteId, checkRateLimit, safeWarn, corsHeaders } = deps;
  const authResult = await resolveAthleteId(request);
  if (authResult.error) return jsonResponse(authResult.body, authResult.error, corsHeaders);
  const athleteId = authResult.athleteId;

  const rl = await checkRateLimit(env, 'plan-schedule', String(athleteId), 30, 60);
  if (rl) {
    return jsonResponse(
      { error: 'rate-limited', retry_after_seconds: rl.retryAfter },
      429, corsHeaders, { 'Retry-After': String(rl.retryAfter) },
    );
  }

  let body;
  try { body = await request.json(); } catch {
    return jsonResponse({ error: 'invalid_body' }, 400, corsHeaders);
  }

  const aiId = Number(body?.ai_plan_session_id);
  if (!Number.isFinite(aiId) || aiId <= 0) {
    return jsonResponse({ error: 'ai_plan_session_id required' }, 400, corsHeaders);
  }

  // Verify ownership.
  const planRow = await env.cycling_coach_db.prepare(
    'SELECT id, suggested_date, title, target_zone, duration, elevation_gained, surface, reasoning FROM ai_plan_sessions WHERE id = ? AND athlete_id = ? LIMIT 1',
  ).bind(aiId, athleteId).first();
  if (!planRow) {
    return jsonResponse({ error: 'not_found' }, 404, corsHeaders);
  }

  // Reject duplicate scheduling.
  const existing = await env.cycling_coach_db.prepare(
    'SELECT id FROM planned_sessions WHERE ai_plan_session_id = ? AND cancelled_at IS NULL LIMIT 1',
  ).bind(aiId).first();
  if (existing) {
    return jsonResponse({ error: 'already_scheduled', planned_session_id: existing.id }, 409, corsHeaders);
  }

  // Combine date + time → unix epoch sec.
  const sessionDateInput = body?.session_date;
  let sessionDateSec = null;
  if (typeof sessionDateInput === 'number') {
    sessionDateSec = Math.floor(sessionDateInput);
  } else if (typeof sessionDateInput === 'string') {
    const ms = new Date(sessionDateInput).getTime();
    if (Number.isFinite(ms)) sessionDateSec = Math.floor(ms / 1000);
  }
  if (!sessionDateSec || sessionDateSec <= 0) {
    return jsonResponse({ error: 'session_date required (ISO or unix sec)' }, 400, corsHeaders);
  }

  const overrides = body?.overrides || {};
  const finalTitle = sanitizeTitle(overrides.title ?? planRow.title);
  const finalDuration = clamp(Number(overrides.duration_minutes ?? planRow.duration ?? 60), 0, 600);
  const finalElevation = overrides.elevation_gained != null
    ? clampInt(overrides.elevation_gained, 0, 20000)
    : planRow.elevation_gained ?? null;
  const finalSurface = SURFACE_LABELS.has(overrides.surface) ? overrides.surface : planRow.surface ?? null;
  const finalZone = zoneLabelToInt(overrides.target_zone ?? planRow.target_zone);

  const now = Math.floor(Date.now() / 1000);
  try {
    const inserted = await env.cycling_coach_db.prepare(`
      INSERT INTO planned_sessions (athlete_id, session_date, title, description, zone, duration_minutes, source, ai_plan_session_id, elevation_gained, surface, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'ai-coach', ?, ?, ?, ?, ?)
      RETURNING id
    `).bind(
      athleteId,
      sessionDateSec,
      finalTitle,
      planRow.reasoning || null,
      finalZone,
      finalDuration,
      aiId,
      finalElevation,
      finalSurface,
      now, now,
    ).first();
    return jsonResponse({
      planned_session_id: inserted.id,
      session_date: sessionDateSec,
      ai_plan_session_id: aiId,
    }, 201, corsHeaders);
  } catch (e) {
    safeWarn(`[plan-schedule] insert error: ${e.message}`);
    return jsonResponse({ error: 'insert_failed' }, 500, corsHeaders);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function gatherInputs(db, athleteId) {
  // User row — preferred surface, FTP, weight, sessions per week.
  const user = await db.prepare(
    'SELECT firstname, ftp, weight, hr_max, preferred_surface, weight FROM users WHERE athlete_id = ? LIMIT 1',
  ).bind(athleteId).first().catch(() => null);

  // Goal event — using existing `events` table from Migration 0001.
  const goal = await db.prepare(
    "SELECT name, type, event_date, distance_km, elevation_m FROM events WHERE athlete_id = ? AND priority = 1 ORDER BY event_date ASC LIMIT 1",
  ).bind(athleteId).first().catch(() => null);

  // Last 30 days of activities — for fitness inputs.
  const cutoff = Math.floor(Date.now() / 1000) - 30 * 86400;
  const activities = await db.prepare(`
    SELECT activity_date, distance_m, moving_time_s, total_elevation_gain_m, average_watts, kilojoules
    FROM activities
    WHERE athlete_id = ? AND activity_date >= ?
    ORDER BY activity_date DESC
    LIMIT 30
  `).bind(athleteId, cutoff).all().catch(() => ({ results: [] }));

  const acts = activities?.results || [];
  const totalDistanceKm = acts.reduce((s, a) => s + (Number(a.distance_m) || 0) / 1000, 0);
  const totalDurationH = acts.reduce((s, a) => s + (Number(a.moving_time_s) || 0) / 3600, 0);
  const totalElevationM = acts.reduce((s, a) => s + (Number(a.total_elevation_gain_m) || 0), 0);

  // Estimate CTL/ATL from kj. Rough: TSS ≈ kj × 0.85 / FTP × 100 / 60. Without
  // recompute infrastructure on the Worker side, we just send raw counts and
  // let the AI infer. Phase A is shipping fast; Phase D adds proper PMC.
  return {
    athlete: {
      firstname: user?.firstname || 'Athlete',
      ftp: user?.ftp || null,
      weight: user?.weight || null,
      preferred_surface: user?.preferred_surface || 'Any',
    },
    goal: goal ? {
      name: goal.name,
      type: goal.type,
      date_iso: new Date((Number(goal.event_date) || 0) * 1000).toISOString().slice(0, 10),
      distance_km: goal.distance_km,
      elevation_m: goal.elevation_m,
    } : null,
    recent: {
      count: acts.length,
      total_distance_km: Math.round(totalDistanceKm),
      total_duration_h: Math.round(totalDurationH * 10) / 10,
      total_elevation_m: Math.round(totalElevationM),
      avg_distance_km: acts.length ? Math.round(totalDistanceKm / acts.length) : 0,
    },
  };
}

function checkGoalFeasibility(inputs) {
  // Simple heuristic: current weekly volume × growth must reach roughly the
  // event's volume. Generous default — AI gets the final say with richer data.
  if (!inputs.goal || !inputs.goal.date_iso) return { feasible: true };
  const today = new Date();
  const goalDate = new Date(inputs.goal.date_iso);
  const weeksAvailable = Math.max(0, Math.floor((goalDate - today) / (7 * 86400000)));
  if (weeksAvailable < 2) {
    return {
      feasible: false,
      reason: `Goal is ${weeksAvailable} weeks away — too tight for a structured build.`,
      alternative: {
        name_suggestion: 'Lighter event or move date back',
        distance_km: Math.round((inputs.goal.distance_km || 100) * 0.7),
        elevation_m: Math.round((inputs.goal.elevation_m || 1500) * 0.7),
        weeks_required: 6,
      },
    };
  }
  // No upper-bound check yet; defer to AI's own feasibility check on rich data.
  return { feasible: true };
}

function buildPrompt(inputs, weeks) {
  return `You are a cycling training coach. Generate a structured weekly training plan for a rider.

ATHLETE
- Name: ${inputs.athlete.firstname}
- FTP: ${inputs.athlete.ftp ?? 'unknown'} W
- Weight: ${inputs.athlete.weight ?? 'unknown'} kg
- Preferred surface: ${inputs.athlete.preferred_surface}

RECENT 30 DAYS
- Rides: ${inputs.recent.count}
- Total distance: ${inputs.recent.total_distance_km} km
- Total duration: ${inputs.recent.total_duration_h} h
- Total elevation: ${inputs.recent.total_elevation_m} m
- Avg ride distance: ${inputs.recent.avg_distance_km} km

${inputs.goal ? `GOAL EVENT
- Name: ${inputs.goal.name}
- Date: ${inputs.goal.date_iso}
- Distance: ${inputs.goal.distance_km} km
- Elevation: ${inputs.goal.elevation_m} m

If the goal is unrealistic given current fitness × time available, return:
  { "feasible": false, "block_reason": "...", "alternative_goal": { "distance_km": int, "elevation_m": int, "weeks_required": int }, "sessions": [] }

Otherwise build progressively toward the goal with appropriate taper in the final 7-10 days.` : ''}

INSTRUCTIONS
- Generate ${weeks} week(s) of sessions starting Monday of this week.
- Honor zone-specificity (Z1 recovery → Z7 sprint), progressive overload, and recovery days.
- Never exceed safe weekly TSS growth.
- For each session: pick a date this/next week, target zone (Z1-Z7 or Recovery), duration 30-300 min, elevation_gained meters (0-3000), surface (Paved/Mixed/Gravel/Any), 1-line reasoning.

OUTPUT — strict JSON only, no markdown:
{
  "feasible": true,
  "sessions": [
    {
      "week_start_date": "YYYY-MM-DD",
      "suggested_date": "YYYY-MM-DD",
      "title": "...",
      "target_zone": "Z2",
      "duration": 90,
      "elevation_gained": 400,
      "surface": "Paved",
      "reasoning": "..."
    }
  ]
}`;
}

function validateSession(s) {
  if (!s || typeof s !== 'object') return false;
  if (typeof s.week_start_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.week_start_date)) return false;
  if (typeof s.suggested_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.suggested_date)) return false;
  if (typeof s.title !== 'string' || s.title.trim().length === 0) return false;
  if (typeof s.target_zone !== 'string' || !ZONE_LABELS.has(s.target_zone)) return false;
  if (typeof s.duration !== 'number' || s.duration < 15 || s.duration > 600) return false;
  if (s.elevation_gained != null && (typeof s.elevation_gained !== 'number' || s.elevation_gained < 0 || s.elevation_gained > 20000)) return false;
  if (typeof s.surface !== 'string' || !SURFACE_LABELS.has(s.surface)) return false;
  if (typeof s.reasoning !== 'string') return false;
  return true;
}

function zoneLabelToInt(label) {
  if (!label || typeof label !== 'string') return null;
  const m = label.match(/^Z([1-7])$/);
  if (m) return Number(m[1]);
  return null;
}

function sanitizeTitle(s) {
  const trimmed = String(s || '').trim();
  if (!trimmed) return 'AI session';
  return trimmed.length > 200 ? `${trimmed.slice(0, 197)}…` : trimmed;
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}
function clampInt(n, min, max) {
  return Math.round(clamp(n, min, max));
}

function isoDateToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mondayOf(iso) {
  const d = new Date(`${iso}T12:00:00`);
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function jsonResponse(obj, status, corsHeaders, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  });
}
