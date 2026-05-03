# UX Design Specs — Post-Demo Sprint
**Author:** UX Designer — Role 2
**Date:** 2026-04-29
**Version at baseline:** v9.2.5
**Issues addressed:** #47, #48, #49, #50, #51, #52, #53

---

## A. Mobile Navigation Redesign — 4 Bottom Tabs (#51, #48)

Bottom tabs visible on mobile (≤640 px only). Desktop retains existing sidebar layout. Active tab persisted in URL path (`/today`, `/train`, `/rides`, `/you`).

### A1. Tab overview

| Tab | Icon hint | Primary CTA | Empty state |
|-----|-----------|-------------|-------------|
| Today | Sun/calendar | "Start training" | "Rest day — no workout scheduled" |
| Train | Dumbbell/route | "Regenerate plan" | "Set a goal to build your first plan" |
| Rides | List/history | "Log a ride" | "No rides yet — sync Strava or log manually" |
| You | Person | "Save changes" | N/A (always has identity data if signed in) |

### A2. Today tab — information hierarchy

| # | Element | Notes |
|---|---------|-------|
| 1 | Salutation ("Morning, Jose") | Time-aware (Morning/Afternoon/Evening) |
| 2 | KPI row — 3 cards: Week km / Week TSS / Streak days | Labels mandatory per FB-2 |
| 3 | Today's planned workout card | Title + duration + one-line WHY (see §C) |
| 4 | "Start training" CTA button | Deep-links into Train tab at today's session |
| 5 | Year forecast card (AI ring) | Collapsed by default; tap to expand (see §B) |

**Persona relevance:** A — all elements. C — KPI row only (hide TSS, show km + streak); no workout card if no plan. B — same as A plus club ride badge if today is a club event.

**Mobile vs desktop:** On desktop the Today section becomes a dashboard panel — KPIs inline, workout card beside forecast ring (2-column).

**Acceptance criteria:**
- [ ] Salutation reflects time of day correctly.
- [ ] KPI cards each have a visible sub-label (not just a number).
- [ ] Tapping "Start training" navigates to today's session without extra taps.
- [ ] Year forecast card visible without scrolling on 375 px viewport.
- [ ] Empty workout state shown when no session is planned.

---

### A3. Train tab — information hierarchy

| # | Element | Notes |
|---|---------|-------|
| 1 | Plan-summary card: phase + weeks to goal | Only when goal set (see §C) |
| 2 | 7-day grid: Mon–Sun, each cell = workout type + duration | Scrollable horizontally on mobile |
| 3 | Today's session highlighted | Border/bold — not colour (tokens handle colour) |
| 4 | Route picker card | Collapsed; tap opens §D filter sheet |
| 5 | AI Coach card | Last AI tip or "Ask coach..." input |
| 6 | "Regenerate plan" CTA | Triggers plan recalc; spinner during call |

**Persona relevance:** A — full view. B — add "Club ride this week" badge on grid cells. C — omit plan-summary card; show generic tip ("Stay consistent — even 20 min counts").

**Acceptance criteria:**
- [ ] 7-day grid renders without horizontal overflow on 375 px.
- [ ] "Regenerate plan" shows spinner and disables button during recalc.
- [ ] Plan-summary card absent when no goal set; CTA "Set a goal to get a personalized plan" shown instead.
- [ ] Route picker card present and tappable.

---

### A4. Rides tab — information hierarchy

| # | Element | Notes |
|---|---------|-------|
| 1 | Filter bar: date range / type chips / distance chips | Sticky at top |
| 2 | Ride list: paginated ≥10/page, prev/next controls | Per FB-5 |
| 3 | Ride row: date, title, distance, elevation, duration | |
| 4 | Tap ride → ride detail drawer/page | Existing component |

**Persona relevance:** A — all filters. C — date filter only; type/distance less relevant. B — add "Club ride" badge on group rides.

**Acceptance criteria:**
- [ ] Pagination controls visible; page ≥10 rides before next appears.
- [ ] Filters persist within session but reset on hard refresh.
- [ ] Ride detail reachable in one tap from list row.
- [ ] Empty state copy shown when no rides match filters.

---

### A5. You tab

See full spec in §E.

---

## B. Year-to-Date Forecast Redesign (#49)

Replaces static "447 of 8,000 km" bar.

### B1. Forecast card anatomy

| Zone | Content |
|------|---------|
| Top | "Your year in motion" heading |
| Centre | Progress ring: filled arc = YTD actual; projected arc (dashed) = AI endpoint |
| Below ring | Narrative: "At your current pace, ~2,100 km by 31 Dec" |
| Below narrative | If goal set: "Expected fitness at [goal event]: [fitness descriptor]" |
| Bottom | Last updated timestamp |

### B2. Computation rules

| Condition | Behaviour |
|-----------|-----------|
| < 30 days of data | Empty state: "Need 30 days of rides to forecast — train a few weeks first" |
| 30–55 days (< 8 weeks) | Linear projection: (YTD km ÷ days elapsed) × 365 |
| ≥ 8 weeks | AI refinement: linear base + weekly-variance correction via Anthropic call (IR-3) |
| Goal event date set | Second narrative line: "~X weeks to [event] — on track / [gap] km behind pace" |
| No annual goal set | Ring projected endpoint = AI estimate only; no reference line |

### B3. Refresh cadence

Recomputes each time new activities sync from Strava. No manual refresh button needed; timestamp shows staleness.

**Persona relevance:** A — full card with goal tracking. C — simplified: narrative only, no goal-event line. B — no change (same as A).

**Acceptance criteria:**
- [ ] Static "8,000 km" target absent from UI.
- [ ] Forecast narrative present with dynamic Y value.
- [ ] Empty state shown when < 30 days of data.
- [ ] Ring shows two arcs: actual (solid) and projected (dashed).
- [ ] Goal-event line appears only when goal is set.
- [ ] Timestamp updates after each Strava sync.

---

## C. Goal ↔ Planning Integration (#50)

### C1. Goal-set state

| Surface | Content |
|---------|---------|
| Plan-summary card (Train tab, top) | "Base phase · 11 weeks to Etape du Tour" |
| Today's workout card WHY line | "Building base endurance — 11 weeks to Etape" |
| Forecast card (Today tab) | Second narrative line linking fitness to goal date |
| Weekly grid | Each session cell shows phase tag (Base / Build / Peak / Taper) |

### C2. No-goal state

| Surface | Content |
|---------|---------|
| Plan-summary card slot | CTA card: "Set a goal to get a personalized plan →" |
| Today's workout WHY line | Absent |
| Weekly plan | General fitness template; no phase labels |

### C3. Edge cases

| Scenario | UX response |
|----------|-------------|
| Goal date in the past | Banner: "Your goal date has passed — archive it or set a new one" + two CTAs |
| Goal < 2 weeks away | "Race week mode" mini-plan: short activation sessions + rest + race day brief |
| Goal changed mid-plan | Plan recalculates within 2 s; grid refreshes in place (per FB-4 AC) |

**Persona relevance:** A — primary persona; all goal features apply. B — goal may be a club event (group goal future scope, not this sprint). C — goal features hidden; no training plan shown.

**Acceptance criteria:**
- [ ] WHY line present on today's workout card when goal is set.
- [ ] Plan-summary card shows correct phase name and week countdown.
- [ ] CTA "Set a goal" visible in plan-summary card slot when no goal exists.
- [ ] Past-goal banner shown when goal date < today.
- [ ] Race-week mini-plan triggers when goal date within 14 days.
- [ ] Plan recalculates within 2 s of goal save.

---

## D. Route Recommendation Redesign (#47)

### D1. Location resolution (priority order)

| Priority | Source | Override |
|----------|--------|----------|
| 1 | Stored preference (`route_preferences.home_region`) | User can override per session |
| 2 | Strava profile city | — |
| 3 | Browser geolocation (permission prompt) | — |
| 4 | Manual text input | Saved as preference on confirm |

### D2. Filter controls

| Filter | Values | Default by persona |
|--------|--------|--------------------|
| Surface | Any / Paved / Gravel | A → Paved; B → Any; C → Paved |
| Distance | Chips: 10 / 25 / 50 / 100 km + free input | 25 km |
| Difficulty | Flat / Rolling / Hilly | Rolling |

All filters: single-tap chips, no confirm button required. Results refresh on each tap.

### D3. Result card

| Field | Notes |
|-------|-------|
| Route name | |
| Distance + elevation | "42 km · 650 m" |
| Surface badge | Paved / Gravel / Mixed |
| "Open in [provider]" deeplink | Role 3 determines provider; deeplink format TBD |

### D4. Dependency flag for Role 3

> Surface metadata (Paved / Gravel / Mixed) is only available if the chosen provider exposes it (e.g., Komoot has it; raw OSM may not). If provider lacks surface metadata, the surface filter must be hidden or shown as "Approximate" with a caveat. **Role 3 must confirm provider before this filter is finalised.**

### D5. Empty and error states

| Condition | Message |
|-----------|---------|
| No routes match filters | "No routes match — broaden filters or change location" |
| Location unresolvable | "We couldn't detect your location — enter a city to search" |
| Provider API error | "Routes unavailable right now — try again in a moment" |

**Persona relevance:** A — paved + specific distance. B — any surface, longer distances. C — short paved routes; difficulty filter less relevant (default Flat).

**Acceptance criteria:**
- [ ] Zero hardcoded city/coordinate references in route UI.
- [ ] Surface filter shows at least three values.
- [ ] Location resolves from stored preference before prompting geolocation.
- [ ] Empty state shown when no routes found (not silent wrong results).
- [ ] "Open in [provider]" deeplink present on each card.
- [ ] Persona-specific surface defaults applied on first load.

---

## E. Profile / "You" Tab Expansion (#52, #53, #48)

### E1. Section stack (mobile = single column; desktop = sections 1+2 left / 3+4 right)

| # | Section | Editable | Persona notes |
|---|---------|----------|---------------|
| 1 | Identity: photo, name, city | Read-only (Strava sync) | All personas |
| 2 | Training profile: FTP, weight, HR max | Editable | C: FTP + HR optional; show "Set FTP to unlock zone-based training" CTA |
| 3 | AI / Anthropic: masked API key, status | Editable | C: may never set; show "Add key to enable AI coaching" |
| 4 | Strava: connection status, last sync, disconnect | Read/action | All personas |
| 5 | Clubs: list (name + role badge), "Leave" per row | Action | A + B; C likely no clubs |
| 6 | Future: Consent & Data, Data export, Delete account | Greyed "Coming soon" | All personas |
| 7 | Sign out | Action (destructive) | All personas; separated by divider |

### E2. Empty and error states per section

| Section | Empty state | Error state |
|---------|-------------|-------------|
| Identity | — (always populated from sign-in) | "Strava sync failed — reconnect Strava" |
| Training profile | Fields blank with placeholders | Inline validation error on save |
| AI / Anthropic | "No API key — add one to enable AI features" | "Key invalid — test failed; check and re-enter" |
| Strava | Should not occur (user is signed in via Strava) | "Sync failed [timestamp] — Retry" |
| Clubs | "You haven't joined a club yet" | — |
| Future | N/A (static placeholder) | — |

### E3. Clubs section detail (FB-7 roster slice)

Displays only clubs the signed-in user belongs to. Full admin tools (roster, events) are out of scope this sprint; a "Manage club →" link is shown for admin role members.

**Acceptance criteria:**
- [ ] Identity section is read-only; no edit controls shown.
- [ ] FTP/weight/HR fields validate on save with inline errors.
- [ ] API key displayed masked; "Replace key" clears and re-prompts.
- [ ] "Test connection" button present beside API key; shows pass/fail inline.
- [ ] Strava disconnect shows confirmation dialog before action.
- [ ] Clubs list shows role badge (Admin / Member) per row.
- [ ] "Leave club" triggers confirmation before action.
- [ ] Future section rows greyed out with "Coming soon" label.
- [ ] Sign-out button at bottom, separated by divider, triggers confirmation.
- [ ] Desktop layout: Identity + Training profile in left column; AI + Strava in right column.

---

## Open Questions for Founder

1. **Annual goal type:** Should the goal always be a specific event (named race + date + distance), or should a simpler "ride X km by Dec 31" option also be supported for Persona C?
2. **Club goal scope:** Persona B may want a shared club goal (e.g., "2,000 km collectively this month"). Is that in scope for this sprint or deferred?
3. **Anthropic key ownership:** Is the Anthropic key always user-supplied, or will there be an app-level key as a fallback for users who don't have one (especially Persona C)?

## Role 3 (Architect) Dependencies

- **D4 (Route surface filter):** Filter must be conditional on provider exposing surface metadata. Confirm provider + available fields before building the filter UI.
- **B2 (Forecast AI call):** If the Anthropic key is user-supplied (per IR-3), confirm that the Worker can read it per-request without latency impact on the Today tab load.
- **AC-3 (Router):** Confirm whether `/today`, `/train`, `/rides`, `/you` will be nested TanStack routes or client-side tab state — this affects whether the browser back button works within the tab and whether deep-link sharing is supported.
