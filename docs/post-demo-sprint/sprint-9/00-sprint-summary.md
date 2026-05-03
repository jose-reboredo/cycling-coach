# Sprint 9 — Strava OAuth Modernization + Schedule Polish + Hotfix Cluster

**Dates:** 2026-05-02
**Version range:** v10.9.0 → v10.10.3 (5 releases — 1 major shape change, 1 polish, 3 hotfixes)
**Persona focus:** **A — Marco** primary
**Headline outcome:** Strava OAuth migrated to server-side D1 storage (matches RWGPS pattern from Sprint 8). AI plan auto-regenerates on Strava webhook events with the `user_edited_at` lock. Schedule polish trio (quick-add empty hour slots + repeat-weekly + route-card match reasons). Three hotfixes for the same release-cluster.

## Themes

| Theme | Issues | Net delivery |
|---|---|---|
| Strava OAuth → D1 (Migration 0012) | — | v10.9.0: tokens migrated from browser-side localStorage to server-side `strava_tokens` table. Browser keeps short-lived bearer for API calls; refresh handled server-side. |
| Phase D — auto-regenerate AI plan on Strava webhook + `user_edited_at` lock | — | v10.9.0: `/webhook/<secret>` posts a new activity → AI plan regenerates → `user_edited_at` rows preserved |
| Schedule polish trio + route-card match reasons | — | v10.10.0: quick-add (empty hour slot click) + repeat-weekly v1 + route cards explain why they were ranked (distance fit, elevation match, surface preference) |
| Hotfix: repeat-weekly + route picker proximity gate too strict | — | v10.10.1 |
| Hotfix² — repeat-weekly v3 + calendar accessibility + diacritic-tolerant geocoding | — | v10.10.2 |
| Hotfix³ — `useCancelClubEvent` cache invalidation + month-range padding | — | v10.10.3 |

## Releases shipped

| Version | Date | Headline |
|---|---|---|
| v10.9.0 | 2026-05-02 | Strava OAuth → D1 + Phase D auto-regenerate AI plan + `user_edited_at` lock |
| v10.10.0 | 2026-05-02 | Schedule polish trio + route-card match reasons (founder-bundled v10.10.0 + v10.11.0 worth) |
| v10.10.1 | 2026-05-02 | Hotfix: repeat-weekly + route picker proximity gate too strict |
| v10.10.2 | 2026-05-02 | Hotfix² — repeat-weekly v3 + calendar accessibility + diacritic-tolerant geocoding |
| v10.10.3 | 2026-05-02 | Hotfix³ — `useCancelClubEvent` cache invalidation + month-range padding |

## What landed vs planned

- **Planned:** Strava OAuth modernization + Phase D auto-regen + quick-add + repeat-weekly. Roughly mapped to two minor releases.
- **Shipped:** All planned scope landed in v10.9.0–v10.10.0. Then **3 hotfixes in v10.10.1 → v10.10.3**: each addressed a separate symptom but they were all symptoms of the same underlying architecture issue (cache invalidation + state contracts on the schedule surface). The hotfix cluster was the warning sign that the v10.11.x calendar reliability cluster was about to land.
- **Drift:** Hotfix density signals deeper structural debt. Founder + CTO recognized it post-v10.10.3 and Sprint 10 opened with "calendar reliability — review whole experience" as the explicit theme.

## Memory rules validated this sprint

- `feedback_pattern-replacement.md` — invoked but **not adopted** in time. Three hotfixes on adjacent symptoms (repeat-weekly v1 → v3, cancel invalidation, month-range padding) without stepping back to ask "what's the underlying contract that's broken?" Sprint 10 did the architectural review the hotfix cluster was begging for.
- `feedback_pre-deploy-verification.md` — failed in this sprint. None of the 3 hotfixes were caught by the static-endpoint smoke tests; all surfaced in founder use.
