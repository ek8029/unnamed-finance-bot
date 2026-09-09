-- Independent of 074-076. What a new signup asked to see first (spec 3.4):
-- a list of codes, never free text. NULL = never asked, '{}' = skipped.
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS first_look TEXT[] DEFAULT NULL;

COMMENT ON COLUMN user_preferences.first_look
  IS 'Onboarding v3 first-look codes: exposure, receipts, changes, overlap. NULL = not asked, empty = skipped.';
