# Train tab — goal-driven AI training plan with dynamic session scheduling

**Status:** Draft for review · v10.8.0 candidate (**implementation gated on approval**)
**Author:** BA + Architect pass (Sonnet)
**Audience:** Founder + CTO

---

## 1. Personas and core flows

### Persona A — Solo rider with a goal

**Profile:** Marco-style. Has set a goal event (e.g., "Etape du Tour, 12 Jul 2026, 168 km, 4200m"). Strava-connected with at least 4 weeks of ride history.

**Story:** "Build me toward my goal event. Tell me when the goal is unrealistic. Adapt as I ride."

**Acceptance criteria:**

- AC-A.1 — Plan respects the time budget between today and goal date (e.g., 6 weeks → 6-week progressive build).
- AC-A.2 — Each week's TSS load increases progressively (build phase) then tapers in the last 7-10 days before the goal.
- AC-A.3 — Sessions are zone-specific (Z2 base / Z3 tempo / Z4 threshold / Z5 VO2) and proportionate to current CTL/ATL.
- AC-A.4 — When current fitness × time available is insufficient, AI returns a **block message** with an alternative: "Goal unrealistic given your current 78 CTL and 6-week window. Adjust to: 100 km / 1800 m gravel event in 8 weeks." Plan generation is paused; user must adjust the goal or override.
- AC-A.5 — On every new Strava activity sync, the plan re-evaluates and surfaces changes ("Threshold session moved to Tuesday after your strong Saturday ride").
- AC-A.6 — Sessions already scheduled in the calendar auto-update if their `ai_plan_session_id` link is intact and the user hasn't manually edited (`user_edited_at` null).

### Persona B — Solo rider, no goal

**Profile:** Léa-style commuter or steady weekend rider. Strava-connected, no goal event set.

**Story:** "Keep me improving on my weak areas based on what I've been riding."

**Acceptance criteria:**

- AC-B.1 — Plan is fitness-maintenance + improvement: targets the user's lowest-performing zone or most inconsistent training pattern.
- AC-B.2 — No taper logic; plan rolls forward weekly.
- AC-B.3 — `reasoning` field on each session names the improvement target ("Building Z3 tempo time — your last 30 days show only 8% in Z3").

### Persona C — New user, no rides, no goal

**Profile:** First connection. Strava connected but few/no rides synced yet.

**Story:** "Give me something safe and structured to start."

**Acceptance criteria:**

- AC-C.1 — Returns a foundational base-building plan: 3 sessions/week, all Z2 endurance, durations 45-90 min.
- AC-C.2 — Plan is generic across new users (no personalization until first 7 days of rides arrive).
- AC-C.3 — Plan auto-personalises after 4+ activities synced (transition to Persona B logic).

---

## 2. Core flow 1 — AI plan generation

### Triggers (when the plan regenerates)

| Trigger | Source | Behavior |
|---|---|---|
| First use | App detects no plan rows for athlete | Generates initial plan |
| Goal set/changed | `POST /api/me/goal` (existing) | Invalidates current plan, regenerates |
| New Strava activity | Strava webhook (existing) → fires `/webhook/strava` | Re-evaluates plan against new fitness data |
| Manual regenerate | User clicks "Regenerate Plan" | Forces fresh generation |

### Inputs to the AI

- Goal: event name, date, distance, elevation, target avg power (if known)
- Current fitness: latest CTL, ATL, TSB, FTP, weight
- Last 30 days of rides: distance, duration, TSS, dominant zone per ride
- User-stated sessions per week (existing `users.sessions_per_week`)
- User surface preference (new `users.preferred_surface`)
- Days remaining until goal

### Outputs (per session)

```ts
interface AiPlanSession {
  id: number;                       // db PK
  week_start_date: string;          // "2026-05-04" (Monday ISO)
  title: string;                    // "Threshold intervals — 4×8 @ 92% FTP"
  suggested_date: string;           // "2026-05-07" (ISO date)
  suggested_time: null;             // user fills when scheduling
  elevation_gained: number | null;  // meters (e.g., 800)
  target_zone: string;              // "Z2", "Z3", "Z4", "Recovery"
  duration: number;                 // minutes
  surface: string;                  // "Paved" | "Mixed" | "Gravel" | "Any"
  reasoning: string;                // "Building threshold endurance for Etape"
}
```

### When goal is unrealistic

AI returns:

```json
{
  "feasible": false,
  "block_reason": "Goal requires CTL of ~95; you're at 78 with 6 weeks. Healthy build limits 3-4 CTL/week.",
  "alternative_goal": {
    "distance": 100,
    "elevation": 1800,
    "weeks_required": 8,
    "rationale": "Reduce target by 40% and extend by 2 weeks for a safe build."
  },
  "sessions": []
}
```

The frontend renders a **goal-blocked card** with two CTAs:
- "Update my goal" (opens goal-event editor with the alternative pre-filled)
- "Generate plan anyway (override)" — sets `users.plan_override = true`, regenerates without the feasibility gate

---

## 3. Core flow 2 — Scheduling a session

User on **Train tab** sees the AI plan list (current week + next week). Each row has a `+ Schedule` button.

Click → opens the existing `SessionPrefillModal` (v10.2.0+) **with these fields prefilled from `ai_plan_sessions`:**

| Field | Source | Editable? |
|---|---|---|
| Title | `title` | yes |
| Date | `suggested_date` | yes |
| Time | empty | **required** |
| Target zone | `target_zone` | yes (dropdown) |
| Elevation gained (meters) | `elevation_gained` | yes (decision Q1) |
| Duration | `duration` | yes (existing) |
| Surface | `surface` | yes (dropdown) |
| Coach brief | `reasoning` | read-only |

Submit → POST `/api/plan/schedule` (new). Inserts a row into the existing `planned_sessions` table (NOT `club_events` — see decision Q3) with `ai_plan_session_id` FK link back.

User Mark-done flow / Cancel flow / Edit flow all re-use existing v9.12.5 drawer mutations. Nothing changes there.

---

## 4. Core flow 3 — Today tab + route matching

When today has a scheduled session linked to an `ai_plan_session_id`, the Today tab's `<TodayDossier>` (v10.0.0) already shows it. v10.8.0 adds:

1. **Surface override on click**: tapping the session opens the existing `EventDetailDrawer` (v9.12.5). The drawer's `<SessionRoutePicker>` (v10.5.0+) already has a surface preference. v10.8.0 wires it to use `ai_plan_sessions.surface` as the default and the `users.preferred_surface` as fallback.

2. **Match score includes elevation gain target** (currently match is distance-driven only): the picker's scoring weights gain a `elevation_match_to_target` term that compares route elevation to `ai_plan_sessions.elevation_gained`. Bell curve at the target ±20%.

3. **Match-reasons display on each route card** (new): the picker shows 1-2 plain-English reasons per route:

   ```
   "Casa de Campo Loop — 92% match
    ✓ 820m vs 800m target
    ✓ 45km matches 90min @ 30km/h"
   ```

No backend change required for this — the existing v10.6.0 `/api/routes/generate` and `/api/routes/saved` responses already carry distance + elevation; we add `elevation_target` to the request and surface the breakdown in the UI.

---

## 5. Decisions needed from CTO + founder

### Q1 — Is `elevation_gained` editable when scheduling, or read-only from AI plan?

**Recommendation:** Editable.

**Reasoning:** The user knows their local terrain. AI plan elevation is a target, not a prescription. If the user only has flat routes available, forcing them to ride 800m elevation is unrealistic. Letting them edit means they can match the plan's *intent* (Z3 tempo) using locally-available terrain.

### Q2 — Is `surface` AI-inferred or always user-selected at route-match time?

**Recommendation:** AI infers a default for plan creation; user overrides at route-match time.

**Reasoning:** AI uses `users.preferred_surface` as a baseline. If not set, defaults to "Any" so the picker doesn't filter. User's per-session surface choice in the route picker overrides for that session only — doesn't update preferences (they may want gravel today even if usually paved).

### Q3 — Where do scheduled sessions live: `club_events`, `planned_sessions`, or new `scheduled_sessions`?

**Recommendation: Reuse `planned_sessions`** (the existing table from Migration 0008 / v9.12.0). NOT `club_events`.

**Reasoning:**
- `planned_sessions` already exists for personal sessions, with `athlete_id`, `session_date`, `title`, `description`, `zone`, `duration_minutes`, `target_watts`, `source` (allowlist `'manual' | 'ai-coach' | 'imported'`), `completed_at`, `cancelled_at`. Source already includes `'ai-coach'`.
- `club_events` is for shared rides with RSVP semantics. AI plan sessions are per-athlete training, not club events. Conflating them mixes scopes.
- New `scheduled_sessions` would duplicate everything in `planned_sessions`.

What we **add** to `planned_sessions` (Migration 0011):
```sql
ALTER TABLE planned_sessions ADD COLUMN elevation_gained INTEGER;
ALTER TABLE planned_sessions ADD COLUMN surface TEXT;
ALTER TABLE planned_sessions ADD COLUMN ai_plan_session_id INTEGER REFERENCES ai_plan_sessions(id) ON DELETE SET NULL;
ALTER TABLE planned_sessions ADD COLUMN user_edited_at INTEGER;
```

`user_edited_at` is set when the user mutates a scheduled session's fields. Tells us "don't auto-update from plan regeneration" (decision Q5).

### Q4 — How does "scheduled session auto-updates when plan changes" work?

**Recommendation:** Webhook-triggered, not cron.

**Trigger flow:**

1. Strava webhook fires on new activity → existing `/webhook/strava` handler.
2. New activity persisted as today (existing).
3. **NEW step**: enqueue a job: `regenerate_plan(athlete_id)`. Cloudflare Queues is overkill for current scale; a synchronous call from the webhook handler is fine (re-generation is ~5s with Haiku).
4. `regenerate_plan` re-runs AI prompt with refreshed inputs.
5. New `ai_plan_sessions` rows are written; old rows for the same week are soft-deleted (`updated_at` bumped, content overwritten in-place to preserve FK links).
6. Find all `planned_sessions` linked via `ai_plan_session_id` where `user_edited_at IS NULL AND completed_at IS NULL AND cancelled_at IS NULL`.
7. Update their fields from the new plan.

**No cron** because Strava webhook is reliable and avoids double-work. Manual "Regenerate Plan" button on Train tab gives users a fallback when webhooks lag.

### Q5 — If user manually edits a scheduled session, does that lock it from auto-updates?

**Recommendation:** Yes. Lock via `user_edited_at`.

**Implementation:**
- Set `user_edited_at = now()` whenever user changes a scheduled session's fields (Edit drawer, prefill modal save with diff).
- Plan regeneration's UPDATE step skips rows where `user_edited_at IS NOT NULL`.
- User can opt back into auto-updates with an "Unlink from plan" → "Re-link" toggle in the drawer (defer to v10.8.x — not v10.8.0).

---

## 6. Open architectural notes

### Token economy

Plan generation runs once per trigger (typically ~3-5 times per week per active user). Using **Haiku** (cheaper) for plan generation is appropriate; Opus is only needed for goal-feasibility judgment which we can do client-side via heuristics (no Opus call).

Rough estimate per active user per week:
- 1 manual generate
- 2-4 webhook-triggered re-evaluations (one per ride)
- ~3000 input tokens × 5 calls = 15k tokens/user/week
- ~1500 output tokens × 5 = 7.5k tokens/user/week
- Haiku cost: ~$0.005/user/week → $0.02/user/month → ~$2/100 MAU/month

System-paid via `SYSTEM_ANTHROPIC_KEY` (existing pattern). Users don't need their own key for plan generation. Their existing BYOK still applies for the report-style coach narrative (existing flow).

### Avoiding AI hallucinations

Plan generation prompt:

1. Provides explicit JSON schema with strict types.
2. Validates with Zod on the Worker side; rejects malformed responses (re-tries once).
3. Sanity-checks: total weekly TSS within ±50% of expected; no zone outside 1-7; no duration > 600 min.
4. Caches per `(athlete_id, fitness_hash, goal_hash)` for 6h to avoid re-generating on rapid regenerate clicks.

### Goal-feasibility check (client-side, no AI)

Before calling AI for plan generation:

```ts
const ctlNeeded = estimateCtlForEvent(goal);          // event TSS / 7
const weeksAvailable = (goal.date - today) / 7;
const safeBuildPerWeek = 4;
const ctlGap = ctlNeeded - currentCtl;
const feasible = ctlGap / weeksAvailable <= safeBuildPerWeek;
if (!feasible) {
  return { feasible: false, alternative_goal: shrinkGoal(goal, weeksAvailable) };
}
```

Avoids burning AI tokens on infeasible plans.

---

## 7. Phased delivery

Per locked SemVer + sprint cadence:

| Phase | Release | Theme | Effort |
|---|---|---|---|
| A | **v10.8.0** | Schema + plan generation API + Train tab list UI (read-only) | ~6h |
| B | **v10.8.1** | Scheduling flow (Train → calendar via prefill modal) | ~4h |
| C | **v10.8.2** | Today tab + route matching with elevation target + match-reasons | ~5h |
| D | **v10.8.3** | Webhook auto-update + user_edited_at lock | ~3h |

Each phase is testable in isolation. Phases A and B can ship same-week; C and D are best as separate releases for visual verification.

---

## 8. What I'm asking you to approve

1. The 5 decisions in §5 (Q1-Q5)
2. The phased delivery in §7
3. Reusing `planned_sessions` (not creating `scheduled_sessions`)
4. Webhook-triggered auto-update (not cron)
5. Token estimate (~$0.02/user/month for plan AI) — system-paid

If any of those needs to change, I revise the plan before any code lands.

If approved as-is, **I'll start with Phase A only** (next release) so you can verify the Train tab list before scheduling logic ships.
