-- 050: real on/off for the daily brief email (The Current).
-- The digest cron sends "The Current" to every user daily but had no opt-out —
-- the Settings toggles wrote columns no sender read, and no toggle even matched
-- the daily send. This adds the one column the digest actually gates on.
-- notification_market_alerts (migration 001) already exists and now gates the
-- watchlist-alerts email. Unsubscribe links are HMAC-signed (no token column
-- needed); an unsubscribe click upserts this row to FALSE.

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS notification_daily_brief BOOLEAN DEFAULT TRUE;
