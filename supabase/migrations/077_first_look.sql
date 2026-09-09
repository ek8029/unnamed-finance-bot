-- Independent of 074-076. What a new signup asked to see first (spec 3.4):
-- a list of codes, never free text. NULL = never asked, '{}' = skipped.
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS first_look TEXT[] DEFAULT NULL;

-- Same convention as 076: the allowed values hold for every write path, not
-- only the PATCH route that validates them.
ALTER TABLE user_preferences
  DROP CONSTRAINT IF EXISTS first_look_known_codes;
ALTER TABLE user_preferences
  ADD CONSTRAINT first_look_known_codes
  CHECK (first_look IS NULL OR first_look <@ ARRAY['exposure','receipts','changes','overlap']::text[]);

COMMENT ON COLUMN user_preferences.first_look
  IS 'Onboarding v3 first-look codes: exposure, receipts, changes, overlap. NULL = not asked, empty = skipped.';
