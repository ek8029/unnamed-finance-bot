-- Migration 031: Add last_seen_at to user_profiles
-- Tracks actual user activity (not just sign-in events)

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_profiles_last_seen ON user_profiles(last_seen_at DESC);

COMMENT ON COLUMN user_profiles.last_seen_at IS 'Last time user loaded dashboard (throttled to 1 update/hour)';
