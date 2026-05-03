# Sprint 8 — CTO Review

**Reviewed:** 2026-05-01 sprint close (post-v10.8.0)
**Releases:** 3 minor — lowest count of any sprint, highest density per cut
**Reviewer:** CTO + Architect synthesis

## What worked

1. **Design doc preceded the bundle.** v10.7.0 shipped the goal-driven AI plan design doc (no code change). v10.8.0 shipped Phases A + B + C as one cohesive release. Zero immediate hotfixes — the plan-doc pass paid off. **Validates `feedback_pre-coding-scope-alignment.md`.**
2. **Three honest tabs.** Founder's UX call (v10.6.0) replaced a confusing mixed-source picker with three explicit tabs. The architecture (one component, three sub-tabs with distinct fetchers) became the canonical shape — survived through Sprint 11.
3. **Server-side OAuth.** RWGPS tokens never touched the browser. Lower attack surface than Strava's browser-side flow at this point in the project. Sprint 9 then matched Strava to this pattern (v10.9.0).
4. **`user_edited_at` lock.** Simple, robust pattern: stamp the column when a user edits, AI auto-regen skips rows where it's set. Sprint 10's repeat-group cascade later inherited the same lock pattern.

## What regressed

1. **`idx_planned_sessions_ai_plan` missing from `schema.sql` cumulative.** The migration created it; the cumulative file didn't get the line. Caught by Sprint 11's contract test, not by review. Severity Low (production runs migrations) but a discipline failure relative to v9.2.0's rule. **Memory rule re-validated:** `feedback_release-readme-sweep.md` (the cumulative-schema sub-rule).
2. **RWGPS token storage plain-text.** The secret name `RWGPS_AUTH_TOKEN_ENCRYPTION_KEY` exists but no encryption was actually applied. Filed in `SPRINT_11_BACKLOG.md` as a security item. Compensating control: D1 access requires Worker-level credentials.
3. **`ai_plan_session_id` cascade is the second cascade path through `planned_sessions`.** Adding to the structural complexity that compounds in Sprint 9 + 10.

## What we learned

- **Bundles are fine when scoped to one risk theme.** v10.8.0's Phases A + B + C all touch goal-driven planning. They share success criteria, share rollback risk, and share the user's mental model. Bundling Phases of one feature is structurally different from bundling unrelated features.
- **OAuth design ahead of implementation pays.** v10.7.0's design doc spent 4 hours (write + review). v10.8.0 implementation shipped clean with no rework. The 4 hours saved well over 4 hours of hotfix overhead.

## Tech debt accrued

- Three cascade-update paths through `planned_sessions` after this sprint:
  1. `ai_report_id` (Sprint 6) — links to `ai_reports` for legacy plan-vs-report wiring.
  2. `ai_plan_session_id` (this sprint) — links to `ai_plan_sessions` for cascading auto-regen.
  3. (later) `recurring_group_id` (Sprint 10) — cross-week sibling cascade.
  Consolidate with a clear "what cascade fires when" table somewhere visible.
- RWGPS token encryption-at-rest is real backlog.
- `SessionRoutePicker` is reaching the size where refactor pays back.

## Process notes

- **3 releases / sprint is comfortable** for high-cohesion work. v10.x cadence is settling: 1 major surface bet per release; design doc preceding implementation when scope > ~10h.
- **Confluence release pages getting noisy.** v10.6 + v10.7 + v10.8 each created a child page. Per-release granularity is right; what's missing is a per-sprint roll-up. Sprint 11's docs branch later upgraded `documentRelease()` to add migration + breaking-change callouts.

## Memory rules — created or validated this sprint

| File | Status |
|---|---|
| `feedback_pre-coding-scope-alignment.md` | **Re-validated** by v10.7.0 design doc → v10.8.0 clean ship |
| `feedback_economy-model.md` | **Validated** by Phase B's Haiku-for-system-paid choice |
| `feedback_release-ceremony.md` | **Validated** by Phases A+B+C bundling decision |

## Carry-forward for Sprint 9

- Strava OAuth → D1 (match the RWGPS server-side pattern; v10.9.0 ships this).
- Phase D — auto-regenerate AI plan on Strava webhook events. Wire `user_edited_at` lock through this regen path.
- Quick-add sessions (click empty hour slot → schedule). Tactical UX.
- Calendar reliability cluster surfaces here (start of v10.10.x → v10.11.x cluster). **Did not get fully resolved until Sprint 10.**
