-- Migration 0007 (Sprint 5 Phase 3, v9.7.3) — Event model expansion + lifecycle
-- ============================================================================
-- Adds 7 columns to `club_events` per BA #60:
--   distance_km             — REAL nullable (social events skip)
--   expected_avg_speed_kmh  — REAL nullable
--   surface                 — TEXT CHECK ('road' | 'gravel' | 'mixed') nullable
--   start_point             — TEXT nullable (free text address)
--   route_strava_id         — TEXT nullable (link to user's saved Strava route)
--   description_ai_generated — INTEGER NOT NULL DEFAULT 0 (boolean: was AI-drafted?)
--   cancelled_at            — INTEGER nullable (soft-delete; epoch when cancelled)
--
-- Pre-CTO column-shape verification (Sprint 4 retro Improvement #2):
--   Verified 2026-05-01 via `grep schema.sql`:
--     - distance_km: free on club_events (matches in training_prefs.preferred_distance_km
--                    and goals.event_distance_km — both unrelated)
--     - surface: free on club_events (matches in training_prefs.surface_pref ×2 — unrelated)
--     - all 5 other columns: not present anywhere ✓
--
-- Backfill: NOT NULL DEFAULT 0 on description_ai_generated covers existing rows.
-- All other new columns are nullable; existing rows get NULL by default.
-- ============================================================================

ALTER TABLE club_events ADD COLUMN distance_km REAL;
ALTER TABLE club_events ADD COLUMN expected_avg_speed_kmh REAL;
ALTER TABLE club_events ADD COLUMN surface TEXT CHECK (surface IS NULL OR surface IN ('road', 'gravel', 'mixed'));
ALTER TABLE club_events ADD COLUMN start_point TEXT;
ALTER TABLE club_events ADD COLUMN route_strava_id TEXT;
ALTER TABLE club_events ADD COLUMN description_ai_generated INTEGER NOT NULL DEFAULT 0;
ALTER TABLE club_events ADD COLUMN cancelled_at INTEGER;
