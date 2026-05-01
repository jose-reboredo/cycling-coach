# Train tab — API spec for goal-driven plan generation

**Companion to** `train-tab-goal-driven-planning.md`. Read that first.
**Status:** Draft for review. Implementation gated on approval.

---

## Endpoint summary

| Method | Path | Phase | Purpose |
|---|---|---|---|
| `POST` | `/api/plan/generate` | A | Generate or regenerate the AI plan for the authenticated athlete |
| `GET`  | `/api/plan/current` | A | Read the latest plan |
| `POST` | `/api/plan/schedule` | B | Move an `ai_plan_sessions` row into a scheduled `planned_sessions` row |
| `POST` | `/api/plan/regenerate-from-strava` | D | Internal endpoint fired by `/webhook/strava` |
| `POST` | `/api/me/goal` | (existing — extend) | Goal CRUD (already exists; add feasibility hint to response) |

All endpoints require `resolveAthleteId(request)` (Bearer token). Rate-limited under existing scopes (`me-write`).

---

## `POST /api/plan/generate`

**Triggers AI plan generation for the authenticated athlete.**

### Request

```json
{
  "weeks": 4,
  "force": false
}
```

| Field | Type | Default | Notes |
|---|---|---|---|
| `weeks` | int 1..12 | 4 | How many weeks to generate forward |
| `force` | bool | false | If true, bypass the 6h cache hit |

### Response — 200, plan generated

```json
{
  "feasible": true,
  "plan": {
    "athlete_id": 12345,
    "generated_at": 1714500000,
    "week_start_date": "2026-05-04",
    "weeks_count": 4,
    "sessions": [
      {
        "id": 6701,
        "week_start_date": "2026-05-04",
        "title": "Base Endurance — Z2 steady",
        "suggested_date": "2026-05-05",
        "elevation_gained": 400,
        "target_zone": "Z2",
        "duration": 90,
        "surface": "Paved",
        "reasoning": "Building aerobic base — your last 30 days show 78% Z1/Z2."
      },
      {
        "id": 6702,
        "week_start_date": "2026-05-04",
        "title": "Threshold intervals — 4×8 @ 92% FTP",
        "suggested_date": "2026-05-07",
        "elevation_gained": 600,
        "target_zone": "Z4",
        "duration": 75,
        "surface": "Paved",
        "reasoning": "Closing the Z3-Z4 gap before the Etape build phase."
      }
    ]
  }
}
```

### Response — 200, goal infeasible (plan blocked)

```json
{
  "feasible": false,
  "block_reason": "Goal needs CTL ~95; you're at 78 with 6 weeks. Healthy build limits 3-4 CTL/week.",
  "alternative_goal": {
    "name_suggestion": "100 km / 1800 m gravel ride",
    "distance_km": 100,
    "elevation_m": 1800,
    "weeks_required": 8
  },
  "override_url": "/api/me/goal?override=true"
}
```

### Response — 401/429/503

| Status | Code | Meaning |
|---|---|---|
| 401 | `unauthorized` | Missing / invalid Bearer |
| 429 | `rate-limited` | More than 5 generations / hour / athlete |
| 503 | `system_anthropic_key_missing` | `SYSTEM_ANTHROPIC_KEY` not configured |

---

## `GET /api/plan/current`

**Read the latest plan for the authenticated athlete. No re-generation.**

### Response — 200

Same shape as `POST /api/plan/generate` success.

### Response — 404 `no_plan`

When the athlete has never generated a plan. UI shows the "Generate your first plan" CTA.

---

## `POST /api/plan/schedule`

**Move an `ai_plan_sessions` row into a scheduled `planned_sessions` row.**

### Request

```json
{
  "ai_plan_session_id": 6701,
  "session_date": "2026-05-05T07:00:00Z",
  "overrides": {
    "title": "Sweet-spot intervals 3x12",
    "duration_minutes": 95,
    "elevation_gained": 350,
    "surface": "Mixed"
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `ai_plan_session_id` | int | yes | Must belong to caller |
| `session_date` | ISO datetime or unix-sec | yes | Combines suggested_date + user-picked time |
| `overrides.*` | optional | — | Any user edits applied at schedule time |

### Response — 201

```json
{
  "planned_session_id": 8842,
  "session_date": 1714888800,
  "ai_plan_session_id": 6701
}
```

Server inserts into `planned_sessions` with `source = 'ai-coach'`, `ai_plan_session_id` FK set. `user_edited_at` is **not** set on initial schedule (overrides at schedule time count as "this is the agreed first version", not a manual edit).

### Response — 404 `not_found` / 409 `already_scheduled`

`already_scheduled` returned when a `planned_sessions` row already exists with the same `ai_plan_session_id` and not cancelled.

---

## `POST /api/plan/regenerate-from-strava` (internal)

**Webhook-fired plan regeneration. Not user-facing.**

Triggered by the existing `/webhook/strava` handler when a new activity arrives. Takes no body; reads `athlete_id` from query string after webhook auth.

Behavior:
1. Read latest activity (just synced).
2. Re-compute fitness inputs (CTL/ATL/TSB).
3. Call AI to regenerate plan for current week + N forward.
4. `UPDATE` existing `ai_plan_sessions` rows in-place (preserves FKs).
5. `INSERT` new rows for any new dates.
6. Cascade-update `planned_sessions WHERE ai_plan_session_id IN (...) AND user_edited_at IS NULL AND completed_at IS NULL AND cancelled_at IS NULL`.

Returns `200 { regenerated: true, session_count: 12 }` or `200 { regenerated: false, reason: 'cache_hit' }`.

Rate-limited at the webhook level (Strava already does this).

---

## `POST /api/me/goal` (existing — extend)

Goal CRUD endpoint already exists. v10.8.0 extends the success response with a feasibility hint when `goal.date` is set:

```json
{
  "goal": {
    "name": "Etape du Tour 2026",
    "distance_km": 168,
    "elevation_m": 4200,
    "date": "2026-07-12"
  },
  "feasibility": {
    "feasible": false,
    "current_ctl": 78,
    "ctl_needed_estimate": 95,
    "weeks_available": 6,
    "alternative_suggestion": { "distance_km": 100, "elevation_m": 1800, "weeks_required": 8 }
  }
}
```

When `feasible: false` is returned, the UI shows the alternative suggestion before allowing plan generation.

---

## AI prompt (Phase A reference, not final)

```
SYSTEM:
You are a cycling training coach. Generate a structured weekly training
plan as JSON matching the schema. Honor zone-specificity, progressive
overload, and recovery. Never exceed safe weekly TSS growth (4 CTL/week).

INPUTS:
- athlete_name, current_fitness { ctl, atl, tsb, ftp }
- recent_30_days { count, total_tss, dominant_zones }
- goal? { name, distance_km, elevation_m, date }
- sessions_per_week (user preference)
- preferred_surface
- weeks_to_generate

OUTPUT (strict JSON, no prose):
{
  "feasible": boolean,
  "block_reason": string?,
  "alternative_goal": { distance_km, elevation_m, weeks_required }?,
  "sessions": [
    {
      "week_start_date": "YYYY-MM-DD",
      "suggested_date": "YYYY-MM-DD",
      "title": string (≤ 80 chars),
      "elevation_gained": int meters or null,
      "target_zone": "Z1"|"Z2"|"Z3"|"Z4"|"Z5"|"Z6"|"Z7"|"Recovery",
      "duration": int minutes (15..600),
      "surface": "Paved"|"Mixed"|"Gravel"|"Any",
      "reasoning": string (≤ 200 chars)
    }
  ]
}
```

Validated server-side with Zod after Anthropic returns. Re-tries once on schema violation.

---

## Token economy (recap from §6 of the design doc)

| Item | Estimate |
|---|---|
| Inputs per call | ~3000 tokens |
| Outputs per call | ~1500 tokens |
| Calls per active user / week | 3-5 (1 manual + 2-4 webhook-triggered) |
| **Per-user monthly cost (Haiku)** | **~$0.02** |
| 100 MAU/month | **~$2** |
| 1000 MAU/month | **~$20** |

System-paid via `SYSTEM_ANTHROPIC_KEY` (existing pattern from `/coach` endpoint). User's BYOK key still applies for the existing Coach narrative — these are different surfaces.

---

## Approval checklist

- [ ] Endpoint shapes (5 paths above) match expected client needs
- [ ] Error codes (`unauthorized`, `rate-limited`, `system_anthropic_key_missing`, `not_found`, `already_scheduled`, `goal_infeasible`) are appropriate
- [ ] Token economy (~$2/100 MAU/month) is acceptable
- [ ] Webhook-triggered regeneration in Phase D is the right approach
- [ ] AI prompt scope (Sonnet for orchestration, Haiku for plan gen) is right
