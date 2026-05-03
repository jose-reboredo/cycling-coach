# Sprint 4 · Architecture Changes (Issue #53)
**Author:** Architect · **Date:** 2026-04-30  
**ADRs locked:** S4.1–S4.5 (approved 2026-04-30)  
**Inputs:** `01-business-requirements.md`, `03-cto-review.md`, `schema.sql`, `migrations/`, `src/worker.js`

---

## §A. Schema Design

### Existing table additions

| Table | Column(s) | Type / Default | Phase | Reason |
|---|---|---|---|---|
| `users` | `ftp_visibility` | `TEXT NOT NULL DEFAULT 'private'` | 2 | ADR-S4.4 opt-in; `'private'\|'public'` |
| `club_members` | `trend_arrow`, `trend_updated_at` | `TEXT`, `INTEGER` (both NULL) | 2 (column); 4 (populated) | Cron-computed trend; add early so Phase 4 cron has the column |
| `club_events` | `event_type`, `distance_km`, `pace_band` | `TEXT NOT NULL DEFAULT 'ride'`, `REAL`, `TEXT` | 3 | ADR-S4.2 — multi-type events. **Not in migration 0002 despite `02-cto-review.md §B` claim; confirmed absent from `schema.sql` and `migrations/0002_club_events.sql`.** |

### New tables

**`event_rsvps` (Phase 2)** — per-member RSVP state; `UNIQUE(event_id, athlete_id)` enforces idempotency.

```sql
CREATE TABLE event_rsvps (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id    INTEGER NOT NULL REFERENCES club_events(id) ON DELETE CASCADE,
  athlete_id  INTEGER NOT NULL REFERENCES users(athlete_id) ON DELETE CASCADE,
  status      TEXT    NOT NULL DEFAULT 'going',   -- 'going' | 'not_going'
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (event_id, athlete_id)
);
CREATE INDEX idx_rsvps_event   ON event_rsvps(event_id, status);
CREATE INDEX idx_rsvps_athlete ON event_rsvps(athlete_id, event_id);
```

**`club_circle_notes` (Phase 5)** — AI-drafted + admin-editable weekly Circle Notes; `week_start_date` is the cron dedup key.

```sql
CREATE TABLE club_circle_notes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id           INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  body              TEXT    NOT NULL,
  is_ai_draft       INTEGER NOT NULL DEFAULT 1,          -- 1=AI origin, 0=admin
  author_athlete_id INTEGER REFERENCES users(athlete_id), -- NULL for cron drafts
  week_start_date   TEXT    NOT NULL,   -- ISO YYYY-MM-DD (Monday)
  published_at      INTEGER,            -- NULL = draft
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  UNIQUE (club_id, week_start_date)
);
CREATE INDEX idx_circle_notes_club_week ON club_circle_notes(club_id, week_start_date DESC);
```

**`club_metrics_rollup` (Phase 5)** — pre-aggregated club-level weekly stats; privacy boundary for all LLM prompts (see §F).

```sql
CREATE TABLE club_metrics_rollup (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id             INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  week_start_date     TEXT    NOT NULL,   -- ISO YYYY-MM-DD (Monday)
  total_hours         REAL    NOT NULL DEFAULT 0,
  total_distance_km   REAL    NOT NULL DEFAULT 0,
  avg_pace_kmh        REAL,
  active_member_count INTEGER NOT NULL DEFAULT 0,
  new_member_count    INTEGER NOT NULL DEFAULT 0,
  member_count_total  INTEGER NOT NULL DEFAULT 0,
  computed_at         INTEGER NOT NULL,
  ai_narrative        TEXT,              -- cached B-AI-5 Haiku output
  ai_narrative_at     INTEGER,
  UNIQUE (club_id, week_start_date)
);
CREATE INDEX idx_metrics_rollup_club_week ON club_metrics_rollup(club_id, week_start_date DESC);
```

### Migration files (inline SQL)

> **`schema.sql` rule:** Per v9.2.0 process rule (`schema.sql` lines 6–9, `CONTRIBUTING.md`), every migration commit must also update `schema.sql`. Reviewers reject PRs that drift the two.

> **Numbering note (corrected 2026-04-30):** `migrations/` currently has `0001`, `0002`, `0004_training_prefs_route_filters.sql` (already shipped). `0003` is reserved for #52 (`users.sex` / `users.country`). Sprint 4 migrations therefore use `0005`, `0006`, `0007` to avoid the existing `0004` collision. Renumbered from the architect's first draft. See §G.1 — the founder's call on whether to renumber the existing `0004` to fill the `0003` gap is moot since `0004` is shipped to remote D1.

**`migrations/0005_clubs_expansion_phase2.sql`** — v9.6.1
```sql
ALTER TABLE users       ADD COLUMN ftp_visibility   TEXT    NOT NULL DEFAULT 'private';
ALTER TABLE club_members ADD COLUMN trend_arrow      TEXT;
ALTER TABLE club_members ADD COLUMN trend_updated_at INTEGER;
CREATE TABLE IF NOT EXISTS event_rsvps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id   INTEGER NOT NULL REFERENCES club_events(id)      ON DELETE CASCADE,
  athlete_id INTEGER NOT NULL REFERENCES users(athlete_id)    ON DELETE CASCADE,
  status     TEXT    NOT NULL DEFAULT 'going',
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  UNIQUE (event_id, athlete_id));
CREATE INDEX IF NOT EXISTS idx_rsvps_event   ON event_rsvps(event_id, status);
CREATE INDEX IF NOT EXISTS idx_rsvps_athlete ON event_rsvps(athlete_id, event_id);
```

**`migrations/0006_clubs_expansion_phase3.sql`** — v9.6.2
```sql
ALTER TABLE club_events ADD COLUMN event_type  TEXT NOT NULL DEFAULT 'ride';
ALTER TABLE club_events ADD COLUMN distance_km REAL;
ALTER TABLE club_events ADD COLUMN pace_band   TEXT;
```

**`migrations/0007_clubs_expansion_phase5.sql`** — v9.6.4
```sql
CREATE TABLE IF NOT EXISTS club_circle_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  body TEXT NOT NULL, is_ai_draft INTEGER NOT NULL DEFAULT 1,
  author_athlete_id INTEGER REFERENCES users(athlete_id),
  week_start_date TEXT NOT NULL, published_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  UNIQUE (club_id, week_start_date));
CREATE INDEX IF NOT EXISTS idx_circle_notes_club_week ON club_circle_notes(club_id, week_start_date DESC);
CREATE TABLE IF NOT EXISTS club_metrics_rollup (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  week_start_date TEXT NOT NULL,
  total_hours REAL NOT NULL DEFAULT 0, total_distance_km REAL NOT NULL DEFAULT 0,
  avg_pace_kmh REAL, active_member_count INTEGER NOT NULL DEFAULT 0,
  new_member_count INTEGER NOT NULL DEFAULT 0, member_count_total INTEGER NOT NULL DEFAULT 0,
  computed_at INTEGER NOT NULL, ai_narrative TEXT, ai_narrative_at INTEGER,
  UNIQUE (club_id, week_start_date));
CREATE INDEX IF NOT EXISTS idx_metrics_rollup_club_week ON club_metrics_rollup(club_id, week_start_date DESC);
```

---

## §B. API Endpoint Specs

| Method + Path | Auth | Body / Query | Response 200 (shape) | Key errors | Rate-limit | Phase | Notes |
|---|---|---|---|---|---|---|---|
| `GET /api/clubs/:id/overview` | member | — | `{ club, stat_tiles{hours_28d,distance_28d,member_count,goal_pct}, upcoming_events[], circle_note\|null }` | 401 403 404 | none | 1 | Single D1 batch (4 stmts). Readiness dots resolved client-side from a separate load call to keep Phase 1 independent of Phase 4 data. |
| `POST /api/clubs/:id/events/:eventId/rsvp` | member | `{ status: 'going'\|'not_going' }` | `{ status, confirmed_count }` | 401 403 404 422 | `checkRateLimit('clubs-write', id, 30, 60)` | 2 | `ON CONFLICT … DO UPDATE` — idempotent. Returns fresh `confirmed_count` for optimistic UI. |
| `GET /api/clubs/:id/events/:eventId/rsvps` | member | — | `{ confirmed_count, avatars[{athlete_id,firstname,profile_url}] }` (max 12) | 401 403 404 | none | 2 | ADR-S4.5: avatars + count visible to all members. No FTP in this payload. |
| `PATCH /api/users/me/profile` | Strava token | `{ ftp_visibility? }` | `{ athlete_id, ftp_visibility }` | 401 422 | `checkRateLimit('profile-write', id, 10, 60)` | 2 | Column allowlist enforced in handler — never interpolate user-supplied column names. |
| `GET /api/clubs/:id/events?range=YYYY-MM` | member | `range` (req), `type` (opt) | `{ events[{id,title,event_date,event_type,distance_km,pace_band,confirmed_count,location}] }` | 401 403 400 | none | 3 | Extends existing handler; adds `range` branch. `confirmed_count` via LEFT JOIN on `event_rsvps WHERE status='going'`. |
| `GET /api/clubs/:id/members` _(extend)_ | member | `sort` `dir` query params | `{ members[{…,ftp_w\|null,trend_arrow\|null,hours_28d,attended_count}] }` | 401 403 | none | 2 + 4 | FTP masking per ADR-S4.4 (§F). `sort=ftp` puts NULLs last. Phase 4 populates `trend_arrow`. |
| `GET /api/clubs/:id/metrics` | member | `weeks` (1–12, def 12) | `{ load_curve[], leaderboard[], ai_narrative\|null, ai_narrative_at\|null }` | 401 403 | none | 5 | `load_curve` from `club_metrics_rollup`; `ai_narrative` stale-while-revalidate (weekly cron). Same FTP masking as `/members`. |
| `POST /api/clubs/:id/circle-note` | Captain / Pace-Setter | `{ body, is_ai_draft }` | `{ id, club_id, body, is_ai_draft, author_athlete_id, week_start_date, published_at }` | 401 403 422 | `checkRateLimit('clubs-write', id, 30, 60)` | 5 | `INSERT OR REPLACE` on `(club_id, week_start_date)`; `week_start_date` computed server-side. Cron drafts have `author_athlete_id=NULL`. |

---

## §C. Worker Cron Handler

**`wrangler.jsonc` addition (Phase 4):**
```jsonc
"triggers": { "crons": ["0 6 * * 1"] }
```

**Handler shape:**
```js
export default {
  async fetch(request, env, ctx) { /* existing */ },
  async scheduled(event, env, ctx) {
    // KV dedup — Cloudflare may fire twice; skip if already ran today
    const key = `cron-last-run:${new Date().toISOString().slice(0, 10)}`;
    if (await env.DOCS_KV.get(key)) return;
    await env.DOCS_KV.put(key, '1', { expirationTtl: 7 * 24 * 3600 });

    try { await runTrendArrows(env); }       catch (e) { safeWarn('[cron] trend arrows:', e.message); }
    try { await runMetricsRollup(env); }     catch (e) { safeWarn('[cron] metrics rollup:', e.message); }
    try { await runCircleNoteDrafts(env); }  catch (e) { safeWarn('[cron] circle notes:', e.message); }
  },
};
```

| Task | Phase | What it does |
|---|---|---|
| `runTrendArrows` | 4 | 4-week avg speed vs 12-week trailing avg per member → writes `club_members.trend_arrow`. No LLM. |
| `runMetricsRollup` | 5 | Aggregate `activities` per club for current week → upsert `club_metrics_rollup`. Club-level only. |
| `runCircleNoteDrafts` | 5 | For clubs missing a draft for `week_start_date`: fetch `club_metrics_rollup` + `club_goals`, call Haiku, INSERT draft into `club_circle_notes`. |

Failure mode: each task independently try/caught; `safeWarn` + skip; no retry; next Monday picks up. Per `02-cto-review.md §C.2`.

---

## §D. AI Prompt Design

Privacy invariant: only pre-aggregated club-level integers/ratios enter any LLM call. No `athlete_id`-keyed rows, no raw activity records. See `01-clubs-experience-design.md §B` and §F.

| Moment | Model | Paid by | Input shape (privacy-safe) | Output JSON | Tokens (in/out) | Cost est. | Fallback |
|---|---|---|---|---|---|---|---|
| B-AI-1 Circle Note draft | `claude-haiku-4-5` | System | `{ club_name, week_start_date, goal_title, goal_target, hours_banked, distance_km, active_members, new_members }` — from `club_metrics_rollup`+`club_goals` | `{ draft: string }` 2–4 sentences | ~200 / ~150 | ~$0.001/club/wk | Draft absent → admin sees "Write manually". Never blocks render. |
| B-AI-5 Metrics insights | `claude-haiku-4-5` | System | Last 4 `club_metrics_rollup` rows: `[{ week_start_date, total_hours, total_distance_km, avg_pace_kmh, active_member_count }]` — no names, no IDs | `{ narrative: string }` 2–3 sentences | ~350 / ~120 | ~$0.001/club/wk | `ai_narrative=null` → "Insights updating…" badge. Chart/leaderboard render regardless. |
| B-AI-6 Post-ride callout | `claude-haiku-4-5` | System | `{ member_firstname, nth_club_ride_count, event_title }` — caller's own data only | `{ callout: string }` ≤1 sentence | ~80 / ~30 | ~$0.0001/event | Static template fallback: `"Nice work, {firstname} — {n} club rides!"`. Never blocks webhook write. |
| B-AI-4 Schedule suggestion | `claude-sonnet-4-5` | BYOK user | `{ daily_load_last7[{date,ctl,atl,tsb}], upcoming_events[{id,title,event_date,distance_km,pace_band}] }` — caller only | `{ suggestion: { event_id, rationale } }` | ~500 / ~100 | ~$0.001/trigger | No key → chip not rendered. API error → chip shows "Suggestion unavailable". Never blocks tab. |

---

## §E. Phase Boundaries

| Phase | Release | Schema | Endpoints | Cron tasks | Frontend |
|---|---|---|---|---|---|
| 1 | v9.6.0 | none | `GET /overview` | none | 4-tab shell; Overview stat tiles + Upcoming; Circle Note as plain admin text; slim sticky header |
| 2 | v9.6.1 | mig 0005 (`event_rsvps`, `users.ftp_visibility`, `club_members.trend_arrow`) | `POST+GET /rsvp`, `PATCH /me/profile`, extend `GET /members` | none | Members tab full (FTP masking, role badges, sort); RSVP on Overview |
| 3 | v9.6.2 | mig 0006 (`club_events` columns) | `GET /events?range` (extend handler) | none | Schedule calendar + filters; conflict pill (admin); multi-type event pills |
| 4 | v9.6.3 | none (uses Phase 2 columns + `daily_load`) | none new | `runTrendArrows`; `scheduled` export lands | Readiness dots (Overview); trend arrows (Members + Metrics leaderboard) |
| 5 | v9.6.4 | mig 0007 (`club_circle_notes`, `club_metrics_rollup`) | `GET /metrics`, `POST /circle-note` | `runMetricsRollup`, `runCircleNoteDrafts` | Metrics tab full; Circle Note auto-draft + edit; post-ride callout; BYOK schedule chip |

---

## §F. Privacy + Security Notes

**ADR-S4.4 — server-side FTP filter** (not client-side hide):

```
if (caller.role IN ('captain','pace_setter') OR member.ftp_visibility = 'public')
  → serialize ftp_w
else
  → ftp_w = null   ← absent from JSON payload; nothing to un-hide in DOM
```

Applies to both `GET /members` and `GET /metrics` leaderboard rows.

**AI prompt privacy:** `club_metrics_rollup` is the privacy boundary. No rows from `activities`, `daily_load`, or any `athlete_id`-keyed table enter any prompt. B-AI-6 exception: only the caller's own `firstname` + aggregate count — no peer data.

**Rate-limit coverage — write paths only:**

| Endpoint | Scope key | Limit / Window |
|---|---|---|
| `POST /rsvp` | `clubs-write` | 30 / 60 s |
| `POST /circle-note` | `clubs-write` | 30 / 60 s |
| `PATCH /me/profile` | `profile-write` | 10 / 60 s |

Read endpoints are membership-gated; no additional rate-limit needed at current scale.

---

## §G. Open Architectural Questions

1. **Migration numbering — RESOLVED.** `migrations/` has `0001`, `0002`, `0004` shipped; `0003` reserved for #52. Sprint 4 uses `0005`, `0006`, `0007` to avoid the existing `0004` collision. No founder action required.

2. **`event_type` column absent from `club_events`.** `02-cto-review.md §B ADR-S4.2` states the column "already exists in migration 0002" — confirmed absent from both `migrations/0002_club_events.sql` and `schema.sql`. Phase 1–2 event creation must default `event_type='ride'` until migration 0005 deploys.

3. **B-AI-6 fires on the Strava webhook path, not cron.** The `SYSTEM_ANTHROPIC_KEY` must be available to `fetch` at activity-sync time. Confirm the per-athlete Haiku call (≤80 tokens) stays within the 50 ms CPU budget on the free Workers plan before Phase 5 ships.
