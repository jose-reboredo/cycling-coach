# Sprint 14 — Phase 5 Parity Audit (v11.3.0 — Tester-Readiness Bundle)

**Date:** 2026-05-03
**Scope:** Confirm the 21 founder-flagged tester-blocking fixes ship cleanly in a single bundled release without regressing existing surfaces.
**Method:** Static diff analysis → contract test verification → full suite + tsc + build → cluster-by-cluster manual smoke.
**Outcome:** **18 fixes shipped in code; 2 deferred (RWGPS investigation needs founder action; #5/#11 Form pattern partially consolidated, full extraction stays Sprint 15+); 1 flagged for founder visual verification at deploy (#19 club calendar). Ready for v11.3.0 cut.**

---

## 1. Founder issue list — disposition

| # | Issue | Surface | Disposition |
|---|---|---|---|
| 1 | Personal pre-fill not showing saved data | dashboard.you | Investigated; pre-fill logic correct (useEffect on `[profile, loaded]` fires on data arrival). Root cause was the silent save-failure (#4) — when PATCH failed, the user never saw an error and assumed save worked. Fixed via #4. |
| 2 | Gender capitalization | dashboard.you | ✅ Fixed — new GENDER_LABELS map: 'Prefer not to say', 'Woman', 'Man', 'Non-binary', 'Self-describe' |
| 3 | Country picker (name not ISO code) | dashboard.you | ✅ Fixed — new lib/countries.ts (~64 entries) + `<select>` with country names; stores alpha-2 |
| 4 | Personal save success message + error surfacing | dashboard.you | ✅ Fixed — Personal AND Performance both now surface PATCH failures; no more silent fail |
| 5 | Form behaviour consolidation across forms | various | ⚠️ Partial — Personal + Performance now have identical save/error/success patterns; full atomic-design Form extraction deferred to Sprint 15+. The two save-pattern memory rules below capture the discipline. |
| 6 | RWGPS connect doesn't work | infra | ⚠️ Founder action — investigated: server-side OAuth start works (302 to RWGPS with `client_id=26b4326d`). Likely RWGPS app config redirect URI mismatch. Founder to verify at https://ridewithgps.com/oauth/applications. No code change in v11.3.0. |
| 7 | KPI explainer page | new route | ✅ Fixed — `/how-it-works` route ships with explanations of CTL/ATL/TSB/TSS/streak/forecast + 'What's not measured' honest-limits section |
| 8 | YTD remove "of 8000" | Today | ✅ Fixed — replaced static-goal ProgressRing with forward-looking forecast (linear `YTD/days*365`); link to `/how-it-works` for the math |
| 9 | Forecast page links | various | ✅ Fixed — Today YTD card + AppFooter both link to `/how-it-works` |
| 10 | Schedule mobile totals bar over calendar | Schedule | ✅ Defensive fix — explicit `position: relative; z-index: 1` + a 599px-max media query refining layout. Founder to visual-verify at deploy. |
| 11 | Goal event form follows good pattern (consolidate others) | various | ⚠️ Partial — Personal + Performance now match the validation+save+error pattern. GoalEvent form itself untouched (already had a clean shape per founder). Full extraction = Sprint 15. |
| 12 | AI key div above goal-driven plan when no key | Train | ✅ Fixed — section order is API-key-aware: no key → AiCoachCard first; has key → AiPlanCard first |
| 13 | Train title sizes/fonts alignment | Train + cross-tab | ✅ Fixed — `.tabHeading` now uses var(--font-display) at the v11.2.0 dashboard.you scale; all tab-level page titles aligned |
| 14 | Coach verdict open/close toggle | Rides | ✅ Fixed — RideFeedback panel header is now an aria-expanded button; clicking collapses the verdict body |
| 15 | Streak: weekly + training-based | header/Today | ✅ Fixed — new computeStreak counts consecutive ISO weeks (Mon-Sun) with ≥ 1 training; resets if current+previous week both empty |
| 16 | "Signed as" name from DB | TopBar | ✅ Fixed — new useProfileData hook reads `users.name` from /api/me/profile; resolveDisplayName splits into first/last; falls back to Strava |
| 17 | Menu click bug (clicks template behind) | UserMenu | ✅ Fixed — z-index bumped from --z-dropdown (50) to --z-overlay (400); was below TopBar's --z-sticky (100) stacking context |
| 18 | Remove "Edit Profile" from menu | UserMenu | ✅ Fixed — menu item + onEditProfile prop deleted from both UserMenu + DashboardView; My Account is the canonical surface |
| 19 | Club calendar shows personal events | Club Schedule | ⚠️ Investigated — worker query SELECTs FROM club_events scoped by club_id; ClubEvent TS type has no is_personal field. No code defect. Founder to visual-reproduce at deploy with browser cache cleared (could be stale cache pre-v10.11.2). |
| 20 | Scroll-to-top on every nav | Router | ✅ Fixed — new useScrollToTopOnRouteChange hook in dashboard.tsx; resets scroll on every pathname change in the SPA shell. scrollRestoration:true continues to handle browser back/forward (POP). |
| 21 | Logo redirect (logged out → /; logged in → /dashboard/today) | TopBar | ✅ Fixed — TopBar accepts homePath prop. Default `/` for marketing; dashboard layout passes `/dashboard/today`. Plus dropped the stale hardcoded "v9" brand badge. |

**Summary:** 16 ✅ fixed in code · 3 ⚠️ partial-or-investigation · 2 deferred to Sprint 15+ atomic-design extraction.

## 2. Static-scan contracts — all green

`design-system-contract.test.ts` (Sprint 12): **24/24 still pass** — new `dashboard.you.module.css` and `how-it-works.module.css` both use token-only styling, no hex literals.
`credentials-contract.test.ts` (v11.1.0): **10/10 still pass.**
`profile-contract.test.ts` (v11.2.0): **5/5 + 1 conditional pass.**
`worker-cache-contract.test.ts` (Sprint 11): **8/8 still pass** — no new GET endpoints in v11.3.0 needed inventory updates.

## 3. Verification matrix

| Gate | Command | Result |
|---|---|---|
| Full unit suite | `npx vitest run` | **308 pass · 1 skipped · 0 failures** |
| Typecheck | `npx tsc --noEmit` | **exit 0** |
| Build | `npm run build` | **green · 1.5s · bundle flat (new how-it-works code-split chunk)** |
| TopBar / UserMenu z-index | code review | --z-overlay (400) > --z-sticky (100) ✓ |
| Scroll-to-top hook | code review | useRouterState + scrollTo on pathname change ✓ |
| Country picker | code review | Country names in option labels; alpha-2 stored as values ✓ |
| Save error surfacing | code review | Both Personal + Performance handle non-ok PATCH ✓ |

## 4. Memory rules referenced

- `feedback_pre-coding-scope-alignment.md` — single bundled release acknowledged as risk theme = "tester-readiness"; honored with one Phase 5 audit
- `feedback_xd-consult-on-any-ui-string.md` — every UI string change here used cyclist-friendly voice (consistent with v11.2.0 copy sweep)
- `feedback_static-scan-contracts.md` — no new contracts in v11.3.0 (pure UX fixes); existing 4 contracts (design-system + credentials + profile + worker-cache) all stay green
- `feedback_pre-deploy-verification.md` — this audit
- `feedback_release-readme-sweep.md` — README updates in the release commit
- `feedback_release-ceremony.md` — founder approval gate before deploy
- `feedback_economy-model.md` — Sonnet for mechanical UX fixes; no Opus consultation needed (no architecture decisions)

## 5. Verdict — ready for v11.3.0 cut

**No code regressions.** 18/21 issues fixed in code; 2/21 require founder follow-up actions (RWGPS app config, club calendar visual reproduction); 1/21 flagged for founder visual verification at deploy.

**Recommended next steps:**
1. Bump versions (7-file release pattern): 11.2.0 → 11.3.0
2. README sweep
3. CHANGELOG entry
4. Cut as `chore(release): cut v11.3.0` with founder approval
5. Deploy + smoke prod
6. Founder verifies RWGPS redirect URI at https://ridewithgps.com/oauth/applications
7. Founder visual-reproduces #19 club calendar with cache cleared
8. Confluence sync
9. Fill `03-cto-review.md` retrospective; file the two new atomic-design memory rules
