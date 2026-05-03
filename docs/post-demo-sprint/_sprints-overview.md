# Sprints overview

Single index for every sprint of the post-demo phase. Updated at every sprint open + close.

| Sprint | Status | Dates | Version range | Persona wedge | Headline outcome |
|---|---|---|---|---|---|
| 1 | Closed | 2026-04-30 | v9.3.0 | A (security + mobile) | Sprint 1 of post-demo plan: 2 security CRITICALs + mobile 4-tab refactor + route discovery rewire + Migration 0004 |
| 2 | Closed | 2026-04-30 | v9.2.0 → v9.3.5 | A (audit close-out) | Four CRITICAL items: OAuth state CSRF (`#14`), `/refresh` token rotation, security headers, Sprint 1 follow-ups |
| 3 | Closed | 2026-04-30 | v9.5.0 → v9.5.2 | A (audit phase 2) | Phase 1 frontend stability + Phase 2 security hardening (3 fixes) + Phase 3 a11y + UI polish |
| 4 | Closed | 2026-04-30 | v9.6.0 → v9.6.5 | B (clubs Phase 1 + 2) | Clubs IA expansion: 4-tab Overview + Members tab + RSVP wiring + privacy-visibility plumbing |
| 5 | Closed | 2026-05-01 | v9.7.0 → v9.11.0 | B + C (clubs Phase 3) | Clubs Schedule tab (Outlook-style multi-view + drawer); event model expansion + lifecycle (`#60`); iOS Safari hardening; Create Club page route; cancelled-events filter |
| 6 | Closed | 2026-05-01 | v9.12.0 → v9.12.8 | A + B (personal scheduler MVP) | Personal scheduler v2 (planned-sessions data layer + 5 endpoints), mandatory duration, calendar timezone fix, personal-session UX bundle, AI brief → schedule bridge |
| 7 | Closed | 2026-05-01 | v10.0.0 → v10.5.4 | A (individual dashboard restructure + AI plan + route picker) | Today/Train/Schedule restructure; per-day Schedule buttons + streak counter; AI plan prefill modal; ORS route generation backend + drawer UX; CSP hardening |
| 8 | Closed | 2026-05-01 | v10.6.0 → v10.8.0 | A (route picker maturation + AI plan v2) | Three-tab honest route picker; Ride with GPS OAuth; goal-driven AI training plan (Phases A + B + C bundle) with `ai_plan_sessions` |
| 9 | Closed | 2026-05-02 | v10.9.0 → v10.10.3 | A (Strava OAuth modernization + schedule polish) | Strava OAuth → D1 + Phase D auto-regenerate AI plan + `user_edited_at` lock; schedule polish trio + route-card match reasons; 3 hotfixes (repeat-weekly + a11y + diacritic geocoding + cancel invalidation) |
| 10 | Closed | 2026-05-03 | v10.11.0 → v10.12.0 | A (calendar reliability + repeat-aware drawer) | Calendar reliability cluster — 5 interrelated bugs + cache root-cause (`Cache-Control: private, no-store`); repeat-aware drawer + cascade edit; GH `#80` calendar event-block alignment; RWGPS disconnect UI |
| 11 | In flight | 2026-05-03 | v10.13.0 → … | A (housekeeping) | Sprint 11 prep: security audit + 5-UPDATE WHERE hardening; +158 contract tests; README + Confluence rewrite to Merkle quality; route generation explicitly deferred to a focused sprint |
| 12 | Planned | TBD | TBD | TBD | **Reserved for the dedicated route generation sprint** (per founder decision 2026-05-03 after v10.13.0 deploy: route gen still not working despite sprint-11-bugs gates; needs end-to-end redesign with fixture-based harness) |

## Sources of truth

- Per-sprint planning + retro: `docs/post-demo-sprint/sprint-N/`
- Per-version detail: `CHANGELOG.md`
- Pre-existing 4-sprint plan that framed Sprints 5-8 a priori: `docs/post-demo-sprint/4-sprint-plan-2026-05.md`
- Process template: `docs/post-demo-sprint/_sprint-template.md`
- Memory rules validated across sprints: `~/.claude/projects/.../memory/`

## Process

1. **Sprint open** — write the four files in `sprint-N/` per `_sprint-template.md`. Update this index row.
2. **Sprint mid-flight** — keep `02-architecture-changes.md` honest as schema / endpoints land.
3. **Sprint close** — write `03-cto-review.md` with the real shipped scope, fill in summary outcome, update this index row.

Auto-memory rule (`feedback_sprint-documentation-mandatory.md`) enforces this for every future sprint.
