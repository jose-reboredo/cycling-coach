# Sprint 14 — CTO Review

**Reviewed:** 2026-05-03 (sprint open + close on the same day)
**Releases shipped:** 1 (v11.3.0 single bundled tester-readiness release)
**Reviewer:** CTO + Architect synthesis with the product lead. Founder approval gate respected before deploy.

> Sprint 14 is the tester-readiness sprint. Founder ran the live product against real testers and surfaced 21 bugs / inconsistencies. v11.3.0 ships 18 fixes in code, 2 founder follow-up items (RWGPS app config; club calendar visual repro), and 1 partial extraction (form pattern documented as memory rule, full molecule extraction deferred to Sprint 15). Two new memory rules filed (`feedback_form-pattern-canonical.md`, `feedback_atomic-design-extraction-from-bugs.md`).

## What worked

1. **Bug-cluster recognition.** The 21-bug tester report wasn't 21 separate issues — it was 4 patterns (forms, menus, navigation, surface-specific) + handful of one-offs. Recognizing the clusters at sprint open made the work routable: forms got the canonical-save-pattern treatment across multiple surfaces; menus got the z-index + duplicate-removal cleanup as one batch; navigation got the scroll-to-top + logo-redirect pair. Without cluster recognition, the sprint would have been 21 individual fixes with no shared discipline; with it, two memory rules came out and the next forms / menus inherit by reference.

2. **Single-day delivery on a 21-bug bundle.** Founder asked for a single bundled release ("prepare a single release to fix all of them"). Risk-theme density was higher than `feedback_pre-coding-scope-alignment.md` typically allows, but the founder's call as PO held: tester-readiness is itself the single risk theme. Phase 5 audit cleanly verified.

3. **Investigation-only as a first-class disposition.** Two of the 21 items (#6 RWGPS, #19 club calendar) had no code defect after investigation. v11.3.0 documented this honestly in the audit + commit messages + CHANGELOG instead of inventing a fix. Founder gets clear next-step actions (verify RWGPS redirect URI, visual-reproduce club calendar with cleared cache).

4. **Save-error surfacing was the real "no success message" bug.** Founder reported "no success message" on Personal section saves. Investigation showed the success path worked; the silent-failure path was the bug — when the country was free-text "Spain" instead of "ES", the worker returned 400 validation error and the frontend ignored the non-ok and showed nothing. Adding the `r.ok` branch + the country picker (which makes the bad input impossible) fixed both the user-facing symptom and the underlying regression class. Filed as `feedback_form-pattern-canonical.md`.

5. **Cyclist-friendly copy discipline carried over from Sprint 13.** Every UI string change in Sprint 14 went through the v11.2.0 vocabulary rules (sentence case, no apology, no tech jargon). The new `/how-it-works` route is the most extreme example — explaining CTL/ATL/TSB in cyclist language instead of cryptography-flavored terminology.

6. **The orchestrator's role-routing held under high task density.** No three-role consultation needed (no architecture decisions); Tech Lead + Sonnet covered all 21 fixes; Phase 5 audit synthesized cluster-by-cluster. The `feedback_economy-model.md` rule paid for itself — Opus would have been overkill here.

## What regressed

1. **The tester-readiness sprint surfaced patterns we already had memory rules about.** `feedback_xd-consult-on-any-ui-string.md` (Sprint 13) was supposed to slot XD/BD review into every release that ships UI strings. Sprint 14's UI-string release didn't get an explicit XD/BD consult — the founder's tester pass was the proxy. **Lesson:** the rule applies to v11.0 / v11.1 / v11.2 releases too in retrospect; the 15 copy strings that v11.2.0's Task 7.5 swept were missed in v11.1.0 because that consult skipped. Sprint 14 doesn't have a fresh miss but the rule needs to apply *before* tester feedback, not after.

2. **The atomic-design extraction is partial, not complete.** Forms now share the save-pattern but still re-implement the state hooks (busy / saved / error / errors). Sprint 15 should ship the `useFormSection` hook + `<FormActions />` molecule so new forms inherit by import, not by re-implementation. Filed as a Sprint 14 → Sprint 15 carry-forward; flagged in `feedback_atomic-design-extraction-from-bugs.md`.

3. **#19 club calendar showing personal events** — investigation found no code defect, but I have a residual unease that the founder *saw* something real that I couldn't reproduce from code review alone. The TS type confirmed the data shape, the SQL is scoped, the cache-control headers are right. If a tester continues to see this, the next debugging step is a screenshot + browser network tab capture to settle whether it's stale data, scope confusion (`/dashboard/schedule` merges club + personal intentionally), or a real worker bug. **Lesson:** for "I see X" reports, code review can rule out classes of bugs but can't replace device reproduction. Sprint 15 starts with a brief founder visual reproduction step on this one.

4. **TopBar's hardcoded "v9" brandBadge** had been stale for ~10 releases (we shipped v10.x and v11.x with it visible). It wasn't on the founder's bug list but I caught it during the logo-redirect fix and dropped it. **Lesson:** the README sweep rule (`feedback_release-readme-sweep.md`) catches version pin in README + CHANGELOG but doesn't audit version mentions in component literals. Worth a future static-scan contract test that asserts no hardcoded version strings outside the canonical 5 release-pattern files.

## What we learned

- **A 21-bug tester report is a structural signal, not just a punchlist.** Fixing them is necessary but the bigger win is recognizing the pattern of patterns. Sprint 14's two new memory rules came out of the cluster recognition; without that, we'd have shipped 21 isolated fixes and the *next* tester pass would surface the same drift.
- **"Investigation only" is a valid release outcome.** Two of the 21 items had no code action in v11.3.0. Documenting the investigation honestly (in the commit message + audit doc + CHANGELOG) is more valuable than inventing a fix that doesn't address a real bug.
- **The form save pattern is the highest-leverage molecule we haven't yet extracted.** Forms are everywhere in this app (profile, training prefs, goal event, club event, AI key save, schedule new, recover passphrase). Every one currently re-implements busy/saved/error state. Sprint 15's molecule extraction has multi-sprint payoff.
- **Z-index discipline is a memory-rule candidate.** The UserMenu's stacking-context bug (`--z-dropdown` 50 < `--z-sticky` 100) was a class of error: dropdowns / popovers / sheets need to sit *above* sticky chrome, but the token names don't enforce a layering policy. A future memory rule could codify "any popover element uses `--z-overlay` or higher; sticky chrome maxes at `--z-sticky`."
- **Bundling 18 disparate fixes in one release is acceptable when the risk theme is "tester-readiness"**, but it does stretch the `feedback_pre-coding-scope-alignment.md` ≤1-risk-theme rule. The Phase 5 audit's cluster-by-cluster verification is what made it safe; without that structure, the deploy would have been a coin-flip.

## Tech debt accrued

- **`useFormSection` hook + `<FormActions />` molecule extraction** — Sprint 15+ candidate. Concrete API design needs the Design System Architect role.
- **`<MenuOverlay />` molecule extraction** — z-index discipline + click-outside + focus trap as a single reusable shell. Today: UserMenu, ContextSwitcher, ClubEventModal, future modal surfaces all reimplement.
- **#19 club calendar visual reproduction** — founder action. If reproducible, the next step is network tab capture.
- **#6 RWGPS app config** — founder action at https://ridewithgps.com/oauth/applications.
- **`useAthleteProfile` localStorage hook deprecation** — duplicates state with v11.2.0 server-backed profile API. Removed from `dashboard.tsx` (TabsLayout); still used by `OnboardingModal` until that refreshes (Sprint 15+).
- **Static-scan for hardcoded version strings outside the release-pattern files** — the brandBadge "v9" rot was preventable.
- **Atomic-design molecule extraction broadly** — Sprint 14 documented the discipline; Sprint 15 ships the molecules.

## Process notes

- **The "single bundled release" shape works for tester-readiness sprints.** The bug count was high but the risk theme was singular ("get the product readable to external testers"). Phase 5 audit's per-cluster verification keeps the bundle honest.
- **`feedback_xd-consult-on-any-ui-string.md` is now a hard pre-Phase-4 step.** Sprint 14's tester report itself was a delayed XD/BD consult; future releases (v11.4+, v12.x) should not skip this even when no obvious UI churn is planned — every release ships *some* UI string somewhere.
- **Sprint 14 ships in one calendar day with 6 atomic commits + 1 release commit.** The 4-doc shape (00-summary + 01-business-requirements¹ + 02-architecture-changes¹ + 03-cto-review) plus the 04-phase-5-parity-audit is the standard. ¹ — 01 + 02 docs were trimmed to a sprint-summary callout in 00 since this sprint had no new business requirements (founder's bug list IS the requirements) and no architecture changes (pure UX fixes).
- **Founder direction supersedes orchestrator preference for release shape.** Founder said "single bundled release"; orchestrator's `feedback_pre-coding-scope-alignment.md` would have suggested a split. Founder is PO; PO decision wins.

## Memory rules — created or validated this sprint

| File | Status |
|---|---|
| `feedback_pre-coding-scope-alignment.md` | **Re-validated with caveat** — single bundled release is acceptable when the risk theme is tester-readiness; per-cluster Phase 5 audit makes it safe |
| `feedback_xd-consult-on-any-ui-string.md` | **Re-validated** — Sprint 14 was the consequence of skipping this in earlier releases; the rule applies before tester feedback, not after |
| `feedback_static-scan-contracts.md` | **Re-validated** — no new contracts needed in v11.3.0; the existing 4 stayed green throughout |
| `feedback_pre-deploy-verification.md` | **Re-validated** — Phase 5 audit caught no new issues; documented investigations honestly |
| `feedback_release-readme-sweep.md` | **Re-validated** — README's Routes + Recent releases swept on the release commit |
| `feedback_release-ceremony.md` | **Re-validated** — single founder approval gate before deploy |
| `feedback_economy-model.md` | **Re-validated** — Sonnet for all 21 mechanical UX fixes; Opus reserved for none (no architecture decisions) |
| `feedback_sprint-documentation-mandatory.md` | **Re-validated** — 4-doc shape held; 01 + 02 trimmed to summary callouts |
| `feedback_three-role-architecture-consultation.md` | **N/A** — no architecture decisions in Sprint 14 |
| **NEW: `feedback_form-pattern-canonical.md`** | **Filed** — every editable form follows the same canonical save flow; silent failure is the regression class |
| **NEW: `feedback_atomic-design-extraction-from-bugs.md`** | **Filed** — when a tester pass surfaces 3+ bugs that all cluster into "X behaves differently across surfaces", extract the consistent pattern as an atom→molecule→organism + memory rule |

## Carry-forward for Sprint 15

- **`useFormSection` hook + `<FormActions />` molecule extraction.** Atomic-design step from `feedback_form-pattern-canonical.md`. New forms inherit the discipline by import.
- **`<MenuOverlay />` molecule extraction.** Sprint 14 fixed the immediate z-index bug; Sprint 15 codifies the pattern.
- **#19 club calendar visual reproduction.** Founder action; if reproducible, next debugging step is a network capture.
- **#6 RWGPS app config redirect URI.** Founder action at ridewithgps.com.
- **`useAthleteProfile` deprecation finish** — refresh `OnboardingModal` to PATCH `/api/me/profile` directly, then remove the localStorage hook entirely.
- **#49 AI year-end forecast (refined)** — v11.3.0 ships the linear projection; the AI-refined version remains future work.
- **#56 Club Share & Invite Flow** — engagement loop unlock; not yet started.
- **In-app surface migration to Layer 2 tokens (Today / Train / Schedule / Drawer)** — `/dashboard/you` is the proof-of-pattern; the rest of the surfaces follow.
- **Static-scan for hardcoded version strings** — preventable rot like the "v9" brandBadge.
