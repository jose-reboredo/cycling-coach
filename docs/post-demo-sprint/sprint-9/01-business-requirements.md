# Sprint 9 — Business Requirements

**Source:** Reconstructed from CHANGELOG. Sprint 9 was emergent — no preceding plan doc analogous to `4-sprint-plan-2026-05.md`. Carry-forwards from Sprint 8's CTO review framed the scope.
**Wedge:** Persona A (Marco). Specifically the "AI plan stays fresh as I ride" loop.

## Hypothesis

(1) Strava OAuth tokens shouldn't live in localStorage. Sprint 8 demonstrated server-side OAuth (RWGPS) is cleaner and lower-attack-surface; Strava should match.

(2) The AI weekly plan goes stale within 48 hours of generation if the user actually rides. Auto-regenerating on every Strava activity arrival keeps the plan responsive — provided manual edits aren't clobbered (the v10.8.0 `user_edited_at` lock makes this safe).

(3) Quick-add (empty hour slot click → prefill schedule form) shaves 3 taps off the hot path. Repeat-weekly (one schedule → 4 sibling rows) shaves another 5 taps for users with stable training rhythms. Route-card "match reasons" make the picker explain itself.

## In scope

| Theme | Effort | Persona |
|---|---:|---|
| Strava OAuth migration to D1 (Migration 0012) | ~5h | A |
| Phase D auto-regenerate on webhook events | ~4h | A |
| `user_edited_at` flow through Phase D regen | ~2h | A |
| Empty-hour-slot quick-add (Week + Day grids) | ~2h | A |
| Repeat-weekly v1 (1 schedule → N rows on consecutive weeks) | ~3h | A |
| Route-card match reasons (why each route was ranked) | ~2h | A |
| Diacritic-tolerant geocoding (`Zürich` ≡ `Zurich`) | ~1h | A |
| Calendar a11y polish | ~2h | All |

**Total estimate:** ~21h. Actual shipped: ~30h (3 hotfix rounds added ~9h).

## Out of scope

- **Calendar reliability architectural review.** That's exactly what Sprint 10 became — but at the start of Sprint 9, the symptom-class wasn't yet visible to be scoped.
- **Repeat-aware drawer (cascade edit).** Sprint 10 (lands as v10.12.0).
- **Calendar #80 alignment + overlap.** Sprint 10.
- **RWGPS disconnect from Settings (You tab).** Sprint 10.

## Acceptance criteria

A performance amateur:
1. Logs in via Strava → tokens land server-side. Browser sees a short-lived bearer only. ✅ v10.9.0.
2. Rides on Saturday → Strava webhook fires → AI plan regenerates by Sunday morning with the new fitness data. ✅ v10.9.0.
3. Manually edited Tuesday's session → next regen does NOT clobber it. ✅ v10.9.0.
4. Clicks an empty 9:00 slot on Tuesday → `/dashboard/schedule-new` opens with date+time pre-filled. ✅ v10.10.0.
5. Schedules "Tuesday endurance, repeat 4 weeks" → 4 sibling rows appear on consecutive Tuesdays. ✅ v10.10.0 (with 3 follow-up hotfixes).
6. Picks a route → card shows "matches because: distance 32 km / elevation 450 m / mostly paved". ✅ v10.10.0.
7. Searches for "Zurich" or "Zürich" — both work. ✅ v10.10.2.

## Process directives reaffirmed

- **Hotfix density >2 in a sprint = stop and review.** Sprint 9 ignored this signal until v10.10.3; Sprint 10 then opened with the architectural review the cluster was demanding. **New rule of thumb baked in:** if a release surface needs 2+ hotfixes, the next move is bottom-up architectural review, not a third targeted patch.
