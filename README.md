# Cadence Club

Cycling clubs with an AI training brain. PMC for the solo rider; Overview / Schedule / Members / Metrics with AI-drafted Circle Notes for the club. Built for three personas: **Marco** (performance amateur, Zürich, FTP 285), **Sofia** (Saturday-crew captain), **Léa** (casual commuter who wants to belong).

**Current release: [v9.7.2](./CHANGELOG.md#972--2026-05-01)** · 2026-05-01 · [Security](./SECURITY.md)

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
