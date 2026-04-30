# Sprint 1 Retro — v9.2.5 → v9.3.4

**Sprint window:** 2026-04-30 (single day, real-time pace)
**Closing version in prod:** v9.3.4 (`818dd88`)
**Author:** retro synthesis (Opus, post-stabilization)

---

## Headline

**Shipped everything in scope** — all 5 Sprint 1 issues (`#33`, `#34`, `#47` Phase 1, `#48` folded into `#51`, `#51`), plus Phase 2 AI route discovery (`/api/routes/discover`, lifted from Sprint 3), Migration 0004, all 5 Dependabot vulnerabilities cleared.

**At a stabilization cost** — 4 hotfix releases (v9.3.1 → v9.3.4) over a few hours after the planned v9.3.0 deploy. The feature scope was right; the integration was rough.

---

## What went well

1. **Security CRITICALs landed first per founder directive.** `#33` + `#34` together took ~1.5h, deployed standalone, smoke-verified in prod. "Fix first, build second" worked as a rule.
2. **v9.3.0 itself was clean.** 9 atomic commits, all unit tests green, all 5 issues auto-closed via "Closes #N" syntax. Confluence release entry auto-created on deploy.
3. **Migration 0004 process held.** Applied to remote D1, schema.sql + db/README.md kept in sync per the v9.2.0 process rule. Zero drama.
4. **Test infra paid off when it counted.** Playwright headless against `npm run dev` localised the v9.3.1 redirect-loop bug in <30 minutes — exact line, exact fix. Without that harness we'd have been guessing.
5. **Sub-agent dispatch worked when scoped tightly.** 4 successful Sonnet runs (sub-task A, B, C, `#47` frontend) — each produced correct code; the only friction was confused error-reporting on permission walls (files were written even when reports said "blocked").
6. **Dependabot zero-clear without test breakage.** `vitest 2 → 3` + `happy-dom 15 → 20` were major bumps; I caught one TS strict-mode issue (`'source' overspecified` in spread), fixed inline. `npm audit` 0 vulnerabilities afterward.

---

## What went badly

1. **Hotfix cascade — three layout regressions found one at a time after deploy.**
   - **v9.3.1**: Tanstack Router parent `beforeLoad` fires on every nested-route navigation. My `/dashboard` → `/dashboard/today` redirect re-fired infinitely on mobile. JS thread blocked, React never mounted, prod went all-black. **No `pageerror`** because Tanstack catches `redirect()` as control flow.
   - **v9.3.3**: My v9.3.1 layout shell (`routes/dashboard.tsx`) rendered `<Outlet /> + <BottomNav />` but missed `<TopBar />`. The bug was masked by the redirect loop in v9.3.1; surfaced the moment v9.3.2 fixed the loop. Brand bar, UserMenu — gone.
   - **v9.3.4**: My v9.3.3 fix added TopBar but only ported `<UserMenu />` from legacy. Missed `<ContextSwitcher />` AND the `isClubMode` rendering branch that swaps Outlet for ClubDashboard. Whole clubs feature invisible on mobile.

   **All three would have been caught by a single legacy-parity audit before merging the v9.3.1 layout shell.**

2. **Spec drift not validated against user intent.** Architect's `03-architecture-changes.md §C.2` added `distance` + `difficulty` query params to `/api/routes/saved` and the matching frontend chips. BA's FB-1 only required surface. User feedback on v9.3.0: "the distance picker was not a requirement, difficulty neither". I followed architect spec; should have flagged the drift against BA acceptance.

3. **Smoke tested the wrong things.** v9.3.1's deploy verification was `/version` + 401s on auth-gated endpoints. Those didn't change between v9.3.0 and v9.3.1. The thing that changed (mobile dashboard mount) was never tested. Static-endpoint smoke is theatre when the regression risk is in dynamic UI.

4. **My revert destroyed the user's fix.** Op `3d4f73d` rolled back to v9.3.0 source without first running `git log --oneline -20`. The user had already shipped v9.3.2 (`687bfce`) fixing v9.3.1's redirect loop; my revert clobbered both v9.3.2's fix and v9.3.1's features in one stroke. Hard process failure — the user had to interrupt and ask "are you in a loop?"

5. **Routes shown not session-aware in v9.3.0.** RoutesPicker returned ALL of the user's saved Strava routes (including a Positano vacation route while they were training in Zürich). v9.3.1 added session-distance filtering — but only after user feedback. The "Positano in routes" feedback was a category-of-error my smoke tests don't have a check for: "results contextually irrelevant despite shape-correct".

6. **No mobile-viewport CI gate.** We have Playwright (`tests/smoke.spec.ts`, `tests/tabs.spec.ts`), but no test that loads `/dashboard` at 390×844 with `cc_tabsEnabled='true'` and verifies the page mounts. A single such test would have caught all 3 of: redirect loop, missing TopBar, missing ContextSwitcher.

7. **Phase 2 lift-forward stretched the v9.3.1 hotfix scope.** Architect plan deferred `/api/routes/discover` (system-paid Haiku) to Sprint 3. User feedback on v9.3.0 made it clear Phase 1 was a dead end without an AI fallback for users with no saved routes. Lifting Phase 2 into v9.3.1 was the right call, but it turned a "small UI fix" into a "feature lift + UI rework + bug fix" combo. More surface = more regressions.

---

## Improvements for Sprint 2 (process changes)

| # | Change | Catches |
|---|---|---|
| 1 | **Legacy-parity audit before merging any layout-shell refactor.** List every component the legacy renders; verify the new shell renders the same set or has explicit replacements. | v9.3.3 + v9.3.4 cascade |
| 2 | **Mobile-viewport CI gate.** New `tests/mobile-tabs.spec.ts`: viewport 390×844 + `cc_tabsEnabled='true'`, navigate `/dashboard`, assert URL redirects to `/dashboard/today` (no loop), `<header>` exists, `<nav aria-label="Primary">` exists, `#root` has children, no `pageerror`. Block deploy on red. | v9.3.1 redirect loop + missing chrome regressions |
| 3 | **Pre-implementation user walkthrough for spec-driven UI.** 2-min "this is what I'll build" preview to user before coding any new chips/controls/workflow. Especially when spec sources (BA + Architect) disagree. | v9.3.0 distance+difficulty chips, Positano-in-routes |
| 4 | **Hard rule: `git log --oneline -20` before any revert/reset.** Add to executing-actions checklist. No destructive git op without verifying the chain. | v9.3.0 revert disaster |
| 5 | **Smoke what changed, not what's stable.** Per-release smoke list must specifically target the regression risk surface for that release, not just static endpoints. | v9.3.1 deploy verification gap |
| 6 | **Phase-shift triggers scope re-review.** When Sprint N work pulls forward Sprint N+1 features, treat as a new release, not a hotfix. Ship the original fix first, then the lifted feature. | v9.3.1 over-scope |
| 7 | **Codify "tabs view = legacy mirror" contract** in `routes/dashboard.tsx`. When a developer adds something to legacy `Dashboard.tsx`'s TopBar trailing or main view, they must also add it to `TabsLayout`. Comment + a custom-rule lint or runtime assertion in dev mode. | future TabsLayout regressions |

---

## Git + version state at sprint close

- **Live in prod:** v9.3.4 · commit `818dd88`
- **Main branch:** clean (1 trailing lockfile sync to commit, no real drift)
- **Origin sync:** 0 ahead, 0 behind
- **Branches:** only `main` (project pattern, no feature branches)
- **Open GitHub issues:** 23 — Sprint 2 candidates: `#49` (forecast), `#50` (annual goal), `#52` (profile expansion); HIGH-severity backlog `#38–#45` carries to Sprint 3
- **Closed in Sprint 1:** `#33`, `#34`, `#47`, `#48`, `#51` (5 of the 5 Sprint 1 stories)

---

## Recommended Sprint 2 kickoff sequence

1. **User walkthrough of `#49`, `#50`, `#52` BA stories** (15 min) — apply Improvement #3 upfront so we don't ship distance-chip-style spec drift again.
2. **Add `tests/mobile-tabs.spec.ts` first** (Improvement #2) — gate Sprint 2 deploys on it from day one.
3. **Codify the layout-mirror contract in `routes/dashboard.tsx`** (Improvement #7) — add a comment + add `<ClubCreateCard />` to the personal tabs main flow (the Sprint 1 hotfixes left it unwired in non-club-mode tabs).
4. **Then Sprint 2 features** — `#50` first (goal data model is dependency for `#49`), then `#49` (forecast), then `#52` (You-tab profile expansion + Migration 0003).

**Estimated Sprint 2 effort:** ~39h per the architect plan, no expected lift-forward.
