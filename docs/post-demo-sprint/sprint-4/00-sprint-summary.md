# Sprint 4 — Clubs Expansion (Issue `#53`)

**Status:** Closed
**Dates:** 2026-04-30
**Version range:** v9.6.0 → v9.6.5 (5 phased releases + 1 marketing alignment)
**Persona focus:** Persona B (Sofia — Saturday-crew captain)
**Headline outcome:** Clubs information architecture expansion across 4 tabs (Overview / Members / Schedule / Metrics). RSVP wiring (`event_rsvps` table). Phase A AI moments (statistical, no LLM cost) — readiness dots, members trend arrow. Phase B AI moments (LLM-driven) deferred to later sprints.

## Themes

| Theme | Issues | Phase | Net delivery |
|---|---|---|---|
| Clubs IA shell + Overview tab | `#53` | Phase 1 (v9.6.0) | 4-tab IA, slim sticky header (cover hero dropped), Overview tab fully wired, Schedule/Members tabs scaffolded, redesigned info hierarchy. |
| OAuth completion fix | `#15` | Hotfix (v9.6.1) | `/callback` inline script blocked by CSP — resolved with nonce-based pattern. |
| Members tab + RSVP wiring + privacy plumbing | `#53` | Phase 2 (v9.6.2) | `event_rsvps` table; `POST /api/clubs/:id/events/:eventId/rsvp`; FTP-default sort; member-row drawer; FTP visibility chip (privacy-by-default per ADR-S4.4). |
| Phase 2 polish | — | Phase 2 (v9.6.3) | Three founder-feedback bugs fixed in one commit. |
| RSVP correctness hotfix | — | Phase 2 (v9.6.4) | `LEFT JOIN event_rsvps` was technically correct but D1 verified `event_rsvps` had 0 rows ever — RSVP write path was broken. |
| Marketing landing rewrite | — | Phase 3 (v9.6.5) | Landing page realigned to current product direction (clubs-first with AI embedded across three personas). |

## Releases shipped

| Version | Date | Headline |
|---|---|---|
| v9.6.0 | 2026-04-30 | Sprint 4 Phase 1 — clubs expansion (`#53`). 4-tab IA, slim sticky header (cover hero dropped), Overview tab fully wired. |
| v9.6.1 | 2026-04-30 | Hotfix — `/callback` inline script blocked by CSP from v9.5.1 (`#15`). |
| v9.6.2 | 2026-04-30 | Sprint 4 Phase 2 — clubs Members tab + RSVP wiring + privacy-visibility plumbing. |
| v9.6.3 | 2026-04-30 | Three Phase 2 polish bugs from founder feedback. Fixed in one commit. |
| v9.6.4 | 2026-04-30 | Hotfix-of-hotfix — RSVP write path was broken. Verified by D1: `event_rsvps` had 0 rows ever. |
| v9.6.5 | 2026-04-30 | Marketing landing rewrite — clubs-first with AI embedded across three personas. |

## What landed vs planned

- **Planned:** 5-phase ~52h Clubs Expansion. Phases 1–2 in this sprint; Phase 3 (Schedule tab + month query) and Phase 4–5 (AI moments) staged for later sprints.
- **Shipped:** Phases 1–2 plus Phase 3 partial scaffolding (Schedule tab present but not feature-complete until Sprint 5). Phase 4 AI moments deferred to Sprint 5+. Phase 5 LLM-driven AI moments still backlog.
- **Drift:** small. RSVP write path required two hotfixes — first attempt joined an empty table, second attempt inserted but read path didn't refresh. Caught and fixed within sprint.

## Memory rules created or validated this sprint

- **ADR-S4.4 — privacy-by-default for FTP visibility.** New users default to `private`; opt-in to public. Validated as the correct posture; carried forward.
- **`#53` scoping was correct** — the Sprint 3 CTO call to defer Clubs expansion into its own sprint validated. Trying to fit ~52h into Sprint 3's hardening budget would have produced rushed work.

## Documents in this folder

| File | Role |
|---|---|
| `00-sprint-summary.md` | This document. |
| `01-business-requirements.md` | BA + UX clubs experience design — 4 tabs, 6 user stories, 6 AI embedding points, 3 new D1 tables, 4 new endpoints. |
| `02-architecture-changes.md` | Architect's technical plan and shipped deltas. |
| `03-cto-review.md` | CTO synthesis — 5-phase ~52h scope, AI cost-ceiling analysis, founder scoping decisions. |
