-- Migration 0012 — Sprint 5++ / v10.9.0.
-- Server-side Strava OAuth token storage. Mirrors rwgps_tokens (v10.6.0)
-- shape exactly so both providers follow the same pattern.
--
-- Why now: Phase D of the goal-driven AI plan (auto-regenerate when a
-- new Strava activity arrives via webhook) needs server-side tokens to
-- call Anthropic on the user's behalf — the webhook event has only an
-- athlete_id, no Bearer token.
--
-- Migration story: hybrid window. The /callback handler persists into
-- D1 going forward; /refresh upserts on every legacy refresh_token call
-- so currently-logged-in users self-migrate without re-OAuth.

CREATE TABLE IF NOT EXISTS strava_tokens (
  athlete_id INTEGER PRIMARY KEY REFERENCES users(athlete_id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  scope TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
