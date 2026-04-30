-- =============================================================
-- Migration 0005 — clubs Phase 2: event_rsvps, ftp_visibility, trend columns (v9.6.2)
-- =============================================================
-- Adds three schema elements required for Sprint 4 Phase 2:
--
--   1. users.ftp_visibility (TEXT NOT NULL DEFAULT 'private') — ADR-S4.4 opt-in
--      privacy toggle. Existing rows backfill to 'private' (privacy-first default).
--      Users opt in to 'public' to allow other club members to see their FTP.
--
--   2. club_members.trend_arrow (TEXT, NULL) — Phase 4 cron will populate.
--      Column added now so the cron handler in Phase 4 can write without
--      a separate migration at that point.
--
--   3. club_members.trend_updated_at (INTEGER, NULL) — unix epoch seconds;
--      companion to trend_arrow, records when the cron last computed the arrow.
--
--   4. event_rsvps table — per-member RSVP state for club events.
--      UNIQUE(event_id, athlete_id) enforces idempotency: UPSERT on the
--      combination is safe and re-entrant. Phase 2 endpoints write and read this.
--      Two covering indexes:
--        idx_rsvps_event   — event roll-up queries (confirmed_count, avatar list)
--        idx_rsvps_athlete — per-athlete RSVP history queries
--
-- Non-breaking. All new columns are nullable or have DEFAULT values; no
-- existing rows are invalidated.
--
-- Consumed by (Phase 2):
--   POST /api/clubs/:id/events/:eventId/rsvp    — UPSERT event_rsvps
--   GET  /api/clubs/:id/events/:eventId/rsvps   — read confirmed_count + avatars
--   PATCH /api/users/me/profile                  — update users.ftp_visibility
--   GET  /api/clubs/:id/members (extended)       — FTP mask uses ftp_visibility
-- =============================================================

ALTER TABLE users        ADD COLUMN ftp_visibility   TEXT    NOT NULL DEFAULT 'private';
ALTER TABLE club_members ADD COLUMN trend_arrow       TEXT;
ALTER TABLE club_members ADD COLUMN trend_updated_at  INTEGER;

CREATE TABLE IF NOT EXISTS event_rsvps (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id    INTEGER NOT NULL REFERENCES club_events(id)   ON DELETE CASCADE,
  athlete_id  INTEGER NOT NULL REFERENCES users(athlete_id) ON DELETE CASCADE,
  status      TEXT    NOT NULL DEFAULT 'going',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (event_id, athlete_id)
);

CREATE INDEX IF NOT EXISTS idx_rsvps_event   ON event_rsvps(event_id, status);
CREATE INDEX IF NOT EXISTS idx_rsvps_athlete ON event_rsvps(athlete_id, event_id);
