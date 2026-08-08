-- Self-reported acquisition source.
--
-- 034 already stores utm_source/medium/campaign, but UTM is structurally blind
-- to the channel Helm is actually betting on: someone reads an AI assistant's
-- answer citing Helm and types the domain. No referrer, no UTM, invisible. The
-- same is true of a name passed between two people. Asking is the only
-- instrument that sees either.
--
-- Kept as free text rather than an enum so the option list can change without a
-- migration; the UI writes a fixed slug set and `acquisition_detail` carries the
-- "something else" answer verbatim.
--
-- Cross-tabbing this against utm_source is the point: the gap between what
-- people say and what the link says is the size of the dark-social/AI channel.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS acquisition_source TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS acquisition_detail TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS acquisition_answered_at TIMESTAMPTZ;

-- Partial index: the analytics query is always "who has answered", and the
-- column is null for everyone who has not been asked yet.
CREATE INDEX IF NOT EXISTS idx_user_profiles_acquisition_source
  ON user_profiles (acquisition_source)
  WHERE acquisition_source IS NOT NULL;
