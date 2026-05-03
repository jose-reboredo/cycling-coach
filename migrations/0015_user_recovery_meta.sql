-- migrations/0015_user_recovery_meta.sql
-- Migration 0015 — Sprint 13 / v11.1.0 — recovery metadata on users.
-- Recovery is account-level, not provider-level; lives on `users`.
-- recovery_code_hash = SHA-256 hex of the 24-char dashed code.
-- passphrase_set_at gates the AI flow (NULL = no passphrase yet, fall back to localStorage).

ALTER TABLE users ADD COLUMN recovery_code_hash TEXT;
ALTER TABLE users ADD COLUMN passphrase_set_at  INTEGER;
