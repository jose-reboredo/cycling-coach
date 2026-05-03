# Sprint 7 — Business Requirements

**Source (planned):** `4-sprint-plan-2026-05.md` §A.ii (AI personal coach loop).
**Source (shipped):** Same scope plus route-generation backend pulled forward from Sprint 8.
**Wedge:** Persona A (Marco). With the personal scheduler in place, the AI coach loop is the next leverage point.

## Hypothesis

If a user can (1) read an AI-generated weekly brief, (2) hit "+ Schedule" on a single day, (3) confirm the prefill in a modal, and (4) attach a generated route to that session, then the full plan-to-execute loop closes in under 10 seconds. That's the differentiator vs Strava (no plan), Komoot (no plan), TrainerRoad (no route).

## In scope

| Theme | Effort | Persona |
|---|---:|---|
| Today reframed as today-only dossier; Train tab owns planning | ~6h | A |
| Per-day "+ Schedule" buttons on the AI weekly plan | ~4h | A |
| Consecutive-day streak counter on Today | ~2h | A |
| AI plan → calendar prefill modal | ~4h | A |
| Smarter duration estimation when AI plan omits explicit duration | ~2h | A |
| Layout: salutation + sync chip + streak above TopTabs | ~2h | All |
| Route generation backend (`POST /api/routes/generate`) | ~10h | A |
| Route picker drawer UX wires the v10.4.0 backend | ~6h | A |
| CSP hardening for dynamic Worker responses | ~3h | All |

**Total estimate:** ~39h. Actual shipped: ~45h (CSP took 3 attempts; route generator regression added ~2h).

## Out of scope

- **AI plan persistence** (a per-row `ai_plan_session_id` link with cascade-update). Defers to Sprint 8 (lands as v10.8.0, Migration 0011).
- **RWGPS OAuth + saved-routes tab.** Sprint 8 (lands as v10.6.0).
- **Goal-driven planning** (target events, race priority, periodization). Sprint 8.
- **Calendar #80 alignment + overlap rendering.** Sprint 10.

## Acceptance criteria

A performance amateur:
1. Opens the app and lands on Today; sees today's session + a streak chip + a sync chip. ✅ v10.0.0–v10.3.0.
2. Switches to Train; sees the AI weekly plan with "+ Schedule" on each day that's not yet scheduled. ✅ v10.1.0.
3. Clicks "+ Schedule" on a Tuesday endurance day → prefill modal opens with title/duration/zone pre-filled. ✅ v10.2.0.
4. Confirms → session lands on the calendar. ✅ v10.2.0.
5. Opens the session drawer → enters "Bahnhofstrasse Zürich" → gets 3 ranked route cards. ✅ v10.5.0.
6. Picks one → GPX downloads + Strava handoff link opens. ✅ v10.5.4.

A new browser instance:
7. CSP doesn't block inline scripts on /callback (Strava OAuth completes). ✅ v10.5.1 + v10.5.2 hotfixes.

## Process directives reaffirmed

- **One risk theme per release.** Mostly honored. v10.5.4 bundled two related route-picker fixes.
- **Pre-deploy smoke what changed, not static endpoints.** **New rule born this sprint** — see `03-cto-review.md`.
