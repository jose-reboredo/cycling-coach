# Sprint 11 — CTO Review (in flight; updated as the sprint progresses)

**Reviewed:** 2026-05-03 (sprint open + first deploy + v10.13.0 retro)
**Releases shipped so far:** 1 (v10.13.0)
**Reviewer:** CTO + Architect (Opus, in-session synthesis) — autonomous overnight run + morning review with founder

> This document gets finalized at sprint close. Current content covers the v10.13.0 cut + the founder-reported route-gen failure that follows it.

## What worked

1. **Four parallel autonomous workstreams in isolated git worktrees.** Each agent on its own branch, each pushed independently, no cross-contamination of git state. Founder reviewed all four reports + merged in priority order (security → bugs → tests → docs) with no merge conflicts (predicted disjoint diff regions held). v10.13.0 cut + deployed cleanly.
2. **Static-scan contract tests scale cheaply.** v10.11.3's pattern (read worker source as text, assert regression-prone shape isn't present) multiplied to 158 new tests in one night. Cost-per-test is near zero; coverage breadth is meaningful.
3. **Honest counter-offer on scope.** Founder asked for "all roles review their part" + perf + pentest + sweep + multi-role review. The honest single-night version (tech-lead pass, no real harness) was scoped explicitly. Founder accepted; the result was credible work, not theater.
4. **Security + tests caught real drift.** Tests branch found `idx_planned_sessions_ai_plan` missing from `schema.sql` cumulative (Migration 0011 leak). Security branch found 5 UPDATE statements relying on pre-checks instead of WHERE-clause scope. Both real findings; both fixed in branch.

## What regressed

1. **Route-generation fixes shipped but didn't fix the user-visible problem.** v10.13.0 deployed the centroid 2 km gate + Strava type/anchor filter. Founder smoke-tested post-deploy and confirmed the Zurich + Path of Gods bugs persist. **Lesson: incremental gates were the wrong tool for this surface.** Founder explicitly deferred route generation to a dedicated future sprint with a fixture-based harness + end-to-end redesign.
2. **Two filename collisions** between security and tests branches (both created `worker-authz-contract.test.ts`). Caught in pre-merge inspection; tests branch's file renamed to `worker-authz-coverage.test.ts` before merge. Lesson: when spawning parallel agents, instruct them to namespace new files by branch.
3. **Bugs agent leaked edits to the parent repo** (the bare repo at `/Users/josereboredo/.../cycling-coach/`). Caught + restored before merging branches. Lesson: when running parallel agents, provide explicit `pwd` checks + worktree-aware file paths in the agent prompts.

## What we learned

- **Pattern-replacement applies to fix attempts too, not just code patterns.** Sprint 7-9 cluster of 6 ineffective hotfixes was the in-product symptom of pattern-failure. Sprint 11's route-gen patches are in the same shape: 3 targeted gates that didn't address the user-visible problem. **Memory rule re-validated:** when a fix-attempt pattern produces 3+ same-class non-fixes, replace the approach (not the code).
- **The autonomous-overnight pattern worked.** Four agents in parallel worktrees, founder reviews in the morning. Cost: ~5 minutes of orchestration setup. Benefit: 1 night of work delivered as 4 reviewable diffs. Repeatable.
- **`SPRINT_11_BACKLOG.md` keeps the no-harness items honest.** Listing what wasn't done + why is more valuable than a fake "we did everything" retro.

## Tech debt accrued

- **Route-generation reliability is now a tracked deferred item** — Sprint 12 reserved for the dedicated rebuild.
- `src/worker.js` shard extraction overdue.
- `src/docs.js` per-page split overdue.
- Encrypted-at-rest RWGPS token storage backlog.
- Real perf testing, pentest, dependency-audit CI gate — all backlog (need real harness).

## Process notes

- **Sprint documentation discipline.** This 4-doc shape (`00-summary` + `01-business-requirements` + `02-architecture-changes` + `03-cto-review`) gets the founder + future-self a single place to read what each sprint did. Locked as a memory rule for every future sprint. **Older sprints (5-10) reconstructed retroactively** on 2026-05-03 morning from CHANGELOG + git log; the reconstruction is honest about being post-hoc but still load-bearing for the project's history.
- **Sprint 12 will run as a dedicated route-generation sprint** with explicit scope: end-to-end redesign (geocode + ORS request shape + scoring + post-validation + Strava + RWGPS rankings + picker UX), fixture-based harness, no incremental gate patches.

## Memory rules — created or validated this sprint

| File | Status |
|---|---|
| `project_route-generation-status.md` | **Created** — route-gen is known-broken; do NOT propose targeted patches |
| `feedback_pattern-replacement.md` | **Re-validated** by the route-gen non-fix |
| `feedback_sprint-documentation-mandatory.md` | **Created** as part of this sprint — every sprint must have the 4 docs |

## Carry-forward for Sprint 12

- **Route-generation rebuild.** End-to-end. Geocode (Nominatim ambiguity surfaces) + ORS request shape (bbox, profile, waypoint scaffold) + scoring weights + post-validation gates + Strava + RWGPS saved-route ranking + picker UX. Don't touch one layer in isolation.
- **Fixture-based harness.** Real pentest replays + ORS replays so the user-visible bugs become testable (and no longer have to wait for production smoke-tests to surface).
- **Optionally:** real perf baseline (k6 or wrk) and dependency-audit CI gate. Either as part of Sprint 12 or as Sprint 13 dedicated.
