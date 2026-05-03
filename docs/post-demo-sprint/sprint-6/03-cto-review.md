# Sprint 6 — CTO Review

**Reviewed:** 2026-05-01 sprint close (post-v9.12.8)
**Releases:** 9 minor + hotfix cuts
**Reviewer:** CTO + Architect (Opus, in-session synthesis)

## What worked

1. **MVP-as-bundle.** v9.12.0 shipped the entire personal scheduler in a single cut: `planned_sessions` table + 5 endpoints + Add Session route + the aggregator extension. No drip-release. Tight cohesion meant zero "endpoint exists but UI doesn't use it" half-states.
2. **Cycling-canon time units.** v9.12.3 swap to hours-not-minutes was 30 minutes of code and instantly made every UI feel like it was made by someone who rides. Founder's domain expertise paid back disproportionately.
3. **Marketing ↔ product visual parity.** v9.12.6 SchedulePreview component → v9.12.7 calendar pill unification. Same component template in both places means the marketing screenshot is also a regression test.
4. **Allowlist-bound PATCH** stayed disciplined. Sprint 11 audit later found zero injection vectors here — credit the v9.12.0 reviewer's `setIfPresent()` discipline.

## What regressed

1. **v9.12.4 timezone bug.** Founder reported "I create event at 9am, calendar shows it at 11am". 8 sites used `getUTC*` for display when the DB stores UTC but the user lives in a TZ. Fix straightforward; symptom should never have made it past dev. **Memory rule re-validated:** `feedback_pre-coding-scope-alignment.md` — 2-min user preview before coding spec-driven UI.
2. **Landing page restructure → reverted.** v9.12.5 bundled "personal-session UX bundle + Landing page features sweep". v9.12.6 reverted the Landing piece because the founder didn't like the issue-grid replacing the marketing visual. Lesson: **personas don't share release scope cleanly when one targets users-in-app and the other targets visitors-on-marketing.** Should have been two releases.
3. **Desktop dashboard regression in v9.12.8.** Mobile-first thinking caused a desktop-tab pile-up. Caught + fixed in same release. Cost: a mid-day rollback risk that the founder absorbed.
4. **Cache-key entanglement.** When `planned_sessions` joined `/api/me/schedule`, the existing TanStack invalidation pattern from Sprint 5 didn't extend cleanly. Symptom went latent and surfaced as the v10.10–v10.11 calendar reliability cluster.

## What we learned

- **Bundling unrelated personas in one release is a process bug.** v9.12.5 + v9.12.6 demonstrate it. New rule of thumb: if scope spans users-in-app and visitors-on-marketing, those are two releases.
- **Timezone is a contract, not a UI detail.** Treat any new `Date` math as needing local-vs-UTC review. The DB-UTC + display-local pattern is right; but every `new Date(epoch * 1000).get*()` call needs to be intentional.
- **Negative-id-as-discriminator is fragile.** The `is_personal` flag is the source of truth; carrying both meant downstream code occasionally checked the wrong one. Pick one and remove the other in a future cleanup.

## Tech debt accrued

- Two cascade paths through `planned_sessions` start emerging here (`ai_report_id`). This is benign in Sprint 6 but compounds in Sprint 7 (`ai_plan_session_id`) and Sprint 10 (`recurring_group_id`). Consolidate someday.
- `useCancelClubEvent` and personal-session cancel hooks should share invalidation logic.
- `formatDuration` was duplicated across calendar components before being centralised; verify there's no remaining copy.

## Process notes

- **Founder pivot mid-sprint.** The original 4-sprint plan put clubs Phase 4–5 here; founder reprioritized to personal scheduler after v9.11.0 closed the captain wedge. The pivot was the right call — Persona A leverage was higher — but it left the planning doc stale. **Lesson: planning docs are living. Update `01-business-requirements.md` mid-sprint when scope shifts, don't wait until the retro.** Bake into the template.
- **No formal retro yet.** The 4-doc sprint folder structure didn't exist when this sprint shipped; this document is the post-hoc reconstruction (2026-05-03). Going forward, write the retro at sprint close.

## Memory rules — created or validated this sprint

| File | Status |
|---|---|
| `feedback_pre-coding-scope-alignment.md` | **Re-validated** by v9.12.4 timezone bug |
| `feedback_release-ceremony.md` | **Validated** by founder right-sizing v9.12.5/v9.12.6 |
| (new candidate) | "Don't bundle personas." Considered but not filed — covered by `feedback_pre-coding-scope-alignment.md`'s phase-shift rule |

## Carry-forward for Sprint 7

- AI plan integration on top of `planned_sessions` (`ai_plan_sessions` table + cascade).
- Individual dashboard restructure — Today / Train / Schedule reframe (v10.0.0).
- Cache-key contract for the aggregator. **Did not happen until Sprint 10–11.** Tracking as latent debt.
