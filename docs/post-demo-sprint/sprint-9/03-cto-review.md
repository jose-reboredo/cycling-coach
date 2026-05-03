# Sprint 9 — CTO Review

**Reviewed:** 2026-05-02 sprint close (post-v10.10.3)
**Releases:** 5 (1 major shape change, 1 polish bundle, 3 hotfixes)
**Reviewer:** CTO + Architect (Opus, in-session synthesis)

## What worked

1. **Strava OAuth migration to D1.** v10.9.0 cleanly mirrored the v10.6.0 RWGPS server-side pattern. Browser localStorage now only carries short-lived access tokens; refresh is server-side. Sprint 11 audit later confirmed no committed-secret leakage.
2. **Phase D auto-regen + `user_edited_at` lock.** Hits a real user need ("plan stays fresh as I ride") without violating the founder rule "user edits are sacred". Validated the v10.8.0 lock pattern at scale.
3. **Match reasons on route cards.** Small UX touch (v10.10.0); high return on user trust ("the picker is explaining itself"). Stuck through Sprint 11.

## What regressed (the cluster)

1. **3 hotfixes on the v10.10.0 surface.**
   - v10.10.1: repeat-weekly off-by-one + route picker proximity gate too strict.
   - v10.10.2: repeat-weekly v3 (third attempt) + a11y + diacritic-tolerant geocoding.
   - v10.10.3: `useCancelClubEvent` invalidation + month-range padding for week-spanning views.

2. **The pattern: each hotfix addressed an adjacent symptom without asking what the underlying contract was.** Cache invalidation, range-padding, off-by-one — all symptoms of "the schedule surface has multiple state contracts that don't agree." We treated them as N independent bugs. They weren't.

3. **None of the 3 hotfixes were caught by the smoke test ladder.** The ladder hit static endpoints (per `feedback_pre-deploy-verification.md`'s rule that we'd allegedly internalized in Sprint 7). All 3 surfaced in founder use. The ladder needed to actually exercise the diff's risk surface — and didn't.

## What we learned

- **Hotfix density is the structural-debt signal we kept missing.** When a release surface needs 2+ hotfixes, the next move is **stop and review**, not a third targeted patch. Sprint 10 opened with this lesson explicitly: "review the whole calendar logic". That review found the v10.11.x cache-control root cause that 6 prior hotfixes had never touched.
- **Smoke what changed, NOT static endpoints.** The pre-deploy ladder needed to be re-engineered. v10.11.3 introduced static-scan contract tests that exercise the regression-prone shape; v10.13.0 added 158 more (Sprint 11 prep).
- **Repeat-weekly v1 had a design gap.** Creating sibling rows without a shared id meant "edit all upcoming" wasn't possible. Founder requested it; v10.12.0 (Sprint 10) introduced `recurring_group_id` as a clean solution. v10.10.0's design should have anticipated the cascade need.

## Tech debt accrued

- Cascade paths through `planned_sessions` now: `ai_report_id`, `ai_plan_session_id`, soon `recurring_group_id`. Three vectors; no single source of truth for "what cascades when". Sprint 10 + 11 inherit this complexity.
- Cache invalidation lives in two places (`useCancelClubEvent` + personal-session cancel hooks). v10.10.3 fix duplicated the pattern instead of centralising.
- Repeat-weekly v1 (v10.10.0) → v3 (v10.10.2) was a churn cycle. Lesson: when a feature ships in 3 hotfixes, the original spec was probably wrong.
- Smoke ladder was insufficient. Sprint 10 + 11 invest heavily here.

## Process notes

- **Founder bundling decision.** v10.10.0 was framed as "v10.10.0 + v10.11.0 worth" of polish, bundled at founder request. The bundle was the right scope (one risk theme: schedule polish), but the subsequent 3 hotfixes meant the bundle was rushed. Bundling is fine when the underlying feature is mature; v10.10.0's repeat-weekly wasn't.
- **`/whats-next` was useful here.** The founder used the in-app surface to track which polish items were left in-flight. Validated that the planning-from-issues pattern is worth keeping.

## Memory rules — created or validated this sprint

| File | Status |
|---|---|
| `feedback_pre-deploy-verification.md` | **Failed in practice** — 3 hotfixes none caught by smoke ladder. Triggered Sprint 10 root-cause review. |
| `feedback_pattern-replacement.md` | **Should have been invoked** but wasn't. Sprint 10 retrofitted the lesson. |
| (new) | **"Stop after 2 hotfixes that don't stick — switch to diagnostic mode"** — informally adopted at end of Sprint 9; formalised in Sprint 10's retro |

## Carry-forward for Sprint 10

- **Architectural review of the calendar surface.** Bottom-up: HTTP response headers → Service Worker → TanStack invalidation → component state. Founder asked for it explicitly post-v10.10.3.
- Repeat-aware drawer with `recurring_group_id` cascade.
- Calendar #80 alignment + overlap rendering.
- RWGPS disconnect from Settings.
- Smoke ladder rebuild — static-scan contract tests.
