# Sprint 10 — CTO Review

**Reviewed:** 2026-05-03 sprint close (post-v10.12.0)
**Releases:** 5 (4 in the cluster, 1 closing bundle)
**Reviewer:** CTO + Architect (Opus, in-session synthesis) — explicit pass requested by founder after the v10.10.x hotfix cluster
**Defining moment:** v10.11.2's discovery of `Cache-Control: private, max-age=300` on three success-path responses

## What worked

1. **Bottom-up architectural review found the bug 6 hotfixes had missed.** v10.11.0 + v10.11.1 fixed real issues at the React layer but didn't address the symptom because the symptom lived below them. v10.11.2 walked the stack from HTTP up and the cache-control header was the first thing that didn't pass smell-test. **Memory rule operationalized:** when a symptom-class survives multiple top-down patches, walk the stack from HTTP up.
2. **Defense-in-depth entry filter (v10.11.3).** Single-point invariant: every `/api/*` response has `Cache-Control: private, no-store` unless explicitly opted out. Backstops any future endpoint that forgets to set it. Sprint 11 then validated this with 8 contract tests (and Sprint 11 prep added 158 more).
3. **Repeat-aware drawer cleanly architected.** `recurring_group_id` is opaque, client-generated, validated server-side. Cascade is opt-in via query param, not implicit. `user_edited_at` lock prevents the cascade from clobbering hand-edited siblings. Designed at scope-alignment time, shipped first try.
4. **Calendar #80 fix used px instead of % positioning.** Same architectural shape as the v10.11.2 cache fix: the bug was below the layer everyone was inspecting. CSS `box-sizing: border-box` + explicit column height resolved the drift. Added 7 unit tests for the overlap algorithm so the fix is regression-locked.

## What regressed

1. **6 ineffective hotfixes from Sprints 7-9 traced back to insufficient test coverage of the regression-prone shape.** Pattern matching ("this looks like an invalidation bug") instead of investigating ("let me read the actual response headers"). **Memory rule re-validated:** `feedback_pre-deploy-verification.md` — and operationalized via static-scan contract tests.
2. **Confirmation bias on cache layers (top-down vs bottom-up).** Six hotfixes touched TanStack, Service Worker, useRef, refetchOnMount, await invalidations, and SW cache version. None touched HTTP cache headers. Bottom of the stack should be the FIRST thing inspected for a "stale data served" symptom, not the last.
3. **Pattern-replacement was not invoked early enough.** After the 3rd ineffective hotfix at end of Sprint 9, the move should have been "stop, review, replace pattern". Sprint 9 didn't do it. Sprint 10 did, in part because the founder explicitly demanded the architectural review.

## What we learned

- **Stop after 2 hotfixes that don't stick — switch to diagnostic mode.** The cost of one round of root-cause analysis is less than the cost of N targeted patches that miss. **New rule of thumb, informally adopted across Sprint 10 + 11.**
- **Static-scan contract tests for symptom-class regressions.** The cache-contract test (`worker-cache-contract.test.ts`) doesn't run a request — it reads `src/worker.js` as text and asserts the regression-prone shape isn't present. This is cheap, fast, and catches the exact class of drift that produced the v10.10.x cluster. Sprint 11 expanded this to 200+ tests.
- **Repeat-weekly v1 (Sprint 9) had a design hole**: sibling rows with no shared id meant cascade was impossible. Sprint 10 fixed the design (one column add); but the lesson is to **anticipate cascade needs at design time** for any feature that creates a row family.

## Tech debt accrued

- Two cascade paths through `planned_sessions` (AI plan vs repeat group). Opt-in flags keep them disjoint, but a single "what cascades when" decision doc would help the next contributor.
- `dashboard.schedule-new.tsx` reaching ~600 lines with create + edit + repeat-weekly + cascade. Refactor candidate.
- `EventDetailDrawer.tsx` lazy-loading not yet done.
- Smoke ladder is now 7 checks deep (was 4); discoverability of the ladder is an issue (it lived in CHANGELOG entries this sprint; Sprint 11's docs branch hoists it into the README runbook).

## Process notes

- **Founder-driven diagnostic mode.** Founder said "review the whole calendar logic" after v10.10.3. This authorization unlocked a mode of working we should pre-authorize: when a symptom-class persists, default to architectural review, not patches. **Saved as `feedback_diagnostic-mode-after-2-hotfixes.md` candidate** (informal so far).
- **Three-feature bundle in v10.12.0** (repeat-aware drawer + calendar #80 + RWGPS disconnect UI) was a founder-approved bundle. Worked because all three were mature designs by the time of bundling and none competed for attention.
- **v10.12.0 closes Sprint 10 cleanly.** v10.13.0 (Sprint 11 prep) was a separately-authorized autonomous overnight run.

## Memory rules — created or validated this sprint

| File | Status |
|---|---|
| `feedback_pattern-replacement.md` | **Re-validated** — cache-bug fix replaced the "patch every layer above" pattern with "walk the stack from HTTP" |
| `feedback_pre-deploy-verification.md` | **Operationalized** — static-scan contract tests now exist (`worker-cache-contract.test.ts`) |
| (new candidate) | "Stop after 2 hotfixes that don't stick" — informally adopted; not yet a saved file |

## Carry-forward for Sprint 11

- **Security audit** (single tech-lead pass; not a real pentest).
- **+30 contract tests** across the API surface (target landed at +158 actual).
- **README + Confluence rewrite** to Merkle quality.
- **Two named bugs** the founder reported during the v10.10.x cluster — Zurich-Positano hike recommendation + Zurich-anchor 2 km drift on generated routes.
- **Performance + pentest** — both backlog'd; need a real harness.

Sprint 11 then ran as four parallel autonomous agents per `SPRINT_11_HANDOFF.md`. Route-generation work shipped but founder confirmed post-deploy that the user-visible problem persists; flagged for a dedicated route-generation sprint (Sprint 12).
