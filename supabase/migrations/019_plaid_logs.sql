-- Plaid API call logging table for debugging and audit
CREATE TABLE IF NOT EXISTS plaid_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_code TEXT,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying by user and time
CREATE INDEX IF NOT EXISTS idx_plaid_logs_user_id ON plaid_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_logs_created_at ON plaid_logs(created_at DESC);

-- RLS: users can only read their own logs
ALTER TABLE plaid_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own plaid logs"
  ON plaid_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert (used by the logger from API routes)
GRANT SELECT ON plaid_logs TO authenticated;
GRANT INSERT ON plaid_logs TO authenticated;
-- Service role needs insert for webhook logging (no user session)
GRANT ALL ON plaid_logs TO service_role;
