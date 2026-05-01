-- Migration 0008 (Sprint 5 Phase 5, v9.12.0) — Personal training sessions
-- ============================================================================
-- Adds `planned_sessions` table for individual training-plan items shown in
-- the personal scheduler at /dashboard/schedule. Foundational layer for the
-- v9.13.0+ AI Coach integration (#79) where /coach plans auto-populate this
-- table.
--
-- Design rationale, scalability analysis, and full risk register documented
-- in docs/post-demo-sprint/v9.12.0-cto-analysis.md §3.1, §4, §5.
--
-- Pre-CTO column-shape verification (Sprint 4 retro Improvement #2):
--   2026-05-01 — verified via grep schema.sql: no column-name conflicts
--   on athlete_id, session_date, source, ai_report_id, completed_at.
--   References ai_reports.id (existing table from Sprint 1) with
--   ON DELETE SET NULL so AI report cleanup doesn't cascade-delete sessions.
--
-- Storage projection (CTO §4): 1k users × ~25 sessions/month × 200B = ~5MB/mo.
-- Indexes: composite (athlete_id, session_date) for month-range queries +
-- partial (ai_report_id WHERE NOT NULL) for future AI-source analytics.
-- ============================================================================

CREATE TABLE planned_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  athlete_id INTEGER NOT NULL REFERENCES users(athlete_id) ON DELETE CASCADE,
  session_date INTEGER NOT NULL,                  -- unix epoch seconds (start time)
  title TEXT NOT NULL,
  description TEXT,
  zone INTEGER CHECK (zone IS NULL OR zone BETWEEN 1 AND 7),
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 0 AND 600),
  target_watts INTEGER CHECK (target_watts IS NULL OR target_watts BETWEEN 0 AND 2000),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'ai-coach', 'imported')),
  ai_report_id INTEGER REFERENCES ai_reports(id) ON DELETE SET NULL,
  completed_at INTEGER,                           -- soft completion (nullable)
  cancelled_at INTEGER,                           -- soft delete (nullable)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_planned_sessions_athlete_date ON planned_sessions(athlete_id, session_date);
CREATE INDEX idx_planned_sessions_ai_report ON planned_sessions(ai_report_id) WHERE ai_report_id IS NOT NULL;
