-- UTM tracking on signups for attribution
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
