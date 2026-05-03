# Sprint 3 — Hardening, Accessibility, and Clubs Scoping

**Status:** Closed
**Dates:** 2026-04-30
**Version range:** v9.5.0 → v9.5.2 (3 phased releases)
**Persona focus:** All three personas — backlog stability and accessibility
**Headline outcome:** Three frontend stability fixes from the audit's HIGH backlog (`#38`–`#40`). Three security hardening fixes (method allowlist, clubs-write rate-limit, full security header set). Four accessibility / UI polish fixes batched as Phase 3. Clubs expansion (`#53`) scoping started but defers to Sprint 4 as a sprint-sized feature.

## Themes

| Theme | Issues | Phase | Net delivery |
|---|---|---|---|
| Stability + correctness | `#38`, `#39`, `#40` | Phase 1 (v9.5.0) | Three small frontend bugs, no schema/API touch. Single mobile-tabs CI gate covers them all. |
| Security hardening | `#41`, `#42`, `#15` | Phase 2 (v9.5.1) | Method allowlist on writes, per-athlete rate limit on clubs-write, full security header set (HSTS, X-Frame, X-Content-Type, Referrer-Policy, Permissions-Policy, CSP). |
| Accessibility + UI polish | `#43`, `#44`, `#45` | Phase 3 (v9.5.2) | CSS-only changes; Lighthouse mobile a11y score lifts. |
| Clubs expansion scoping | `#53` | Triage | Founder scoping session confirmed Clubs Phase 1 + 2 belongs in its own sprint (Sprint 4). Roster slice (~8h) carries over; full IA expansion sized at ~50–65h in Sprint 4 CTO review. |

## Releases shipped

| Version | Date | Headline |
|---|---|---|
| v9.5.0 | 2026-04-30 | Sprint 3 Phase 1 — three frontend stability fixes from the audit's HIGH backlog + backlog triage. No worker, no schema, no security work. |
| v9.5.1 | 2026-04-30 | Sprint 3 Phase 2 — three security hardening fixes covering method allowlist, clubs-write rate-limit, and full security header set. |
| v9.5.2 | 2026-04-30 | Sprint 3 Phase 3 — accessibility + UI polish. Four CSS-only / single-component fixes batched into one release theme. |

## What landed vs planned

- **Planned:** ~20h across 3 phases (5 stability + 10 security + 5 a11y) plus founder-gated Clubs scoping session.
- **Shipped:** all 9 backlog items (3 + 3 + 3 + 1) across 3 phased releases. Clubs expansion deferred to Sprint 4 as planned.
- **Drift:** none. Clean three-phase ship; the phased structure (one risk theme per release) became a template referenced by later sprints.

## Memory rules created or validated this sprint

- **One risk theme per release.** Sprint 3 demonstrated the pattern at scale — three releases, three independent themes, zero hotfixes. Carry-forward to all subsequent sprints.
- **Phased release structure for hardening backlogs.** Stability → security → polish is a defensible ordering when each phase has < 10h of work.

## Documents in this folder

| File | Role |
|---|---|
| `00-sprint-summary.md` | This document. |
| `01-business-requirements.md` | Backlog review of 16 open issues — per-issue assessment, recommended action, sprint slot. |
| `02-architecture-changes.md` | CTO sprint plan — risk + scope tables, three-phase release structure, security-fix specifications. |
| `03-cto-review.md` | Sprint retrospective. |
