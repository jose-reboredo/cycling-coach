# Sprint 10 — Business Requirements

**Source:** Founder request after v10.10.3: "the rest is no ok. review the whole experience, logic, previous releases, add more logic if needed. my hyphotesis maybe you shuld check, calendar is not working and every hotfix its not solving it, errors persists." (2026-05-03)
**Wedge:** Persona A reliability. The calendar surface had to *work*.

## Hypothesis

The calendar reliability symptom-class ("edit doesn't register / cancel doesn't disappear / event time off by hours") had survived 6 hotfixes because every fix targeted a layer ABOVE the actual broken layer. A bottom-up architectural review — starting at HTTP response headers and working up through Service Worker → TanStack invalidation → component state — would surface the actual contract that was broken.

## In scope

| Theme | Effort | Persona |
|---|---:|---|
| Architectural review (CTO + architect pass) | ~3h | Internal |
| HTTP `Cache-Control` audit on every `/api/*` GET | ~2h | A |
| Root-cause fix (3 endpoints with `max-age=300`) | ~1h | A |
| Defense-in-depth entry filter on every `/api/*` response | ~2h | A |
| 8 cache-contract tests (4 → 8) | ~2h | Internal |
| Repeat-aware drawer with `recurring_group_id` cascade (Migration 0013) | ~5h | A |
| Calendar `#80` alignment fix (px positioning + overlap rendering) | ~4h | A + B |
| RWGPS disconnect UI in Settings (You tab) | ~2h | A |

**Total estimate:** ~21h. Actual shipped: ~24h.

## Out of scope (deferred)

- **AI plan repeat-group integration.** v10.12.0 ships the schema (`recurring_group_id`); the AI side stays on `ai_plan_session_id`. Bundling AI cascade + group cascade in one release was a footgun (two cascade paths through the same row).
- **Today inline route shortcut.** Founder deferred pending design alignment.
- **Performance + pentest.** Backlog'd to Sprint 11 prep.
- **Documentation rewrite to Merkle quality.** Backlog'd to Sprint 11 prep.

## Acceptance criteria

A performance amateur:
1. Edits a session's duration → save → close drawer → reopen drawer → new value visible. ✅ v10.11.2 (root-cause fix).
2. Cancels an event → calendar cell shows the event hidden / cancelled state immediately. ✅ v10.11.2.
3. Schedules a 4-week-repeat → all 4 sibling sessions appear with the same `recurring_group_id`. ✅ v10.12.0.
4. Edits one session of the repeat with "Apply to all upcoming repeats" toggle on → siblings cascade-update (skipping any with `user_edited_at` set). ✅ v10.12.0.
5. Opens the calendar Week view with overlapping events → events render side-by-side, each at the correct time. ✅ v10.12.0.
6. Opens Settings (You tab) → RWGPS card shows Connect or Disconnect button as appropriate. ✅ v10.12.0.

A reviewer running the post-deploy contract tests:
7. `npm run test:unit` → 35 tests pass (was 27 before v10.11.3). ✅.

## Process directives reaffirmed + new

- **Stop after 2 hotfixes that don't stick — switch to diagnostic mode.** Operationalized this sprint after v10.11.x cluster.
- **Bottom-up review.** When a symptom class survives multiple top-down patches, walk the stack from HTTP up. The cache bug had been invisible because every prior diagnosis started at the React layer and didn't go below.
- **Static-scan contract tests for regression-prone shapes.** Locked in via v10.11.3's `worker-cache-contract.test.ts`. Pattern then expanded across Sprint 11.
