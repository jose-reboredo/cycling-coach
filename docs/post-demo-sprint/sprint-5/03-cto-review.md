# Sprint 5 — CTO Review

**Reviewed:** 2026-05-01 sprint close (post-v9.11.0)
**Releases:** 11 + 4 hotfixes = 15
**Reviewer:** CTO + Architect (Opus, in-session synthesis)

## What worked

1. **Outlook-style scheduler shipped first try.** v9.7.1 nailed the captain's mental model. No subsequent rework on the grid component contracts; they survived through Sprint 10's calendar reliability cluster largely intact (`MonthCalendarGrid` / `WeekCalendarGrid` / `DayCalendarGrid` + `EventDetailDrawer`).
2. **Page-route over modal — pattern replacement validated.** `#71` modal stacking-context bug had two preceding hotfix attempts (v9.8.0 + v9.8.1). v9.8.2's pivot to `/clubs/new` page route was the first-try fix and let us delete 5 modal patches. **Memory rule invented from this:** `feedback_pattern-replacement.md`.
3. **Allowlist-bound PATCH columns.** v9.9.0's `PATCH /api/clubs/:id/events/:eventId` shipped with `setIfPresent()` returning a column allowlist. Sprint 11's security audit later validated that no SQL injection surface exists on this route — credit Sprint 5's discipline.

## What regressed

1. **iOS Safari took two unbudgeted hotfix rounds.** v9.7.3 → v9.7.4 → v9.7.5. Root cause for both: founder review on actual iPhone PWA caught issues that the desktop dev loop didn't. **Memory rule invented:** `feedback_pre-coding-scope-alignment.md` — 2-min user preview before coding spec-driven UI.
2. **Modal stacking context (`#71`) shipped as P0 in v9.7.x bundle.** It had been latent since Sprint 4's clubs Phase 2; the new modal layer in v9.8.0 just made it visible. Fix took 3 attempts.
3. **Cancelled-events filter cache invalidation.** v9.11.0 shipped the filter; v9.12.x had to re-touch the cache key when planned sessions joined the same query. Symptom of insufficient cache-key contract — became part of the v10.11.x calendar reliability cluster much later.

## What we learned

- **One risk theme per release** is non-negotiable. v9.11.0 bundled four issues by founder request and we got away with it, but the cache-key entanglement above traces back to that bundle.
- **iOS PWA is a separate target.** Until v9.7.5 we treated mobile = small viewport. iPhone Safari standalone PWA has its own viewport math (`env(safe-area-inset-*)`), its own scroll-lock semantics, and renders modals differently from in-tab Safari. Recommend a dedicated iOS smoke checklist on every layout-touching release.
- **AI-drafted fields need a "user can override" path even on first cut.** v9.7.3 shipped AI description as text-input + Generate button. v9.7.4 hotfix added the override visibility because users edited the AI output and we silently re-overwrote on save.

## Tech debt accrued

- Drawer's date-math helpers duplicated across grids. Hoist into `Calendar/types.ts` — partially done; finish in a quiet sprint.
- v9.10.x slot intentionally skipped (failed experimental cuts). Don't reuse the version slot.
- Personal scheduler aggregator (v9.11.0) read-side only — the data layer + write-side ships in Sprint 6. Don't ship anything else that depends on personal sessions until v9.12.0 lands.

## Process notes

- **Sprint retros + bug post-mortems mandatory** lock-in (set as a process directive at sprint open) was honored. v9.7.5 + v9.8.2 each got a post-mortem entry referenced in the related issues.
- **Scope creep risk** when an architectural pivot mid-sprint (modal → page route) eats budget that was allocated to other items. Scoped the pivot tightly: only `/clubs/new` got the page-route treatment; the rest of the modal surface kept its existing behavior. Worth keeping the discipline next time.

## Memory rules — created or validated this sprint

| File | Status |
|---|---|
| `feedback_pattern-replacement.md` | **Created** from v9.8.0–v9.8.2 chain |
| `feedback_pre-coding-scope-alignment.md` | **Created** from v9.7.3–v9.7.5 iOS chain |
| `feedback_release-readme-sweep.md` | **Validated** — every `chore(release)` did sweep README's recent-releases list |

## Carry-forward for Sprint 6

- Finish the personal scheduler — `planned_sessions` table + 5 endpoints + Add Session UX (becomes v9.12.0).
- Cancelled-events cache-key contract: when planned sessions join the surface, ensure cache invalidation still fires correctly. **Did not happen cleanly — became the v10.11.x cluster.** Carry-forward into the v10.13.0 contract-test bundle (Sprint 11 prep).
- iOS Safari smoke checklist: add to `RELEASE_CHECKLIST.md` (didn't happen this sprint; carry-forward).
