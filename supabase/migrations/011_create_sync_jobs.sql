-- Migration 011: Sync Jobs and Audit Logs
-- Description: Create tables for API sync jobs, sync run logs, and audit trails
-- Supports Plaid/SnapTrade/Market data sync orchestration and user action auditing

-- =================================================================
-- SYNC JOBS
-- =================================================================

CREATE TABLE sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  job_type TEXT NOT NULL CHECK (job_type IN ('plaid_transactions', 'plaid_balances', 'snaptrade_holdings', 'market_prices', 'market_news', 'sec_filings')),
  job_name TEXT NOT NULL,

  schedule TEXT, -- Cron expression
  is_enabled BOOLEAN DEFAULT TRUE,

  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sync_jobs_user_id ON sync_jobs(user_id);
CREATE INDEX idx_sync_jobs_type ON sync_jobs(job_type);
CREATE INDEX idx_sync_jobs_enabled ON sync_jobs(is_enabled) WHERE is_enabled = TRUE;

-- Comments
COMMENT ON TABLE sync_jobs IS 'Scheduled sync jobs for external API integrations';
COMMENT ON COLUMN sync_jobs.schedule IS 'Cron expression for job scheduling';
COMMENT ON COLUMN sync_jobs.job_type IS 'Type of sync (Plaid, SnapTrade, market data)';

-- =================================================================
-- SYNC RUNS
-- =================================================================

CREATE TABLE sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_job_id UUID NOT NULL REFERENCES sync_jobs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'partial')),

  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,

  error_message TEXT,
  error_details JSONB,

  run_metadata JSONB -- Additional run context
);

-- Indexes
CREATE INDEX idx_sync_runs_job_id ON sync_runs(sync_job_id);
CREATE INDEX idx_sync_runs_user_id ON sync_runs(user_id);
CREATE INDEX idx_sync_runs_started ON sync_runs(started_at DESC);
CREATE INDEX idx_sync_runs_status ON sync_runs(status);

-- Comments
COMMENT ON TABLE sync_runs IS 'Execution log for each sync job run';
COMMENT ON COLUMN sync_runs.status IS 'Running, success, failed, or partial (some records failed)';
COMMENT ON COLUMN sync_runs.run_metadata IS 'Additional context about the run (API version, etc.)';

-- =================================================================
-- AUDIT LOGS
-- =================================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  action TEXT NOT NULL, -- 'user.login', 'account.connected', 'insight.dismissed'
  entity_type TEXT, -- 'account', 'holding', 'insight'
  entity_id UUID,

  ip_address INET,
  user_agent TEXT,

  metadata JSONB, -- Additional action context

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- Comments
COMMENT ON TABLE audit_logs IS 'Audit trail of user actions for security and compliance';
COMMENT ON COLUMN audit_logs.action IS 'Action taken (e.g., user.login, account.connected)';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional context about the action';
