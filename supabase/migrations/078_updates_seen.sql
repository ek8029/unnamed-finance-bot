-- Independent of 077. When the overview's Updates card was last read by this
-- person, so the card can show what arrived since rather than the newest lines
-- of everything. NULL = never read, which the card treats as "no mark" and
-- renders exactly as it did before this column existed.
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS updates_seen_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN user_preferences.updates_seen_at
  IS 'When this person last read the overview Updates card. NULL = never read. Written by PATCH /api/user/preferences after the card renders; the route rejects a value it cannot parse and clamps a future one to now.';
