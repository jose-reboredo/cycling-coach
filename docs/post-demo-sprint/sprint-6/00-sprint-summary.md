# Sprint 6 — Personal Scheduler MVP + UX Bundle

**Dates:** 2026-05-01
**Version range:** v9.12.0 → v9.12.8 (9 releases)
**Persona focus:** **A — Marco (performance amateur)** primary, **B — Sofia (captain)** secondary
**Headline outcome:** Personal sessions become first-class on the calendar; users can plan, edit, complete, and cancel solo training. Calendar pills adopt the SchedulePreview marketing visual. Landing page restructure.

## Themes

| Theme | Issues | Net delivery |
|---|---|---|
| Personal scheduler v2 — data layer + endpoints + UX | `#76`, `#77`, `#78`, `#79` | v9.12.0: `planned_sessions` table + 5 endpoints + Add Session route + TopTabs alignment fix |
| Mandatory event duration + form polish | `#79` (partial) | v9.12.2: required asterisks, legend, BottomNav adapts to item count |
| Cycling-canon time units (hours, not minutes) | (founder feedback) | v9.12.3: durations rendered as `0.5h`/`1h`/`1.5h`; calendar blocks size to actual duration |
| Calendar timezone fix | (founder feedback) | v9.12.4: 8 sites switched from `getUTC*` to local accessors; RSVP chip hidden on personal sessions |
| Personal-session UX bundle | — | v9.12.5: Edit / Mark done / Cancel actions; Unsubscribe for club events; zone-coloured pills; SessionIcon |
| Landing page restructure | — | v9.12.6: marketing landing reframed around four value pillars + SchedulePreview component |
| Calendar pills marketing-visual unification | — | v9.12.7: in-app pills mirror SchedulePreview's bordered + bold + duration-tagged style |
| AI brief → calendar bridge | — | v9.12.8: `+ Add to schedule` button on the AI brief; desktop dashboard regression fix |

## Releases shipped

| Version | Date | Headline |
|---|---|---|
| v9.12.0 | 2026-05-01 | Personal Scheduler v2 — `planned_sessions` data layer + 5 endpoints + Add Session UX. Closes `#76`/`#77`/`#78`/`#79` |
| v9.12.1 | 2026-05-01 | Hotfix — two bugs from v9.12.0 visual review |
| v9.12.2 | 2026-05-01 | Partial `#79` polish bundle: mandatory duration + asterisks/legend + BottomNav adapts |
| v9.12.3 | 2026-05-01 | Duration in hours + calendar time-blocking |
| v9.12.4 | 2026-05-01 | Calendar timezone fix + hide "X going" on personal sessions |
| v9.12.5 | 2026-05-01 | Personal-session UX bundle + Landing page features sweep |
| v9.12.6 | 2026-05-01 | Landing page UX correction — back to a marketing landing |
| v9.12.7 | 2026-05-01 | In-app calendar pills adopt SchedulePreview marketing visual |
| v9.12.8 | 2026-05-01 | Desktop dashboard regression fix + AI brief → "Add to schedule" button |

## What landed vs planned

- **Planned (4-sprint plan):** Sprint 6 was framed as "clubs Phase 4–5" (Members search + invites + Circle Note).
- **Shipped:** the entire focus pivoted to the personal scheduler MVP. Members search + invites slipped to a later sprint (parts shipped opportunistically through v10.x; Circle Note still backlog as of Sprint 11).
- **Drift:** large. Founder reprioritized mid-sprint after v9.11.0 closed the captain-side wedge sufficiently and Persona A's "I want to plan my week" need surfaced as the higher-leverage bet.

## Memory rules validated this sprint

- `feedback_release-ceremony.md` — validated by the v9.12.5 → v9.12.6 reversal where the Landing page restructure shipped as part of a personal-session UX bundle and the founder pulled it back; right-sizing ceremony to release scope means a single founder call can revert a sub-theme without ceremony.
- `feedback_pre-coding-scope-alignment.md` — validated again by v9.12.4: founder-reported "I create event at 9am, calendar shows it at 11am" caught only after v9.12.3 shipped. 2-min user preview would have caught the timezone drift earlier.
