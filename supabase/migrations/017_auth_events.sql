-- Auth events table for audit logging, rate limiting, and login activity
CREATE TABLE IF NOT EXISTS auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  -- 'login_success', 'login_failed', 'signup', 'logout',
  -- 'password_change', 'password_reset_request', 'session_revoke', 'account_delete'
  email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Fast lookups for rate limiting (by email + type + time window)
CREATE INDEX idx_auth_events_email_type ON auth_events(email, event_type, created_at DESC);
-- Fast lookups for user login activity
CREATE INDEX idx_auth_events_user ON auth_events(user_id, created_at DESC);

-- Row Level Security
ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own events (for login activity display)
CREATE POLICY "Users can read own auth events"
  ON auth_events FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert (API routes use service client)
-- No INSERT policy for regular users ensures events can't be forged
