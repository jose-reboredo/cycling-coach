# Cadence Club

Cycling training app for solo riders and clubs. Reads your Strava history, computes daily form (CTL/ATL/TSB), generates AI-coached weekly plans, and gives clubs a shared schedule with RSVP and AI-drafted weekly recaps.

**Current release:** [v10.0.0](./CHANGELOG.md) · **Live:** [cycling-coach.josem-reboredo.workers.dev](https://cycling-coach.josem-reboredo.workers.dev) · [Security policy](./SECURITY.md)

---

## What it does

- **Daily form** — PMC (CTL/ATL/TSB) computed nightly from your Strava history; visible at the top of the Today tab.
- **AI training plan** — bring-your-own-key Anthropic integration that generates a 7-day plan against your form, FTP, and stated goals. Generation cost ≈ $0.02 per plan; key stays in the browser.
- **Personal scheduler** — Month / Week / Day calendar that aggregates planned sessions and club rides on one surface. Time-blocked, zone-coloured, timezone-aware.
- **Clubs** — Create or join a club. Members RSVP from the calendar. AI drafts a weekly Circle Note recap. FTP stays private by default.
- **Strava integration** — OAuth connect, ride history, "Open in Strava" route handoff, optional saved-routes ranking.

The app is a single-page React 19 app served from a Cloudflare Worker, with D1 (SQLite at the edge) for storage and KV for tokens. Personal sessions and club events share the same calendar primitives and event drawer.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite + TypeScript (strict) |
| Routing | TanStack Router (file-based) |
| Data | TanStack Query |
| Animation | Motion (React) |
| Backend | Cloudflare Workers |
| Database | D1 (SQLite at the edge) |
| KV | Cloudflare KV (token storage) |
| AI | Anthropic Claude (BYOK) |
| Auth | Strava OAuth 2.0 |
| Tests | Vitest + Playwright |
| Build | wrangler + vite |

---

## Local development

```bash
# install
npm install
cd apps/web && npm install && cd ../..

# run worker + web in parallel
npm run dev:all

# web only (Vite dev server, port 5173)
npm run dev:web

# worker only (wrangler dev)
npm run dev:worker

# build
npm run build

# test
cd apps/web && npm run test          # vitest + playwright
cd apps/web && npm run test:unit     # vitest only
cd apps/web && npm run test:e2e      # playwright only
cd apps/web && npm run typecheck     # tsc --noEmit
cd apps/web && npm run lint          # biome
```

### Deploy

```bash
# requires .deploy.env with ADMIN_SECRET set; wrangler.toml configured
source .deploy.env
npm run deploy   # build:web + wrangler deploy + docs:sync
```

The deploy script builds the SPA, deploys the Worker, and posts a release entry to the docs index.

### D1 migrations

```bash
# apply locally
npx wrangler d1 execute cycling_coach_db --local --file migrations/0009_club_events_duration.sql

# apply to remote
npx wrangler d1 execute cycling_coach_db --file migrations/0009_club_events_duration.sql
```

Cumulative-schema policy: every migration also updates `schema.sql` in the same commit.

---

## Project structure

```
apps/web/                 # React SPA
├── src/
│   ├── routes/           # TanStack Router file-based routes
│   ├── components/       # UI components (Calendar, AiCoachCard, ClubDashboard, ...)
│   ├── hooks/            # TanStack Query mutations + queries
│   ├── lib/              # API client, formatters, feature flags
│   ├── design/           # tokens.css + icon library + reset
│   └── pages/            # Landing + legacy Dashboard
src/
└── worker.js             # Cloudflare Worker (~3000 lines)
migrations/               # D1 SQL migrations
schema.sql                # Cumulative schema
docs/                     # Architecture notes
```

### Key route conventions

- Dashboard tabs live under `/dashboard/*` with TopTabs nav (`Today` / `Schedule` / `Train` / `Rides` / `You`).
- Club tabs live under the same route shell when scope.mode === 'club'; ClubDashboard renders Overview / Schedule / Members / Metrics.
- Calendar primitives (`MonthCalendarGrid`, `WeekCalendarGrid`, `DayCalendarGrid`, `EventDetailDrawer`) are shared between the personal scheduler and the club Schedule tab.
- Personal session edit reuses `/dashboard/schedule-new?id=N&range=YYYY-MM` (same template, edit mode hydrated from cached query).

---

## Recent releases

See [CHANGELOG.md](./CHANGELOG.md) for the full history. Highlights:

- **v10.0.0** — Individual dashboard restructure. Today tab reframed as a today-only dossier; planning + AI brief → calendar bridge moved to Train tab. Major bump reflects breaking change in Today tab content.
- **v9.12.8** — Desktop dashboard regression fix; `+ Add to schedule` button bridges the AI brief to the personal scheduler.
- **v9.12.7** — Calendar pills adopt bordered + bold + duration-tagged style across Month/Week/Day grids.
- **v9.12.6** — Landing page restructured around four marketing value pillars; new SchedulePreview visual.
- **v9.12.5** — Personal-session UX bundle: Edit / Mark done / Cancel actions; Unsubscribe for club events; zone-coloured pills; SessionIcon.
- **v9.12.4** — Calendar timezone fix (8 sites switched from `getUTC*` to local accessors); RSVP chip hidden on personal sessions.
- **v9.12.3** — Duration in hours (cycling convention) on event forms; calendar pills now visually book actual duration.
- **v9.12.0–v9.12.2** — Personal scheduler MVP: aggregator route, plan-a-session page, mandatory duration on club events.

---

## Roadmap

The live roadmap at [`/whats-next`](https://cycling-coach.josem-reboredo.workers.dev/whats-next) is driven by GitHub Issues with milestones (`vX.Y.Z`) and area / priority / type labels. The page proxies the GitHub API via the Worker's `/roadmap` endpoint, edge-cached for 5 minutes.

Active themes:

- **v9.13.0** — AI plan persistence (auto-populate the week's planned sessions from the coach output).
- **v9.14.0** — Shareable rides via signed public URL (`/s/:token`).
- **Sprint 6** — Multi-timezone (IANA `tz` column), club analytics, club invite links.

---

## Contributing

Issues and pull requests are welcome. The design intent is documented in `docs/`; the active SemVer rule (CONTRIBUTING-style) is **MINOR for new features, PATCH for fixes / surface-level additions / visual polish**.

A handful of practical notes:

- Run `npm run typecheck` and `npm run lint` before pushing.
- New endpoints must include rate limiting + auth (see existing handlers in `src/worker.js`).
- Schema changes must update both `migrations/NNNN_name.sql` and `schema.sql` in the same commit.

---

## License

Source-available, not licensed for public redistribution. See [SECURITY.md](./SECURITY.md) for vulnerability disclosure.
