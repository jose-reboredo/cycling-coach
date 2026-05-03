# Sprint 1 — Demo-Blockers + Security CRITICALs

**Status:** Closed
**Dates:** 2026-04-30
**Version range:** v9.3.0 (single-cut release)
**Persona focus:** All three personas — demo readiness blocker
**Headline outcome:** Two security CRITICALs closed (`#33` `/coach` zero-auth, `#34` X-Forwarded-Host trust). Mobile 4-tab dashboard refactor (`#51`) shipped behind a feature flag. Route discovery rewired to a non-Strava data source (`#47`). Migration 0004 establishes `training_prefs` route-filter columns.

## Themes

| Theme | Issues | Net delivery |
|---|---|---|
| Demo-blocker mobile UX | `#51`, `#48` (folded into `#51`) | 4-tab dashboard — Today / Train / Schedule / You. Behind `cc_tabsEnabled` kill-switch flag. |
| Route recommendation correctness | `#47`, `#48` | Region-driven route discovery (no hardcoded city). Surface filter (Any / Paved / Gravel). Non-Strava data provider integrated. |
| Security CRITICALs lifted from Sprint 3 | `#33`, `#34` | `/coach` and `/coach-ride` bearer-gated via `resolveAthleteId`. X-Forwarded-Host stripped + origin allowlist. |
| Schema groundwork for future sprints | — | Migration 0004 adds `home_region`, `preferred_distance_km`, `preferred_difficulty` to `training_prefs`. |
| Process scaffolding | — | Sprint planning template + retro discipline established (`docs/retros/sprint-1.md`). |

## Releases shipped

| Version | Date | Headline |
|---|---|---|
| v9.3.0 | 2026-04-30 | Sprint 1 of the post-demo plan ships in one cut: 2 security CRITICALs, mobile 4-tab refactor, route discovery rewire, Migration 0004, dependency hygiene. |

## What landed vs planned

- **Planned:** demo blockers (`#47`, `#51`) + 2 security CRITICALs (`#33`, `#34`) + Migration 0004 in Sprint 1; remaining audit HIGHs (`#38`–`#45`) in Sprint 3.
- **Shipped:** all of the above in one cut. `#48` was folded into `#51` per the CTO review's priority adjustment (the 4-tab structure naturally satisfied the dashboard-clarity acceptance criteria).
- **Drift:** none material. The CTO priority overrides (`§B`) were applied without rework.

## Memory rules created or validated this sprint

- **Process directive — `feedback_pre-deploy-verification.md` precursor.** Sprint 1 retro identified that ad-hoc visual review missed regressions; this evolved into the formal pre-deploy verification rule by Sprint 7.
- **Process directive — kill-switch flags for blast-radius-medium refactors.** The `cc_tabsEnabled` flag pattern shipped with the 4-tab refactor became a reusable pattern for v9.x mobile work.

## Documents in this folder

| File | Role |
|---|---|
| `00-sprint-summary.md` | This document. |
| `01-business-requirements.md` | Post-demo BA debrief — user stories FB-1 through FB-5 + implicit requirements. |
| `02-architecture-changes.md` | Architect's technical plan and shipped deltas. |
| `03-cto-review.md` | CTO synthesis — risk assessment, priority overrides, three-week sprint plan. |
| `ux-design-specs.md` | Supplementary UX/Design role contribution from the post-demo planning round. Cross-referenced by `01-business-requirements.md`. |
