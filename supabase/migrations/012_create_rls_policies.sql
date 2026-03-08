-- Migration 012: Row-Level Security Policies
-- Description: Enable RLS and create policies for all user-owned tables
-- Ensures users can only access their own data

-- =================================================================
-- USER PROFILES
-- =================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =================================================================
-- USER PREFERENCES
-- =================================================================

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =================================================================
-- LINKED ACCOUNTS
-- =================================================================

ALTER TABLE linked_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounts"
  ON linked_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts"
  ON linked_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts"
  ON linked_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts"
  ON linked_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- =================================================================
-- ACCOUNT BALANCES
-- =================================================================

ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account balances"
  ON account_balances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own account balances"
  ON account_balances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =================================================================
-- TRANSACTIONS
-- =================================================================

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  USING (auth.uid() = user_id);

-- =================================================================
-- CASH FLOW SNAPSHOTS
-- =================================================================

ALTER TABLE cash_flow_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cash flow"
  ON cash_flow_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cash flow"
  ON cash_flow_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =================================================================
-- LIABILITIES
-- =================================================================

ALTER TABLE liabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own liabilities"
  ON liabilities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own liabilities"
  ON liabilities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own liabilities"
  ON liabilities FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own liabilities"
  ON liabilities FOR DELETE
  USING (auth.uid() = user_id);

-- =================================================================
-- HOLDINGS
-- =================================================================

ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own holdings"
  ON holdings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own holdings"
  ON holdings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own holdings"
  ON holdings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own holdings"
  ON holdings FOR DELETE
  USING (auth.uid() = user_id);

-- =================================================================
-- PORTFOLIO SNAPSHOTS
-- =================================================================

ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own portfolio snapshots"
  ON portfolio_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own portfolio snapshots"
  ON portfolio_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =================================================================
-- PORTFOLIO PERFORMANCE
-- =================================================================

ALTER TABLE portfolio_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own portfolio performance"
  ON portfolio_performance FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own portfolio performance"
  ON portfolio_performance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =================================================================
-- TAX ESTIMATES
-- =================================================================

ALTER TABLE tax_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tax estimates"
  ON tax_estimates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tax estimates"
  ON tax_estimates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tax estimates"
  ON tax_estimates FOR UPDATE
  USING (auth.uid() = user_id);

-- =================================================================
-- CAPITAL GAINS
-- =================================================================

ALTER TABLE capital_gains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own capital gains"
  ON capital_gains FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own capital gains"
  ON capital_gains FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =================================================================
-- TAX OPTIMIZATION TASKS
-- =================================================================

ALTER TABLE tax_optimization_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tax tasks"
  ON tax_optimization_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tax tasks"
  ON tax_optimization_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tax tasks"
  ON tax_optimization_tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tax tasks"
  ON tax_optimization_tasks FOR DELETE
  USING (auth.uid() = user_id);

-- =================================================================
-- INSIGHTS
-- =================================================================

ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights"
  ON insights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own insights"
  ON insights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own insights"
  ON insights FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own insights"
  ON insights FOR DELETE
  USING (auth.uid() = user_id);

-- =================================================================
-- INSIGHT SOURCES
-- =================================================================

ALTER TABLE insight_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view insight sources for own insights"
  ON insight_sources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM insights
      WHERE insights.id = insight_sources.insight_id
      AND insights.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert insight sources for own insights"
  ON insight_sources FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM insights
      WHERE insights.id = insight_sources.insight_id
      AND insights.user_id = auth.uid()
    )
  );

-- =================================================================
-- NET WORTH SNAPSHOTS
-- =================================================================

ALTER TABLE net_worth_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own net worth"
  ON net_worth_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own net worth"
  ON net_worth_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =================================================================
-- FINANCIAL HEALTH SCORES
-- =================================================================

ALTER TABLE financial_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own financial health"
  ON financial_health_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own financial health"
  ON financial_health_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =================================================================
-- SYNC JOBS
-- =================================================================

ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync jobs"
  ON sync_jobs FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own sync jobs"
  ON sync_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own sync jobs"
  ON sync_jobs FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- =================================================================
-- SYNC RUNS
-- =================================================================

ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync runs"
  ON sync_runs FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own sync runs"
  ON sync_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- =================================================================
-- AUDIT LOGS
-- =================================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =================================================================
-- PUBLIC TABLES (No RLS - Public Read Access)
-- =================================================================

-- These tables are public reference data and don't need RLS:
-- - institutions
-- - securities
-- - transaction_categories
-- - market_prices
-- - market_news
-- - sec_filings
-- - market_events
-- - insight_rules

-- Enable public read access for institutions
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access to institutions"
  ON institutions FOR SELECT
  TO authenticated, anon
  USING (true);

-- Enable public read access for securities
ALTER TABLE securities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access to securities"
  ON securities FOR SELECT
  TO authenticated, anon
  USING (true);

-- Enable public read access for transaction categories
ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access to transaction categories"
  ON transaction_categories FOR SELECT
  TO authenticated, anon
  USING (true);

-- Enable public read access for market prices
ALTER TABLE market_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access to market prices"
  ON market_prices FOR SELECT
  TO authenticated, anon
  USING (true);

-- Enable public read access for market news
ALTER TABLE market_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access to market news"
  ON market_news FOR SELECT
  TO authenticated, anon
  USING (true);

-- Enable public read access for SEC filings
ALTER TABLE sec_filings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access to sec filings"
  ON sec_filings FOR SELECT
  TO authenticated, anon
  USING (true);

-- Enable public read access for market events
ALTER TABLE market_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access to market events"
  ON market_events FOR SELECT
  TO authenticated, anon
  USING (true);

-- Enable public read access for insight rules (admin-managed)
ALTER TABLE insight_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access to insight rules"
  ON insight_rules FOR SELECT
  TO authenticated, anon
  USING (true);
