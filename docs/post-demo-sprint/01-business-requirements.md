# Post-Demo Business Requirements
**Session:** Merkle demo debrief, 2026-04-30
**Author:** Business Analyst — Role 1
**Product version at demo:** v9.2.5

---

## Stories

### FB-1 · Route Recommendation — Data Source & Surface Filter

**User story**
As a **solo rider (A)** or **club admin (B)**, I want route suggestions that match my actual location and preferred surface type, so that I can discover real, rideable routes without manual workarounds.

**Acceptance criteria**
- Entering "Madrid" returns routes geographically centred on Madrid (not any hardcoded city).
- Surface filter offers at least three values: **Any**, **Paved**, **Gravel**.
- Selecting "Paved" hides gravel/unpaved routes; selecting "Gravel" hides paved-only routes.
- Route data is fetched from a non-Strava provider (see Implicit Requirements §1).
- Zero hardcoded coordinate/city references remain in the route-recommendation codebase.
- Error state shown when no routes found for a region rather than silently returning wrong results.

**Priority:** P0 — blocks next demo

**Dependencies:** Data-provider evaluation (implicit req IR-1) must complete first.

**Complexity:** L (16–40 h) — includes provider integration, API key management, filter UI.

---

### FB-2 · My Account Dashboard Clarity

**User story**
As a **solo rider (A)**, I want a clear, self-explanatory account dashboard, so that I can quickly understand my data and navigate to the right section without guessing.

**Acceptance criteria**
- Every section on the dashboard has a visible, descriptive heading.
- KPI cards carry a one-line label explaining what the metric means (e.g., tooltip or sub-label).
- Navigation between sections requires no more than one tap/click from the dashboard.
- A usability test with one unfamiliar user produces zero "I don't know what this means" observations for labelled items.
- Empty state copy present for any section with no data yet.

**Priority:** P1 — needed next round

**Dependencies:** FB-5 (mobile tabs restructure) — layout changes overlap.

**Complexity:** M (4–16 h)

---

### FB-3 · AI-Powered Year-End Forecast

**User story**
As a **solo rider (A)**, I want an AI-projected year-end distance forecast based on my current pace, so that I have a motivating, realistic target rather than an arbitrary fixed goal.

**Acceptance criteria**
- The static "X of 8,000 km" bar is replaced with a forecast card.
- Forecast reads: "At your current pace you will ride ~Y km by 31 Dec."
- Y is calculated from: (YTD distance ÷ days elapsed) × 365.
- An AI model refines the linear projection using weekly-variance data when ≥ 8 weeks of history exist (falls back to linear when < 8 weeks).
- Forecast refreshes automatically each time new activities sync.
- The 8,000 km hard-coded goal is removed from the UI; a user-configurable annual goal remains optional (FB-4 dependency).

**Priority:** P1

**Dependencies:** FB-4 (goal linkage) — the configurable goal field feeds into the forecast card.

**Complexity:** M (4–16 h) — linear projection is S; AI refinement adds M overhead.

---

### FB-4 · Goal Linked to Weekly Planning

**User story**
As a **solo rider (A)**, I want my annual goal to drive the weekly training plan, so that every planned session meaningfully contributes toward my target.

**Acceptance criteria**
- Weekly plan shows a "towards goal" label or progress indicator on each session.
- Changing the goal immediately recalculates the weekly target (km/week or hours/week).
- If no goal is set, the weekly plan section prompts the user to set one.
- The detached "Goal" display card on the dashboard is removed; goal is surfaced only inside the weekly planning context.
- Plan recalculation is visible within 2 seconds of goal save.

**Priority:** P1

**Dependencies:** FB-3 (forecast card) shares goal field; do FB-4 first.

**Complexity:** M (4–16 h)

---

### FB-5 · Mobile Pagination & Tab Structure

**User story**
As a **casual commuter (C)** or **solo rider (A)** on mobile, I want a tabbed, paginated interface, so that I can navigate sections without scrolling through one long page.

**Acceptance criteria**
- Four bottom tabs on mobile: **Today**, **Train**, **Rides**, **You**.
- **Today** tab contains: salutation, KPIs, what's planned for today, start-training CTA, year forecast.
- **Train** tab contains: weekly plan, goal progress.
- **Rides** tab contains: recent activities list with pagination (≥ 10 items per page, prev/next controls).
- **You** tab contains: profile info (FB-6), settings.
- Tabs are not shown on desktop (≥ 1024 px); desktop retains sidebar/section layout.
- Active tab state is persisted across page refresh (URL or localStorage).

**Priority:** P0 — blocks next demo (mobile UX is currently one-page / unusable on phone)

**Dependencies:** FB-2 (dashboard clarity) and FB-6 (profile expansion) for tab content.

**Complexity:** L (16–40 h)

---

### FB-6 · Expanded Edit Profile / My Account

**User story**
As a **solo rider (A)**, I want a full "My Account" profile page where I can manage personal data, API keys, and future consent settings, so that the app feels complete rather than a stub.

**Acceptance criteria**
- Existing FTP, Weight, HR Max fields retained.
- New fields: Name, Date of birth, Gender, City/Country, Strava connection status (read-only link).
- Anthropic API key field: masked input, save + test button (tests with a cheap ping call), stored encrypted at rest.
- Placeholder section "Consent & Data" with a "coming soon" notice (no functional requirement yet).
- All fields validate on save; inline error messages for invalid input.
- Profile picture upload is out of scope for this sprint.

**Priority:** P1

**Dependencies:** FB-5 (You tab is the host for this page).

**Complexity:** M (4–16 h) — API key encryption adds ~4 h.

---

### FB-7 · Club Features Expansion

**User story**
As a **club admin (B)**, I want richer club management tools, so that I can effectively organise rides, communicate with members, and track collective performance beyond the MVP.

**Acceptance criteria**
- Stakeholder to provide prioritised feature list before implementation begins (details TBD — see note below).
- Interim deliverable: a scoped feature backlog in `docs/post-demo-sprint/club-features-backlog.md` reviewed and signed off by the product owner.
- At minimum for this sprint: member roster page (list members, show join date, role badge Admin/Member).
- Existing create/join/events/invite-link functionality is not regressed.

**Priority:** P1

**Dependencies:** None (clubs MVP already live).

**Complexity:** XL (40 h+) for full expansion; M for roster-only slice.

> **Note:** "More club features" is intentionally vague. A scoping session is needed before implementation. This story is filed to create the issue and trigger that conversation.

---

## Implicit Requirements

| ID | Description | Triggered by |
|----|-------------|-------------|
| IR-1 | **Route data-provider evaluation** — Strava cannot supply route suggestions. Must evaluate alternatives (e.g., Komoot API, Waymarked Trails, OpenRouteService, RideWithGPS API) on: free tier limits, geo coverage, surface-type metadata, licensing. Output: ADR doc before coding begins. | FB-1 |
| IR-2 | **API key storage security** — Storing the Anthropic key in D1 requires encryption at rest (not plain text). Needs a KV-based secret or Workers Secrets binding, or AES encryption before D1 write. | FB-6 |
| IR-3 | **AI model integration for forecast** — FB-3's refined projection requires calling the Anthropic API from the Worker. If the user's own key is used (FB-6), the Worker must read it per-request. Token cost / latency implications need a spike. | FB-3, FB-6 |
| IR-4 | **Mobile breakpoint strategy** — FB-5 introduces a mobile-only tab nav. The existing Tailwind/component strategy must define the breakpoint and ensure desktop layout is not broken. | FB-5 |
| IR-5 | **Goal data model** — Currently the goal may be a UI-only field; FB-4 requires it to be persisted and read by the planning engine. Verify whether it is already in D1. | FB-4 |

---

## Architecture-Conflict Flags

| Flag | Feedback | Conflict |
|------|----------|----------|
| AC-1 | FB-1 | Route data was seemingly designed around Strava's API. Switching provider means a new API client, new env secrets, and potentially new rate-limit/cost model — not a drop-in swap. |
| AC-2 | FB-3 | A hardcoded 8,000 km goal lives somewhere in the frontend. If the goal is not persisted in D1, the AI forecast Worker call has nothing to read — frontend-only state cannot drive a server-side model. |
| AC-3 | FB-5 | TanStack Router's current route tree is likely flat/desktop-centric. Mobile tabs require either nested routes (`/today`, `/train`, `/rides`, `/you`) or a client-side tab state manager — both touch the router config. |
| AC-4 | FB-6 | Storing the Anthropic API key in D1 conflicts with the principle of keeping secrets in Cloudflare Workers Secrets. A hybrid approach (key encrypted with a Workers Secret as the cipher key, ciphertext in D1) needs an explicit ADR. |

---

## Schema-Change Flags

| Flag | Table(s) affected | Change needed | Triggered by |
|------|-------------------|--------------|-------------|
| SC-1 | `users` or new `user_goals` | Add `annual_goal_km`, `annual_goal_type` columns (or new table) | FB-4, FB-3 |
| SC-2 | `users` | Add personal profile columns: `dob`, `gender`, `city`, `country` | FB-6 |
| SC-3 | `users` | Add `anthropic_api_key_enc` (encrypted blob) + `anthropic_api_key_iv` | FB-6, IR-2 |
| SC-4 | Potentially new `route_preferences` | Store user surface preference, home region | FB-1 |

> All schema changes require a new migration file in `migrations/` and a `wrangler d1 migrations apply` step — coordinate with Architect (Role 2).
