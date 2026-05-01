-- Migration 0006 (Sprint 5 Phase 3, v9.7.0) — Schedule tab event_type
-- ============================================================================
-- Adds event_type to club_events for the Schedule tab filter chips
-- (🚴 ride / ☕ social / 🏁 race). Pre-CTO column-shape verified against
-- schema.sql 2026-05-01 — club_events.event_date is INTEGER (unix epoch
-- seconds), and the existing idx_club_events_club_date(club_id, event_date)
-- already serves the month-range query the new GET /api/clubs/:id/events
-- endpoint will run. No new index needed.
--
-- Backfill: NOT NULL DEFAULT 'ride' covers existing rows in one shot.
-- ============================================================================

ALTER TABLE club_events ADD COLUMN event_type TEXT NOT NULL DEFAULT 'ride';
