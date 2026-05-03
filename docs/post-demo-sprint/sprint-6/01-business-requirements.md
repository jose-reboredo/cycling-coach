# Sprint 6 — Business Requirements

**Source (planned):** `4-sprint-plan-2026-05.md` §B (clubs Phase 4–5).
**Source (shipped):** Founder reprioritization mid-sprint after v9.11.0 (clubs schedule was good enough; Persona A's solo training surfaced as higher leverage).
**Wedge as shipped:** Persona A (Marco — performance amateur). Persona B inherits via shared calendar surface.

## Hypothesis (as shipped)

If a user can plan their solo training the same way they plan club rides — same calendar, same pills, same drawer — Cadence Club becomes the single surface for "what am I doing this week", regardless of source. This deepens engagement well beyond the v9.6.x ride-tracking baseline and sets up the AI plan integration (Sprint 7+).

## In scope (as shipped)

| Issue | Title | Effort | Persona |
|---|---|---:|---|
| `#76` | Add planned_sessions DB table + minimal CRUD endpoints | ~4h | A |
| `#77` | Aggregator endpoint joins planned_sessions + club_events | ~3h | A |
| `#78` | "Add session" frontend route + form (zone, duration, distance) | ~5h | A |
| `#79` | Mandatory duration + asterisks/legend + BottomNav refresh | ~3h | All |
| (founder feedback) | Cycling-canon hours-not-minutes for duration display | ~2h | A |
| (founder feedback) | Calendar timezone fix — `getUTC*` → local accessors at 8 sites | ~3h | All |
| (UX bundle) | Personal-session lifecycle: Edit / Mark done / Cancel; Unsubscribe for club; zone-coloured pills | ~6h | A |
| (Landing) | Restructure landing around four value pillars + SchedulePreview marketing visual | ~5h | New users |
| (visual unification) | In-app calendar pills adopt SchedulePreview style | ~2h | All |
| (Train tab) | AI brief → "+ Add to schedule" bridge | ~2h | A |

**Total estimate:** ~35h (lower than Sprint 5; reflects narrower scope after founder pivot).

## Out of scope (deferred from the original plan)

- **Clubs Phase 4 — Members search + invite flow** (`#56`). Defers to Sprint 7+ (parts ship opportunistically through v10.x; Circle Note still backlog as of Sprint 11).
- **AI plan v2 / goal-driven planning.** Sprint 7 (lands as v10.8.0).
- **Mobile-first PWA polish.** Sprint 8+.

## Acceptance criteria

A performance amateur:
1. Schedules a 1.5h Z3 session for next Tuesday from `/dashboard/schedule-new`. ✅ v9.12.0.
2. Sees the session on the Month/Week/Day calendar with the right time + duration block. ✅ v9.12.3.
3. The displayed time matches their wall clock (not UTC). ✅ v9.12.4.
4. Edits the duration → saves → reopens the drawer; new duration sticks. ✅ v9.12.5.
5. Marks the session done → "✓ Completed on …" banner replaces the action buttons. ✅ v9.12.5.
6. Cancels a session → it hides from default views with a toggle to reveal. ✅ v9.12.5.
7. Pills carry zone color (`pill_personal_z{n}`) so intensity reads at a glance. ✅ v9.12.5.

A captain:
8. Calendar pills look like the marketing visual on the landing page. ✅ v9.12.7.

A new user landing on the marketing site:
9. Sees four value pillars (PMC, AI plan, route picker, club RSVP) and a SchedulePreview that matches the in-app calendar. ✅ v9.12.6.

## Process directives reaffirmed

- **One risk theme per release.** Honored except v9.12.5 (personal-session UX bundle + Landing features). Founder approved the bundle at scope-alignment time; later split (v9.12.6 reverted the Landing piece).
- **2-minute user preview for spec-driven UI.** v9.12.4 timezone bug would have been caught earlier.
- **Cumulative-schema rule.** `migrations/0008_planned_sessions.sql` shipped with `schema.sql` updated in the same commit.
