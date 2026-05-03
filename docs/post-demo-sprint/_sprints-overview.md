# Sprints overview

Single index for every sprint of the post-demo phase. Updated at every sprint open and close.

| Sprint | Status | Dates | Version range | Persona wedge | Headline outcome |
|---|---|---|---|---|---|
| 1 | Closed | 2026-04-30 | v9.3.0 | All personas (security + mobile) | Two security CRITICALs (`#33`, `#34`); mobile 4-tab dashboard refactor (`#51`); route discovery rewired to non-Strava data source (`#47`); Migration 0004 |
| 2 | Closed | 2026-04-30 | v9.3.5 | A + C (BYOK regression cleanup) | Two regression hotfixes (FB-R1 / FB-R2); mobile-viewport CI gate; annual goal data model (`#50`); AI year-end forecast (`#49`); Migration 0003 |
| 3 | Closed | 2026-04-30 | v9.5.0 → v9.5.2 | All personas (audit close-out + a11y) | Phase 1 frontend stability (3 fixes) + Phase 2 security hardening (3 fixes) + Phase 3 accessibility + UI polish (4 fixes) |
| 4 | Closed | 2026-04-30 | v9.6.0 → v9.6.5 | B (clubs Phase 1 + 2) | Clubs IA expansion across 4 tabs; Overview tab fully wired; Members tab + RSVP wiring; FTP-private-by-default; marketing landing rewrite |
| 5 | Closed | 2026-05-01 | v9.7.0 → v9.11.0 | B + C (clubs Phase 3 + scheduler kick-off) | Clubs Schedule tab (Outlook-style multi-view + drawer); event-model expansion + lifecycle (`#60`); iOS Safari hardening; Create Club page route; cancelled-events filter |
| 6 | Closed | 2026-05-01 | v9.12.0 → v9.12.8 | A + B (personal scheduler MVP) | Personal scheduler v2 (planned-sessions data layer + 5 endpoints); mandatory duration; calendar timezone fix; personal-session UX bundle; AI brief → schedule bridge |
| 7 | Closed | 2026-05-01 | v10.0.0 → v10.5.4 | A (individual dashboard restructure + AI plan + route picker) | Today/Train/Schedule restructure; per-day Schedule buttons + streak counter; AI plan prefill modal; ORS route generation backend + drawer UX; CSP hardening |
| 8 | Closed | 2026-05-01 | v10.6.0 → v10.8.0 | A (route picker maturation + AI plan v2) | Three-tab honest route picker; Ride with GPS OAuth; goal-driven AI training plan (Phases A + B + C bundle) with `ai_plan_sessions` |
| 9 | Closed | 2026-05-02 | v10.9.0 → v10.10.3 | A (Strava OAuth modernization + schedule polish) | Strava OAuth → D1; Phase D auto-regenerate AI plan + `user_edited_at` lock; schedule polish trio + route-card match reasons; 3 hotfixes (repeat-weekly, accessibility, diacritic geocoding, cancel invalidation) |
| 10 | Closed | 2026-05-03 | v10.11.0 → v10.12.0 | A (calendar reliability + repeat-aware drawer) | Calendar reliability cluster — 5 interrelated bugs and cache root-cause (`Cache-Control: private, no-store`); repeat-aware drawer + cascade edit; GH `#80` calendar event-block alignment; RWGPS disconnect UI |
| 11 | Closed | 2026-05-03 | v10.13.0 | Internal (housekeeping) | Security audit + 5-UPDATE WHERE hardening; +158 contract tests; README + Confluence rewrite to professional standard; route generation explicitly deferred to a dedicated sprint; sprint-documentation discipline established for every sprint going forward |
| 12 | In flight | 2026-05-03 → … | v11.0.0 (target) | All personas (first-impression craft) | Brand foundation + extended design system; three-layer token taxonomy; Inter + Source Serif Pro pairing self-hosted; Phosphor iconography; six priority components rebuilt; Marketing landing rebuilt as canonical reference page; `/impeccable` critique cycle as quality gate |
| 13 | Planned | TBD | TBD | A (route generation rebuild) | Reserved for the end-to-end route-generation rebuild — fixture-based harness, geocoding + ORS + scoring + post-validation + saved-route ranking + picker UX redesigned together rather than patched in isolation |

## Sources of truth

- Per-sprint planning and retrospective: `docs/post-demo-sprint/sprint-N/`
- Per-version release notes: `CHANGELOG.md`
- Sprint 5–8 framing document (written prior to Sprint 5 open): `docs/post-demo-sprint/4-sprint-plan-2026-05.md`
- Process template for new sprints: `docs/post-demo-sprint/_sprint-template.md`

## Process

1. **Sprint open** — create `sprint-N/`, populate the four files per `_sprint-template.md`, update this index row.
2. **Sprint mid-flight** — keep `02-architecture-changes.md` accurate as schema and endpoints land. Update `01-business-requirements.md` if scope shifts.
3. **Sprint close** — write `03-cto-review.md` with the real shipped scope, finalise the summary outcome, and update this index row.

The four-file shape is mandatory for every sprint and is enforced by an internal documentation rule.
