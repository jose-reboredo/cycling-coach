# Sprint 8 — Business Requirements

**Source (planned):** `4-sprint-plan-2026-05.md` §A.iii (mobile-first PWA polish).
**Source (shipped):** RWGPS OAuth + goal-driven AI plan v2.
**Wedge:** Persona A (Marco). Captain (B) inherits via the route picker. PWA polish bet (C) rolled.

## Hypothesis

(1) Route generation alone isn't enough — most cyclists already have saved routes in Strava and/or RWGPS. The picker should respect that and present three honest tabs instead of mixing sources.

(2) The AI weekly plan in v10.x produced sessions that were generic ("Tuesday endurance, 1.5h"). If the plan responds to the user's actual goals (target events, peak-week timing, race priority), engagement deepens and the plan becomes a periodization tool, not a placeholder.

## In scope

| Theme | Effort | Persona |
|---|---:|---|
| RWGPS OAuth flow + `rwgps_tokens` table (Migration 0010) | ~6h | A |
| Three-tab route picker (Generate / Strava saved / RWGPS saved) | ~5h | A + B |
| Multi-app GPX handoff (Strava + RWGPS + Komoot + Garmin) | ~3h | A |
| Saved routes open directly in source app | ~1h | A |
| Route picker bug fixes (post-v10.6.0 visual review) | ~3h | A |
| RWGPS disconnect UI (route picker only at this stage) | ~1h | A |
| Token refresh wiring | ~2h | A |
| Goal-driven AI plan — design doc + Phase A schema | ~4h | A |
| Phase B — plan generator reads goals | ~6h | A |
| Phase C — `planned_sessions.ai_plan_session_id` link + auto-regen + `user_edited_at` lock | ~4h | A |

**Total estimate:** ~35h. Actual shipped: ~37h.

## Out of scope (deferred from the original plan)

- **Mobile-first PWA polish** (offline PMC, Lighthouse 95+, iOS standalone). Backlog.
- **AI plan repeat-group integration** (cross-week recurring archetypes share an id). Surfaces in Sprint 10 as `recurring_group_id`; the AI-side integration is still backlog as of Sprint 11.
- **RWGPS disconnect from Settings (Profile/You tab).** Lands as Item 1 in v10.12.0 (Sprint 10).
- **Web push notifications for plan updates.** Backlog.

## Acceptance criteria

A performance amateur:
1. Connects RWGPS via the route picker → flow completes; "Connected" state visible. ✅ v10.6.0.
2. Sees three tabs in the route picker. Each only shows routes from its source. ✅ v10.6.0.
3. Picks a generated route → GPX downloads + 4-app handoff buttons (Strava / RWGPS / Komoot / Garmin) appear. ✅ v10.6.0.
4. Picks a Strava-saved route → opens directly in Strava (no GPX needed). ✅ v10.6.0.
5. Updates their goal to "Etape du Tour, July 12, A priority" → AI plan adapts (peak week timing, climb volume). ✅ v10.8.0.
6. Manually edits a Tuesday session's duration → `user_edited_at` is stamped → next AI auto-regen does not overwrite. ✅ v10.8.0.

A founder running the v10.7.0 design doc review:
7. Reads the plan doc end-to-end before any coding starts. ✅.

## Process directives reaffirmed

- **Design doc before bundle.** v10.7.0's goal-driven AI plan design doc preceded v10.8.0's bundled Phases A + B + C ship. Worked — v10.8.0 had no immediate hotfixes.
- **Right-size ceremony.** Three-phase bundle in one release was a founder call, not a process default.
