# Sprint 10 — Architecture Changes (Shipped)

Status: **closed**. Snapshot.

## Schema

| Migration | Version | Change |
|---|---|---|
| `0013_planned_sessions_recurring_group.sql` | v10.12.0 | ALTER `planned_sessions` ADD COLUMN `recurring_group_id TEXT`. Partial index `idx_planned_sessions_recurring_group(recurring_group_id) WHERE recurring_group_id IS NOT NULL`. |

Cumulative `schema.sql` updated in same commit.

## Endpoints (modified)

### Cache headers — root cause fix (v10.11.2)
Three endpoints had `Cache-Control: private, max-age=300` on success-path responses:
- `GET /api/clubs/:id/events?range=YYYY-MM`
- `GET /api/me/schedule?range=YYYY-MM`
- `GET /api/me/sessions?range=YYYY-MM`

Browser cached the response for 5 minutes. TanStack `invalidateQueries` triggered fetches but the browser short-circuited to the cached response without ever reaching the network. This is why every fix above the HTTP layer (TanStack, SW, hooks, components) was ineffective.

**Fix (v10.11.2):** changed to `private, no-store` on all three.

### Defense-in-depth entry filter (v10.11.3)
New helper `withApiCacheDefault(res, pathname)` in `src/worker.js`:
```js
function withApiCacheDefault(res, pathname) {
  if (!pathname.startsWith('/api/')) return res;
  const headers = new Headers(res.headers);
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'private, no-store');
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
```
Wired in `export default { fetch }` so every `/api/*` response runs through it before `withSecurityHeaders`. Endpoints that opt in to caching (e.g. `/roadmap` with `public, max-age=300`) keep their explicit setting; the helper only defaults missing headers.

### Repeat-aware cascade (v10.12.0)
- `POST /api/me/sessions` — accepts optional `recurring_group_id` (validated `^[a-f0-9]{8,32}$/i`).
- `PATCH /api/me/sessions/:id?cascade=group` — opt-in cascade. Updates the addressed row, then propagates the same patch (sans `session_date`) to siblings sharing the group id whose `user_edited_at IS NULL`.

## Frontend

### v10.11.x — calendar reliability cluster (in order)
- v10.11.0: `Promise.allSettled`, `useCancelClubEvent` cache invalidation, `useRef` rehydrate, `refetchOnMount: 'always'`, `await Promise.all([invalidateQueries...])` — 5 interrelated fixes. ALL of these were correct in isolation but didn't fix the symptom because the broken layer was below them.
- v10.11.1: A + B + D from the architectural review pass.
- v10.11.2: see "Cache headers — root cause fix" above.
- v10.11.3: contract tests + entry filter.

### v10.12.0 — repeat-aware drawer + GH #80 alignment + RWGPS disconnect

#### Repeat-aware drawer (Item 2)
- `apps/web/src/components/Calendar/EventDetailDrawer.tsx` — when `event.recurring_group_id != null`, render a "Repeat · Part of weekly repeat" meta row above the action buttons.
- `apps/web/src/routes/dashboard.schedule-new.tsx` — multi-week create generates a `recurring_group_id` via `crypto.getRandomValues`. Edit form surfaces "Apply changes to all N upcoming repeats" checkbox when the session has a group AND ≥1 upcoming sibling with `user_edited_at IS NULL`.
- Mappers in `dashboard.schedule.tsx` + `TodayDossier.tsx` thread the group id from `planned_sessions` into `CalendarEvent`.

#### Calendar #80 alignment + overlap (Item 3)
New shared module `apps/web/src/components/Calendar/layout.ts`:
- `HOUR_PX = 40` constant (matches `.weekHourSlot` height).
- `computeOverlapColumns(events)` — greedy left-to-right column assignment for events overlapping in clock-time.

`WeekCalendarGrid.tsx` + `DayCalendarGrid.tsx` switched from `top: X%` / `height: Y%` to **px-based positioning**. Killed the per-hour drift caused by `.weekHourSlot`'s `border-bottom: 1px` inflating column height beyond the math.

CSS fix in `Calendar.module.css`:
- `.weekHourSlot { box-sizing: border-box; }` so total slot height = exactly 40 px.
- `.weekDayCol { height: 640px; }` explicit (was implicit; mismatched the slot stack).

7 new contract tests in `Calendar/__tests__/layout.test.ts`.

#### RWGPS disconnect UI (Item 1)
- `apps/web/src/routes/dashboard.you.tsx` — new card after Strava. Loading / Connected (with Disconnect button) / Not connected (with Connect button) states. Calls existing `disconnectRwgps()` from `routesApi.ts`.

## Infra

- No new Worker secrets.
- SW cache name bumped `cycling-coach-v10.10.x` → `cycling-coach-v10.12.0`.

## Observability

- New static-scan tests (`worker-cache-contract.test.ts`, 8 cases) lock the contract:
  - Per-endpoint regression guards (the 3 user-reported endpoints).
  - Entry-filter assertions (function exists, default header correct, applied in fetch).
  - Public endpoint sanity (`/roadmap` allowed to cache).
  - Endpoint inventory (`KNOWN_API_GET_PATHS` — fails on undocumented additions).

## Smoke-check ladder (rebuilt this sprint)

| Check | Surface |
|---|---|
| Footer reads target version | Every page |
| **DevTools Network → `/api/me/schedule` Response Headers contain `Cache-Control: private, no-store`** | DevTools |
| **Mutation roundtrip: open session → edit duration → save → close drawer → reopen → new value** | Drawer flow (the test that 6 prior hotfixes failed) |
| Repeat-weekly creates 4 siblings with shared `recurring_group_id` | Schedule + DevTools D1 |
| Cascade edit with toggle on propagates to upcoming siblings, skipping `user_edited_at` ones | Drawer flow |
| Week / Day grids: events at correct time + overlapping events side-by-side | Calendar |
| Settings → RWGPS card shows correct Connect/Disconnect state | You tab |

## Tech debt accrued

- **Two cascade paths through `planned_sessions`** (`ai_plan_session_id` from Sprint 8 + `recurring_group_id` from this sprint). v10.12.0 ships the group cascade as opt-in; the AI cascade remains separate. Belongs in a "what cascades when" decision doc.
- `dashboard.schedule-new.tsx` is now ~600 lines with both create and edit flows + repeat-weekly + cascade toggle. Refactor candidate.
- `EventDetailDrawer.tsx` continues to grow (drawer + drawer-embedded route picker); ~30 kB gzipped.
