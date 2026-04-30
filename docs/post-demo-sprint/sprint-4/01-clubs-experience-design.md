# Sprint 4 · Clubs Experience Design — Issue #53
**Layer:** BA + UX
**Date:** 2026-04-30
**Wireframes:** Locked (4-tab IA: Overview / Schedule / Members / Metrics)
**Directive:** AI-embedded, seamless, adds value to the personas

---

## §A — Stories per Persona

### Persona A — Marco (performance-driven amateur)

**A-1 · Club ranking at a glance**
> As Marco, I want to see how my FTP and monthly hours compare to other club members, so that I know who is pushing me and where I sit in the pecking order.
- Overview members rail shows Marco's own row highlighted vs peers.
- Members tab default sort is FTP descending; Marco's row is visually distinguished.
- Relative rank (e.g. "#2 of 8") is visible without opening the full table.
- No absolute FTP values of other members are exposed without their consent (privacy flag).
- Priority: **P0** · Affects: Overview, Members

**A-2 · AI-driven readiness signal before a group ride**
> As Marco, I want an AI readiness nudge before I RSVP to Saturday's ride, so that I can decide whether to push or rest based on my recent training load.
- RSVP row on Overview shows a per-user readiness indicator (green / amber / red).
- Indicator is derived from the caller's own `daily_load` data — never peers' private data.
- Tapping the indicator expands a one-line AI rationale ("Your 7-day load is elevated — consider the shorter route").
- If no `daily_load` data exists for the user, the indicator is hidden (no broken state).
- Priority: **P0** · Affects: Overview (Upcoming section)

---

### Persona B — Club Admin / Captain

**B-1 · Operational drift alert for the Circle Note**
> As the club captain, I want an AI-drafted weekly summary of who is slipping, who is surging, and whether the collective goal is on track, so that I can send a timely note without manually crunching numbers.
- The Circle Note section renders an AI-generated draft (editable before publish) when the captain opens Overview.
- Draft reads collective hours, distance, new members from the rolling 28-day window.
- Captain can accept as-is, edit, or discard (admin-only write path).
- Published note is visible to all members with the author name and date stamp.
- Priority: **P0** · Affects: Overview (Circle Note)

**B-2 · Conflict detection on the schedule**
> As the club captain, I want the schedule to flag when a planned group ride clashes with a major local event or another club's ride, so that I avoid low-attendance sessions.
- Schedule calendar shows a conflict pill (amber) when two events share the same day for the same region filter.
- Conflict detail on hover/tap: "3 members have another event this day."
- Admin can dismiss a conflict flag per event.
- Conflict detection runs on event create/update; no background polling required.
- Priority: **P1** · Affects: Schedule

**B-3 · Invite and member management**
> As the club captain, I want to invite new members by sharing the club link and quickly see who joined recently, so that I can welcome them and assign pace-setter roles.
- Overview invite URL is one-tap copy; Share button triggers native share sheet on mobile.
- Members tab "NEW" badge is applied automatically to members who joined within the last 30 days.
- Captain can promote any member to Pace Setter or Captain role from the Members tab row actions.
- Role change is logged (audit trail) and confirmed with an inline success toast.
- Priority: **P1** · Affects: Overview, Members

---

### Persona C — Casual Commuter (Léa)

**C-1 · Friendly RSVP without stats overwhelm**
> As a casual commuter, I want to RSVP to a group ride with a single tap and see a friendly confirmation, so that I feel included without being intimidated by pace or FTP data.
- The Upcoming section on Overview shows ride title, date, confirmed count, and a single "RSVP" button.
- The RSVP confirm state shows "You're in! 8 others confirmed" — no pace or FTP data on this view.
- A calendar prompt (Add to Calendar) is offered post-RSVP.
- Members stats columns (FTP, Hours/Mo) are hidden by default for members whose role is "Member" (not Captain / Pace Setter); they can opt in via profile settings.
- Priority: **P0** · Affects: Overview (Upcoming), Members

**C-2 · AI encouragement after a completed group ride**
> As a casual commuter, I want a short celebratory message after I complete a ride logged against the club event, so that I feel rewarded for showing up.
- When Léa's Strava activity posts on a day matching an RSVP'd club event, the Overview Circle Note area surfaces a personalised "Nice work, Léa — you've now ridden with the crew 3 times!" callout.
- Callout is AI-generated (Haiku), system-paid, fires once per completed event.
- Callout auto-dismisses after 7 days; not shown on subsequent logins if dismissed.
- No callout fires if the activity cannot be matched to a club event (no false positives).
- Priority: **P1** · Affects: Overview

---

## §B — AI Embedding Points

### B-AI-1 · Circle Note auto-draft (Overview — Circle Note section)
- **Where:** Overview tab, Circle Note card
- **What it shows:** A weekly AI-drafted summary of collective training — hours banked, distance covered, standout members, progress toward club goal.
- **Trigger:** Weekly cron (Monday 06:00 UTC) + on-demand "Regenerate" button visible to admins only.
- **Source data:** `club_goals`, `club_members`, aggregated `activities` for the rolling 28-day window (summed server-side before LLM call; raw activities not passed).
- **Cost class:** System-paid Haiku (short summarisation prompt, <300 tokens output).
- **Persona served:** B (authoring), C (reading).

### B-AI-2 · Per-user RSVP readiness indicator (Overview — Upcoming section)
- **Where:** Overview tab, each row in the Upcoming rides list.
- **What it shows:** A colour-coded readiness dot (green / amber / red) next to the RSVP button, reflecting the current user's training load vs the ride's expected effort.
- **Trigger:** Page load (caller's own data only; no cross-member data).
- **Source data:** `daily_load` for the authenticated user (last 7 days ATL/CTL); ride distance/effort inferred from the event's distance tag when present.
- **Cost class:** No AI — statistical threshold only (ATL/CTL ratio; no LLM call).
- **Persona served:** A (explicit decision), C (gentle nudge framing).

### B-AI-3 · Members tab AI form-trend arrow (Members tab — table rows)
- **Where:** Members tab, FTP column or a new "Trend" column alongside FTP.
- **What it shows:** A directional arrow (up / flat / down) per member indicating whether their effective pace has trended over the last 4 weeks relative to their trailing 12-week average.
- **Trigger:** Weekly cron (same Monday run as B-AI-1); cached result served on tab load.
- **Source data:** `activities` aggregated per `athlete_id` (avg speed per week); no raw activity data sent to LLM.
- **Cost class:** No AI — statistical (rolling average comparison; no LLM call).
- **Persona served:** A (competitive context), B (admin spotting drift).

### B-AI-4 · "Best ride for you today" schedule suggestion (Schedule tab — filter sidebar)
- **Where:** Schedule tab, above the TYPE filter group, as a collapsible "Suggested for you" chip.
- **What it shows:** One recommended upcoming ride from the calendar ("Given your load, the Wed 10 May moderate ride looks like a good fit") with a direct link to RSVP.
- **Trigger:** On-demand — fires when the user opens the Schedule tab if they have BYOK Sonnet configured.
- **Source data:** `daily_load` (caller), upcoming `club_events` (next 14 days), `users.ftp` equivalent field.
- **Cost class:** BYOK Sonnet (richer contextual recommendation; user-borne cost; gracefully absent when no key set).
- **Persona served:** A (optimal training alignment), C (decision simplification).

### B-AI-5 · Metrics tab AI-narrated insights feed (Metrics tab — primary content area)
- **Where:** Metrics tab, top of the main content area, above the collective load curve.
- **What it shows:** A 2-3 sentence AI narration of the club's month ("Your club is 12% above average pace vs last month — Marco's volume is up 40%, keep an eye on recovery signals").
- **Trigger:** Weekly cron (same Monday run as B-AI-1); shown as a "Last updated Mon" badge.
- **Source data:** `club_metrics_rollup` (proposed, see §E); pre-aggregated collective stats — no individual-level data in the LLM prompt.
- **Cost class:** System-paid Haiku.
- **Persona served:** A (competitive framing), B (admin awareness), C (plain-language digest).

### B-AI-6 · Post-ride celebratory callout (Overview — Circle Note / top of page)
- **Where:** Overview tab, rendered as a transient banner above the Circle Note when applicable.
- **What it shows:** Personalised "Nice work, [name] — you completed your Nth club ride!" message.
- **Trigger:** Activity sync event: when a Strava activity is written to `activities` on a day matching the user's RSVP'd event date, the Worker checks for the match and flags the callout.
- **Source data:** `activities`, `event_rsvps` (proposed), `club_events`.
- **Cost class:** System-paid Haiku (short encouragement prompt, <80 tokens output).
- **Persona served:** C (belonging), A (streak awareness).

---

## §C — Per-Tab UX Flows

### Overview tab

> **2026-04-30 founder update — cover hero dropped.** The wireframe's striped cover block + bold italic title is removed. Club name + metadata band (`EST. 2024 · LONDON · 8 MEMBERS · *PRIVATE*`) collapses into a slim sticky header above the tabs row, reclaiming ~280 px of vertical space for content.

On load the user sees the slim club header (name + metadata + tabs row) within 200 ms — no LLM dependency on first paint. Immediately below, the "Circle, This Month" stat tiles render from a lightweight aggregation query; the RSVP readiness dots populate once `daily_load` resolves (max 400 ms, progressive). The primary CTA is the RSVP button on the first upcoming ride row. Secondary CTA is the Share invite link (one-tap copy). The Circle Note loads last — it is display-only for non-admins; admins see an "Edit / Regenerate" affordance.

### Schedule tab

The filter sidebar starts collapsed on mobile, expanded on desktop. Selecting any filter (TYPE, DISTANCE, PACE, REGION, MEMBER LEVEL) immediately re-queries the calendar — no Submit button; debounced 200 ms. The month view updates to show only matching RIDE pills. Clicking a RIDE pill opens a side-drawer (not a new page) showing event title, distance, pace band, confirmed count, location, and the RSVP button. RSVP is a single POST; the confirmed count increments optimistically. The "Suggested for you" chip (B-AI-4) is displayed above the filter stack; tapping it pre-fills the filters that match the suggestion.

### Members tab

The default sort on load is FTP descending (matching the wireframe "SORTED BY FTP" header). The SORT BY dropdown exposes: FTP, Hours/Mo, Attended, Joined, Name. Search is as-you-type (client-side filter on the loaded member list; no round trip). Role badges (Captain, Pace Setter, NEW) render as inline chips directly on the name cell — visible at a glance without expanding the row. Clicking a member row opens a member profile drawer: their avatar, role, join date, trend arrow (B-AI-3), and — if the viewer is an admin — role-change controls and a "Remove from club" destructive action behind a confirmation step. Non-admin viewers see only public stats and the member's recent attended events.

### Metrics tab

This tab is defined here for the first time (wireframes omit it). It contains three stacked sections:

1. **AI Insights feed** (B-AI-5) — plain-language 2-3 sentence digest of the club's month. System-paid Haiku, weekly cron. Displayed first; gives non-technical members an entry point.
2. **Collective load curve** — a 12-week chart of total club hours per week, overlaid with a trend line. Statistical only; no AI. X-axis is week, Y-axis is hours; each bar is colour-coded by volume quintile.
3. **Member leaderboard** — sortable table (FTP / Hours / Attended) with trend arrows from B-AI-3. Admins see all columns; members see FTP masked by default (opt-in to reveal per profile setting). The leaderboard is the competitive heartbeat of the tab for Persona A; the AI digest above it keeps Persona C engaged without demanding she interpret the chart.

---

## §D — Acceptance Criteria (Definition of Done)

- All four tabs render and are navigable without a full-page reload (SPA routing or tab-switch pattern consistent with the existing dashboard).
- The Overview stat tiles load within 500 ms on a cold edge cache; the AI Circle Note draft may take up to 3 s and shows a skeleton loader while pending.
- RSVP is idempotent: double-tapping the button does not create duplicate RSVPs; the button toggles to "Cancel RSVP" after first confirmation.
- All new interactive elements (RSVP, Share, filter chips, sort dropdown, member row click) are keyboard-navigable and carry appropriate ARIA labels, consistent with the #43/#44 accessibility patterns already applied in the dashboard.
- Colour-coded readiness dots and trend arrows carry a text alternative (title or aria-label) so they are not information conveyed by colour alone.
- AI-generated text (Circle Note, insights feed, callout) is visually labelled as AI-assisted (a small "AI" or star glyph beside the content block) so users understand it is not admin-authored copy.
- Admin-only controls (Circle Note edit, role-change, member remove) are not rendered in the DOM for non-admin sessions — not merely hidden via CSS.
- The Members tab search filters only the already-loaded member list; no extra network request fires per keystroke.
- The Schedule conflict pill (B-2) is shown only to admins; regular members see no conflict indicators (information they cannot act on).
- The Metrics tab leaderboard FTP column is masked by default for "Member" role viewers; a visible "Show stats" toggle in the header un-masks with a single click (privacy-first default).
- No new feature increases the bundle size by more than 15 kB gzipped before the architect reviews the component split.
- All new D1 queries use prepared statements; no raw string interpolation of user-supplied values.

---

## §E — Schema + Endpoint Flags

Implied additions not covered by the current schema (`clubs`, `club_members`, `club_goals`, `club_events`) or current endpoints (`POST /api/clubs`, `GET /api/clubs`, `POST /api/clubs/join/:code`, `GET|POST /api/clubs/:id/events`, `GET /api/clubs/:id/members`):

- `event_rsvps` table — required by the RSVP flow (B-1, C-1, B-AI-6); columns at minimum: `event_id`, `athlete_id`, `status`, `created_at`.
- `club_circle_notes` table — stores published (and draft) Circle Notes with `is_ai_draft` flag, `published_at`, `author_athlete_id`; required by B-1 and B-AI-1.
- `club_metrics_rollup` table — pre-aggregated weekly club stats (total hours, total distance, avg pace, member count delta); feeds B-AI-5 without sending raw activity rows to the LLM.
- `GET /api/clubs/:id/overview` — single endpoint to power the Overview tab stat tiles + upcoming events + circle note in one round trip (avoids N+1 on tab open).
- `POST /api/clubs/:id/events/:eventId/rsvp` — create / toggle RSVP; returns updated confirmed count.
- `GET /api/clubs/:id/metrics` — serves Metrics tab: leaderboard rows + pre-aggregated load curve data.
- `POST /api/clubs/:id/circle-note` — admin write path for publishing (or overwriting) the Circle Note; accepts `{ body, is_ai_draft }`.
- Worker cron handler (`scheduled` export) — weekly Monday run to generate Circle Note draft (B-AI-1), update metrics rollup (B-AI-5), and recompute trend arrows (B-AI-3).

---

## §F — Open Questions for Founder

1. **Members rail bar value `312 V`** — the wireframe shows a numeric + "V" label beside each member avatar. Is "V" weekly volume in km, TSS, FTP watts, or a proprietary Cadence score? The answer determines whether B-AI-3's trend arrow replaces this bar or sits alongside it.
2. **Calendar event types** — the Schedule wireframe shows only `RIDE` pills. Should club events like café stops, races, or training camps appear as distinct pill types (different colours or icons), or is everything a "ride" at this stage?
3. **Circle Note authorship model** — should the note be (a) fully AI-generated and admin-approved before publish, (b) AI-drafted with free-text editing, or (c) admin-only plain text with AI as an optional "Suggest" button? The cost model and UX differ significantly.
4. **FTP privacy default** — the Members wireframe shows FTP (as avg speed, km/h) for every row. Should non-admin members be able to see each other's FTP/pace, or is the default masked and opt-in? Persona C may feel intimidated; Persona A wants the competitive signal.
5. **RSVP visibility** — can members see who else has RSVP'd (names + avatars), or just the confirmed count? Social-presence design for C differs from the count-only design.
6. **Metrics tab leaderboard ranking basis** — the wireframe shows km/h (avg speed) as the sort metric, which penalises climbers vs flat riders. Should the leaderboard offer multiple ranking axes (FTP, Volume, Consistency/Attendance), and if so, which is the default?
