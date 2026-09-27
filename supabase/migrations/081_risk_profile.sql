-- 081_risk_profile
--
-- The concentration line a person chose, so the web, the phone and the
-- insights engine draw the same line. Until now the phone kept the choice in
-- AsyncStorage, where the engine that writes "X is N% of your portfolio" could
-- not see it: the phone said 20%, the engine said 25%, Overview said 35%.
--
-- NULL means the person has not chosen, and Helm uses its default line (25%,
-- lib/concentration-lines.ts). Nullable with no default and no backfill on
-- purpose: nobody is moved onto a line they did not pick, so applying this
-- changes no existing finding.
--
-- The code tolerates this column being absent (a failed read is treated as
-- "not chosen" and the phone keeps its local copy), so this can be applied
-- before or after the deploy.

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS risk_profile TEXT DEFAULT NULL;

ALTER TABLE user_preferences
  DROP CONSTRAINT IF EXISTS risk_profile_known;
ALTER TABLE user_preferences
  ADD CONSTRAINT risk_profile_known
  CHECK (risk_profile IS NULL OR risk_profile IN ('aggressive', 'moderate', 'passive'));

COMMENT ON COLUMN user_preferences.risk_profile
  IS 'Concentration line the person chose: aggressive (30% per position), moderate (20%), passive (12%). NULL = not chosen, Helm uses 25%.';
