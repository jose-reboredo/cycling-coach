-- migrations/0014_user_credentials.sql
-- Migration 0014 — Sprint 13 / v11.1.0 — credentials substrate.
-- Stores per-(athlete, provider) ciphertext for the user's API keys.
-- Encryption is passphrase-derived AES-GCM; the Worker has no decrypt
-- path. See docs/post-demo-sprint/sprint-13/adr-credentials-substrate.md
-- for the full architectural rationale.
--
-- Composite PK (athlete_id, provider) makes multi-provider future
-- (OpenAI, local Llama, etc.) a row insert, not a migration.
--
-- managed=0 → BYOK ciphertext. managed=1 → server-side managed key
-- (Pro-tier substrate; ciphertext NULL; future feature).
--
-- kdf_iterations stored per row to allow rotation without forced
-- re-encryption (older rows decrypt at their stored count; new rows
-- use the new default).

CREATE TABLE IF NOT EXISTS user_credentials (
  athlete_id        INTEGER NOT NULL REFERENCES users(athlete_id) ON DELETE CASCADE,
  provider          TEXT    NOT NULL,
  managed           INTEGER NOT NULL DEFAULT 0,
  ciphertext        BLOB,
  iv                BLOB,
  kdf_salt          BLOB,
  kdf_iterations    INTEGER NOT NULL DEFAULT 600000,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  PRIMARY KEY (athlete_id, provider)
);
