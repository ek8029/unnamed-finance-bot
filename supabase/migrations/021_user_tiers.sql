-- ============================================================
-- 021: User subscription tiers + analysis usage tracking
-- ============================================================

-- ── User Subscriptions ──
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- ── Analysis Usage (tracks per-request for daily quota) ──
CREATE TABLE IF NOT EXISTS analysis_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_usage_user_date
  ON analysis_usage (user_id, created_at);

-- ── RLS ──
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_usage ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription
CREATE POLICY "Users can read own subscription"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role / triggers can insert/update (not direct user writes)
CREATE POLICY "Service role manages subscriptions"
  ON user_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- Users can read their own usage
CREATE POLICY "Users can read own usage"
  ON analysis_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own usage
CREATE POLICY "Users can insert own usage"
  ON analysis_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role full access to usage
CREATE POLICY "Service role manages usage"
  ON analysis_usage FOR ALL
  USING (auth.role() = 'service_role');

-- ── Seed existing users as 'free' ──
INSERT INTO user_subscriptions (user_id, tier)
SELECT id, 'free' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
