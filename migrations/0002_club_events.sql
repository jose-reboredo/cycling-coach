-- =============================================================
-- Migration 0002 — club events (v9.1.3, Phase A)
-- =============================================================
-- Adds:
--   1. club_events — events created by any club member (group rides,
--      café meetups, race meetups). Any member can create; admins are
--      not gatekeepers per the v9.1.3 BA spec.
--   2. Indexes for the two query paths the API uses today:
--      - GET /api/clubs/:id/events ordered by event_date ASC (upcoming)
--      - any future "events I created" view by created_by
--
-- NOT in this migration (deferred to Phase B):
--   - event_rsvps table (going / maybe / no per member)
--   - event_max_attendees + waitlist
--   - route_url + cover_image
--   - recurring events (RRULE)
-- =============================================================

CREATE TABLE IF NOT EXISTS club_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_by INTEGER NOT NULL REFERENCES users(athlete_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date INTEGER NOT NULL,    -- unix epoch seconds, when the event happens (start time)
  location TEXT,                  -- optional free-text location ("Richmond Park · Sheen Gate")
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_club_events_club_date
  ON club_events (club_id, event_date);

CREATE INDEX IF NOT EXISTS idx_club_events_creator
  ON club_events (created_by, event_date);
