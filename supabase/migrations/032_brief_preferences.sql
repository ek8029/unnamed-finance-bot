-- Migration 032: Brief Preferences & User Watchlist
-- Description: Add brief_delivery_time to user_preferences, create user_watchlist table

-- =============================================================================
-- 1. Add brief_delivery_time to user_preferences
-- =============================================================================

ALTER TABLE user_preferences
  ADD COLUMN brief_delivery_time TEXT DEFAULT NULL;

COMMENT ON COLUMN user_preferences.brief_delivery_time
  IS 'Preferred daily brief delivery time in HH:MM format (e.g. 07:00, 09:30). NULL = system default';

-- =============================================================================
-- 2. Create user_watchlist table
-- =============================================================================

CREATE TABLE user_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, ticker)
);

-- Index for fast lookups by user
CREATE INDEX idx_user_watchlist_user_id ON user_watchlist(user_id);

-- Table documentation
COMMENT ON TABLE user_watchlist IS 'User-curated list of tickers to track in daily briefs and market alerts';

-- =============================================================================
-- 3. RLS policies for user_watchlist
-- =============================================================================

ALTER TABLE user_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own watchlist"
  ON user_watchlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their own watchlist"
  ON user_watchlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from their own watchlist"
  ON user_watchlist FOR DELETE
  USING (auth.uid() = user_id);
