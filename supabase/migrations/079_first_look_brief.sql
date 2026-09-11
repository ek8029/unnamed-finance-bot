-- Onboarding v3 gained a fifth first-look card, "What Helm read while I was
-- away", so the constraint from 077 has to admit its code. Without this the
-- PATCH passes validation and the INSERT is rejected, which loses the reader's
-- whole set of picks, not only the new one. Apply this BEFORE deploying the
-- fifth card.
ALTER TABLE user_preferences
  DROP CONSTRAINT IF EXISTS first_look_known_codes;
ALTER TABLE user_preferences
  ADD CONSTRAINT first_look_known_codes
  CHECK (first_look IS NULL OR first_look <@ ARRAY['exposure','receipts','changes','overlap','brief']::text[]);

COMMENT ON COLUMN user_preferences.first_look
  IS 'Onboarding v3 first-look codes: exposure, receipts, changes, overlap, brief. NULL = not asked, empty = skipped.';
