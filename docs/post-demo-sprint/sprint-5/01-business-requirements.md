# Sprint 5 — Business Requirements

**Source:** `4-sprint-plan-2026-05.md` §A (Strategist) + §C (BA) + open backlog at v9.6.5.
**Wedge:** Persona B (Sofia, captain of a Saturday crew) and Persona C (Léa, casual commuter). Persona A (Marco, performance amateur) is well-served by v9.6.x — not the wedge.

## Hypothesis

If Cadence Club ships a captain-grade Schedule tab and a clean event-lifecycle (post / edit / cancel / RSVP), the Saturday-crew use case becomes operational. This is the differentiator vs Strava (no schedule), Komoot (no clubs), TrainerRoad (no clubs).

The bet locked in §A.iii of the 4-sprint plan: **(i) Saturday Crew operating system** over (ii) AI personal coach loop or (iii) mobile-first PWA polish. Sprint 5–6 owns the wedge; Sprint 7–8 closes Persona A loops.

## In scope

| Issue | Title | Effort | Persona |
|---|---|---:|---|
| `#57` | Clubs Schedule tab — multi-view (Month / Week / Day) + event detail drawer | ~12h | B |
| `#60` | Event model expansion: distance, surface, start_point, route — plus Edit + Cancel lifecycle | ~10h | B |
| `#61` | Personal scheduler aggregator — entry point for "what am I doing this week" across personal + club sources | ~8h (kickoff this sprint, completes in Sprint 6) | A + B |
| `#69` | AI-drafted event description (captain types one line; AI fills out details) | ~3h | B |
| `#73` | AI route discovery (`POST /api/routes/discover`) + e2e drift fixes from v9.6.x backlog | ~5h | A |
| `#74` | Cancelled-events filter on calendar surfaces | ~1h | B |
| `#75` | Overview tab Edit/Cancel parity with Schedule | ~2h | B |
| `#59`, `#62`, `#65`, `#66`, `#67` | Nav + iOS Safari hardening cluster | ~6h | All |
| `#63` | Visibility chip removal (FTP-private-by-default already shipped v9.6.2) | ~1h | A |

**Total estimate:** ~48h. Actual shipped: ~55h (iOS hardening took two unbudgeted hotfix rounds).

## Out of scope (explicitly deferred)

- **Clubs Phase 4 — Members search + invites.** Defers to Sprint 6 per the 4-sprint plan.
- **AI personal coach loop** (`#49`, `#52`). Sprint 7+.
- **Mobile-first PWA polish** (offline PMC, Lighthouse 95+). Sprint 8+.
- **Personal scheduler completion** — only the aggregator entry point this sprint; the `planned_sessions` data layer + 5 endpoints lands in Sprint 6.

## Acceptance criteria

A captain logs in and:
1. Switches between Month / Week / Day views without losing state. ✅ v9.7.1.
2. Clicks an event → opens the detail drawer with full event metadata, RSVPs, and Edit/Cancel actions. ✅ v9.7.1 + v9.9.0 (Edit/Cancel completion).
3. Posts a new event with title + duration + distance + surface; AI fills the description. ✅ v9.7.3 + v9.8.0.
4. Cancels an event from the Overview or Schedule tab; the event hides from the default calendar view but is recoverable. ✅ v9.11.0.
5. Cancelled events are filtered from the upcoming list by default. ✅ v9.11.0.

A casual commuter:
6. Opens the app on iPhone Safari (PWA, standalone) and the layout doesn't fall apart. ✅ v9.7.5 (after two hotfixes).

A performance amateur:
7. Opens AI route discovery and gets ride suggestions tied to their training prefs. ✅ v9.11.0.

## Process directives (locked at sprint open)

From `RELEASE_CHECKLIST.md` + the 4-sprint plan §B (process):
- **Sprint retros mandatory.** Every sprint closes with `03-cto-review.md`.
- **Bug post-mortems mandatory.** Every reverted hotfix or repeated regression class gets a post-mortem in `docs/post-mortems/`.
- **One risk theme per release.** No bundling unrelated changes; founder calls when bundling exception applies.
