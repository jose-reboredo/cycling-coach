-- =============================================================
-- Migration 0001 — PMC + structured events (P2 path)
-- =============================================================
-- Adds:
--   1. FTP, weight, HR max on users (athlete profile for zone math)
--   2. TSS / NP / IF / duration columns on activities (so PMC works)
--   3. daily_load rollup table (CTL/ATL/TSB precomputed per day)
--   4. Goal-event extensions (target_event_date, event_type, event_name)
-- =============================================================

-- 1. USERS — add FTP, weight, HR max
ALTER TABLE users ADD COLUMN ftp_w INTEGER;
ALTER TABLE users ADD COLUMN weight_kg REAL;
ALTER TABLE users ADD COLUMN hr_max INTEGER;
ALTER TABLE users ADD COLUMN ftp_set_at INTEGER;

-- 2. ACTIVITIES — TSS / NP / IF / duration_s as first-class columns
-- (previously only in strava_raw_json blob)
ALTER TABLE activities ADD COLUMN duration_s INTEGER;
ALTER TABLE activities ADD COLUMN average_watts INTEGER;
ALTER TABLE activities ADD COLUMN np_w INTEGER;
ALTER TABLE activities ADD COLUMN if_pct REAL;
ALTER TABLE activities ADD COLUMN tss REAL;
ALTER TABLE activities ADD COLUMN primary_zone INTEGER; -- 1..6 Coggan; will widen to 1..7 when Strava 7-zone ingestion lands

CREATE INDEX IF NOT EXISTS idx_activities_athlete_tss
  ON activities(athlete_id, start_date_local DESC, tss);

-- 3. daily_load — fast PMC reads. One row per athlete per day.
-- ctl/atl recomputed nightly when activities change.
CREATE TABLE IF NOT EXISTS daily_load (
  athlete_id INTEGER NOT NULL REFERENCES users(athlete_id) ON DELETE CASCADE,
  date TEXT NOT NULL,        -- ISO YYYY-MM-DD
  tss_sum REAL NOT NULL DEFAULT 0,
  ctl REAL NOT NULL DEFAULT 0,
  atl REAL NOT NULL DEFAULT 0,
  tsb REAL NOT NULL DEFAULT 0,
  computed_at INTEGER NOT NULL,
  PRIMARY KEY (athlete_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_load_athlete_date
  ON daily_load(athlete_id, date DESC);

-- 4. GOALS — extend for structured events (Etape du Tour, Gran Fondo, etc.)
ALTER TABLE goals ADD COLUMN event_name TEXT;
ALTER TABLE goals ADD COLUMN event_type TEXT;       -- 'gran_fondo' | 'tt' | 'crit' | 'race' | 'volume'
ALTER TABLE goals ADD COLUMN event_distance_km REAL;
ALTER TABLE goals ADD COLUMN event_elevation_m REAL;
ALTER TABLE goals ADD COLUMN event_location TEXT;
ALTER TABLE goals ADD COLUMN event_priority INTEGER DEFAULT 1; -- 1=A race, 2=B, 3=C

-- =============================================================
-- BACKFILL (run once after schema applies)
-- =============================================================
-- Compute TSS retroactively from existing strava_raw_json. Requires
-- users.ftp_w to be set. Runs as a follow-up Worker job — see
-- apps/web/scripts/backfill-tss.ts (TODO: write in Phase 5).
-- =============================================================
