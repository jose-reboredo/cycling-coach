# Sprint 2 — Sprint 1 Regression Hotfixes + Goal Data Model

**Status:** Closed
**Dates:** 2026-04-30
**Version range:** v9.3.5 (single-cut)
**Persona focus:** Persona A (Marco) and Persona C (Léa) — BYOK regression blocked plan generation
**Headline outcome:** Two regression hotfixes from Sprint 1's BYOK flow (FB-R1 `/coach` auth + FB-R2 You-tab "Get a key" link). Mobile-viewport CI gate established. Annual goal data model (`#50`) and AI year-end forecast (`#49`) shipped. Migration 0003 adds `users.sex` + `users.country` for profile expansion.

## Themes

| Theme | Issues | Net delivery |
|---|---|---|
| Sprint 1 regression cleanup | FB-R1, FB-R2 | `postJson()` in `coachApi.ts` attaches `Authorization: Bearer …` for `/coach` and `/coach-ride`. "Get a key →" link restored on the You tab. |
| Mobile-viewport CI gate | — | Test gate that should have prevented FB-R2's silent component drop. |
| Annual goal data model | `#50` | `goals` table extended; `PUT /api/goals/annual` endpoint. |
| AI year-end forecast | `#49` | System-paid Haiku forecast surfaces "at your current pace, ~Y km by 31 Dec". KV-cached. |
| Profile expansion (You tab Phase 1) | `#52` | Migration 0003 — `users.sex`, `users.country`. UI surfaces these in the profile editor. |
| Architectural decision — keep `#33` bearer gate | ADR-S2.1 | Confirms not to revert `/coach` auth (would re-open CRITICAL `#33`). Fix lives in the frontend. |

## Releases shipped

| Version | Date | Headline |
|---|---|---|
| v9.3.5 | 2026-04-30 | Sprint 2 Phase 1 — two regression hotfixes from Sprint 1's BYOK flow + the mobile-viewport CI gate that should have been there from day one. |

## What landed vs planned

- **Planned:** ~42h budget — FB-R1, FB-R2, `#50`, `#49`, `#52` Phase 1.
- **Shipped:** all of the above. Budget overrun ~2h (acceptable per CTO review tolerance).
- **Drift:** none. The CTO ADR-S2.1 (do not revert the `#33` bearer gate) was honored — the regression fix lives in the frontend, security posture intact.

## Memory rules created or validated this sprint

- **ADR-S2.1 (architectural decision record):** never weaken a security gate to fix a frontend regression. Frontend-side fix preferred. Validated.
- **Mobile-viewport CI gate** as a class of test that should be present for any layout-touching change. Operational rule going forward.

## Documents in this folder

| File | Role |
|---|---|
| `00-sprint-summary.md` | This document. |
| `01-business-requirements.md` | BA stories — FB-R1, FB-R2, plus carry-forward of Sprint 1 features `#49`, `#50`, `#52` Phase 1. |
| `02-architecture-changes.md` | Architect's technical plan and shipped deltas. |
| `03-cto-review.md` | CTO synthesis — risk assessment, ADR-S2.1, sprint plan. |
