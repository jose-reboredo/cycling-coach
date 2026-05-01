# Sprint 2 Retro — v9.3.4 → v9.3.5

**Sprint window:** 2026-04-30 (same day as Sprint 1; scope reset mid-window)
**Closing version in prod:** v9.3.5 (`90dfde5`)
**Author:** retro synthesis (backfilled 2026-05-01 — founder directive came at end of S4)

---

## Headline

**Sprint 2 was scoped DOWN to "regressions only" mid-window.** Clubs expansion (`#53`) took priority and became Sprint 4. Sprint 2 shipped only Phase 1: two regression fixes (FB-R1 Strava-token bearer in `/coach`; FB-R2 missing Anthropic-key link in You-tab) plus the new `mobile-tabs.spec.ts` CI gate (Sprint 1 Improvement #2). Originally-planned features (`#49`/`#50`/`#52`) deferred — eventually slotted to Sprint 7.

**Cost: ~25% of daily quota.** Smallest sprint to date by scope.

---

## What went well

1. **Sprint 1 Improvement #2 shipped same-day-as-prescribed.** `tests/mobile-tabs.spec.ts` — viewport 390×844 + `cc_tabsEnabled='true'` + `/dashboard` redirect assertion + `<header>` + `<nav>` + `#root` children + no `pageerror`. The exact regression class that broke S1's v9.3.1 → v9.3.4 cascade is now blocked at CI.
2. **FB-R1 + FB-R2 fixes were surgical.** `343f8a3` postJson sends Strava bearer + stravaExpired error path; `48d2222` restores "Get a key →" Anthropic link + reassurance copy. Both shipped clean, no follow-up.
3. **No new regressions introduced.** mobile-tabs spec held; legacy-parity rule (S1 Improvement #1) followed since the layout shell wasn't touched.
4. **Cost discipline.** Sprint 2 burned ~25% of daily quota vs Sprint 1's ~80%.

---

## What went badly

1. **Phase 1 was the ONLY phase — sprint scope was reset mid-window.** Original Sprint 2 plan (`#49`/`#50`/`#52` features + Migration 0003) wasn't worked on at all. Scope reset to "do regressions, then pivot to clubs" was an improvement-driven response to user requirements coming in (`#53` clubs expansion needs), but the "Sprint" boundary became fuzzy — Sprint 2 lasted only a few hours before Sprint 3 (hardening backlog) replaced it.
2. **Mobile-tabs assertions vs SPA timing** needed a follow-up tweak (`4c1e9fb`). The new test wasn't 100% stable on first commit — flaky on cold-start due to TanStack Router's `beforeLoad` async resolution. Fixed by waiting for `[data-testid='today-tab-content']` instead of just URL change.
3. **No retro written at sprint close.** The founder directive to retro every sprint came at end of Sprint 4. Backfilled here.

---

## Improvements for Sprint 3

| # | Change | Catches |
|---|---|---|
| 1 | **Mid-stream scope reset = treat as new sprint, not phase shift.** Document the boundary explicitly in the retro and the next sprint's plan. | Sprint 2/3 boundary fuzziness |
| 2 | **New test files added in a release MUST run green TWICE** (initial commit + a follow-up CI run after assertions stabilise) before declaring the gate live. | mobile-tabs assertion-timing follow-up |
| 3 | **Adopt CTO-only-single-doc planning template** for Sprint 3 — Sprint 1 burned 30% of quota on planning; Sprint 3 should reset. | Planning-cost overrun pattern |

---

## Git + version state at sprint close

- **Live in prod:** v9.3.5 · commit `90dfde5`
- **Main branch:** clean
- **Origin sync:** 0 ahead, 0 behind
- **Open GitHub issues:** ~21 — the Sprint 2 features (`#49`, `#50`, `#52`) deferred; HIGH-severity stability backlog `#38–#45` carries to Sprint 3
- **Closed in Sprint 2:** FB-R1 (no GH issue), FB-R2 (no GH issue) — both were user-feedback strings, not numbered backlog items

---

## Recommended Sprint 3 kickoff sequence

1. **CTO-only single-doc plan** (apply Sprint 2 Improvement #3) — no separate BA/UX/Architect rounds. One doc, one synthesis pass.
2. **Phase the hardening backlog into 3 batches** by risk theme: Phase 1 stability (`#38`/`#39`/`#40`), Phase 2 security (`#15`/`#41`/`#42`), Phase 3 a11y + UI polish (`#43`/`#44`/`#45`/`#3`). Per Sprint 1 Improvement #6 ("phase-shift triggers scope re-review"), each phase ships as its own release.
3. **Open issues hygiene**: confirm with founder which items in `#38–#45` are actually still relevant — backlog-review.md as a deliverable, not a side-task.

**Estimated Sprint 3 effort:** ~12h across 3 phases. Lower than Sprint 1 (~24h) and Sprint 2 (originally 24h, actual ~6h).
