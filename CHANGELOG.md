# Changelog

All notable releases. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning [SemVer](https://semver.org/).

---

## [8.1.0] — 2026-04-28

Five tracked feature requests, shipped in one release.

### Added

- **Editable goal event** — `useGoalEvent` hook + `<GoalEventCard>` component. The dashboard event card now has an Edit affordance that flips it into an inline form: name, type (Gran Fondo / Race / TT / Crit / Volume / Tour / Other), date, distance, elevation, location, priority (A / B / C). Persists to localStorage; will sync to D1 once schema v2 is applied (the `goals` table already has `event_name`, `event_type`, `target_date` columns).
- **Disconnect Strava menu** — avatar pill is now a popover trigger (`<UserMenu>`). Three actions: *Sync now* (invalidates Tanstack Query cache), *Revoke at Strava ↗* (opens `strava.com/settings/apps` so users can fully drop the OAuth grant), *Disconnect Strava* (clears local tokens + redirects to `/`). Backed by ESC + click-outside to dismiss.
- **Ride detail on tap** — clicking any row in Recents expands an inline detail panel that lazy-fetches `/api/activities/{id}` via Tanstack Query (cached forever). Surfaces description, primary photo, decoded route polyline rendered as inline SVG, full stats grid (distance / time / elevation / avg + max HR / avg + max + NP watts / kJ), best efforts (PRs by distance), segment efforts with achievements, kilometre splits with elevation deltas, and an "Open on Strava ↗" link. Demo mode renders a stat-only fallback.
- **What's next page** at `/whats-next` — public roadmap sourced from `lib/roadmap.ts` (mirrors `.github/ISSUES_v8.0.0.md`). Three sections (In progress / Open / Shipped) with priority + status pills, area tag, target version. Linked from the landing footer.
- **`useActivityDetail`** — Tanstack Query hook with `staleTime: Infinity` (ride data never changes after upload) + 30-min GC.
- **`lib/polyline.ts`** — Google polyline decoder + a `polylineToSvg()` helper that projects to a viewBox preserving aspect ratio.

### Changed

- **Bottom nav** — "Stats" tab renamed to **"Rides"** to match its content (recent ride list, not aggregate analytics).
- **Recents heading** updated from "Recents" to "**Previous rides**" with copy that points users at both the tap-to-expand detail and the AI coach verdict.
- **`MOCK_EVENT`** is now a default seed only; the live source is the `useGoalEvent` hook backed by localStorage.
- **`stravaApi`** gained `activityDetail(id)` + the `StravaActivityDetail` / `StravaSplit` / `StravaBestEffort` / `StravaSegmentEffort` / `StravaPhoto` types.

### Files

```
apps/web/src/
├── components/
│   ├── GoalEventCard/       (new — editable event card)
│   ├── RideDetail/          (new — lazy-loaded expansion panel)
│   └── UserMenu/            (new — avatar popover)
├── hooks/
│   ├── useActivityDetail.ts (new)
│   └── useGoalEvent.ts      (new)
├── lib/
│   ├── polyline.ts          (new)
│   └── roadmap.ts           (new)
├── pages/
│   └── WhatsNext.tsx + .module.css  (new)
└── routes/
    └── whats-next.tsx       (new)
```

---

## [8.0.1] — 2026-04-28 — Hotfix

Critical fix: the v8.0.0 dashboard was rendering Marco-Bianchi seed mock data **regardless of authentication state** — even after a successful Strava OAuth round-trip. v8.0.1 wires the real-data swap and hardens the auth gate.

### Fixed

- **Dashboard auth gate** — `/dashboard` with no Strava tokens now renders a dedicated `ConnectScreen` instead of mock data. Mock data only ever shows in dev (`import.meta.env.DEV`) or when the URL carries `?demo=1`.
- **Real-data swap** — when tokens exist, `Dashboard` fetches the user's athlete profile (`/api/athlete`) and last 200 activities (`/api/athlete/activities`) via Tanstack Query through the Worker proxy, converts them to the internal shape (`stravaConvert.ts`), and derives every widget (PMC, streak, wins, volume, recents, AI coach context) from real data.
- **Loading screen** — first-time syncs show a centered spinner with copy ("Syncing your rides…") instead of a flash of mock content.
- **Token refresh on 401** — `useStravaData` clears tokens when Strava returns `not_authenticated`, falling through to the ConnectScreen.

### Added

- `ConnectScreen` page — full editorial connect prompt with primary CTA, fact row, and `?demo=1` discovery hint.
- `LoadingScreen` page — centered spinner + status copy, used during initial fetch.
- `lib/stravaConvert.ts` — Strava activity → internal `MockActivity` mapper. Computes real TSS / primary zone when FTP is known; falls back to a duration-based proxy (≈70 TSS/h) marked clearly in the UI.
- `lib/pmc.ts → computePmcDelta()` — PMC + 7-day delta from any activity list (was hard-wired to mock).
- `useStravaData` / `useAthlete` / `useActivities` / `useRides` Tanstack Query hooks.
- Dashboard `↻` and `⏻` buttons in TopBar wire to `queryClient.invalidateQueries` and `clearTokens` respectively (sync + disconnect).
- Profile photo support — Strava `athlete.profile` URL renders in the user pill; falls back to initials.

### Changed

- All widgets now compute their data from a single `activities` array passed into `<DashboardView>`. The fork between mock + real lives in one place (`<DashboardInner>`).
- Greeting copy now reads form state from PMC ("Form is fresh / productive / fatigued / overreached") instead of hardcoded mock text.
- Year-to-date km computed from real activities filtered to current year. Yearly goal target still mocked (8,000 km) until goals UI ships.
- "TSS proxy" disclosure rendered under quick stats when FTP is unset, so the user knows the PMC numbers are an estimate.

### Known limitations

- **Strava app callback domain** — if you set callback domain to `localhost` during dev testing in v8.0.0, OAuth fails in prod with "redirect_uri mismatch". Reset to your production domain at <https://www.strava.com/settings/api> (one-time fix on Strava's side; not in this repo).
- **Goal event** still mocked (Etape du Tour). Real events table TBD — see `[goal-events]` in the issues file.
- **FTP onboarding** — the dashboard now correctly shows "—" for FTP/W·kg and the duration-based TSS proxy when FTP is unknown. The first-run flow capturing FTP is open as `[ftp-onboarding]`.

---

## [8.0.0] — 2026-04-28

**The PARS redesign.** Full architectural reset: the dashboard moves to a React/Vite SPA layered on top of the existing Worker via Cloudflare Workers Static Assets. Single deploy, single URL, no CORS. The aesthetic flips from the prior light editorial theme to **Performance Dark** — near-black canvas, molten-orange accent, Geist + Geist Mono, instrument-panel data density. Designed for **Marco** — the performance-driven amateur cyclist (Zürich, FTP-aware, training 8–12 h/week).

### Added — frontend

- **React 19 + Vite + TypeScript strict** SPA at `apps/web`. Tanstack Router (file-based, type-safe), Tanstack Query, Motion, CSS Modules, Biome.
- **Design system v1** — single source of truth in `apps/web/src/design/tokens.{ts,css}`. Tokens for color (canvas, surface, text, accent, Coggan zones Z1–Z6, status), spacing (4 px base), radius, shadows, motion durations + easings, type scale, z-index, breakpoints.
- **Twelve base components**: `Button`, `Card`, `Container`, `Eyebrow`, `Pill`, `BikeMark`, `BottomNav` (mobile authed nav), `GrainOverlay`, `PmcStrip`, `ProgressRing`, `StatTile`, `TopBar`, `WorkoutCard`, `ZonePill`.
- **Landing** route — hero ("Train like the metrics matter"), instrument-cluster preview (live PMC + workout + ring), credentials band, FOR / NOT FOR honesty list, 3 feature spreads, BYOK pricing, final CTA, editorial footer.
- **Privacy** route — editorial sections, success/warn callout boxes, mono code spans.
- **Dashboard** route — see "Dashboard sections" below.

### Added — dashboard sections

1. **Hero fold** — italic greeting, PMC strip (CTL · ATL · TSB with 7-day deltas), 4 quick stats, goal-event countdown, yearly km goal ring with projected year-end.
2. **Today's workout** — uses the AI-generated plan when available, falls back to a sample WorkoutCard.
3. **Streak heatmap** — 12 weeks × 7 days, 5 intensity buckets, current/best/total numbers, today cell pulses.
4. **Wins timeline** — last 90 days of PRs surfaced as a feed.
5. **Volume chart** — distance + elevation bars, weekly/monthly toggle, 12-bucket window, totals header.
6. **AI Coach** — three states: BYOK setup → sessions/week picker (1–7 with hint copy) + Generate → full plan render (summary, strengths, areas to improve, 7-day plan with today highlight, motivation, regenerate).
7. **Routes for today** — saved routes scored against today's plan + surface preference (Tarmac/Gravel/Any) + start address. Match % per row, top-3 default with "Show all".
8. **Recents** — 8 most recent rides with inline "Get coach verdict" panel calling `/coach-ride`.

### Added — backend / infra

- **Workers Static Assets** in `wrangler.jsonc` (replaces the legacy CF Pages flow). Single Worker serves SPA + API. `run_worker_first` lists OAuth + API + AI + webhook paths.
- **`migrations/0001_pmc_and_events.sql`** — schema v2 adds `users.ftp_w / weight_kg / hr_max`, `activities.tss / np_w / if_pct / duration_s / primary_zone`, new `daily_load` PMC rollup table, event-extension columns on `goals`. *(Migration ready; not auto-applied. Apply with `wrangler d1 execute`.)*
- **`/authorize` + `/callback` honor `?origin=`** so OAuth redirect_uri returns to the user's actual host (works in Vite dev at :5173 even though Worker runs at :8787). Origin is base64-JSON-encoded into Strava's `state` param to survive the round-trip. Strict allowlist: only localhost loopbacks accepted.
- **Concurrent dev** — `npm run dev:all` boots Worker + Vite together via `concurrently`. Vite proxies `/api`, `/authorize`, `/callback`, `/refresh`, `/coach`, `/coach-ride`, `/version`, `/webhook` to the Worker.

### Changed

- **Type stack**: Geist (UI) + Geist Mono (numerals). Two families. Inter is gone.
- **Color**: dark canvas + molten orange `#ff4d00`. Strava brand orange `#fc4c02` retained but reserved for Strava-specific UI (sync indicators, attribution).
- **Build & deploy**: root `package.json` adds `dev:web`, `dev:worker`, `dev:all`, `build:web`, `build`, `deploy` scripts. Single `npm run deploy` builds the SPA then `wrangler deploy`s the Worker with assets attached.

### Restored from v7 (after the initial redesign dropped them)

- AI weekly plan generator (sessions-per-week picker, full plan render).
- Per-ride AI feedback (verdict + concrete next-time suggestion).
- Streak heatmap.
- Wins timeline.
- Volume chart.
- Saved routes picker with surface + start-address preferences.
- All preferences keyed under `cc_*` localStorage to maintain compatibility with the legacy Worker's keys.

### Persona-driven design decisions

- **Mono for every numeral** — like a Garmin Edge / Wahoo BOLT screen.
- **No emoji as visual currency** — replaced with crafted SVG glyphs (BikeMark, ★, ◆).
- **Square-ish radii** (max 16 px) — instrument-coded, not bubble-shaped.
- **Italic flourishes only on emphasis words** — italic = brand inflection, not body copy.
- **Topographic SVG behind the landing hero** — Ordnance Survey / cycling-map atmosphere.
- **`prefers-reduced-motion` zeroes every duration** in CSS — single guard, never per-component.

### Known limitations / next up

- Dashboard renders **seeded Marco-Bianchi mock data** by default. The real-data swap (live `/api/athlete` + `/api/athlete/activities` via Tanstack Query) is wired in `lib/api.ts` and `lib/auth.ts` but not yet hot-swapped at the page level. Apply schema v2 migration first, then flip the toggle.
- TSS backfill from existing `strava_raw_json` — schema columns added, backfill script not yet written.
- Strava 7-zone power model — currently using Coggan's 6 (Z1–Z6). Z7 token + ingestion pending. See `lib/zones.ts`.
- The legacy `landingPage()` / `dashboardPage()` / `privacyPage()` functions in `src/worker.js` are unreachable under Workers Static Assets but still bundled. Pruning them is a follow-up.
- Cloudflare Pages app's previous CI build command may still be `wrangler deploy` only — update Workers & Pages → cycling-coach → Settings → Builds → Build command to `npm run build:web` for full CI/CD.

---

## [7.0.3] — 2026-04-26

Final pre-redesign release. Editorial-light theme with Instrument Serif numerals, Strava orange accent, single-column 780 px dashboard. Featured: streak heatmap, wins timeline, AI weekly plan, per-ride coach verdicts, training prefs, routes picker, yearly goal ring, distance/elevation charts, ride detail expansion. Strangler-Fig D1 dual-write in progress (sub-phase 2.2a).

## [7.0.0]–[7.0.2] — earlier in April 2026

Iterations on the v7 editorial theme — heatmap colors, hero typography, footer rhythm, surface-preference flow, route scoring algorithm.
