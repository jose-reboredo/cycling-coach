-- Migration 0011 — Sprint 5++ / v10.8.0 Phase A.
-- AI-generated weekly training plan sessions. The AI produces these BEFORE
-- the user schedules them; once scheduled, a row in `planned_sessions` (the
-- existing personal-session table from v9.12.0 / Migration 0008) gets a FK
-- back to the source ai_plan_sessions row.
--
-- Design refs:
--   docs/post-demo-sprint/train-tab-goal-driven-planning.md
--   docs/post-demo-sprint/train-tab-api-spec.md
--
-- Decisions baked in (per design doc §5):
--   Q3: reuse planned_sessions (NOT club_events; NOT new scheduled_sessions)
--   Q5: user_edited_at lock prevents auto-overwrite of scheduled sessions
--       when the AI plan regenerates.

CREATE TABLE IF NOT EXISTS ai_plan_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  athlete_id INTEGER NOT NULL REFERENCES users(athlete_id) ON DELETE CASCADE,
  -- ISO date of the Monday of the week this session belongs to. Lets us
  -- batch-fetch a week of plan rows without scanning the whole table.
  week_start_date TEXT NOT NULL,
  -- AI-suggested ride date (ISO). User may override at schedule time.
  suggested_date TEXT NOT NULL,
  title TEXT NOT NULL,
  -- Coggan zone label, exact text from AI ('Z1' | ... | 'Z7' | 'Recovery').
  -- Stored as TEXT to preserve the AI's labeling; the prefill modal has
  -- an explicit zone select that maps text → integer for planned_sessions.
  target_zone TEXT,
  duration INTEGER, -- minutes
  elevation_gained INTEGER, -- metres (target, not strict)
  -- 'Paved' | 'Mixed' | 'Gravel' | 'Any' — drives the route picker
  -- default surface filter at schedule time.
  surface TEXT,
  -- AI's plain-English explanation, surfaced in the prefill modal as
  -- read-only context. ≤ 200 chars.
  reasoning TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  -- Same athlete cannot have two AI plan rows for the same date+title.
  -- Prevents double-rows when regeneration writes the same plan twice.
  UNIQUE(athlete_id, suggested_date, title)
);

CREATE INDEX IF NOT EXISTS idx_ai_plan_sessions_athlete_week
  ON ai_plan_sessions(athlete_id, week_start_date);

-- v10.8.0 — extend planned_sessions with the link back + auto-update lock.
-- ai_plan_session_id: FK to the AI plan row that produced this scheduled
--                     session. NULL when user created the session manually
--                     (legacy v9.12.0 path).
-- elevation_gained:   target metres (carries forward from AI plan; user
--                     can edit at schedule time).
-- surface:            'Paved' | 'Mixed' | 'Gravel' | 'Any'.
-- user_edited_at:     epoch sec, set when the user mutates a scheduled
--                     session's fields after initial schedule. When set,
--                     plan regeneration's UPDATE step skips this row.
ALTER TABLE planned_sessions ADD COLUMN ai_plan_session_id INTEGER REFERENCES ai_plan_sessions(id) ON DELETE SET NULL;
ALTER TABLE planned_sessions ADD COLUMN elevation_gained INTEGER;
ALTER TABLE planned_sessions ADD COLUMN surface TEXT;
ALTER TABLE planned_sessions ADD COLUMN user_edited_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_planned_sessions_ai_plan
  ON planned_sessions(ai_plan_session_id) WHERE ai_plan_session_id IS NOT NULL;

-- v10.8.0 — preferred_surface column on users for AI plan default.
-- Existing user_training_prefs.surface_pref already exists per legacy
-- v9.x code, but it's per-source-pref not per-user-default. This new
-- column on users is the canonical "user's preferred surface" used by
-- the AI prompt. Existing UI will set both for backward compatibility.
ALTER TABLE users ADD COLUMN preferred_surface TEXT;
