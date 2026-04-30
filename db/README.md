# Database — Cadence Club D1

Cloudflare D1 (SQLite-on-the-edge). Binding name `cycling_coach_db`. Database id `bfc42f0f-a043-4058-854d-d8ebed9a8e4c` (see `wrangler.jsonc`).

## Two files, one schema

- **`schema.sql`** (project root) — **canonical cumulative state**. Used for fresh local bootstrap. Always reflects the post-latest-migration shape.
- **`migrations/`** (project root) — **incremental change log**. Each migration applies cleanly on top of the previous schema. Used to advance an existing DB (local or remote) without rebuilding.

### Process rule (v9.2.0 onward)

Every migration commit MUST also update `schema.sql` in the same commit. Reviewers reject PRs that drift the two apart. This is the workaround for the gap caught by the 2026-04-30 audit (issue #37) where `schema.sql` was missing migrations 0001 + 0002 — fresh bootstrap was broken until v9.2.0.

If you forget on a PR, the fix is small: re-derive the schema from migrations and update both in the same follow-up commit.

## Bootstrap — fresh local database

```bash
# Fresh local DB from schema (full state, no incremental application)
npx wrangler d1 execute cycling_coach_db --local --file=schema.sql
```

Verify with:

```bash
npx wrangler d1 execute cycling_coach_db --local --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Expected tables: `activities`, `ai_reports`, `club_events`, `club_goals`, `club_members`, `clubs`, `daily_load`, `goals`, `ride_feedback`, `training_prefs`, `user_connections`, `users`.

## Apply a single migration to an existing DB

Local:

```bash
npx wrangler d1 execute cycling_coach_db --local --file=migrations/0003_<name>.sql
```

Remote (production):

```bash
npx wrangler d1 execute cycling_coach_db --remote --file=migrations/0003_<name>.sql
```

Always test against `--local` first.

## Migration tracking — known gaps

- We don't currently use `wrangler d1 migrations` (the official tracking system that records applied migrations in a `d1_migrations` table). Each migration is applied manually via `--file`.
- This means there's no machine-readable record of which migrations have been applied to which environment.
- Mitigation: the migration files in `migrations/` are numbered sequentially (0001, 0002, ...) and idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` patterns). Re-running a migration is safe.
- Future: consider adopting `wrangler d1 migrations apply` once the schema stabilises further. Documented as a backlog item.

## Migrations index

| # | File | Shipped | Description |
|---|---|---|---|
| 0001 | `migrations/0001_pmc_and_events.sql` | v9.0.x | FTP/weight/HR on users; TSS/NP/IF/duration on activities; `daily_load` table; goal-event extensions |
| 0002 | `migrations/0002_club_events.sql` | v9.1.3 | `club_events` table + `(club_id, event_date)` and `(created_by, event_date)` indexes |

## Backups

D1 has automatic point-in-time recovery via Cloudflare's dashboard (last 30 days, free plan). For an explicit dump:

```bash
npx wrangler d1 export cycling_coach_db --remote --output=backup-$(date +%Y%m%d).sql
```

Useful before any destructive migration.
