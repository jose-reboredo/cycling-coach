# Cadence Club

Performance training intelligence for serious cyclists. PMC, structured workouts, smart route picker. Built around the persona of **Marco** — the performance-driven amateur (Zürich, FTP 285, Etape du Tour goal).

**Current release: [v9.2.2](./CHANGELOG.md#922--2026-04-30)** · 2026-04-30 · [Security](./SECURITY.md)

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
