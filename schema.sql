-- =============================================================
-- Cadence Club DB Schema — cumulative state through v9.6.2
-- =============================================================
-- Source of truth for fresh-bootstrap parity. Every column added by
-- migrations/0001_pmc_and_events.sql, /0002_club_events.sql,
-- /0004_training_prefs_route_filters.sql is mirrored here so a fresh
-- `wrangler d1 execute --file=schema.sql` produces a working DB. The
-- migration files are kept as the authoritative record of the change
-- history; this file is the snapshot.
--
-- Process rule (v9.2.0 onward, see CONTRIBUTING.md):
--   Every migration MUST also update schema.sql in the same commit.
--   Reviewers reject PRs that drift the two apart.
--
-- Multi-source ready (Strava today, Garmin / AppleHealth later) +
-- clubs + collective goals + per-club events.
-- =============================================================

-- ============= USERS =============
CREATE TABLE users (
  athlete_id INTEGER PRIMARY KEY,
  firstname TEXT,
  lastname TEXT,
  profile_url TEXT,
  raw_athlete_json TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  -- v9.0.x (migration 0001) — athlete profile for zone math + PMC.
  ftp_w INTEGER,
  weight_kg REAL,
  hr_max INTEGER,
  ftp_set_at INTEGER,
  -- v9.6.2 (migration 0005) — ADR-S4.4 privacy opt-in; 'private'|'public'
  ftp_visibility TEXT NOT NULL DEFAULT 'private'
);

-- ============= USER CONNECTIONS =============
-- Generic for multi-source: Strava now, Garmin/AppleHealth later
CREATE TABLE user_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  athlete_id INTEGER NOT NULL REFERENCES users(athlete_id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  credentials_json TEXT NOT NULL,
  connected_at INTEGER NOT NULL,
  last_sync_at INTEGER,
  is_active INTEGER DEFAULT 1,
  UNIQUE(athlete_id, source)
);

-- ============= ACTIVITIES =============
-- Multi-source ready. Strava IDs as columns for fast deduplication.
CREATE TABLE activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  athlete_id INTEGER NOT NULL REFERENCES users(athlete_id) ON DELETE CASCADE,
  start_date_local TEXT NOT NULL,
  sport_type TEXT NOT NULL,
  distance REAL NOT NULL,
  moving_time INTEGER NOT NULL,
  total_elevation_gain REAL,
  average_speed REAL,
  average_heartrate REAL,
  max_heartrate REAL,
  pr_count INTEGER DEFAULT 0,
  achievement_count INTEGER DEFAULT 0,
  strava_id INTEGER UNIQUE,
  garmin_id TEXT UNIQUE,
  apple_health_uuid TEXT UNIQUE,
  primary_source TEXT NOT NULL,
  strava_raw_json TEXT,
  garmin_raw_json TEXT,
  apple_health_raw_json TEXT,
  synced_at INTEGER NOT NULL,
  -- v9.0.x (migration 0001) — TSS / NP / IF as first-class columns
  -- (previously only in strava_raw_json blob).
  duration_s INTEGER,
  average_watts INTEGER,
  np_w INTEGER,
  if_pct REAL,
  tss REAL,
  primary_zone INTEGER          -- 1..6 Coggan; widens to 1..7 when Strava 7-zone ingestion lands
);

CREATE INDEX idx_activities_athlete_date ON activities(athlete_id, start_date_local DESC);
CREATE INDEX idx_activities_sport_type ON activities(athlete_id, sport_type, start_date_local DESC);
-- v9.0.x (migration 0001)
CREATE INDEX idx_activities_athlete_tss ON activities(athlete_id, start_date_local DESC, tss);

-- ============= DAILY LOAD (v9.0.x, migration 0001) =============
-- Pre-computed PMC rollup. One row per athlete per day. ctl/atl
-- recomputed nightly when activities change.
CREATE TABLE daily_load (
  athlete_id INTEGER NOT NULL REFERENCES users(athlete_id) ON DELETE CASCADE,
  date TEXT NOT NULL,           -- ISO YYYY-MM-DD
  tss_sum REAL NOT NULL DEFAULT 0,
  ctl REAL NOT NULL DEFAULT 0,
  atl REAL NOT NULL DEFAULT 0,
  tsb REAL NOT NULL DEFAULT 0,
  computed_at INTEGER NOT NULL,
  PRIMARY KEY (athlete_id, date)
);

CREATE INDEX idx_daily_load_athlete_date ON daily_load(athlete_id, date DESC);

-- ============= AI REPORTS =============
CREATE TABLE ai_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  athlete_id INTEGER NOT NULL REFERENCES users(athlete_id) ON DELETE CASCADE,
  generated_at INTEGER NOT NULL,
  sessions_per_week INTEGER,
  surface_pref TEXT,
  report_json TEXT NOT NULL,
  prompt_version TEXT,
  model_used TEXT
);

CREATE INDEX idx_reports_athlete_date ON ai_reports(athlete_id, generated_at DESC);

-- ============= RIDE FEEDBACK =============
CREATE TABLE ride_feedback (
  activity_id INTEGER PRIMARY KEY REFERENCES activities(id) ON DELETE CASCADE,
  athlete_id INTEGER NOT NULL,
  feedback_json TEXT NOT NULL,
  generated_at INTEGER NOT NULL,
  prompt_version TEXT,
  model_used TEXT
);

-- ============= TRAINING PREFS =============
CREATE TABLE training_prefs (
  athlete_id INTEGER PRIMARY KEY REFERENCES users(athlete_id) ON DELETE CASCADE,
  sessions_per_week INTEGER DEFAULT 3,
  surface_pref TEXT,
  start_address TEXT,
  -- v9.3.0 (migration 0004) — route-discovery filter defaults
  home_region TEXT,                 -- preferred starting region (free text, e.g. "Madrid")
  preferred_distance_km INTEGER,    -- default distance filter (km)
  preferred_difficulty TEXT,        -- 'flat' | 'rolling' | 'hilly'
  updated_at INTEGER NOT NULL
);

-- ============= GOALS (personal) =============
CREATE TABLE goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  athlete_id INTEGER NOT NULL REFERENCES users(athlete_id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL,
  target_value REAL,
  target_unit TEXT,
  target_date TEXT,
  title TEXT,
  set_at INTEGER NOT NULL,
  achieved_at INTEGER,
  -- v9.0.x (migration 0001) — structured goal events (Etape du Tour,
  -- Gran Fondo, etc.) so PMC math can target a date.
  event_name TEXT,
  event_type TEXT,              -- 'gran_fondo' | 'tt' | 'crit' | 'race' | 'volume'
  event_distance_km REAL,
  event_elevation_m REAL,
  event_location TEXT,
  event_priority INTEGER DEFAULT 1   -- 1=A race, 2=B, 3=C
);

CREATE INDEX idx_goals_athlete ON goals(athlete_id, set_at DESC);

-- ============= CLUBS (Phase 2 ready) =============
CREATE TABLE clubs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  owner_athlete_id INTEGER NOT NULL REFERENCES users(athlete_id),
  is_public INTEGER DEFAULT 0,
  invite_code TEXT UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE club_members (
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  athlete_id INTEGER NOT NULL REFERENCES users(athlete_id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at INTEGER NOT NULL,
  -- v9.6.2 (migration 0005) — Phase 4 cron populates; NULL until first cron run
  trend_arrow TEXT,
  trend_updated_at INTEGER,
  PRIMARY KEY (club_id, athlete_id)
);

CREATE TABLE club_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL,
  target_value REAL NOT NULL,
  target_unit TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  title TEXT,
  description TEXT,
  created_at INTEGER NOT NULL,
  achieved_at INTEGER
);

-- ============= CLUB EVENTS (v9.1.3, migration 0002) =============
-- Any club member can post an event. Admins are not gatekeepers per
-- the v9.1.3 BA spec. RSVPs deferred to a future event_rsvps table.
CREATE TABLE club_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_by INTEGER NOT NULL REFERENCES users(athlete_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date INTEGER NOT NULL,    -- unix epoch seconds, when the event happens
  location TEXT,                  -- optional free-text ("Richmond Park · Sheen Gate")
  created_at INTEGER NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'ride'  -- v9.7.0 (migration 0006): Schedule tab filter chips — 'ride' / 'social' / 'race'
);

CREATE INDEX idx_club_events_club_date ON club_events(club_id, event_date);
CREATE INDEX idx_club_events_creator ON club_events(created_by, event_date);

-- ============= EVENT RSVPs (v9.6.2, migration 0005) =============
-- Per-member RSVP state for club events. UNIQUE(event_id, athlete_id)
-- enforces idempotency — UPSERT on (event_id, athlete_id) is re-entrant.
-- Phase 4 confirmed_count is SELECT COUNT(*) WHERE status='going'.
CREATE TABLE event_rsvps (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id    INTEGER NOT NULL REFERENCES club_events(id)   ON DELETE CASCADE,
  athlete_id  INTEGER NOT NULL REFERENCES users(athlete_id) ON DELETE CASCADE,
  status      TEXT    NOT NULL DEFAULT 'going',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (event_id, athlete_id)
);

CREATE INDEX idx_rsvps_event   ON event_rsvps(event_id, status);
CREATE INDEX idx_rsvps_athlete ON event_rsvps(athlete_id, event_id);