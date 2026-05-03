# Sprint 8 — RWGPS OAuth + AI Plan v2 (Goal-Driven)

**Dates:** 2026-05-01
**Version range:** v10.6.0 → v10.8.0 (3 minor releases — biggest cohesive sprint by feature density per cut)
**Persona focus:** **A — Marco** primary
**Headline outcome:** Three-tab honest route picker (Generate / My Strava / My RWGPS). RWGPS OAuth integration. Goal-driven AI training plan with dynamic session scheduling — Phases A + B + C bundled.

## Themes

| Theme | Issues | Net delivery |
|---|---|---|
| Three-tab honest route picker | — | v10.6.0: Generate new (ORS), My Strava (saved), My Ride with GPS (saved). RWGPS OAuth flow added (`/authorize-rwgps`, `/callback-rwgps`); Migration 0010 adds `rwgps_tokens` table |
| Multi-app GPX handoff | — | v10.6.0: Generated routes export as GPX with Strava / RWGPS / Komoot / Garmin Connect. Saved routes open directly in their source app |
| Route picker bug fixes + RWGPS disconnect UI + token refresh | — | v10.7.0 |
| Goal-driven AI training plan design doc | — | v10.7.0 (doc only) |
| Goal-driven AI training plan — Phases A + B + C bundle | — | v10.8.0: `ai_plan_sessions` table (Migration 0011); user goals influence weekly plan; per-row `ai_plan_session_id` link from `planned_sessions`; auto-update lock via `user_edited_at` |

## Releases shipped

| Version | Date | Headline |
|---|---|---|
| v10.6.0 | 2026-05-01 | Three-tab honest route picker + Ride with GPS OAuth integration |
| v10.7.0 | 2026-05-01 | Route picker bug fixes + RWGPS disconnect UI + token refresh + goal-driven AI plan design doc |
| v10.8.0 | 2026-05-01 | Goal-driven AI training plan with dynamic session scheduling — Phases A + B + C bundled |

## What landed vs planned

- **Planned (4-sprint plan §A.iii):** Sprint 8 = mobile-first PWA polish (offline PMC, iOS standalone, Lighthouse 95+).
- **Shipped:** Pivoted entirely. RWGPS OAuth + goal-driven AI plan v2 took the slot. Mobile PWA polish slipped indefinitely (still backlog as of Sprint 11).
- **Drift:** large but defensible. The route picker reframe ("three honest tabs" instead of one mixed pile) was a captain's-eye-view UX call from the founder, and goal-driven planning is the highest-leverage Persona A feature shipped this far.

## Memory rules validated this sprint

- `feedback_pre-coding-scope-alignment.md` — validated again: the v10.7.0 design doc for goal-driven AI plan went through founder review BEFORE coding the v10.8.0 implementation. Saved several hotfix rounds; v10.8.0 shipped with no immediate hotfixes.
- `feedback_economy-model.md` — validated by v10.8.0's three-phase Anthropic prompt design (system-paid Haiku for the plan generation, BYOK Sonnet/Opus only on user-paid surfaces).
- `feedback_release-ceremony.md` — Phases A + B + C bundling in v10.8.0 violated "one risk theme per release" but founder approved the bundle as a coherent deliverable. Validated the right-size-ceremony-to-release-scope rule.
