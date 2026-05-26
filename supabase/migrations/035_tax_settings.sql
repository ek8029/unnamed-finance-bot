-- Migration: 035_tax_settings
-- Description: Add tax configuration columns to user_preferences

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS filing_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tax_bracket TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tax_state TEXT DEFAULT NULL;

COMMENT ON COLUMN user_preferences.filing_status IS 'Filing status: Single, Married Filing Jointly, Married Filing Separately, Head of Household';
COMMENT ON COLUMN user_preferences.tax_bracket IS 'Federal tax bracket: 10%, 12%, 22%, 24%, 32%, 35%, 37%';
COMMENT ON COLUMN user_preferences.tax_state IS 'State for state tax calculations';
