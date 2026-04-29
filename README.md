# Cycling Coach

Performance training intelligence for serious cyclists. PMC, structured workouts, smart route picker. Built around the persona of **Marco** — the performance-driven amateur (Zürich, FTP 285, Etape du Tour goal).

**Current release: [v8.5.0](./CHANGELOG.md#850--2026-04-29)** · 2026-04-29 · [Security](./SECURITY.md)

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
- **Color**: dark canvas (`#0a0a0c`), molten orange (`#ff4d00`), Coggan zones Z1–Z6 (cool→hot ramp), three status colors, Strava brand reserved for Strava-specific UI.
- **Spacing**: 4 px base scale, mobile-first.
- **Radius**: square-ish (max 16 px). No bubble shapes.
- **Shadow**: 1 px lines preferred over shadows. `--sh-glow` reserved for accent moments.
- **Motion**: 6 named durations, 4 named easings. `prefers-reduced-motion` zeros all in CSS.

Tokens live in `apps/web/src/design/tokens.ts` (typed) and are mirrored to `apps/web/src/design/tokens.css` (CSS variables). Components consume CSS variables; Motion / canvas drawing imports the TS object.

### Component grammar
- **Container** — single horizontal-rhythm primitive (4 widths)
- **Button** — primary (lime glow), secondary, ghost, strava
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
npm run deploy                   # build then wrangler deploy
```

CI/CD on push to `main`: Cloudflare Workers Builds runs `npm run build:web && npx wrangler deploy`. Configure in CF dashboard → Workers → cycling-coach → Settings → Builds.

## Schema migration (v1 → v2)

Apply `migrations/0001_pmc_and_events.sql` once via wrangler:

```bash
npx wrangler d1 execute cycling_coach_db --file migrations/0001_pmc_and_events.sql
npx wrangler d1 execute cycling_coach_db --file migrations/0001_pmc_and_events.sql --remote
```

Adds: FTP/weight/HR max on users; TSS/NP/IF/duration columns on activities; `daily_load` PMC rollup table; goal-event fields.

After the migration: ask Marco for his FTP via a one-time settings flow (TODO in Phase 5). With that one input, all PMC math becomes real, not mocked.

## Open issues / next up

- `[zones]` Strava uses 7 power zones (Z7 = Neuromuscular Power); we use Coggan's 6. When we ingest Strava-side power-zone metadata for activities, extend `Zone` to 1..7 and add `--c-z7` token. See `apps/web/src/lib/zones.ts`.
- `[backfill]` Compute TSS retroactively from existing `activities.strava_raw_json` once `users.ftp_w` is set. Migration is in place; backfill script not yet written.
- `[auth-replace]` `Dashboard.tsx` currently always renders mock Marco data. Wire `useAthlete()` + `useActivities()` Tanstack Query hooks to swap in real Strava data when tokens present.
- `[worker-prune]` `src/worker.js` still has dead `landingPage()` / `dashboardPage()` / `privacyPage()` HTML. Workers Static Assets makes them unreachable but they bloat the bundle. Prune in a cleanup pass.
- `[ftp-onboarding]` First-run flow asking Marco for FTP, weight, HR max, goal event.
- `[pwa]` Existing `apple-mobile-web-app-*` meta lives on the React `index.html`. Add a service worker + manifest for true PWA install.

## License

Personal project, not licensed for public reuse.
