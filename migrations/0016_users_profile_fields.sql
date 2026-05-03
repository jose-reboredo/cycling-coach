-- migrations/0016_users_profile_fields.sql
-- Migration 0016 — Sprint 13 / v11.2.0 — My Account profile fields.
-- All nullable; existing rows unaffected.
--
-- gender: enum stored as TEXT; NULL means "not stated".
--   Allowed values: prefer-not-to-say, woman, man, non-binary, self-describe
-- gender_self: only set when gender = 'self-describe'.
-- country: ISO 3166-1 alpha-2 (2-char uppercase).
-- dob: unix epoch seconds (date-only convention; we store 00:00 UTC of the chosen date).

ALTER TABLE users ADD COLUMN name        TEXT;
ALTER TABLE users ADD COLUMN dob         INTEGER;
ALTER TABLE users ADD COLUMN gender      TEXT;
ALTER TABLE users ADD COLUMN gender_self TEXT;
ALTER TABLE users ADD COLUMN city        TEXT;
ALTER TABLE users ADD COLUMN country     TEXT;
