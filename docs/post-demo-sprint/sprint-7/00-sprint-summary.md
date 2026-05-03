# Sprint 7 — Individual Dashboard Restructure + AI Plan + Route Picker Backend

**Dates:** 2026-05-01
**Version range:** v10.0.0 → v10.5.4 (10 releases including hotfix² for CSP)
**Persona focus:** **A — Marco** primary
**Headline outcome:** Major dashboard restructure (Today / Train / Schedule). Per-day "Schedule" buttons + streak counter on Today. AI prefill modal lands. Route generation backend (`POST /api/routes/generate`) and the in-app drawer that wires it.

## Themes

| Theme | Issues | Net delivery |
|---|---|---|
| Dashboard restructure (MAJOR) | — | v10.0.0 reframes Today as a today-only dossier; planning + AI brief move to Train tab |
| Per-day "+ Schedule" + streak counter | — | v10.1.0 ships per-day buttons on the AI weekly plan + consecutive-day streak chip on Today |
| AI plan → calendar prefill modal | — | v10.2.0 — clicking "+ Schedule" opens a confirmation modal pre-filled from the AI plan; smarter duration estimation when explicit duration is missing |
| Layout: salutation + sync chip + streak above TopTabs | — | v10.3.0 lifts the trio above tabs (matches club view); prefill modal visual fixes |
| Route generation backend | `#82` | v10.4.0 ships `POST /api/routes/generate` (ORS-based loop generation, scored on distance/elevation/surface/overlap, KV-cached, auth-gated, rate-limited 10/3600s) |
| Route picker drawer UX | — | v10.5.0 wires the v10.4.0 backend in the EventDetailDrawer; address input (Nominatim), 3 ranked route cards, GPX-Strava handoff. Salutation styling matches club-name template; modal duration rounded to 0.5h |
| CSP for Worker dynamic responses | — | v10.5.1 (attempt) and v10.5.2 (actually applied to `_headers` for static assets) |
| Hotfix: route generator returns 3+ routes | — | v10.5.3 — was returning 1 |
| Two route picker fixes — explicit Strava handoff + "Show Strava routes" CTA | — | v10.5.4 |

## Releases shipped

| Version | Date | Headline |
|---|---|---|
| v10.0.0 | 2026-05-01 | Individual dashboard restructure — major |
| v10.1.0 | 2026-05-01 | Per-day "+ Schedule" buttons + consecutive-day streak counter on Today |
| v10.2.0 | 2026-05-01 | AI plan → calendar prefill modal + smarter duration estimation |
| v10.3.0 | 2026-05-01 | Layout: salutation + sync chip + streak chip lifted above TopTabs |
| v10.4.0 | 2026-05-01 | Route generation backend (`POST /api/routes/generate`) |
| v10.5.0 | 2026-05-01 | Route picker drawer UX wires the v10.4.0 backend |
| v10.5.1 | 2026-05-01 | Hotfix attempt 1 — CSP for dynamic Worker responses |
| v10.5.2 | 2026-05-01 | Hotfix² — CSP fix actually applied to `_headers` |
| v10.5.3 | 2026-05-01 | Hotfix — route generator returns 3+ routes again (was 1) |
| v10.5.4 | 2026-05-01 | Two route picker fixes: explicit Strava handoff + "Show Strava routes" CTA |

## What landed vs planned

- **Planned (4-sprint plan §A.ii):** Sprint 7 = AI personal coach loop (`#49` forecast + `#52` profile + adaptive plan).
- **Shipped:** all of the planned scope (per-day Schedule + streak counter + prefill modal) PLUS the route generation backend (which the original plan put as a stretch goal). v10.5.x then absorbed three CSP and routing hotfixes.
- **Drift:** route generation pulled forward from Sprint 8 because the AI plan loop felt incomplete without a "schedule this and pick a route" path. Justified bundling.

## Memory rules validated this sprint

- `feedback_pattern-replacement.md` — re-validated by the v10.5.1 → v10.5.2 CSP chain. The fix in v10.5.1 applied CSP to dynamic Worker responses but missed the static-asset `_headers` file; v10.5.2 was the structural fix. Same shape as Sprint 5's modal → page route arc.
- `feedback_pre-deploy-verification.md` — **invented this sprint** via the v10.5.3 "1 route instead of 3" regression. The planted-test was a static endpoint check that didn't exercise the regression surface. Smoke what changed, not static endpoints.
