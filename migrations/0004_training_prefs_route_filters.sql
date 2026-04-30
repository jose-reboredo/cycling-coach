-- =============================================================
-- Migration 0004 — extend training_prefs with route-filter defaults (v9.3.x)
-- =============================================================
-- Adds three optional columns that drive the FB-1 route-discovery filter UI:
--   1. home_region (TEXT) — user's preferred starting region (free text;
--      e.g. "Madrid", "Surrey, UK"). Used as the default location chip on
--      the Routes panel and as the location parameter on
--      POST /api/routes/discover (Phase 2).
--   2. preferred_distance_km (INTEGER) — default distance filter (km).
--      Drives the ±20% band on GET /api/routes.
--   3. preferred_difficulty (TEXT) — 'flat' | 'rolling' | 'hilly'. Maps to
--      elevation gain per km bands: <5 / 5-15 / >15 m/km.
--
-- Non-breaking additive migration. NULL defaults preserve all existing
-- training_prefs rows unchanged. Backfill is natural — written when the
-- user opens the route picker for the first time post-v9.3.0.
--
-- Consumed by:
--   - GET /api/routes (#47 Phase 1) — uses these as default filter values
--   - PATCH /training-prefs (#47) — partial update of these fields
--   - POST /api/routes/discover (#47 Phase 2 spike, Sprint 3) — passes
--     home_region as `location`, preferred_distance_km as `distance_km`,
--     preferred_difficulty as `difficulty`.
-- =============================================================

ALTER TABLE training_prefs ADD COLUMN home_region TEXT;
ALTER TABLE training_prefs ADD COLUMN preferred_distance_km INTEGER;
ALTER TABLE training_prefs ADD COLUMN preferred_difficulty TEXT;
