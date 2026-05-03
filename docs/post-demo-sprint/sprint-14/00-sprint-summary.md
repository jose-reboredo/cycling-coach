# Sprint 14 — Tester-Readiness + Atomic-Design Consolidation

**Status:** In flight (sprint open 2026-05-03 evening)
**Dates:** 2026-05-03 → 2026-05-04 (2-day shape)
**Version target:** **v11.3.0** (single bundled release; founder direction)
**Persona focus:** External testers — first-look at the product on real Strava data
**Phase shape:** Sprint cycle — Discovery (founder bug list) → Scoping → Implementation → Release → Retro
**Headline outcome (target):** All 21 founder-flagged tester-blocking issues fixed in one release; consistent Form / Menu / Navigation patterns extracted as atomic-design rules and applied across the app.

## Why this sprint exists

Founder ran the live product against real testers and surfaced 21 distinct bugs / inconsistencies, all blocking external rollout. Most cluster into four themes:

1. **Form inconsistency** — Personal / Performance / GoalEvent forms behave differently (pre-fill, save messages, validation, success states).
2. **Top-menu / navigation patterns** — "Signed as" name from wrong source, menu click bubbles to template, scroll position not reset on nav, logo redirect inconsistent, duplicate "Edit Profile" entry.
3. **Data clarity** — KPI math unexplained (CTL/ATL/TSB), YTD goal "of 8000" wrong, streak counts daily not weekly + non-training-based.
4. **Surface-specific UI bugs** — Schedule mobile totals bar over calendar, Train tab reordering, Rides Coach Verdict no-close, Club calendar shows personal events.

Plus: founder asked we **consolidate the learnings as atomic-design patterns** so future surfaces inherit consistent behavior, not re-invent.

## Themes

| Theme | Effort | Pattern unlock |
|---|---|---|
| **Form pattern** (atom→molecule→organism: Input → Field → FormSection) | ~3h | Reusable; applied to Personal + Performance + GoalEvent |
| Personal section UX (pre-fill + capitalization + country picker + save success) | ~2h | New `CountrySelect` molecule + Form pattern |
| Top menu fixes (Signed-as from DB · click bug · remove Edit Profile) | ~1.5h | `MenuOverlay` pattern |
| Navigation patterns (scroll-to-top on every nav · logo redirect verify) | ~1h | Router-level scroll-restore |
| Today tab clarity (YTD "of 8000" out · KPI explainer page link) | ~1h | New `/how-it-works` route |
| Train tab reordering (AI key above goal-plan when no key) | ~1h | — |
| Rides tab Coach Verdict open/close toggle | ~0.5h | — |
| Club calendar filter (only this-club events) | ~1.5h | — |
| Streak calculation (weekly + training-based) | ~2h | Calculation correctness |
| Schedule mobile totals-bar z-index | ~0.5h | — |
| New `/how-it-works` KPI explainer page | ~3h | New route |
| Title sizes/fonts alignment (Train tab) | ~0.5h | Type-scale token use |
| Atomic-design rule extraction (memory + docs) | ~1h | New memory rules |

**Total budget:** ~18.5h across 2 days. Within tolerance for the bundled-release shape.

## Releases planned

| Version | Stage | Risk theme | Note |
|---|---|---|---|
| v11.3.0 | Day 2 | Tester-readiness bundle | Single release per founder direction; multiple unrelated fixes batched. Founder approval gate before deploy. |

## Out of scope (deferred)

- **#49 AI year-end forecast** — partial (the YTD "of 8000" is removed in v11.3.0; the AI-projected forecast itself is still a future feature). Today shows YTD distance + projected linear-end-of-year (computed locally from history) but the AI-refined model lands in a focused later sprint.
- **#56 Club Share & Invite Flow** — Sprint 15+ candidate.
- **PassphraseUnlockCard daily-use wiring on AI Coach card (Today/Train)** — substrate ready; consumer-side state-machine integration deferred.
- **`managed: 1` Pro-tier server-side managed-key plumbing** — substrate ready; billing relay deferred.
- **In-app surface migration to Layer 2 tokens (Today / Train / Schedule / Drawer)** — partial: this sprint's specific fixes touch tokens directly where needed; full surface migration is Sprint 15+.
- **`useAthleteProfile` unification** — duplicate state with v11.2.0 server-backed profile API; deferred.

## Decisions locked at sprint open (2026-05-03)

| # | Decision | Rationale |
|---|---|---|
| 1 | Single bundled v11.3.0 release (vs split) | Founder direction; multiple unrelated fixes can ship together when tester-readiness is the theme |
| 2 | Extract `Form` atom→molecule→organism pattern | Personal / Performance / GoalEvent forms differ; consolidation prevents re-inventing |
| 3 | Country picker uses ISO alpha-2 server-side, country name client-side | Users know names; storage is canonical alpha-2 |
| 4 | New route `/how-it-works` for KPI explainer | Public, footer-linked, explains CTL/ATL/TSB/TSS + projection logic |
| 5 | Streak = weekly (≥ 1 training in calendar week) + training-based (not Strava activity count) | Matches user's mental model; current daily-Strava-activity count is wrong |
| 6 | "Signed as" name = `users.name` from `/api/me/profile`; fall back to Strava firstname/lastname when null | Honors the v11.2.0 profile substrate |
| 7 | RWGPS connect failure tracked separately | Likely RWGPS-app-side redirect URI mismatch; founder verifies app config; no code change in v11.3.0 unless found to be code |
| 8 | Atomic-design extractions filed as memory rules | `feedback_form-pattern-canonical.md` + `feedback_atomic-design-extraction-from-bugs.md` — future surfaces inherit |
| 9 | "Edit Profile" removed from UserMenu | Duplicate of My Account (`/dashboard/you`) since v11.2.0 |

## Memory rules referenced this sprint

- `feedback_pre-coding-scope-alignment.md` — bundled-release shape acknowledged as single risk theme = "tester-readiness"; honored with a single Phase 5 audit pre-deploy
- `feedback_xd-consult-on-any-ui-string.md` — every UI string change here goes through the same voice-rules audit (sentence case, no apology, honest empty states)
- `feedback_three-role-architecture-consultation.md` — N/A; no architecture decisions, just UI/UX consolidation
- `feedback_static-scan-contracts.md` — extend the design-system contract scope to cover the new `/how-it-works` route + the new `Form` molecule's CSS modules
- `feedback_pre-deploy-verification.md` — Phase 5 audit before the cut
- `feedback_release-readme-sweep.md` — README's Routes + Components tables get updates
- `feedback_release-ceremony.md` — founder approval gate before deploy
- `feedback_economy-model.md` — Sonnet for mechanical fixes; Opus reserved for the Form pattern extraction (judgment + reusability call)

## Documents in this folder

| File | Role |
|---|---|
| `00-sprint-summary.md` | This document |
| `01-business-requirements.md` | Per-issue ACs + form pattern spec + atomic-design extraction targets |
| `02-architecture-changes.md` | Route additions, query filters, Form molecule API, contract test extensions, smoke ladder |
| `03-cto-review.md` | Sprint retrospective (filled at sprint close) |
| `04-phase-5-parity-audit.md` | Pre-deploy audit (added at v11.3.0 cut) |

## Linked artefacts (filled as the sprint produces them)

| Artefact | Location | Owner |
|---|---|---|
| Form atom→molecule→organism | `apps/web/src/components/Form/` | Tech Lead |
| Country picker | `apps/web/src/components/CountrySelect/` | Tech Lead |
| KPI explainer page | `apps/web/src/routes/how-it-works.tsx` | XD |
| Atomic-design memory rules | `~/.claude/projects/-Users-josereboredo-cycling-coach-cycling-coach/memory/feedback_form-pattern-canonical.md` + `feedback_atomic-design-extraction-from-bugs.md` | Orchestrator |
