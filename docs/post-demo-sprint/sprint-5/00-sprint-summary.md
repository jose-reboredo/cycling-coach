# Sprint 5 — Clubs Phase 3 + Personal Scheduler Foundations

**Dates:** 2026-05-01
**Version range:** v9.7.0 → v9.11.0 (15 releases — first release under "sprint retros + post-mortems mandatory" process)
**Persona focus:** **B — Sofia (Saturday-crew captain)** and **C — Léa (casual commuter)**
**Headline outcome:** Captain-grade clubs Schedule tab (Outlook-style multi-view) lands; personal-scheduler foundations follow; iOS Safari shipped to a usable state.

## Themes

| Theme | Issues | Net delivery |
|---|---|---|
| Clubs Schedule tab — Outlook-style scheduler + event detail drawer | `#57` | v9.7.1 closed `#57` end-to-end (Month + Week + Day grids + drawer) |
| Event model expansion + lifecycle | `#60`, `#69`, `#73` | 7 new columns on `club_events` (distance, surface, start_point, route_strava_id, etc.); Edit/Cancel/Unsubscribe lifecycle complete by v9.9.0 |
| Responsive nav consistency + iOS Safari hardening | `#59`, `#62`, `#65`, `#66`, `#67` | TopNav/BottomNav unified; line-icon library; iOS PWA standalone fixes |
| Architectural fix — Create Club modal → page route | `#71`, `#72` | v9.8.2 replaces stacking-context modal with `/clubs/new` route; founder-confirmed first-try fix |
| AI route discovery + cancelled-events filter + Overview Edit/Cancel | `#73`, `#74`, `#75` | v9.11.0 bundles three issues |
| Personal scheduler kick-off | `#61` | First slice of personal scheduler aggregator (matures in Sprint 6) |
| Privacy header removal | `#63` | Visibility chip removed; FTP-private-by-default already shipped in v9.6.2 |

## Releases shipped

| Version | Date | Headline |
|---|---|---|
| v9.7.0 | 2026-05-01 | Sprint 5 Phase 3 — clubs Schedule tab (Month-only first cut) |
| v9.7.1 | 2026-05-01 | `#57` Outlook-style multi-view scheduler + event detail drawer |
| v9.7.2 | 2026-05-01 | `#59` + `#62` Responsive nav consistency + CC line-icon library |
| v9.7.3 | 2026-05-01 | `#60` Event model expansion + lifecycle + `#63` Privacy header removal |
| v9.7.4 | 2026-05-01 | Hotfix — 5 UX bugs from `#66` visual review |
| v9.7.5 | 2026-05-01 | iOS Safari hardening — closes 3 P0/P1 issues from v9.7.4 visual verification |
| v9.8.0 | 2026-05-01 | First MINOR-correct feature release — closes `#60` AI-description piece |
| v9.8.1 | 2026-05-01 | Hotfix — Create Club modal stacking-context bug (`#70`) |
| v9.8.2 | 2026-05-01 | Architectural fix — Create Club modal replaced with dedicated page route. Closes `#71` (P0) + `#72` |
| v9.9.0 | 2026-05-01 | First MINOR-correct feature release — `#60` Edit UX (event lifecycle completion) + `#73` e2e drift fixes |
| v9.11.0 | 2026-05-01 | Bundled 4-issue release: Personal scheduler (`#61`) + cancelled-events filter (`#74`) + Overview Edit/Cancel (`#75`) + Landing copy rewrite |

(Versions 9.10.x skipped intentionally — non-shipping experimental cuts.)

## What landed vs planned

- **Planned (from `4-sprint-plan-2026-05.md` §A.iii):** Sprint 5 = clubs Phase 3 (Schedule + RSVP + drafted-description). One risk theme per release.
- **Shipped:** all of Phase 3 plus the start of personal scheduler (`#61`) and several iOS hardening rounds the plan didn't anticipate.
- **Drift:** iOS Safari took two unbudgeted hotfix rounds (v9.7.4 + v9.7.5) before the layout shipped clean. The Create Club P0 (`#71`) wasn't on the plan; it forced an architectural pivot mid-sprint (modal → page route, `#72`).

## Memory rules validated this sprint

- `feedback_pattern-replacement.md` — **invented + validated this sprint.** v9.8.0 → v9.8.1 hotfix → v9.8.2 architectural fix demonstrated the rule: after the third targeted patch on the modal stacking-context bug, replacing the pattern (modal → `/clubs/new` page route) was the first-try fix. Saved 5 preceding modal patches.
- `feedback_pre-coding-scope-alignment.md` — **invented this sprint.** v9.7.3 → v9.7.4 → v9.7.5 chain showed UI specs need a 2-min user preview before coding; otherwise BA/Architect drift surfaces only at visual review.
- `feedback_release-readme-sweep.md` — referenced; partial compliance only.
