-- Migration 001: User Profiles and Preferences
-- Description: Create user_profiles and user_preferences tables
-- These extend Supabase Auth's auth.users with application-specific data

-- =================================================================
-- USER PROFILES
-- =================================================================

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- Comments
COMMENT ON TABLE user_profiles IS 'Extended user profile data beyond Supabase Auth';
COMMENT ON COLUMN user_profiles.id IS 'References auth.users(id)';

-- =================================================================
-- USER PREFERENCES
-- =================================================================

CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Appearance
  theme TEXT DEFAULT 'dark' CHECK (theme IN ('light', 'dark', 'auto')),
  density TEXT DEFAULT 'comfortable' CHECK (density IN ('compact', 'comfortable', 'spacious')),

  -- Localization
  currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'GBP', 'JPY', 'CAD')),
  date_format TEXT DEFAULT 'MM/DD/YYYY' CHECK (date_format IN ('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD')),
  number_format TEXT DEFAULT 'US' CHECK (number_format IN ('US', 'EU', 'UK')),

  -- Notifications
  notification_market_alerts BOOLEAN DEFAULT TRUE,
  notification_transaction_alerts BOOLEAN DEFAULT TRUE,
  notification_budget_alerts BOOLEAN DEFAULT TRUE,
  notification_tax_reminders BOOLEAN DEFAULT TRUE,
  notification_weekly_digest BOOLEAN DEFAULT TRUE,
  notification_monthly_report BOOLEAN DEFAULT FALSE,
  notification_email BOOLEAN DEFAULT TRUE,
  notification_push BOOLEAN DEFAULT FALSE,

  -- Accessibility
  reduce_motion BOOLEAN DEFAULT FALSE,
  high_contrast BOOLEAN DEFAULT FALSE,
  large_text BOOLEAN DEFAULT FALSE,
  screen_reader_optimized BOOLEAN DEFAULT FALSE,

  -- Dashboard
  default_tab TEXT DEFAULT 'overview' CHECK (default_tab IN ('overview', 'accounts', 'portfolio', 'taxes')),
  compact_charts BOOLEAN DEFAULT FALSE,
  show_insights BOOLEAN DEFAULT TRUE,
  auto_refresh BOOLEAN DEFAULT FALSE,
  refresh_interval INTEGER DEFAULT 5, -- minutes

  -- Privacy
  analytics_enabled BOOLEAN DEFAULT TRUE,
  crash_reporting_enabled BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- Comments
COMMENT ON TABLE user_preferences IS 'User settings for appearance, localization, notifications, and dashboard preferences';
COMMENT ON COLUMN user_preferences.user_id IS 'References auth.users(id) - one preference record per user';
COMMENT ON COLUMN user_preferences.refresh_interval IS 'Auto-refresh interval in minutes';

-- =================================================================
-- TRIGGERS FOR UPDATED_AT
-- =================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_profiles
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_preferences
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
