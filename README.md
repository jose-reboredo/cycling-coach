# Cadence Club

Cycling clubs with an AI training brain. PMC for the solo rider; Overview / Schedule / Members / Metrics with AI-drafted Circle Notes for the club. Built for three personas: **Marco** (performance amateur, Zürich, FTP 285), **Sofia** (Saturday-crew captain), **Léa** (casual commuter who wants to belong).

**Current release: [v9.12.8](./CHANGELOG.md#9128--2026-05-01)** · 2026-05-01 · [Security](./SECURITY.md)

## What's new in v9.12.8

**Desktop dashboard regression fix + AI brief → "Add to schedule" button.** Quick-win bundle #1 of 5 (Sprint 5 close-out). Single risk theme: primary dashboard surface complete on every viewport. **Bug**: founder reported "the desktop version of my dashboard doesn't show the top bar menu as clubs does, so user sees today" — root cause was `computeTabsEnabled()` in `lib/featureFlags.ts` defaulting to `(max-width: 1023px)`, a leftover from the v9.3.1 mobile-first rollout. Founder-lock 2026-05-01 design rule says "desktop = top tabs always" but the flag was never updated. Net effect: on desktop, the user landed on `/dashboard/today`, the parent `dashboard.tsx` route saw `tabsEnabled=false`, rendered the legacy single-page `<Dashboard />` instead of `<TabsLayout>`, so neither `<TopTabs>` nor `<Outlet />` mounted. Fix: `computeTabsEnabled()` now defaults to `true` on every viewport; legacy `<Dashboard />` is reachable only via the kill-switch override `localStorage.cc_tabsEnabled = 'false'`. Removed the now-unused `MOBILE_QUERY` constant + `matchMedia` listener; added a `'storage'` event listener so a manual flag flip in DevTools applies without a full reload. **Feature**: Today tab gets a new **"+ Add to schedule"** button next to "Start workout in Strava" — bridges the AI coach brief to the personal scheduler in one click. New `parseAiSession(text)` helper does best-effort regex extraction from the free-text AI brief: title (first sentence, capped at 200 chars), `duration_minutes` (matches "1h 15m" / "1.5h" / "90 min", clamped to 0–600), `zone` (explicit "Z3" first, else keyword fallback: recovery/easy → 1, endurance/base → 2, tempo → 3, threshold/sweet-spot → 4, vo2/interval → 5, anaerobic → 6, sprint/neuromuscular → 7), `target_watts` (matches "252 W" / "270W", validated 50–2000). Full AI text preserved in `description` regardless. POSTs via existing `useCreatePlannedSession` hook with `source: 'ai-coach'` for future analytics. Default scheduled time = today at 18:00 local; user can edit via drawer. Button states: `+ Add to schedule` → `Saving…` → `✓ On your schedule`. No backend, no schema, no new endpoint — `planned_sessions.source` allowlist already includes `'ai-coach'` (Migration 0008). Bundle: dashboard.today chunk +1.5 KB. Quick-wins #2–#5 still queued: Streak counter (v9.12.9), Quick-add from empty calendar cell (v9.12.10), Repeat-weekly toggle on Plan a Session (v9.12.11), Week-summary footer on Schedule (v9.12.12).

## What's new in v9.12.7

**Calendar pills adopt the SchedulePreview marketing visual.** Founder feedback after v9.12.6: "make the scheduler individual and club look as the one into the landing/marketing page, it's really good. I like the bubbles in colors with this bold and time." The marketing-page mini-week (the one with bold titles, zone-coloured bordered pills, and mono duration tags like "1.5h") had become the founder's canonical look. v9.12.7 transfers that aesthetic to the actual in-app calendar grids — Month, Week, Day — across both `/dashboard/schedule` (personal scheduler) and `/clubs/:id/schedule` (club tab), since they share the same Calendar primitives. Three changes: (1) **borders** — every event-type and zone modifier (`pill_ride` / `pill_social` / `pill_race` + `pill_personal_z1`…`pill_personal_z7` + `pill_personal_default`) now has a 1px border at 0.32-alpha matching the background hue; the base `.pill` / `.weekEvent` / `.dayEvent` rules carry a transparent base border so the modifier can fill it without changing layout (`border-box` keeps width stable). (2) **bold titles** — `.pillTitle` is now `font-weight: 600` (was 500); `.dayEventTitle` was already 600. (3) **duration chips** — new helper `formatDuration(mins)` in `Calendar/types.ts` returns cyclist-canon decimal hours: 90 → "1.5h", 60 → "1h", 45 → "0.75h", 75 → "1.25h" (handles legacy non-canonical durations via 2-decimal precision fallback). Added to all 3 grids as a mono small-opacity chip: Month pills get `<span class="pillDur">` end-anchored; Week pills get `<span class="weekEventDur">` below title; Day pills get a new `dayEventTopRow` flex container with time + duration side-by-side. Slight padding/radius bump: pill 2px 4px → 3px 6px, radius `var(--r-1)` → 4px (matches SchedulePreview pill metrics exactly). Hover states unchanged (still `filter: brightness(1.15)`). Cancelled-event line-through still applies on the bold title via the existing `.cancelled` modifier. **No data layer change** — `duration_minutes` was already on the wire since v9.12.2 (`club_events`) and v9.12.0 (`planned_sessions`); this release just renders it. Tooltip on Month pills now also includes the duration: e.g. `"Saturday Crew · 2.5h · 8 going"`. Bundle: calendar chunk +0.4 KB (CSS additions + helper), no new dependencies. **No backend, no schema, no app feature change** — pure visual polish to bring the in-app calendar level with the marketing landing.

## What's new in v9.12.6

**Landing page UX correction — back to a marketing landing.** Founder feedback after v9.12.5: "the 'what you get' landing is not a list of issues delivered — it's a list of features our personas can use. It's a marketing landing page. The first part with №1, №2 and the training examples is very good. So pick functional features we are adding (with value for the final user) and do this marketing landing — the goal is to share with potential members of the app, they need to see what they get and understand the value of using our app." Right call. v9.12.5's "Built · Shipping next" 2-column issue grid (15 + 8 line-items) was an engineering log — wrong framing for the conversion surface. **Removed entirely** in v9.12.6 (along with its `.builtSection` / `.builtGrid` / `.builtCol` / `.builtTag` / `.inlineLink` CSS). FeatureSpread #02 reverted from "Plan and ride structured sessions" framing back to the original **"Today's session, ready to ride / One tap. The workout, the zones, the watts."** — the AI-coach value pillar that landed well in cyclist-friend feedback. Slight tightening: "Routes from your saved Strava list…" line softened to focus on what's live (zone-tagged blocks, target watts, completion → form curve) since the route picker isn't shipped yet. **NEW FeatureSpread #03 — "Your week, on one calendar"** — surfaces the Sprint 5 hero feature (personal scheduler) as a marketing value pillar where it belongs. Kicker: "Solo sessions + club rides — same surface, zone-coloured." Body explains: block out a sweet-spot day in seconds, personal sessions next to club rides, colour-coded by zone, calendar honest about your time (a 2-hour ride visually books two hours), edit/swap/mark-done/cancel from the drawer. **NEW SchedulePreview visual component** — page-local, brutalist mini-week showing 6 days with zone-coloured pills (Z1 Recovery in blue, Z2 Endurance in green, Z3 Tempo in yellow, Z4 Sweet-spot in orange) plus a Saturday Crew club ride pill in accent — visual proof of the "one calendar" promise. Mirrors WorkoutPreview's brutalist look (dark surface, monospace day labels, sharp pill rows). FeatureSpread #04 (was #03) is the existing club layer block — kicker updated to "Overview · Schedule · Members · Metrics" reflecting the actual 4-tab club shell. The full WHAT-YOU-GET section now reads: **№01 Daily form · №02 Today's session · №03 Your week · №04 Club layer**. Each is a value pillar a Marco/Sofia/Léa would recognise. Bundle: landing chunk -3 KB (issue grid removed) + 2 KB (SchedulePreview) = net -1 KB. **No backend, no schema, no app feature change** — this is a pure marketing-surface correction. Roadmap detail still lives at [/whats-next](https://cycling-coach.josem-reboredo.workers.dev/whats-next) which is the right surface for it.

## What's new in v9.12.5

**Personal-session UX bundle (carryover from v9.12.2) + Landing page features sweep.** Single risk theme: the personal session is now a first-class citizen on the calendar and in the drawer. Three items wired to existing endpoints (no schema, no worker change beyond version bump). (1) **Visual differentiation** — `SessionIcon` (1.6px stroke, three rising bars evoking interval structure, joins the icon family in `design/icons/index.tsx` next to RideIcon/SocialIcon/RaceIcon) + zone-coloured pills on Month/Week/Day grids using the existing `--c-z1`…`--c-z7` tokens (Strava-aligned: blue/green/yellow/orange/red/purple/violet, AA-compliant since v9.1.4). Personal sessions without a zone fall back to neutral grey ("untargeted"). (2) **Drawer mutations** for personal sessions — Edit / ✓ Mark done / Cancel buttons with inline-confirm pattern (matches existing club Cancel UX). Mark done PATCHes `completed_at` (allowlist already accepted it since v9.12.0); drawer then shows "✓ Completed on [date]" banner. Edit reuses `/dashboard/schedule-new?id=N&range=YYYY-MM` page route — same template, edit mode hydrates from the cached `useMyScheduleByMonth` query, PATCH on submit. (3) **Unsubscribe** button for club events — shown when caller is RSVP'd to a club ride they didn't create; wires to existing `useRsvp({status: 'not_going'})`. Hook now also invalidates `['me','schedule']` so the event drops from the personal calendar immediately. State machine in EventDetailDrawer: `null | 'cancel-club' | 'cancel-personal' | 'mark-done' | 'unsubscribe'`. **Atomic-design honored at the right layer**: tokens reused, atom (SessionIcon) added to icon family, template (`/dashboard/schedule-new`) reused for create+edit. A formal structural sweep (extract `EventPill`, `DrawerActionFooter` molecules) is queued as a dedicated v9.13.x ADR — not bundled here. **CalendarEvent type** gained `zone?: number | null`, `completed_at?: number | null`, `club_id?: number` (for per-event Cancel/Unsubscribe routing in the heterogeneous personal scheduler). Bundle: dashboard chunk +1.5 KB, drawer +2 KB. Trivial. **Also: Landing page "What you get" sweep** — driven by Marco-persona cyclist friend feedback. The 3 marquee FeatureSpread blocks updated with current state (personal scheduler + zone colors + drawer actions). New `№ 02b — Built · Shipping next` section adds a 2-column transparency grid: 15 features live now (Today/Rides/Train/Schedule/Clubs/App areas) + 8 queued for Sprint 6+ (v9.13 AI plan persistence, v9.14 shareable rides, multi-TZ, club analytics, goals/races, FTP detection). Cyclist-first, ship-weekly. **Deferred to v9.13.0**: AI plan persistence (`#79` — coach auto-populates planned_sessions). **Deferred to v9.14.0**: shareable personal events with `tz` IANA column for author-intent. **Deferred to v9.13.x ADR**: structural atomic-design refactor (EventPill / DrawerActionFooter molecules).

## What's new in v9.12.4

**Calendar timezone fix + hide RSVP on personal sessions.** Founder feedback after v9.12.3: a personal event created at 09:00 was showing on the Week/Day calendar at 07:00 — and the same misalignment was happening to club events (just less obvious because the day was correct and people pattern-matched the time). Root cause: every calendar render site used `getUTCHours()` / `getUTCMinutes()` instead of local accessors, and `EventDetailDrawer` even had `timeZone: 'UTC'` baked into its date formatter. Storage (UTC unix epoch) is correct and stays untouched — only the display layer was forcing UTC on the viewer. v9.12.4 replaces all 8 affected sites (`types.ts` `formatHHMM` + `eventDateToCalendar` + `todayUTC`; `WeekCalendarGrid`; `DayCalendarGrid`; `MonthCalendarGrid`; `EventDetailDrawer`; `ClubEventModal` edit-roundtrip + Saturday-default) with `getHours()` / `getMinutes()` / `getFullYear()` etc. JS `Date` already knows the browser's IANA timezone, so this also gives us the basics for future multi-timezone (a Lisbon viewer of an event created in Zurich automatically sees Lisbon wall-clock — no schema change required). Drops the `· UTC` suffix from the drawer's "When" line. CTO note: when shareable personal events ship in v9.14, we'll add a nullable `tz` IANA column to capture author-intent for events that need a fixed wall-clock anchor (e.g. group meet-ups); deferred until the feature actually exists. Also in this release: `is_personal?: boolean` discriminator on `CalendarEvent` — set by `dashboard.schedule.tsx` when mapping `planned_sessions` → personal sessions hide the "X going" RSVP chip everywhere (Day grid, Month tooltip, Drawer) and the drawer shows "Mode: Solo session" instead. **Deferred to v9.12.5** (carryover from v9.12.2): SessionIcon + zone colors for visual differentiation; drawer Edit/Cancel/Mark-Done for personal sessions; Unsubscribe for club events I RSVP'd. **Deferred to v9.14**: shareable personal events via `/s/:token` (growth lever for next sprint).

## What's new in v9.12.3

**Duration in hours (cycling convention) + calendar time-blocking.** Founder feedback: cyclists think in 0.5h / 1h / 1.5h / 2h, not minutes. And event duration should visually book the time on Week and Day calendar grids — a 15:00 + 2h ride should show a block from 15:00 to 17:00, not a fixed 90-min stub. Both fixes ship in v9.12.3. Backend keeps storing `duration_minutes` (no schema change); UI converts at the edges. ClubEventModal + Add Session page now show "Duration (hours)" with `step=0.5`, `min=0`, `max=10`, placeholder `"1.5"`. On submit: `Math.round(hours * 60)` → minutes. On read back: `minutes / 60` for display. Legacy events with non-half-hour durations (e.g. 75 min) display as `1.25` — accepted edge. Calendar grids: `WeekCalendarGrid` and `DayCalendarGrid` now compute block height as `(event.duration_minutes / 60 / TIME_GRID_HOURS) * 100%` instead of the hardcoded 90-min. Personal sessions and club events both render to scale. Legacy events without duration fall back to 90 min so visual layout doesn't break. Plumbing: `CalendarEvent` type gained `duration_minutes?: number | null`; ScheduleTab passes through automatically (ClubEvent is a superset); dashboard.schedule.tsx + ClubDashboard's UpcomingEventRow click-to-drawer mapper both add the field explicitly. **Deferred to v9.12.4** (deferred items from v9.12.2): visual differentiation between club and personal events (SessionIcon + zone colors); personal session drawer Edit/Cancel/Mark-Done; Unsubscribe button for club events.

## What's new in v9.12.2

**Mandatory `duration_minutes` on club events + asterisks on required fields + BottomNav adapts to item count.** Closes part of `#79` (5-item bundle from founder feedback). Migration `0009` adds `duration_minutes INTEGER` to `club_events` (nullable for legacy rows; required server-side on POST). Server returns 400 if missing on create; PATCH allows null clearing. Frontend: ClubEventModal gets a Duration field + asterisks on Title/Format/Date/Time/Duration + "* Required" legend at form bottom (mono faint, brand-tone — no "Required field" filler). Add Session page (`/dashboard/schedule-new`) gets the same treatment: asterisks on Title/Date/Time/Duration + legend. Brand styling: asterisk in `var(--c-accent)` immediately adjacent to label (no space). BottomNav switches from `grid-template-columns: repeat(5, 1fr)` to `display: flex; .item { flex: 1; }` — adapts to item count instead of leaving an empty 5th slot on club view (which only has 4 items: Overview/Schedule/Members/Metrics). All 9 places that reference `duration_minutes` updated (POST, PATCH, GET range, GET overview, GET /api/me/schedule). **Deferred to v9.12.3** (next session): visual differentiation between club events and personal sessions on calendar pills (SessionIcon + zone colors); drawer Edit/Cancel/Mark-Done buttons for personal sessions; Unsubscribe button for club events I RSVP'd but didn't create. Bundle: dashboard chunk +1 KB.

## What's new in v9.12.1

**Hotfix.** Two bugs from v9.12.0 visual review. `#80` — "+ Add session" button silently failed because `dashboard.schedule.new.tsx` was registered by Tanstack as a child route of `dashboard.schedule.tsx`, but the parent has no `<Outlet />` so the child never mounts. Renamed file to flat path `dashboard.schedule-new.tsx` → URL `/dashboard/schedule-new` (escapes the parent-child nesting; same UX). `#78` follow-up — TopTabs alignment partially fixed in v9.12.0 (added `flex: 1` to `.tab`) but the parent `.list` (ul) was content-width, so tabs distributed evenly within a content-width container. Added `flex: 1` to `.list` AND `.list > li` so the entire chain flex-grows from `.root` → `.list` → `<li>` → `.tab`. Tabs now genuinely fill the container width.

## What's new in v9.12.0

**Personal Scheduler v2 + planned-sessions table.** Closes `#76` (Migration 0008 + 5 new endpoints), `#77` (frontend integration), `#78` (TopTabs alignment fix). Full CTO analysis at `docs/post-demo-sprint/v9.12.0-cto-analysis.md`. Migration `0008` adds new `planned_sessions` table for individual training sessions; 13 columns including session_date/title/zone/duration_minutes/target_watts/source/completed_at/cancelled_at; 2 indexes (composite athlete-date + partial ai_report_id). 5 new endpoints under `/api/me/sessions*` (GET range / POST / PATCH / cancel / uncancel) — auth-gated, rate-limited 30/min on `me-sessions-write` scope, OWASP 404 on cross-user IDs. Extended `GET /api/me/schedule?range=` now returns `{club_events, planned_sessions}` (renamed from `events` for clarity); single response for the entire personal scheduler. Frontend: new types (`PlannedSession`, `CreatePlannedSessionInput`, `PatchPlannedSessionInput`), API client methods, Tanstack mutation hooks (`useCreatePlannedSession`, `usePatchPlannedSession`, `useCancelPlannedSession`). New page route at `/dashboard/schedule/new` with full form (title, date/time, zone selector, duration, target watts, notes) — page pattern per Rule #17 lesson. "+ Add session" button on personal scheduler header. Personal sessions render on calendar alongside club events (currently styled as 'ride' — visual differentiation with SessionIcon + zone colors deferred to v9.12.1). TopTabs `.tab { flex: 1; min-width: 0; text-align: center; }` distributes tabs evenly across container width — fixes the empty-space-on-right bug founder reported. Scalability analysis: design supports ~10k users with current schema + indexes; KV-cache + materialized views are the next-step at 50-100k. Bundle: dashboard chunk unchanged (74.92 KB) — new route emits its own chunk.

**Deferred to v9.12.1+:**
- Visual differentiation: SessionIcon + zone-color rendering for personal sessions on calendar pills
- Drawer Edit/Cancel/Mark-Done buttons for personal sessions
- Unsubscribe button in drawer (for club events I RSVP'd but didn't create)

**Deferred to v9.13.0+:**
- AI Coach plan persistence (`#79`) — `/coach` endpoint auto-populates `planned_sessions` with `source='ai-coach'`. Foundational table is in place; integration is the next step.

## What's new in v9.11.0

**Personal scheduler + Overview Edit/Cancel + cancelled-events filter + Landing copy rewrite.** Bundles 4 issues per founder direction: `#61` Personal scheduler, `#74` cancelled events filter, `#75` Edit/Cancel from Overview Upcoming, `#64` Landing copy de-jargonised. v9.10.0 left as a reserved slot for Route picker (deferred). `#56` Clubs share/invite deprioritised — no current sprint slot.

`#61` — New `/dashboard/schedule` route aggregates events across ALL clubs the user is a member of: events they're going to (RSVP'd `going`) OR created. New endpoint `GET /api/me/schedule?range=YYYY-MM` returns the full event shape per club + `confirmed_count` + `is_creator` / `is_going` flags + `club_name` for multi-club identification. 5-min edge cache. Reuses Calendar primitives (Month/Week/Day grids + EventDetailDrawer) — same look as the per-club Schedule tab, just aggregated. New `useMyScheduleByMonth(range)` Tanstack Query hook. v9.11.0 ships clubs-only aggregation (Streams 1+2 from `#61` spec); AI plan items (Stream 3) and goals (Stream 4) deferred to v9.11.1+ pending stable schemas.

`#74` — `GET /api/clubs/:id/overview` upcoming-events SQL gains `AND e.cancelled_at IS NULL` filter. New `/api/me/schedule` does the same. Calendar grids continue to show cancelled events with strikethrough (intentional, per v9.7.3) — only upcoming/agenda lists filter them.

`#75` — Overview Upcoming Events rows are now tappable; click opens `EventDetailDrawer` with full event detail. Edit + Cancel buttons gated on `callerRole === 'admin'` OR (in future) `created_by === me`. Backend: Overview SQL expanded from 5 fields to 16 fields per upcoming event so the drawer can render properly. `UpcomingEvent` TS type expanded to mirror the full `ClubEvent` shape. Drawer state lifted to ClubDashboard so it doesn't re-mount on tab switch.

`#64` — Landing page copy rewrite for non-technical audience (Sofia + Léa personas). Stripped tech jargon (PMC, CTL/ATL/TSB, BYOK, Anthropic Sonnet/Haiku) — replaced with concrete benefit framing. Hero pill: "Cycling clubs that actually feel like a club" (was "Cycling clubs with an AI training brain"). Features de-jargoned: "Live training status" → "Know what shape you're in — every day"; "A club layer, AI embedded" → "A club that runs itself". Pricing simplified: "Personal AI plans · ≈ $0.02 · Anthropic Sonnet, your key, your bill" → "Personal AI coach · ~50¢/mo · Optional. Bring your own AI key. Skip it and your training brain still works." Final CTA: "PMC, plan, route picker, club layer — all yours, all local, all free" → "Your training brain ready. Your club waiting. All yours, all on your phone, all free."

**Nav reorder:** TopTabs + BottomNav add a "Schedule" slot between Today and Train. 5 nav slots (was 4). BottomNav `grid-template-columns: repeat(5, 1fr)`. ScheduleIcon (already in v9.7.2 design system) used. Bundle: dashboard chunk 88.33 → 74.92 KB (-13.41 KB) because Vite split EventDetailDrawer into its own chunk (14.75 KB) since it's now used by 3 callers — ScheduleTab, ClubDashboard Overview, dashboard.schedule route.

## What's new in v9.9.0

**First MINOR-correct feature release after the naming-convention lock.** Bundles two themes (founder call): Edit UX in EventDetailDrawer (`#60` follow-up) + Playwright e2e drift fixes (`#73`). Edit button in the drawer is now functional — tap → ClubEventModal opens in edit mode pre-filled from the event, submits via PATCH (using the v9.7.3 endpoint that's been wired but unused). State lifted to ClubDashboard so create + edit share the same modal instance: `eventToEdit` state toggled by `openCreateEvent` / `openEditEvent`. `<ScheduleTab>` accepts `onEditEvent` prop, threads through to `<EventDetailDrawer>` Edit button. Modal in edit mode adapts: title "Edit event" instead of "Create an event"; submit button "Save changes" / "Saving…" instead of "Post event" / "Posting…"; pre-fills all 9 fields (title, description, location, date, time, event_type, distance_km, expected_avg_speed_kmh, surface, start_point, descIsAi); preserves `description_ai_generated` flag on edit. e2e drift (`#73`) — 5 Playwright assertions updated for current UI: header check now waits up to 5s before counting (TopBar mount lag); "Marco" greeting check uses `getByRole('heading').filter({ hasText: /Marco/i })` instead of pinning to h1 (greeting moved to h2 in the dashboard.today refactor); ride-detail toggle button gets a 10s waitFor before scroll; BottomNav hash-anchor link gets a 5s waitFor; tabs.spec.ts redirect test uses `waitForURL` instead of immediate check (was flaky). Bundle: dashboard chunk 86.70 → 88.33 KB (+1.63 KB) for the edit-mode logic. No backend changes; Edit UX uses the existing v9.7.3 PATCH endpoint.

## What's new in v9.8.2

**Architectural simplification — Create Club modal replaced with `/clubs/new` page route.** Closes `#71` (P0 — Create Club modal broken on both mobile and desktop, blocking club creation entirely) + `#72` (BottomNav covering footer copyright on mobile). The Create Club flow had hit 3+ bug classes since v9.7.5 — sizing (visualViewport keyboard handling), stacking context (createPortal), now desktop visibility — all rooted in modal complexity. Migration to a dedicated route eliminates the entire bug class: no portal, no visualViewport hook, no z-index battles, no body scroll lock, no focus trap. Same form, simpler implementation, works identically across mobile and desktop. New file `apps/web/src/routes/clubs.new.tsx` (Tanstack file-based route at `/clubs/new`). ContextSwitcher's "Create new club" button + ClubCreateCard's "Create club" button both navigate via `useNavigate({ to: '/clubs/new' })` instead of opening the old modal. On submit, auto-switches AppContext to the new club + navigates to `/dashboard/today`. Old `ClubCreateModal` component still exists in tree (uncalled) — will be removed in a follow-up cleanup release. `#72`: AppFooter `padding-bottom: calc(var(--s-10) + 72px + env(safe-area-inset-bottom, 0))` on mobile (≤ 599px) clears the BottomNav so the © Cadence Club copyright is fully readable. Bundle: dashboard chunk 89.98 → 86.70 KB (−3.28 KB) — modal logic + visualViewport hook + portal wrapper all gone. **NOTE:** local wrangler auth expired this session; deploy needs `npx wrangler login` then `npm run deploy` to ship to prod. v9.8.1's portal fix never reached prod (Workers Builds also failing); v9.8.2 supersedes it (page pattern doesn't need the portal anyway).

## What's new in v9.8.1

**Hotfix.** Closes `#70` — the v9.7.5 fix for `#69` addressed the keyboard-driven sizing issue on Create Club modal but missed a SEPARATE root cause: a CSS stacking-context bug. The modal renders inline inside `ContextSwitcher` → `TopBar`, both of which create stacking contexts via `position: sticky / fixed` + z-index. Once a stacking context is created, child z-indices are confined to it — even `--z-modal: 500` can't beat siblings of the parent. Result: Create Club modal rendered BEHIND the Schedule tab calendar grid. Fix: `createPortal` from `react-dom`. Both `ClubCreateModal` and `ClubEventModal` now portal to `document.body`, escaping any parent stacking context. EventDetailDrawer not portaled (no reported bug; preventive fix deferred unless it surfaces). Added Rule #16 candidate to `0-learnings.md`: when fixing a modal/overlay z-index bug, audit ALL modals + overlays in the same component family in the same release cycle. Bundle: dashboard chunk +0.12 KB.

## What's new in v9.8.0

**First MINOR-correct feature release** under the new naming convention (locked in `CONTRIBUTING.md` this release). v9.8.0 closes the AI-description piece of `#60` (the event lifecycle work that started in v9.7.3): a "Generate with AI ✨" button next to the Notes field in ClubEventModal calls a new system-paid Haiku endpoint and populates the textarea with a 2-3 sentence club-friendly description. New `POST /api/clubs/:id/events/draft-description` accepts current form values (title + format + distance + speed + surface + start_point + location), prompts Haiku for a casual member-direct ("we / the crew") description, returns plaintext. Membership-gated 404 (OWASP); rate-limited 5/min/athlete on a new `event-ai-draft` scope per ADR-S5.3; system-paid via `SYSTEM_ANTHROPIC_KEY` (~$0.001/draft). Frontend tracks an `ai_generated` flag — set true when user accepts the draft as-is, cleared the moment they edit. Sent as `description_ai_generated: true` on the create POST so analytics can track AI-vs-human authorship over time. Edit UX (PATCH wired in drawer) + Route picker integration deferred to v9.9.0 + v9.10.0 — split for tighter verification budget per Sprint 4 retro Improvement #5. Also in this release: `CONTRIBUTING.md` updated with the locked release-naming convention + 5 MAJOR-bump triggers. Confluence Sprint Roadmap re-synced with corrected version labels (v9.7.x past releases stay frozen as labelled; v9.8.0 onward follows strict SemVer).

## What's new in v9.7.5

**iOS Safari hardening.** Closes 3 P0/P1 bugs from the v9.7.4 visual verification (`#67`/`#68`/`#69`) — all iOS-Safari-specific edge cases that the v9.7.4 hotfix didn't fully cover. **`#67` BottomNav Safari toolbar fix:** restored `bottom: 0` + added `padding-bottom: max(env(safe-area-inset-bottom, 0), 12px)` — bar background extends to viewport bottom while buttons sit above the safe-area inset, with a 12px minimum fallback for when env() returns 0. **`#68` date/time native input strip:** added `-webkit-appearance: none` + `min-width: 0` + `-webkit-min-logical-width: 0` on `.input[type='date']` and `.input[type='time']` — iOS Safari was rendering native date/time controls that ignored the modal's CSS width and overflowed the right edge. **`#69` visualViewport-aware modal sizing:** new shared hook `useVisualViewportHeight()` in `apps/web/src/hooks/`. ClubCreateModal and ClubEventModal both clamp `max-height` to `${visualViewport.height - 16}px` so the modal stays inside the visible viewport when the iOS keyboard opens — fixes the bug where the Name input rendered above the visible area on Create Club, making the modal functionally broken on iPhone. Plan re-numbered: original v9.7.5 (AI description + Edit + Route picker) becomes v9.7.6; subsequent releases shift +1. No backend changes; pure frontend hardening. Real-device iOS verification recommended on RELEASE_CHECKLIST.

## What's new in v9.7.4

**Hotfix.** 5 UX bugs from v9.7.3 visual review (`#66`). (1) Replaced emoji Format chips (🚴/☕/🏁) with branded CC line-icon SVGs — added `RideIcon`, `SocialIcon`, `RaceIcon` to the design system at `apps/web/src/design/icons/index.tsx`. Used in ClubEventModal Format chips, ScheduleTab filter chips, and EventDetailDrawer drawerType badge. (2) Drawer z-index lifted from hardcoded `100` to `var(--z-modal, 500)` — was below `--z-nav: 200`, so BottomNav covered the drawer on mobile. (3) Added mobile bottom-padding to ClubDashboard (`calc(72px + safe-area-inset-bottom)`) so the last section / footer isn't hidden behind BottomNav. (4) Modal horizontal scroll fix: `box-sizing: border-box` on `.input` and `.textarea` (root cause — inputs missed the rule, padding pushed them past 100% width); plus `overflow-x: hidden` on `.modal` and `min-width: 0` on `.field` as belt-and-braces. (5) iOS Safari toolbar fix: BottomNav `bottom: 0` → `bottom: env(safe-area-inset-bottom, 0)`. Per Apple guidance, Safari treats its toolbar height as part of the safe-area inset, so floating BottomNav above this inset clears the back/forward/share/bookmarks chrome. The previously-deferred AI description + Edit UX + Route picker (was "v9.7.3.1") becomes **v9.7.5**. Dashboard chunk: 87 → 88 KB (+1 KB).

## What's new in v9.7.3

Sprint 5 / `#60` + `#63` — Event model expansion + lifecycle (cancel) + Privacy header removal. Migration `0007` adds 7 new columns to `club_events` (`distance_km`, `expected_avg_speed_kmh`, `surface` CHECK road/gravel/mixed, `start_point`, `route_strava_id`, `description_ai_generated`, `cancelled_at` for soft-delete). Two new endpoints: `PATCH /api/clubs/:id/events/:eventId` (creator/admin gated, partial-update with allowlisted fields, 30/min clubs-write rate-limit) and `POST /api/clubs/:id/events/:eventId/cancel` (idempotent soft-delete, same gating). Existing `POST` extended to accept all new fields with allowlist guards (event_type ∈ ride/social/race; surface ∈ road/gravel/mixed; numeric ranges 0-1000 km / 0-100 km/h). Existing `GET ?range=` returns the full new column set. ClubEventModal expanded with **Format chips** (🚴 Ride / ☕ Social / 🏁 Race), Distance + Avg-speed inputs, Surface chips (Any / Road / Gravel / Mixed), Start-point text, Location/area text, Notes textarea — with **persona-aware hiding**: Distance/Speed/Surface auto-hide when format = Social. EventDetailDrawer now wires Cancel: tap → confirmation → server-side soft-delete; cancelled events render strikethrough across all 3 calendar views (Month/Week/Day) with reduced opacity + "Cancelled on …" line in the drawer. **`#63` privacy link removed** from the public Landing TopBar (still in footer) — header now focuses on the primary "Connect" CTA. Dashboard chunk: 83 → 87 KB (+4 KB). Edit (PATCH UX) and AI-description button **deferred to v9.7.3.1**.

## What's new in v9.7.2

Sprint 5 / `#59` + `#62` — Responsive nav consistency + Cadence Club line-icon library + Members search input fix. Closes the inconsistency where clubs used top tabs on mobile while individual used BottomNav. New rule (locked 2026-05-01): **desktop = top tabs always; mobile = BottomNav always; breakpoint = 600px**, applied to both clubs and individual contexts. New shared `<TopTabs />` component (CSS hides &lt; 600px); BottomNav extended with optional `items` prop so club mode can drive it from local tab state. BottomNav breakpoint moved from 1024 → 600px. New CC line-icon library at `apps/web/src/design/icons/index.tsx` — 8 branded SVG icons (Today / Train / Rides / You + Overview / Schedule / Members / Metrics), 1.6px stroke 24×24 currentColor, persona-focused JSDoc. ClubDashboard now renders TopTabs (desktop) + BottomNav with club items (mobile, with the new icons). Individual dashboard route renders TopTabs above the Outlet on desktop. Bonus fix: `#62` Members tab search input was rendering at ~40% of mobile viewport — root cause was `flex: 1 1 200px` on a column-direction parent (cross-axis grew vertically); fixed with explicit `flex: 0 0 auto` + `height: 44px` (mobile) / `48px` (desktop), restoring flex-grow only inside the desktop row breakpoint. WCAG 2.5.5 touch-target compliant. Dashboard chunk: 80 → 83 KB (+3 KB for icons + TopTabs). No backend changes.

## What's new in v9.7.1

Sprint 5 / `#57` — Outlook-style multi-view scheduler. Closes the v9.7.0 gap where only Month was available. New view toggle chips at the top of the Schedule tab let users switch between **Month** (6×7 grid), **Week** (7-col × 06:00–22:00 16h time grid), and **Day** (single col × 06:00–22:00). View persists in URL hash (`#month` / `#week` / `#day`); deep-linking and back-button work. Default = Month on desktop, Day on mobile (auto-switch by 600px breakpoint). Date navigation (prev/next) is view-aware — steps months in Month view, weeks in Week, days in Day. New **EventDetailDrawer** opens on tap of any pill: bottom-sheet on mobile, right-side panel on desktop. Drawer renders title + format + when + where + RSVP count + organiser + description; Edit / Cancel buttons stub here, wired in v9.7.3 (event lifecycle). Locked CSS scope: `apps/web/src/components/Calendar/` now houses MonthCalendarGrid, WeekCalendarGrid, DayCalendarGrid, EventDetailDrawer + shared `Calendar.module.css` — primitives reusable for the personal scheduler in v9.7.4. ScheduleTab.tsx is now orchestration only (~225 lines, was 230 — tighter). No backend changes; reuses `GET /api/clubs/:id/events?range=` shipped in v9.7.0. Dashboard chunk: 70.42 → 80.48 KB (+10 KB).

## What's new in v9.7.0

Sprint 5 Phase 3 — clubs Schedule tab. The 4-tab IA's Schedule placeholder ("Coming in v9.6.2") is now a full month-grid calendar: 6×7 grid Monday-start, today highlighted, prev/next month navigation, filter chips multi-select by `event_type` (🚴 ride / ☕ social / 🏁 race), event pills per cell colour-coded by type with tap-to-detail and `+N more` overflow. Migration `0006` adds `club_events.event_type TEXT NOT NULL DEFAULT 'ride'` (backfills existing rows). New endpoint extension `GET /api/clubs/:id/events?range=YYYY-MM` returns events with `confirmed_count` from `event_rsvps` LEFT JOIN, ordered by `event_date ASC`, with 5-min edge cache (`Cache-Control: private, max-age=300`). Two ADRs locked: ADR-S5.1 cron failure mode (log-and-skip, no retry — Phase 4 prep) and ADR-S5.2 readiness-dot thresholds (TSB ≥ +5 / -10 to +5 / < -10 — Phase 4 prep). New `useClubEventsByMonth(clubId, range)` Tanstack Query hook with the project's standard staleTime/gcTime. No new components beyond ScheduleTab + module CSS; reuses design tokens (`--c-accent`, `--c-info`, `--c-warn`) and Sprint 3 a11y patterns (`--hit-min`, `--ring-focus`, `:focus-visible`). Dashboard chunk +4 KB. Sprint 5 Phase 4 (cron handler + readiness dots + trend arrows) lands as v9.7.1; clubs share/invite (`#56`) lands as v9.7.2.

## What's new in v9.6.5

Marketing rewrite. Landing page (`/` and `/#what`) was still Persona A only ("performance-driven amateur, FTP, W/kg"); the product has shifted to clubs-first with AI embedded across three personas. Surgical copy edits in `apps/web/src/pages/Landing.tsx`: hero pivots to "Train solo. *Ride together.* Smarter."; §01 broadens "For you if…" to include club captains and casual commuters; §02 Feature 03 replaces the route preview with a club-layer feature (Overview / Schedule / Members / Metrics, AI Circle Note); pricing splits the dual-tier AI cost model (system-paid Haiku for club moments, BYOK Sonnet for personal /coach plans). New `ClubLayerPreview` component reuses existing route-preview CSS; the now-unused `RoutePreview` was deleted (38 lines). README tagline updated to match. No backend, schema, or routing changes.

## What's new in v9.6.4

**v9.6.3 hotfix-of-hotfix.** Real cause of the "RSVP shows 1 then drops to 0" bug surfaced after v9.6.3 deploy. The `LEFT JOIN event_rsvps` on `/overview` was correct — but no RSVP had ever actually persisted (D1 verified `event_rsvps` had 0 rows ever). Phase 2's `POST /api/clubs/:id/events/:eventId/rsvp` had a misuse of `checkRateLimit`: `if (!rl.ok)` — the helper returns `null` when under-limit / `{ retryAfter }` when over, never an `{ ok }` shape. So `null.ok` threw a `TypeError` for every first request, returning 500 from the worker; the frontend's optimistic update reverted on the error response, hence "shows 1 then 0". Same misuse fixed on `PATCH /api/users/me/profile` (silently 500'd too). Plus: ClubDashboard tabs typography aligned with the BottomNav labels for app-wide UX coherence per founder feedback — `10px / 0.14em` mono uppercase matching the My Account bottom-tabs labels, active state uses accent COLOR + 1 px underline (was 11px / 0.16em with a heavy 2 px border).

## What's new in v9.6.3

Three Phase 2 polish bugs from founder feedback: (1) `GET /api/clubs/:id/overview` was hardcoding `confirmed_count: 0` (Phase 1 placeholder) — now LEFT JOINs `event_rsvps` so RSVP counts persist across refetches (was incrementing optimistically to 1 then snapping back to 0). (2) `ClubCreateModal` could be clipped on mobile when the keyboard appeared — switched to `align-items: flex-start` with safe-area-aware padding, max-height accounts for `100dvh`, smaller padding on narrow viewports. (3) Members tab search input trimmed from inflated padding to a standard 36px search-input height — UX-best-practice subtle, not loud. No worker security surface change; no schema change.

## What's new in v9.6.2

Sprint 4 Phase 2 — clubs Members tab + RSVP wiring + privacy-visibility plumbing. Migration `0005` adds `event_rsvps` (per-member RSVP state, idempotent UPSERT keyed by `(event_id, athlete_id)`), `users.ftp_visibility` (TEXT NOT NULL DEFAULT `'private'` per ADR-S4.4), and `club_members.trend_arrow` + `trend_updated_at` (Phase 4 cron columns). Three new endpoints + one extension: `POST /api/clubs/:id/events/:eventId/rsvp` (rate-limited 30/min on `clubs-write`), `GET /api/clubs/:id/events/:eventId/rsvps` (top-12 avatars + count, visible to all members per ADR-S4.5), `PATCH /api/users/me/profile` (column allowlist on `ftp_visibility`, rate-limited 10/min on a new `profile-write` scope), and `GET /api/clubs/:id/members` extended with server-side FTP mask (caller `'admin'` sees all; otherwise FTP visible only when target's `ftp_visibility='public'`). Members tab rendered fully — Name / Role / Joined columns, sort dropdown (default Joined desc), search-as-you-type, role chips with "NEW" badge for joined-within-30-days. Phase 1's disabled RSVP button on Overview is now live with optimistic confirmed-count + revert-on-error. FTP toggle UI deferred (no `ftp_w` column to toggle against until #52 ships in Sprint 5; backend masking is wired and ready). 27/27 unit pass; mobile-tabs + OAuth full-flow smoke green post-deploy.

## What's new in v9.6.1

**Hotfix.** v9.5.1 (#15 security headers) set CSP `script-src 'self'`, which silently blocked the inline `<script>` on `/callback` that writes Strava tokens to `localStorage` and redirects to `/dashboard`. Symptom: users completing Strava OAuth landed on a "Loading dashboard…" page that never advanced. Fix: per-request nonce CSP for `/callback` only — `crypto.randomUUID()` generates a nonce per response, embedded in the `<script nonce="…">` tag and added to that response's `Content-Security-Policy: script-src 'self' 'nonce-…'`. Strict CSP preserved on every other route. New helper `cspWithScriptNonce()` + `htmlResponse()` extended to accept extra headers. **Should have been caught by a legacy-parity audit during Sprint 3 #15** — exactly the regression the Sprint 1 retro rule warned about. Adding `/callback` to the post-deploy smoke list going forward.

## What's new in v9.6.0

Sprint 4 Phase 1 — clubs expansion (issue `#53`). The 4-tab IA is live: **Overview / Schedule / Members / Metrics**. The cover hero from v9.1.2 is dropped per founder directive (~280 px reclaimed); a slim sticky header replaces it (`EST. {year} · {N MEMBERS} · PRIVATE`). The Overview tab is the only fully-built tab in v9.6.0 — Schedule / Members / Metrics show "Coming in v9.6.{2,1,4}" placeholders that map to Phases 2-5. New backend endpoint `GET /api/clubs/:id/overview` (single D1 batch, membership-gated 404 OWASP) returns the club row, 28-day stat aggregations from `activities` (hours, distance, ride count, new members), upcoming events, and the Circle Note (null until Phase 5). New `useClubOverview` TanStack Query hook with the project's standard staleTime/gcTime. No new schema this phase — Phase 2 lands `event_rsvps`. No AI calls — Phase 4-5 land the AI moments.

## What's new in v9.5.2

Sprint 3 Phase 3 — accessibility + UI polish. Four CSS-only fixes from the 2026-04-30 audit closed in one batch. **#43**: `:focus-visible` rings on Button (all variants), BottomNav, and form inputs across the app. New `--ring-focus` + `--ring-focus-offset` tokens; WCAG 1.4.11 BottomNav color-only-focus replaced with proper outline; inputs migrated from `:focus` to `:focus-visible` so mouse clicks no longer light up the ring. **#44**: 44px touch targets via `min-height: var(--hit-min)` on `VolumeChart .toggleBtn`, `ClubDashboard .tab`, `RideFeedback .askBtn`. **#45**: AppFooter mobile-first grid — 1fr stack at narrow viewports, 3 columns at 600px+ (fixes the iPhone Mini ~111px column collapse). **#3**: Removed "Revoke access" link from the public marketing footer; UserMenu still has it for authenticated users. Build green; 27/27 unit tests still pass.

## What's new in v9.5.1

Sprint 3 Phase 2 — three security hardening fixes from the audit. **#41**: `/api/*` Strava proxy method allowlist (GET+POST only; DELETE/PUT/PATCH → 405). **#42**: per-athlete rate-limit on the three `/api/clubs*` POST endpoints (create/join/event), shared `clubs-write` scope at 30/min/athlete via the existing `checkRateLimit` helper. **#15**: full security header set on every Worker response (CSP, HSTS 2-year+preload, X-Frame-Options:DENY, X-Content-Type-Options:nosniff, Referrer-Policy:strict-origin-when-cross-origin, Permissions-Policy disabling camera/mic/geolocation). Same headers applied to static assets via `apps/web/public/_headers`. CSP starts permissive enough not to break the app (`'unsafe-inline'` on style-src for React inline styles, `*.cloudfront.net` for Strava avatars, Google Fonts) and can be tightened later. Worker fetch handler restructured into a thin wrapper + `handleRequest()` so headers wrap every response without touching the 1400+ lines of route handlers.

## What's new in v9.5.0

Sprint 3 Phase 1 — three frontend stability fixes from the 2026-04-30 audit's HIGH backlog. **#38**: `useRides` was calling `clearTokens()` during render, which under React 19 Strict Mode + React Query retry could wipe tokens that the retry was about to refresh successfully — booting users to ConnectScreen on every near-expiry load. Moved the call to `useEffect`. **#39**: `auth.ts` `writeTokens`/`clearTokens` had no `try/catch`; Safari Private Browsing throws `QuotaExceededError` and stranded users mid-OAuth with no error UI. Wrapped both in `try/catch` mirroring the read-side pattern. **#40**: `useAiReport` and `useRideFeedback` cast caught errors via `as CoachError`; network `TypeError` (offline/CORS) became a fake `invalidKey: true` UX. Replaced with `instanceof CoachError` type-guard. Plus a backlog triage: closed `#6` (route picker, superseded by Sprint 1+2 work); kept `#8` open with a status comment (TSS backfill never ran — 11 nulls / 0 populated). 27/27 unit tests green (was 20; +7 new across `auth.test.ts` + `useCoachHooks.test.ts`).

## What's new in v9.3.5

Sprint 2 Phase 1 — two regression hotfixes from Sprint 1's BYOK flow. **FB-R1**: `coachApi.ts` `postJson()` now reads the Strava token via `ensureValidToken` and attaches `Authorization: Bearer` — the v9.3.0 `/coach` + `/coach-ride` bearer gate (CRITICAL #33) was correct, but the frontend never sent the bearer, so every "Generate plan" click 401'd. New `CoachError.stravaExpired` flag surfaces a "Reconnect Strava" CTA when the session expires. **FB-R2**: You-tab API key form restored the legacy "Your key stays in this browser. [Get a key →](https://console.anthropic.com/settings/keys)" copy + link that v9.3.0 dropped — non-technical personas couldn't complete BYOK setup without it. Sprint 1 retro improvement #2 also lands: new `tests/mobile-tabs.spec.ts` Playwright spec gates every Sprint 2 deploy (mobile viewport + tabs flag, no redirect loop, `<header>` + populated `#root`). 20/20 unit tests green.

## What's new in v9.3.4

Clubs feature lifted into the mobile tabs layout. v9.3.3 added `<TopBar />` with `<UserMenu />` but missed `<ContextSwitcher />` (the individual ↔ club toggle), so clubs went invisible on mobile. v9.3.4 mirrors the legacy `Dashboard.tsx` pattern: ContextSwitcher in the TopBar trailing slot whenever `cc_clubsEnabled`, and when scope is club-mode the tabs layout swaps its `<Outlet />` for `<ClubDashboard />` (with `<ClubCreateCard />` above) instead of rendering the personal tab content. BottomNav hides in club mode — tabs are personal-only.

## What's new in v9.3.3

Stabilization release. v9.3.1 introduced the mobile 4-tab layout but its new shell — `routes/dashboard.tsx` — never rendered the `<TopBar />` brand bar that legacy `pages/Dashboard.tsx` had. The miss carried into v9.3.2 (which fixed the redirect loop but not the layout) and surfaced the moment the redirect-loop fix made the tabs view actually visible: brand mark gone, no UserMenu, no way to disconnect from tab mode. v9.3.3 wires `<TopBar variant="app" />` into the tabs layout shell with the same `<UserMenu />` trailing the legacy dashboard uses (avatar, name, sync, disconnect, edit profile). All v9.3.2 features carry over unchanged.

## What's new in v9.3.2

Hotfix-of-hotfix. v9.3.1 went out and immediately broke prod on mobile — page rendered all-black because Tanstack Router's parent `beforeLoad` fired on every nested route navigation, redirecting `/dashboard/today` back to itself in an infinite loop that locked the JS thread. v9.3.0 was reverted to restore service. v9.3.2 ships the same v9.3.1 features (viewport-aware tabs, RoutesPicker rework, Phase 2 AI route discovery) with the redirect-loop guarded by `location.pathname === '/dashboard'`. Reproduced and fixed locally with Playwright before re-deploying.

## What's new in v9.3.1

Sprint 1 follow-up. Tabs default ON for mobile (<1024px), OFF for desktop — viewport-aware kill-switch, no more DevTools flip needed for the demo. RoutesPicker stripped back to surface filter only (distance and difficulty chips were over-spec — removed) and moved INLINE inside the Today session card, between the AI plan and a new "Start workout in Strava ↗" CTA. Saved Strava routes now filtered against today's session distance (±20%); when zero match, a "Discover AI routes near you" panel calls the new `POST /api/routes/discover` endpoint (system-paid Haiku, 10/h/athlete rate limit) — Phase 2 lifted forward from Sprint 3 because the saved-route flow needs an AI fallback to be useful for new users.

> **Note:** v9.3.1 was reverted in prod due to the redirect-loop regression. Its features ship in v9.3.2 with the fix.

## What's new in v9.3.0

Sprint 1 of the post-demo plan ships in one cut. Two security CRITICALs closed (`#33` `/coach` open-Anthropic-proxy gated behind Strava bearer + per-athlete rate limit; `#34` X-Forwarded-Host phishing vector replaced with origin allowlist). Mobile gets a 4-tab restructure (`#51` — Today / Train / Rides / You behind `cc_tabsEnabled`, default off). Route discovery rewired off mock data onto the user's own Strava saved routes (`#47` Phase 1 — `GET /api/routes/saved` + `PATCH /api/training-prefs` endpoints, surface/distance/difficulty filter chips, persisted preferences). Migration 0004 adds `home_region`, `preferred_distance_km`, `preferred_difficulty` to `training_prefs`. All 5 Dependabot vulnerabilities cleared (happy-dom 15→20, vitest 2→3 — closes 1 critical RCE + 2 high + 2 medium).

## What's new in v9.2.5

Demo-blocker fix. `/whats-next` was leaking raw SQL — issue bodies that opened with ```` ```sql ```` migration blocks (#35, #37) rendered verbatim in route card UI. Server-side `normalizeGhIssue` now strips fenced + inline code before extracting the first paragraph. Plus the remote D1 invite_code backfill that v9.1.4 only applied locally — Merkle Riders now has a valid invite code in prod.

## What's new in v9.2.4

New Confluence spec page: **Data Model**. 12 tables documented end-to-end (DDL, FKs, indexes, read/write paths, migrations). Auto-created on the next deploy. Plus 4 small drift fixes in APIs + Technical Spec pages (`scheduled_at` → `event_date`, `created_by` → `owner_athlete_id` for clubs).

## What's new in v9.2.3

Confluence spec pages content sync — surgical updates across all 6 pages (Systems & Architecture, APIs, Interfaces, Functional Spec, Technical Spec, Security) to reflect v9.2.x reality. ~151 net lines added in `src/docs.js`. Pushes to Confluence automatically via the `docs:sync` step of `npm run deploy`.

## What's new in v9.2.2

Removed the "What's new" badge from TopBar — the auto-popping modal didn't fit the editorial restraint the brand is converging on. Component files left in place (not deleted) for easy revert.

## What's new in v9.2.1

Hotfix for #46 — ContextSwitcher dropdown was clipping content on the left edge when the trigger sat far left in `TopBar.trailing` (narrow viewports especially). The menu now caps `max-width` at `min(360px, viewport-16px)` and switches to viewport-anchored `position: fixed` on mobile (`@media max-width: 600px`). Pure CSS, no TSX changes.

## What's new in v9.2.0

**Sprint 2 of the 2026-04-30 audit.** Four CRITICAL items closed: OAuth state CSRF (issue #14, deferred 3×), `/refresh` auth gate (#36), events test coverage (#35), and `schema.sql` consolidation (#37). Plus the v9.1.4 demo-blocker fix bundle (invite_code generation + contrast tokens) carried forward.

OAuth state is now a KV-backed single-use UUID with 10-min TTL — closes the CSRF / token-confusion vector. `/refresh` verifies the supplied token is in `user_connections` before forwarding to Strava. Test count: 29 passing (was 13). New `db/README.md` documents the schema-vs-migrations policy.

Sprint 3 items remain open: `/coach` zero-auth (#33), `X-Forwarded-Host` open redirect (#34), and 8 HIGH-severity items across frontend/CSS — all tracked as GitHub issues.

## What's new in v9.1.3

**Club events — D1 table + create flow.** New `club_events` table (migration `0002`), two endpoints (`POST` + `GET /api/clubs/:id/events`), modal-style create form, Upcoming section in ClubDashboard. Any member can post a ride — admins are not gatekeepers per the BA spec. Membership-gated reads (404 if not a member, OWASP). RSVPs deferred to a Phase B release.

## What's new in v9.1.2

**Club view restructured to Saturday Crew Wireframes IA + Coach AI for the captain.** ClubDashboard reorganised per the design-bundle wireframes (cover hero, tabs row, hero invite CTA, 4 stat tiles, members list, circle note, coming-next). New `<ClubCoachCard />` lets the captain (admin) connect an Anthropic API key for the club; key stays in `localStorage` keyed by club id. Feedback rendering waits on a club-rides aggregate table; the card explains the current state.

Schedule / Members / Metrics tabs render placeholders — calendar, sortable roster, collective load all wait on backend tables not yet built.

## What's new in v9.1.1

**Palette revert.** Restores molten orange `#ff4d00` + lime `#22c55e` (v9.0.0 era). The v9.1.0 brass + forest swap is rolled back via `git revert 07d9b49`; brand rename to **Cadence Club** stays. Effectively v9.0.0's visual identity under v9.1.0's brand name.

Why: brass-on-dark drifted from the Strava-adjacent identity that defined the product through v8.x. Molten orange signals "cycling-native"; brass read warm-luxury but disconnected from the established mental model. The Soho House cream-light prototype that was attempted mid-session was abandoned for the same reason — dark canvas + molten accent is the visual language users know.

What stays from v9.1.0: brand rename, "Today's session" copy, OnboardingModal mobile fix.

## What's new in v9.1.0

**Brand swap to Cadence Club.** The accent palette pivots from molten orange to warm brass `#B8956A` + forest green `#4A8E54`; the user-facing name flips from "Cycling Coach" to "Cadence Club"; the OnboardingModal gets a mobile-first padding fix. No new pages, no auth changes, no D1 migrations. Strava OAuth remains the only auth path.

- Tokens: brass + forest green (AA-contrast verified — brief's `#2C5530` failed at 2.31:1, lifted to `#4A8E54` for body text; `#2C5530` reserved as `--c-success-deep` for non-text decoration).
- Semantics locked in: **Brass = active / next**, **Forest Green = completed / earned**. PR pills, "Strengths" eyebrow, and "{n} PRs" tally moved from accent → success accordingly. Dashboard "Demo data" pill dropped its (incorrect) success tone to neutral.
- Domain stays at `cycling-coach.josem-reboredo.workers.dev` — migration tracked as [#32](https://github.com/jose-reboredo/cycling-coach/issues/32). Internal identifiers (Worker name, D1 db, npm packages) unchanged.

Strava + Anthropic + Cloudflare Workers under the hood, same as v9.0.0. Existing v8.x and v9.0.0 features (clubs MVP + invite-by-link) all carry over with the new palette.

## What's new in v9.0.0

**F4 invite-by-link + start of the Cadence Club product line.** Closes the v8.6.0 demo gap ("how does an admin add teammates?") and marks the major-version cutover. Subsequent v9.x patches land the brand swap, redesigned pages, and new auth per the v2.0 product redesign brief.

- New `POST /api/clubs/join/:code` worker endpoint (Strava-auth, idempotent, 404 on unknown code per OWASP).
- New `/join/$code` Tanstack route — auto-joins authed users, falls back to "Connect with Strava" CTA for new arrivals.
- `<InviteLinkCard />` in the club Dashboard (admin-only) — shows the canonical join URL with a Copy button.
- Mobile-first layout for both the JoinClub page and InviteLinkCard: stack by default, row layout at ≥768px, 44px touch targets.

The `invite_code` column was populated on every `POST /api/clubs` since v8.6.0 — v9.0.0 only exposes it. No D1 migration.

## What's new in v8.6.0

**Clubs MVP — vertical slice for stakeholder demo.** The defensible angle is amateur cycling clubs as the unit of use, not individual AI coach (saturated market). v8.6.0 ships the minimum surface needed to demonstrate the model end-to-end against real production D1.

- **`POST /api/clubs`** — create a club, caller auto-added as `admin`. Atomic-ish via INSERT…RETURNING + try/catch DELETE cleanup with `safeWarn` on the orphan path.
- **`GET /api/clubs`** — list clubs the caller belongs to (joined with `club_members.role`).
- **`GET /api/clubs/:id/members`** — membership-gated (404 if not a member, OWASP). Returns `firstname`, `lastname`, `profile_url`, `role`, `joined_at` for each member.
- **`resolveAthleteId(request)` helper** — rounds-trips Strava `/athlete` once per club operation to validate the bearer token AND derive `athlete_id`. All failure modes return 401 with `{"error":"authentication required"}`.
- **`<ContextSwitcher />` in TopBar** — compact pill, dropdown lists "My account" + each club + "Create new club". Selection persists in `cc_activeContext` localStorage. Mobile-compact (≤640px).
- **`<ClubDashboard />`** — when in club mode: italic-em club name, role pill, member count, members list with avatars, placeholder stat tiles, "Coming next" roadmap card, "switch back to My Account" hint.
- **Kill-switch `cc_clubsEnabled`** (defaults `true`) — set to `'false'` and reload to render Dashboard exactly as v8.5.3 (zero regression). Gates ContextSwitcher, ClubCreateCard, AND the Dashboard club-mode branch.

Existing v8.5.3 behavior preserved byte-for-byte in individual mode. Existing tables `clubs` + `club_members` reused — no D1 migrations.

## What's new in v8.5.2

Phase 2 tail of the v8.5.x backlog burn. Two security features (#17, #18) plus a docs-integrity pass on the 6 Confluence spec pages and a new per-page deploy-audit footer.

- **`/webhook/<secret>` path-secret source verification** (#17) — canonical webhook URL is now `/webhook/<env.STRAVA_WEBHOOK_PATH_SECRET>`. Legacy `/webhook` and any wrong-secret path return **404** (OWASP — don't leak existence). Without the secret set, the entire `/webhook*` surface is dormant by design (single-user mode today, no active subscription).
- **KV rate-limit on `/admin/document-release`** (#18) — defense-in-depth even though admin-auth-gated. **5 attempts/min/IP**, returns 429 with `Retry-After` on threshold; failed attempts logged via `safeWarn()` with source IP. Uses `DOCS_KV` namespace (Free-plan-compatible). Native Cloudflare rate-limit binding for `/api/*` and `/coach/*` deferred indefinitely (Workers Paid plan only).
- **Per-page deploy footer on Confluence spec pages** — every spec page now carries a "Last touched by deploy vX.Y.Z on YYYY-MM-DD" footer at the bottom, rendered fresh on every `npm run deploy`. Body hash check still skips body rewrites when content unchanged; the footer is overlaid on every deploy so the audit trail "this page was reviewed during deploy v8.5.2" stays current. Six Confluence writes per deploy now (was zero on no-op deploys) — acceptable given the weekly cadence.
- **Spec pages content sync** — Security page substantially updated to reflect v8.5.1 + v8.5.2 reality (issue references now show shipped status, milestones reflect housekeeping reslots). Systems & Architecture + Technical Spec pages updated to describe GitHub Actions CI accurately (Cloudflare Workers Builds intentionally not wired). API endpoints table now shows `/webhook/<secret>` instead of `/webhook` legacy.

Operator action required for #17 to activate (zero-impact today since no webhook subscription exists). The secret value is format-validated at runtime — it must match `/^[0-9a-f]{32,}$/i`, which `openssl rand -hex 16` produces:
```bash
echo -n "$(openssl rand -hex 16)" | npx wrangler secret put STRAVA_WEBHOOK_PATH_SECRET
```

## What's new in v8.5.1

Security hygiene batch — 3 chores from the v8.5.x burn shipped without the larger #17/#18 work, which reslots to v8.5.2.

- **`STRAVA_VERIFY_TOKEN` fail-closed** (#19) — webhook GET drops the hardcoded fallback; returns 503 if the secret isn't configured. Operator must `wrangler secret put STRAVA_VERIFY_TOKEN` before activating webhook subscriptions.
- **Defensive log redaction** (#20) — `redactSensitive()` + `safeLog/Warn/Error` wrappers strip `api_key=`, `sk-ant-*`, `access_token=`, `refresh_token=` patterns from 5 high-risk `console.*` sites in the Worker.
- **`SECURITY.md`** (#22) — top-level threat model + shipped/planned defences split + deploy runbook + disclosure policy via GitHub Security Advisory.

Two doc-cleanup commits also landed (`257290c`, `fce03cf`) — fixed plan-vs-reality drift in SECURITY.md ("rate-limit gate on /coach" was never planned, removed; webhook 403 → 404 per OWASP) and in README (zones Z1-Z7 not Z1-Z6, molten orange not lime, GitHub Actions not Workers Builds, etc.). See [`SECURITY.md`](./SECURITY.md) for the full security posture.

Deferred to **v8.5.2**: #17 webhook path-secret + #18 KV rate-limit on `/admin/document-release`.
Deferred indefinitely: native Cloudflare rate-limit binding (Workers Free plan limitation).

## What's new in v8.5.0

Polish release — closes 5 v8.5.0 issues identified by the dashboard design audit + ships the regression-test harness's first real coverage.

- **Accent contrast for small text** (#25) — new `--c-accent-light: #ff7a3d` token (~5.2:1 on canvas) for ≤14px text. Pill `.accent`, TopBar `v8` badge, RoutesPicker surface icons swap. PARS `--c-accent` stays the brand CTA color.
- **RideDetail expand: pure opacity** (#24) — drops the `height: auto` animation; opacity-only fade, GPU-composited, no layout per frame.
- **`useFocusTrap` hook + UserMenu keyboard nav** (#27) — extracted from OnboardingModal into a shared hook (`apps/web/src/hooks/useFocusTrap.ts`). UserMenu now: focuses first menuitem on open, ↑/↓/Home/End move between items, ESC closes + restores focus to trigger.
- **BottomNav scroll sync** (#26) — `IntersectionObserver` over the four section IDs; active orange dot follows the section currently in view, not just the last-clicked tab.
- **In-app "What's new" modal** (#13) — TopBar badge appears when the user hasn't seen the current release; opens a modal with the latest 3 CHANGELOG entries. Dismiss persists `cc_lastSeenVersion` in localStorage.

Tests: 11 Vitest unit + 13 Playwright e2e at mobile-375 and desktop-1280.

## What's new in v8.4.0

Dashboard design audit pass against the [`ui-ux-pro-max`](https://github.com/) skill catalog (99 UX guidelines + 44 react-perf + 53 react-stack rules). 22 findings · 13 shipped · 4 deferred to v8.5.0.

- **Reduced-motion respected end-to-end** — `<MotionConfig reducedMotion="user">` wraps the app so JS-prop transitions on `motion.section` honor the OS setting. The `prefers-reduced-motion` block in `tokens.css` now squashes any hardcoded keyframe duration globally, killing the infinite Pill / today-pulse animations for motion-sensitive users.
- **Touch targets ≥ 44 px** on every small ghost button (`subtleBtn`, `surfaceBtn`, `addressEdit`, `demoBannerClose`, `showAll`, `skipBtn`, `dangerBtn`) — the WCAG floor flagged by the skill's Touch: Touch Target Size rule.
- **Modal focus trap + restore** — `OnboardingModal` now traps Tab/Shift-Tab inside the dialog and returns focus to the trigger on close (skill rule: A11y: Manage focus properly).
- **Skip-to-main link** — first focusable element in `__root.tsx`, jumps over TopBar + UserMenu.
- **TopBar safe-area inset** — sticky bar clears the iPhone notch / dynamic island.
- **Address input gets `aria-label`**; **VolumeChart gets `role="img"`** with a generated label and the bogus `role="tablist"` is dropped (no matching tabpanels) — replaced with `aria-pressed` on the toggle buttons.
- **VolumeChart bars: `height` → `transform: scaleY`** — GPU-composited; no more layout pass per frame.
- **Polish** — time-of-day greeting (no more "Morning, Marco" at 9 PM), `alert()` replaced with smooth-scroll to the AI Coach section, demo banner copy cleaned up.
- **Deferred to v8.5.0** — RideDetail expand animation, accent-on-canvas contrast for ≤14px text (`--c-accent-light`), BottomNav scroll-sync, UserMenu keyboard nav. Filed as 4 issues via `scripts/file-v8.4.0-audit-issues.sh`.

Audit report: [`docs/superpowers/specs/2026-04-28-dashboard-design-audit.md`](./docs/superpowers/specs/2026-04-28-dashboard-design-audit.md).

## What's new in v8.3.0

GitHub Issues become the source of truth for the public roadmap. The [`/whats-next`](https://cycling-coach.josem-reboredo.workers.dev/whats-next) page reflects the live issue tracker within five minutes — so weekly releases are driven directly by milestone closures, not a separate spreadsheet.

```
GitHub Issues  ─►  Worker /roadmap  ─►  /whats-next page
[label/milestone]   [5-min edge cache]   [Tanstack Query, 5-min stale]
```

- New `Worker /roadmap` endpoint proxies the GitHub REST API, normalises issues (title, body, labels → area + priority, milestone → target version, assignees → in-progress status), and caches at the edge.
- `useRoadmap` hook with graceful fallback to the static seed (so the page is never blank during the GitHub bootstrap).
- `scripts/bootstrap-issues.sh` — idempotent — sets up labels (`priority:*`, `area:*`, `type:*`), milestones (`v8.3.0`, `v8.4.0`, `v8.5.0`), and the open-backlog issues.
- `CONTRIBUTING.md` documents the workflow.

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the issue conventions and weekly release cadence.

## What's new in v8.2.0

Audited the v8.0.0 open-issue list and shipped four of five remaining items.

- **FTP onboarding** — first-run modal captures FTP / weight / HR max. Live W/kg readout. Real TSS + zone math turns on once saved. Reopen any time from the user menu → *Edit profile*.
- **Strava 7-zone model** — Z7 Neuromuscular (>150 % FTP) added end-to-end. New `--c-z7` token, widened `Zone` type, re-bucketed Z6/Z7, glow + workout stripes updated.
- **PWA shell** — manifest, maskable SVG icon, service worker (cache-first for assets, network-first for navigation, never-cache for `/api/*` + auth). Home-screen install on iOS works.
- **Worker pruned** — `landingPage()`, `dashboardPage()`, `privacyPage()` and their helpers deleted. `callbackPage` + `errorPage` slimmed. `src/worker.js` went from **3,375 → 683 lines** (-80 %).

Deferred to v8.3.0: `[backfill]` (needs the remote D1 migration applied first — that's a `wrangler d1 execute --remote` you run when ready).

## What's new in v8.1.0

Five tracked feature requests, shipped in one release.

- **Editable goal event** — inline editor on the dashboard event card. Name, type, date, distance, elevation, location, priority (A/B/C). Persists locally; syncs to D1 when schema v2 is applied.
- **Disconnect Strava menu** — avatar pill opens a popover with *Sync now*, *Revoke at Strava ↗*, and *Disconnect Strava*. Click-outside + ESC dismiss.
- **Ride detail on tap** — clicking any row in Recents lazy-fetches the rich payload from `/api/activities/{id}` and expands inline: description, photo, decoded polyline (SVG), full stats grid, best efforts, segments with achievements, kilometre splits.
- **`/whats-next` page** — public roadmap with priority + status pills and target versions, linked from the landing footer.
- **Bottom-nav rename** — "Stats" → "Rides", "Recents" → "Previous rides".

See [`CHANGELOG.md`](./CHANGELOG.md) for the full history including v8.0.0 + v8.0.1.

## What's new in v8.0.1 — Hotfix

Critical fix to v8.0.0: the dashboard was rendering Marco mock data even after a successful Strava OAuth round-trip. v8.0.1 wires the auth gate (`/dashboard` with no tokens → `ConnectScreen`), the loading screen, and the real-data swap (`useStravaData` → Tanstack Query → derive every widget from the user's actual rides). Mock data only ever renders in dev or when `?demo=1` is present.

## What's new in v8.0.0

The full **PARS** redesign. Complete architectural reset and a new visual identity.

- **New stack** — React 19 + Vite + TypeScript SPA at `apps/web`, deployed via Cloudflare Workers Static Assets (single Worker now serves both UI and API; no second project, no CORS).
- **New design system** — single-source-of-truth tokens in `apps/web/src/design/tokens.{ts,css}`. Geist + Geist Mono, dark canvas, molten-orange accent, Coggan zones Z1–Z6, square-ish radii. 12 base components.
- **Restored every legacy dashboard widget**: PMC strip (CTL · ATL · TSB), streak heatmap, wins timeline (last 90 d PRs), volume chart (distance + elevation, weekly/monthly), AI weekly plan generator, per-ride AI verdict, saved-routes picker with surface + start-address preferences. All under a Performance-Dark, instrument-panel aesthetic.
- **OAuth dev loop** — `/authorize` and `/callback` honor a `?origin=` query param so Strava bounces back to localhost:5173 (Vite) even though the Worker runs on :8787.
- **Concurrent dev** — `npm run dev:all` boots Worker + Vite together.
- **Schema v2 prepared** — `migrations/0001_pmc_and_events.sql` adds FTP / TSS / NP / IF columns + a `daily_load` PMC rollup table + event-extension columns on goals. Apply once with `wrangler d1 execute`.

Full release notes: see [`CHANGELOG.md`](./CHANGELOG.md).

Status: single-user during Strava multi-user approval.

## Stack

- **Frontend**: React 19 + Vite + TypeScript strict + Tanstack Router/Query + Motion + CSS Modules (no Tailwind by design)
- **Backend**: Cloudflare Workers (existing `src/worker.js`) — Strava OAuth, API proxy, Anthropic Claude proxy, webhook
- **Storage**: Cloudflare D1 (SQLite at edge), localStorage on client (Strangler Fig dual-write)
- **Deploy**: Workers Static Assets (replaces legacy CF Pages). Single Worker serves SPA + API.

<!--
TODO (release-time README sweep): the "Repo layout" component tree, the "Routes" frontend list,
and the "Worker routes" table below all date from v8.0.0 and have drifted as features shipped.
Reconcile with apps/web/src/components/ (current set: AiCoachCard, BikeMark, BottomNav, Button,
Card, Container, Eyebrow, GoalEventCard, GrainOverlay, OnboardingModal, Pill, PmcStrip,
ProgressRing, RideDetail, RideFeedback, RoutesPicker, StatTile, StreakHeatmap, TopBar,
UserMenu, VolumeChart, WhatsNew, WinsTimeline, WorkoutCard, ZonePill), the Tanstack Router
files in apps/web/src/routes/ (currently: __root, index, dashboard, privacy, whats-next),
and wrangler.jsonc → assets.run_worker_first for the Worker route inventory. Per the
"release checklist" rule (planned for CONTRIBUTING.md after v8.5.1), these get reviewed at
every chore(release) commit.
-->

## Repo layout

```
cycling-coach/
├── src/worker.js                  # Worker — auth + API + AI proxy + webhook
├── schema.sql                     # D1 v1 schema
├── migrations/
│   └── 0001_pmc_and_events.sql    # v2 — FTP, TSS columns, daily_load, events
├── wrangler.jsonc                 # Workers Static Assets config + D1 binding
├── package.json                   # build:web, deploy scripts
└── apps/web/                      # React SPA
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── design/
        │   ├── tokens.ts          # Design tokens — TS source of truth
        │   ├── tokens.css         # CSS variables on :root
        │   └── reset.css
        ├── components/
        │   ├── Button/
        │   ├── Card/
        │   ├── Container/
        │   ├── Eyebrow/
        │   ├── Pill/
        │   ├── BikeMark/
        │   ├── BottomNav/         # mobile authed nav
        │   ├── GrainOverlay/
        │   ├── PmcStrip/          # CTL · ATL · TSB at-a-glance
        │   ├── ProgressRing/      # PMC dial / goal ring
        │   ├── StatTile/
        │   ├── TopBar/
        │   ├── WorkoutCard/       # today's workout
        │   └── ZonePill/          # Coggan Z1–Z6
        ├── lib/
        │   ├── auth.ts            # token storage + refresh
        │   ├── api.ts             # Strava client (proxied via Worker)
        │   ├── pmc.ts             # CTL/ATL/TSB exponential moving avg
        │   ├── zones.ts           # Coggan power zones
        │   ├── format.ts          # km, time, date helpers
        │   └── mockMarco.ts       # seeded demo data (Marco persona)
        ├── pages/
        │   ├── Landing.tsx
        │   ├── Dashboard.tsx
        │   └── Privacy.tsx
        ├── routes/                # Tanstack Router file-based routing
        │   ├── __root.tsx
        │   ├── index.tsx
        │   ├── dashboard.tsx
        │   └── privacy.tsx
        └── main.tsx               # React root + RouterProvider + QueryClient
```

## Design system — PARS · Performance Dark

**Concept**: a cycling computer turned into an app. Near-black canvas, molten-orange accent, Geist + Geist Mono, instrument-panel data density.

### Tokens (single source of truth)
- **Type**: Geist (UI) + Geist Mono (numerals). Two families. Mono carries every metric.
- **Color**: dark canvas (`#0a0a0c`), molten orange (`#ff4d00`), Strava 7-zone power model Z1–Z7 (cool→hot ramp; Z7 = Neuromuscular >150% FTP), three status colors, Strava brand reserved for Strava-specific UI. Small-text accent uses `--c-accent-light` (`#ff7a3d`) for AA contrast.
- **Spacing**: 4 px base scale, mobile-first.
- **Radius**: square-ish (max 16 px). No bubble shapes.
- **Shadow**: 1 px lines preferred over shadows. `--sh-glow` reserved for accent moments.
- **Motion**: 6 named durations, 4 named easings. `prefers-reduced-motion` zeros all in CSS.

Tokens live in `apps/web/src/design/tokens.ts` (typed) and are mirrored to `apps/web/src/design/tokens.css` (CSS variables). Components consume CSS variables; Motion / canvas drawing imports the TS object.

### Component grammar
- **Container** — single horizontal-rhythm primitive (4 widths)
- **Button** — primary (molten-orange glow), secondary, ghost, strava
- **Card** — surface primitive, optional accent rule
- **Eyebrow** — mono uppercase tracked, optional `rule` line
- **Pill** — small status chip, optional pulsing dot
- **BikeMark** — linework cyclist glyph (currentColor)
- **TopBar** / **BottomNav** — chrome
- **PmcStrip** — Marco's first-thing-in-the-morning glance
- **ProgressRing** — Motion-animated SVG (used for goal + PMC dials)
- **StatTile** — number + unit + eyebrow, sized sm/md/lg, zone-tinted
- **WorkoutCard** — today's session with proportional zone stripe
- **ZonePill** — Coggan zone chip, glow on dot

## Routes

| Path | Owner | Notes |
|------|-------|-------|
| `/` | React (Landing) | Public marketing — hero, FOR/NOT FOR, features, pricing, final CTA |
| `/dashboard` | React (Dashboard) | Authed home — PMC + event + goal + today's workout + week + recents |
| `/privacy` | React (Privacy) | Editorial Markdown-feel section |
| `/authorize` | Worker | Strava OAuth redirect |
| `/callback` | Worker | OAuth code → tokens → localStorage → /dashboard |
| `/refresh` | Worker | Token refresh |
| `/api/*` | Worker | Strava API proxy |
| `/coach`, `/coach-ride` | Worker | Anthropic Claude proxy (BYOK) |
| `/webhook` | Worker | Strava activity webhook |

Worker routes are listed in `wrangler.jsonc → assets.run_worker_first`. Everything else falls through to the React SPA.

## Local development

```bash
# Terminal 1 — backend (Worker + D1 local)
npm run dev                      # wrangler dev on :8787

# Terminal 2 — frontend
npm run dev:web                  # vite on :5173, proxies /api,/authorize,etc → :8787
```

Open http://localhost:5173 — landing, dashboard (with seeded Marco demo data), privacy.

## Build & deploy

```bash
npm run build                    # builds apps/web → apps/web/dist
npm run deploy                   # build:web → wrangler deploy → docs:sync (Confluence)
```

CI on `pull_request` and `push` to `main`: GitHub Actions workflow `.github/workflows/test.yml` runs three parallel jobs — `unit` (Vitest), `e2e` (Playwright at mobile-375 + desktop-1280), and `build` (TS strict + Vite production build). Failing tests block merge.

Production **deploy is manual** today (`npm run deploy` from a developer's shell, requires `wrangler login` + `ADMIN_SECRET` from `.deploy.env`). Cloudflare Workers Builds auto-deploy is **not** wired — by design, until we want push-to-main to ship.

## Schema migration (v1 → v2)

**Migration applied 2026-04-29 to remote D1 — informational only for new contributors.**

The migration at `migrations/0001_pmc_and_events.sql` adds: FTP / weight / HR max on `users`; TSS / NP / IF / duration columns on `activities`; the `daily_load` PMC rollup table; `training_prefs` table; goal-event fields on `goals`.

For local D1 development, apply once:

```bash
npx wrangler d1 execute cycling_coach_db --file migrations/0001_pmc_and_events.sql
```

After the migration: FTP / weight / HR max are captured via the OnboardingModal (shipped v8.2.0). With those three numbers, all PMC math (CTL · ATL · TSB) becomes real instead of duration-proxy.

## Open issues / next up

See the live roadmap at [`/whats-next`](https://cycling-coach.josem-reboredo.workers.dev/whats-next) — driven by GitHub Issues with milestones (`vX.Y.Z`) and labels (`priority:*`, `area:*`, `type:*`). The page proxies `https://api.github.com/repos/jose-reboredo/cycling-coach/issues` via the Worker `/roadmap` endpoint and is edge-cached for 5 minutes.

## License

Personal project, not licensed for public reuse.
