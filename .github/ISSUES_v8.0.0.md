# GitHub issues for v8.0.0 follow-ups

These are the open items from the PARS redesign. Each block is a separate issue: copy the title + body into `gh issue create` or paste into the GitHub web UI.

---

## 1. Hot-swap dashboard mock → real Strava data

**Labels**: `area:dashboard`, `priority:high`, `type:feature`

The dashboard currently always renders seeded Marco-Bianchi mock data. The Tanstack Query plumbing is ready in `apps/web/src/lib/api.ts` + `apps/web/src/lib/auth.ts`, but the swap isn't wired at the page level.

**Acceptance**:
- [ ] When `cc_tokens` localStorage entry is present, `Dashboard.tsx` reads athlete via `stravaApi.athlete()` (Tanstack Query).
- [ ] Activities pulled via `stravaApi.activities()` and reduced into the same shapes the existing widgets consume.
- [ ] Mock data falls back only when no tokens are present (demo mode, banner).
- [ ] Skeleton loading states for all widgets while data is in flight.

**Depends on**: schema v2 migration applied so PMC math has real TSS columns to read.

---

## 2. Apply schema v2 migration to prod D1

**Labels**: `area:db`, `priority:high`, `type:chore`

`migrations/0001_pmc_and_events.sql` adds FTP/weight/HR-max on users, TSS/NP/IF/duration/primary_zone on activities, the `daily_load` PMC rollup table, and event-extension columns on goals.

**Acceptance**:
- [ ] Run `npx wrangler d1 execute cycling_coach_db --file migrations/0001_pmc_and_events.sql` (local).
- [ ] Run `npx wrangler d1 execute cycling_coach_db --file migrations/0001_pmc_and_events.sql --remote` (prod).
- [ ] Verify with `wrangler d1 execute --command "PRAGMA table_info(activities);"` that new columns exist.

---

## 3. TSS backfill from existing `strava_raw_json`

**Labels**: `area:backend`, `priority:high`, `type:feature`

Once schema v2 is applied and a user has set their FTP, walk every existing `activities` row, extract `average_watts` / `weighted_average_watts` from `strava_raw_json`, and compute TSS = (duration_h × IF² × 100). Write back to the new columns.

**Acceptance**:
- [ ] Worker endpoint `/admin/backfill-tss` (auth-gated, single-user-only for now) that walks the activity table.
- [ ] Sets `tss`, `np_w`, `if_pct`, `duration_s`, `primary_zone` per row.
- [ ] Seeds `daily_load` from the resulting rows so PMC has a starting series.
- [ ] Idempotent — re-running doesn't double-count.

---

## 4. FTP onboarding flow

**Labels**: `area:dashboard`, `priority:high`, `type:feature`

First-run flow when the user connects but hasn't set FTP yet — block PMC widgets and prompt for FTP, weight, HR max.

**Acceptance**:
- [ ] Modal or full-screen step on dashboard load when `users.ftp_w IS NULL`.
- [ ] Three inputs: FTP (W), weight (kg), HR max (bpm).
- [ ] "I'll set this later" escape that lets the user use the streak/wins/volume widgets but greys out PMC + AI plan.
- [ ] POSTs to a new Worker endpoint `/profile` that updates `users` table.

---

## 5. Strava 7-zone power model

**Labels**: `area:design-system`, `priority:medium`, `type:feature`

Currently using Coggan's 6-zone model. Strava exposes 7 zones (Z7 = Neuromuscular Power, >150% FTP). When we ingest Strava-side power-zone metadata for activities, extend the system.

**Acceptance**:
- [ ] `Zone` type in `apps/web/src/components/ZonePill/ZonePill.tsx` widened to `1..7`.
- [ ] `--c-z7` token added to `tokens.{ts,css}` (provisional: deeper purple `#6b21a8`).
- [ ] `COGGAN_ZONES` in `lib/zones.ts` extended with Z7 (>150% FTP).
- [ ] `ZonePill` glow + `WorkoutCard.module.css` zone stripe handle Z7.
- [ ] Z7 verified to degrade gracefully on activities that don't have it.

---

## 6. Prune dead HTML handlers from `src/worker.js`

**Labels**: `area:backend`, `priority:medium`, `type:chore`

Workers Static Assets makes `landingPage()`, `dashboardPage()`, `privacyPage()`, `callbackPage()` (HTML rendering portion), and `errorPage()` unreachable. They're still bundled (~60 KB of dead JS).

**Acceptance**:
- [ ] Delete `landingPage()`, `dashboardPage()`, `privacyPage()` and their helpers (`SHARED_HEAD`, `SHARED_BG`, `BIKE_GLYPH`, `FAVICON_B64`, `htmlResponse`).
- [ ] `callbackPage()` slimmed to a tiny HTML page that sets localStorage and redirects.
- [ ] `errorPage()` slimmed similarly OR replaced with a JSON 4xx that the React error route handles.
- [ ] Worker bundle size measurably smaller — verify before/after.
- [ ] No regressions: full OAuth round-trip still lands on `/dashboard`.

---

## 7. Update Cloudflare Workers Builds command

**Labels**: `area:ci`, `priority:high`, `type:chore`

Workers & Pages → cycling-coach → Settings → Builds — the build command must build the SPA before deploying the Worker. Today it's likely `wrangler deploy` only.

**Acceptance**:
- [ ] Build command set to `npm run build:web`.
- [ ] Deploy command stays at `npx wrangler deploy`.
- [ ] Push to main triggers full SPA build → Worker deploy with assets.
- [ ] Smoke: `/`, `/dashboard`, `/privacy` all 200 with React shell after CI deploy.

---

## 8. Live Strava routes (replace mock)

**Labels**: `area:routes`, `priority:medium`, `type:feature`

`apps/web/src/lib/mockRoutes.ts` is a Zürich-area placeholder. The `/api/athlete/routes` proxy is already wired in the Worker.

**Acceptance**:
- [ ] Tanstack Query hook `useRoutes()` calls `/api/athlete/routes`.
- [ ] `RoutesPicker` reads from this query, falls back to `MOCK_ROUTES` only when no tokens.
- [ ] Surface inferred from Strava's `surface` field on the route.
- [ ] Tap a route opens `https://www.strava.com/routes/<id>` in a new tab.
- [ ] Empty state ("You have no saved routes — discover via Komoot/Strava") when the user genuinely has zero.

---

## 9. PWA shell — manifest + service worker

**Labels**: `area:pwa`, `priority:low`, `type:feature`

The legacy app supported home-screen install (`apple-mobile-web-app-*` meta tags). Port that to v8 properly with a manifest and offline shell.

**Acceptance**:
- [ ] `apps/web/public/manifest.webmanifest` with Geist-rendered SVG icons (192, 512, maskable).
- [ ] Service worker that caches `index.html`, the design CSS, and current chunks.
- [ ] Offline page: when no network, dashboard shows last-cached PMC + the prompt "Connect when online".
- [ ] iOS home-screen tested.

---

## 10. Lighthouse mobile ≥ 90

**Labels**: `area:perf`, `priority:medium`, `type:chore`

Brief mandates Lighthouse mobile ≥ 90. Verify and fix.

**Acceptance**:
- [ ] Lighthouse run on `/` mobile preset reports ≥ 90 across Performance / Accessibility / Best Practices / SEO.
- [ ] Same for `/dashboard` (when authed) and `/privacy`.
- [ ] Bundle audit: split Motion if it's preventing the score (it's currently 18.8 KB gzipped).
- [ ] Image-route fonts: preload Geist + Geist Mono first weights, swap in display:swap on the rest.

---

## 11. Surface preference: persist to D1 `training_prefs`

**Labels**: `area:db`, `priority:low`, `type:enhancement`

Today `surface_pref` and `start_address` only live in localStorage. The legacy schema has `training_prefs` ready. Wire D1 dual-write.

**Acceptance**:
- [ ] Worker endpoint `/training-prefs` (POST) writes the row keyed by athlete_id.
- [ ] React `useTrainingPrefs` POSTs on update (Strangler-Fig pattern: continue writing to localStorage too until parity confirmed).
- [ ] Initial load: read from D1 on auth, fall back to localStorage if D1 empty (migration path).

---

## 12. In-app "What's new" modal

**Labels**: `area:dashboard`, `priority:low`, `type:feature`

The legacy dashboard had a changelog modal. Port it to React so users can see release notes without leaving the app.

**Acceptance**:
- [ ] `<WhatsNewLink>` in TopBar trailing slot (small badge if a new version since last view).
- [ ] Modal renders the latest 3 entries from CHANGELOG.md (built at compile time via Vite import or fetched from `/CHANGELOG.md`).
- [ ] "Don't show again for v8.0.0" button stores `cc_lastSeenVersion` in localStorage.
