# Sprint 10 — Calendar Reliability Cluster + Repeat-Aware Drawer

**Dates:** 2026-05-03
**Version range:** v10.11.0 → v10.12.0 (5 releases — 4 in the cache-fix cluster, 1 closing bundle)
**Persona focus:** **A — Marco** (the calendar surface user). Captain (B) inherits.
**Headline outcome:** The "edit doesn't register / cancel doesn't disappear" symptom class — which had survived 6 hotfixes from Sprint 7-9 — finally has a root cause. HTTP-level cache headers were the culprit. Sprint closes with v10.12.0's three-feature bundle (repeat-aware drawer + calendar #80 alignment + RWGPS disconnect UI).

## Themes

| Theme | Net delivery |
|---|---|
| Calendar reliability — five interrelated bugs in one pass | v10.11.0 (Promise.allSettled, hooks invalidation, useRef rehydrate, refetchOnMount, await invalidations) |
| Calendar architectural review fixes (CTO + architect bottom-up) | v10.11.1 (A + B + D from analysis) |
| **ROOT CAUSE FOUND**: browser served stale data for 5 minutes | v10.11.2 — three GET endpoints had `Cache-Control: private, max-age=300`. Browser cached the response and TanStack invalidate never reached network. Changed to `private, no-store`. |
| Defense-in-depth entry filter | v10.11.3 — `withApiCacheDefault()` on every `/api/*` response; 8 contract tests added (4 → 8) |
| v10.12.0 closing bundle | Repeat-aware drawer + cascade edit (Migration 0013 adds `recurring_group_id`); calendar #80 alignment + overlap rendering; RWGPS disconnect UI in Settings |

## Releases shipped

| Version | Date | Headline |
|---|---|---|
| v10.11.0 | 2026-05-03 | Calendar reliability — 5 interrelated bugs fixed in one pass |
| v10.11.1 | 2026-05-03 | Calendar architectural review fixes (CTO + architect pass) — A + B + D from analysis |
| v10.11.2 | 2026-05-03 | **ROOT CAUSE FOUND.** Browser served stale data for 5 min — cache headers were `max-age=300` |
| v10.11.3 | 2026-05-03 | Defense-in-depth entry filter for API cache headers + 8 contract tests |
| v10.12.0 | 2026-05-02 | Bundle: repeat-aware drawer + cascade edit, GH `#80` calendar alignment + overlap, RWGPS disconnect in Settings |

## What landed vs planned

- **Planned:** Architectural review of calendar surface; close out the v10.10.x cluster; ship the repeat-aware drawer + GH #80 + RWGPS disconnect UI.
- **Shipped:** All of it. The architectural review uncovered the 5-minute browser cache (Sprint 7-9 had blamed every layer above HTTP — TanStack, SW, hooks, components — for a symptom that was actually below them).
- **Drift:** none material. The cluster compressed 4 patches into one day because the founder explicitly switched to "diagnostic mode" after the 6th ineffective hotfix.

## Memory rules validated this sprint

- **`feedback_pattern-replacement.md`** — invoked deliberately. After the 6th ineffective hotfix, the move was bottom-up architectural review, not a 7th patch. Founder confirmed: "calendar logic esta roto desde que se ha anadido las repeticiones, revisa toda la logica del calendario."
- **`feedback_pre-deploy-verification.md`** — re-validated **and operationalized**. v10.11.3 added 8 cache-contract tests that statically scan worker.js for the regression shape. Sprint 11 then expanded this to 200+ tests.
- **(new) `feedback_diagnostic-mode-after-2-hotfixes.md`** — informally crystallised; not yet a saved memory rule but referenced repeatedly: stop after 2 hotfixes that don't stick.

## Sprint close

Sprint 10 explicitly closed at v10.12.0 deploy. v10.13.0 (Sprint 11 prep) was a separate authorized run of the autonomous overnight workstream.
