-- Migration 0013 — Sprint 5++ / v10.12.0.
-- Adds recurring_group_id to planned_sessions so weekly-repeat sessions can
-- be edited as a group (the v10.10.0 repeat-weekly feature creates N
-- independent rows; this migration makes them addressable as a set).
--
-- Design refs: retro action item from v10.11.x debugging cluster — "edit
-- one, change all" UX gap when the user expects a repeat to behave like
-- a single recurring event.
--
-- recurring_group_id semantics:
--   - NULL = standalone session (most existing rows)
--   - NOT NULL = part of a repeat group; sibling rows share the same value
--   - The value itself is opaque (a random hex id); not a FK to any table

ALTER TABLE planned_sessions ADD COLUMN recurring_group_id TEXT;

-- Index lets the drawer fetch sibling sessions in O(log N) when
-- displaying "1 of 4 weekly repeats" + the cascade-edit handler.
CREATE INDEX IF NOT EXISTS idx_planned_sessions_recurring_group
  ON planned_sessions(recurring_group_id) WHERE recurring_group_id IS NOT NULL;
