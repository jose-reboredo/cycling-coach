-- Migration 0010 — Sprint 5+ / v10.6.0.
-- Per-user OAuth tokens for Ride with GPS. Lets the route picker fetch
-- the user's RWGPS library and rank routes by match to today's session.
--
-- Why a dedicated table (vs reusing user_connections):
--   user_connections is Strava-specific (credentials_json blob with the
--   exact Strava token shape). Modeling RWGPS through that schema would
--   conflate token shapes from two providers. A dedicated table keeps
--   each provider's auth concerns isolated and cleanly indexed.

CREATE TABLE IF NOT EXISTS rwgps_tokens (
  athlete_id INTEGER PRIMARY KEY REFERENCES users(athlete_id) ON DELETE CASCADE,
  -- RWGPS access_token: bearer used in Authorization header for API calls.
  access_token TEXT NOT NULL,
  -- RWGPS refresh_token: optional per their OAuth flow. Stored when present
  -- so we can refresh without forcing the user through OAuth again.
  refresh_token TEXT,
  -- RWGPS auth_token: their OAuth response separately exposes a permanent
  -- per-user token used in the x-rwgps-auth-token header. Saved alongside
  -- access_token. Both are needed for /api/v1/routes.json calls.
  auth_token TEXT NOT NULL,
  -- Their internal user id, returned in the OAuth response. Useful for
  -- audit logs and for constructing direct routes URLs without an extra
  -- /api/v1/users/me round-trip.
  rwgps_user_id INTEGER,
  -- Token expiry (epoch sec). When refresh_token is present and we hit
  -- expires_at, refresh transparently. When absent, fall back to the API
  -- and re-prompt the user only on 401.
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Future-proofing index — we don't currently look up by rwgps_user_id but
-- if we ever add webhook support (RWGPS → Cadence Club) we'll need it.
CREATE INDEX IF NOT EXISTS idx_rwgps_tokens_user ON rwgps_tokens(rwgps_user_id) WHERE rwgps_user_id IS NOT NULL;
