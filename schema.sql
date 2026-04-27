-- =============================================================
-- Cycling Coach DB Schema v1
-- =============================================================
-- Designed for: Strava (current), multi-source (future), 
-- clubs + collective goals (future Phase 2)
-- =============================================================

-- ============= USERS =============
CREATE TABLE users (
  athlete_id INTEGER PRIMARY KEY,
  firstname TEXT,
  lastname TEXT,
  profile_url TEXT,
  raw_athlete_json TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
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
  synced_at INTEGER NOT NULL
);

CREATE INDEX idx_activities_athlete_date ON activities(athlete_id, start_date_local DESC);
CREATE INDEX idx_activities_sport_type ON activities(athlete_id, sport_type, start_date_local DESC);

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
  achieved_at INTEGER
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