-- =========================================================================
-- HELM TERMINAL — Consolidated Database Migrations (001–021)
-- =========================================================================
-- Generated: 2026-03-13
-- Combines all 21 migrations into a single idempotent setup script.
-- Run against a fresh Supabase project via the SQL editor.
--
-- IMPORTANT: This file assumes Supabase Auth (auth.users) already exists.
-- Run this AFTER your Supabase project is created.
-- =========================================================================


-- =========================================================================
-- 001: USER PROFILES AND PREFERENCES
-- =========================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'dark' CHECK (theme IN ('light', 'dark', 'auto')),
  density TEXT DEFAULT 'comfortable' CHECK (density IN ('compact', 'comfortable', 'spacious')),
  currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'GBP', 'JPY', 'CAD')),
  date_format TEXT DEFAULT 'MM/DD/YYYY' CHECK (date_format IN ('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD')),
  number_format TEXT DEFAULT 'US' CHECK (number_format IN ('US', 'EU', 'UK')),
  notification_market_alerts BOOLEAN DEFAULT TRUE,
  notification_transaction_alerts BOOLEAN DEFAULT TRUE,
  notification_budget_alerts BOOLEAN DEFAULT TRUE,
  notification_tax_reminders BOOLEAN DEFAULT TRUE,
  notification_weekly_digest BOOLEAN DEFAULT TRUE,
  notification_monthly_report BOOLEAN DEFAULT FALSE,
  notification_email BOOLEAN DEFAULT TRUE,
  notification_push BOOLEAN DEFAULT FALSE,
  reduce_motion BOOLEAN DEFAULT FALSE,
  high_contrast BOOLEAN DEFAULT FALSE,
  large_text BOOLEAN DEFAULT FALSE,
  screen_reader_optimized BOOLEAN DEFAULT FALSE,
  default_tab TEXT DEFAULT 'overview' CHECK (default_tab IN ('overview', 'accounts', 'portfolio', 'taxes')),
  compact_charts BOOLEAN DEFAULT FALSE,
  show_insights BOOLEAN DEFAULT TRUE,
  auto_refresh BOOLEAN DEFAULT FALSE,
  refresh_interval INTEGER DEFAULT 5,
  analytics_enabled BOOLEAN DEFAULT TRUE,
  crash_reporting_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Shared updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- =========================================================================
-- 002: INSTITUTIONS AND LINKED ACCOUNTS
-- =========================================================================

CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  website_url TEXT,
  institution_type TEXT,
  supports_plaid BOOLEAN DEFAULT FALSE,
  supports_snaptrade BOOLEAN DEFAULT FALSE,
  plaid_institution_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_institutions_slug ON institutions(slug);
CREATE INDEX IF NOT EXISTS idx_institutions_plaid ON institutions(plaid_institution_id) WHERE plaid_institution_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS linked_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id),
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'credit_card', 'brokerage', 'crypto', 'loan', 'mortgage')),
  account_subtype TEXT,
  account_number_last4 TEXT,
  official_name TEXT,
  current_balance NUMERIC(15, 2) DEFAULT 0,
  available_balance NUMERIC(15, 2),
  credit_limit NUMERIC(15, 2),
  currency TEXT DEFAULT 'USD',
  plaid_access_token TEXT,
  plaid_account_id TEXT,
  snaptrade_account_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('healthy', 'pending', 'error', 'disconnected')),
  sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linked_accounts_user_id ON linked_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_linked_accounts_institution_id ON linked_accounts(institution_id);
CREATE INDEX IF NOT EXISTS idx_linked_accounts_type ON linked_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_linked_accounts_active ON linked_accounts(is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS account_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES linked_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(15, 2) NOT NULL,
  available_balance NUMERIC(15, 2),
  snapshot_date DATE NOT NULL,
  inflows NUMERIC(15, 2) DEFAULT 0,
  outflows NUMERIC(15, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_account_balances_user_id ON account_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_account_balances_account_id ON account_balances(account_id);
CREATE INDEX IF NOT EXISTS idx_account_balances_date ON account_balances(snapshot_date DESC);

DROP TRIGGER IF EXISTS update_linked_accounts_updated_at ON linked_accounts;
CREATE TRIGGER update_linked_accounts_updated_at
    BEFORE UPDATE ON linked_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- =========================================================================
-- 003: TRANSACTIONS AND CATEGORIES
-- =========================================================================

CREATE TABLE IF NOT EXISTS transaction_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category_group TEXT,
  icon TEXT,
  color TEXT,
  is_income BOOLEAN DEFAULT FALSE,
  is_expense BOOLEAN DEFAULT FALSE,
  is_transfer BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_transaction_categories_group ON transaction_categories(category_group);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES linked_accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES transaction_categories(id),
  amount NUMERIC(15, 2) NOT NULL,
  transaction_date DATE NOT NULL,
  posted_date DATE,
  description TEXT NOT NULL,
  merchant_name TEXT,
  category_name TEXT,
  is_pending BOOLEAN DEFAULT FALSE,
  plaid_transaction_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_plaid ON transactions(plaid_transaction_id) WHERE plaid_transaction_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS cash_flow_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_month DATE NOT NULL,
  total_income NUMERIC(15, 2) DEFAULT 0,
  total_expenses NUMERIC(15, 2) DEFAULT 0,
  net_flow NUMERIC(15, 2) DEFAULT 0,
  savings_amount NUMERIC(15, 2) DEFAULT 0,
  savings_rate NUMERIC(5, 4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, snapshot_month)
);

CREATE INDEX IF NOT EXISTS idx_cash_flow_user_id ON cash_flow_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_month ON cash_flow_snapshots(snapshot_month DESC);

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- =========================================================================
-- 004: LIABILITIES
-- =========================================================================

CREATE TABLE IF NOT EXISTS liabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_account_id UUID REFERENCES linked_accounts(id) ON DELETE SET NULL,
  liability_type TEXT NOT NULL CHECK (liability_type IN ('credit_card', 'student_loan', 'mortgage', 'auto_loan', 'personal_loan', 'other')),
  lender_name TEXT NOT NULL,
  current_balance NUMERIC(15, 2) NOT NULL,
  original_amount NUMERIC(15, 2),
  minimum_payment NUMERIC(10, 2),
  interest_rate NUMERIC(5, 4),
  payment_due_date INTEGER,
  maturity_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_liabilities_user_id ON liabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_liabilities_type ON liabilities(liability_type);
CREATE INDEX IF NOT EXISTS idx_liabilities_active ON liabilities(is_active) WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS update_liabilities_updated_at ON liabilities;
CREATE TRIGGER update_liabilities_updated_at
    BEFORE UPDATE ON liabilities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- =========================================================================
-- 005: SECURITIES AND HOLDINGS
-- =========================================================================

CREATE TABLE IF NOT EXISTS securities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL UNIQUE,
  security_name TEXT NOT NULL,
  cusip TEXT,
  isin TEXT,
  asset_class TEXT CHECK (asset_class IN ('equity', 'etf', 'mutual_fund', 'crypto', 'bond', 'commodity', 'other')),
  sector TEXT,
  industry TEXT,
  exchange TEXT,
  currency TEXT DEFAULT 'USD',
  logo_url TEXT,
  current_price NUMERIC(15, 4),
  last_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_securities_ticker ON securities(ticker);
CREATE INDEX IF NOT EXISTS idx_securities_asset_class ON securities(asset_class);
CREATE INDEX IF NOT EXISTS idx_securities_sector ON securities(sector);

CREATE TABLE IF NOT EXISTS holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES linked_accounts(id) ON DELETE CASCADE,
  security_id UUID NOT NULL REFERENCES securities(id),
  ticker TEXT NOT NULL,
  shares NUMERIC(18, 8) NOT NULL,
  average_cost_basis NUMERIC(15, 4),
  total_cost_basis NUMERIC(15, 2),
  current_price NUMERIC(15, 4) NOT NULL,
  total_value NUMERIC(15, 2) NOT NULL,
  unrealised_gain_loss NUMERIC(15, 2),
  unrealised_gain_loss_pct NUMERIC(8, 4),
  day_change_pct NUMERIC(8, 4),
  portfolio_allocation_pct NUMERIC(5, 2),
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, account_id, security_id)
);

CREATE INDEX IF NOT EXISTS idx_holdings_user_id ON holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_account_id ON holdings(account_id);
CREATE INDEX IF NOT EXISTS idx_holdings_security_id ON holdings(security_id);
CREATE INDEX IF NOT EXISTS idx_holdings_ticker ON holdings(ticker);


-- =========================================================================
-- 006: PORTFOLIO SNAPSHOTS AND PERFORMANCE
-- =========================================================================

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_value NUMERIC(15, 2) NOT NULL,
  total_cost_basis NUMERIC(15, 2),
  total_gain_loss NUMERIC(15, 2),
  total_gain_loss_pct NUMERIC(8, 4),
  holdings_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_id ON portfolio_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_date ON portfolio_snapshots(snapshot_date DESC);

CREATE TABLE IF NOT EXISTS portfolio_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  return_1d_pct NUMERIC(8, 4),
  return_1w_pct NUMERIC(8, 4),
  return_1m_pct NUMERIC(8, 4),
  return_3m_pct NUMERIC(8, 4),
  return_6m_pct NUMERIC(8, 4),
  return_ytd_pct NUMERIC(8, 4),
  return_1y_pct NUMERIC(8, 4),
  sharpe_ratio NUMERIC(6, 4),
  beta NUMERIC(6, 4),
  volatility NUMERIC(6, 4),
  diversification_score NUMERIC(5, 4),
  sector_concentration JSONB,
  asset_class_allocation JSONB
);

CREATE INDEX IF NOT EXISTS idx_portfolio_performance_user_id ON portfolio_performance(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_performance_date ON portfolio_performance(calculated_at DESC);


-- =========================================================================
-- 007: MARKET DATA
-- =========================================================================

CREATE TABLE IF NOT EXISTS market_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  security_id UUID NOT NULL REFERENCES securities(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  price_date DATE NOT NULL,
  open NUMERIC(15, 4),
  high NUMERIC(15, 4),
  low NUMERIC(15, 4),
  close NUMERIC(15, 4) NOT NULL,
  volume BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(security_id, price_date)
);

CREATE INDEX IF NOT EXISTS idx_market_prices_security_id ON market_prices(security_id);
CREATE INDEX IF NOT EXISTS idx_market_prices_ticker ON market_prices(ticker);
CREATE INDEX IF NOT EXISTS idx_market_prices_date ON market_prices(price_date DESC);

CREATE TABLE IF NOT EXISTS market_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  url TEXT,
  image_url TEXT,
  source TEXT,
  author TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  tickers TEXT[],
  sectors TEXT[],
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_news_published ON market_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_news_tickers ON market_news USING GIN(tickers);
CREATE INDEX IF NOT EXISTS idx_market_news_sectors ON market_news USING GIN(sectors);

CREATE TABLE IF NOT EXISTS sec_filings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  security_id UUID REFERENCES securities(id),
  ticker TEXT NOT NULL,
  filing_type TEXT NOT NULL,
  filing_date DATE NOT NULL,
  report_period DATE,
  title TEXT,
  url TEXT NOT NULL,
  revenue NUMERIC(20, 2),
  net_income NUMERIC(20, 2),
  eps NUMERIC(10, 4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sec_filings_ticker ON sec_filings(ticker);
CREATE INDEX IF NOT EXISTS idx_sec_filings_type ON sec_filings(filing_type);
CREATE INDEX IF NOT EXISTS idx_sec_filings_date ON sec_filings(filing_date DESC);

CREATE TABLE IF NOT EXISTS market_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('earnings', 'dividend', 'split', 'merger', 'ipo', 'macro', 'fed_announcement')),
  ticker TEXT,
  event_date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  impact_level TEXT CHECK (impact_level IN ('high', 'medium', 'low')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_events_type ON market_events(event_type);
CREATE INDEX IF NOT EXISTS idx_market_events_ticker ON market_events(ticker);
CREATE INDEX IF NOT EXISTS idx_market_events_date ON market_events(event_date DESC);


-- =========================================================================
-- 008: TAX MANAGEMENT
-- =========================================================================

CREATE TABLE IF NOT EXISTS tax_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tax_year INTEGER NOT NULL,
  estimated_income_tax NUMERIC(15, 2) DEFAULT 0,
  short_term_capital_gains NUMERIC(15, 2) DEFAULT 0,
  long_term_capital_gains NUMERIC(15, 2) DEFAULT 0,
  deductions_identified NUMERIC(15, 2) DEFAULT 0,
  total_estimated_tax NUMERIC(15, 2) DEFAULT 0,
  estimated_quarterly_payment NUMERIC(15, 2) DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tax_year)
);

CREATE INDEX IF NOT EXISTS idx_tax_estimates_user_id ON tax_estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_tax_estimates_year ON tax_estimates(tax_year DESC);

CREATE TABLE IF NOT EXISTS capital_gains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  security_id UUID NOT NULL REFERENCES securities(id),
  ticker TEXT NOT NULL,
  transaction_type TEXT CHECK (transaction_type IN ('buy', 'sell')),
  transaction_date DATE NOT NULL,
  shares NUMERIC(18, 8) NOT NULL,
  price_per_share NUMERIC(15, 4) NOT NULL,
  cost_basis NUMERIC(15, 2),
  proceeds NUMERIC(15, 2),
  gain_loss NUMERIC(15, 2),
  gain_loss_type TEXT CHECK (gain_loss_type IN ('short_term', 'long_term')),
  tax_year INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capital_gains_user_id ON capital_gains(user_id);
CREATE INDEX IF NOT EXISTS idx_capital_gains_ticker ON capital_gains(ticker);
CREATE INDEX IF NOT EXISTS idx_capital_gains_year ON capital_gains(tax_year);
CREATE INDEX IF NOT EXISTS idx_capital_gains_type ON capital_gains(gain_loss_type);

CREATE TABLE IF NOT EXISTS tax_optimization_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tax_year INTEGER NOT NULL,
  task_title TEXT NOT NULL,
  task_description TEXT,
  potential_savings NUMERIC(15, 2),
  task_type TEXT CHECK (task_type IN ('deduction', 'credit', 'strategy', 'harvesting')),
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
  deadline DATE,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_tasks_user_id ON tax_optimization_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tax_tasks_year ON tax_optimization_tasks(tax_year);
CREATE INDEX IF NOT EXISTS idx_tax_tasks_completed ON tax_optimization_tasks(is_completed);


-- =========================================================================
-- 009: INSIGHTS ENGINE (includes 015 snoozed_until, is_archived columns)
-- =========================================================================

CREATE TABLE IF NOT EXISTS insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('spending', 'portfolio', 'market', 'tax', 'credit')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  recommended_action TEXT,
  explanation TEXT,
  estimated_impact_amount NUMERIC(15, 2),
  confidence_score NUMERIC(3, 2),
  source_type TEXT CHECK (source_type IN ('rule_based', 'ai_generated', 'external')),
  rule_id UUID,
  related_entity_type TEXT,
  related_entity_ids TEXT[],
  is_dismissed BOOLEAN DEFAULT FALSE,
  is_useful BOOLEAN,
  user_feedback TEXT,
  snoozed_until TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_insights_user_id ON insights(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_type ON insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_priority ON insights(priority);
CREATE INDEX IF NOT EXISTS idx_insights_created ON insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_dismissed ON insights(is_dismissed) WHERE is_dismissed = FALSE;
CREATE INDEX IF NOT EXISTS idx_insights_snoozed ON insights(snoozed_until) WHERE snoozed_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_insights_archived ON insights(is_archived) WHERE is_archived = TRUE;

CREATE TABLE IF NOT EXISTS insight_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id UUID NOT NULL REFERENCES insights(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id UUID,
  source_url TEXT,
  source_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insight_sources_insight_id ON insight_sources(insight_id);
CREATE INDEX IF NOT EXISTS idx_insight_sources_type ON insight_sources(source_type);

CREATE TABLE IF NOT EXISTS insight_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL UNIQUE,
  rule_description TEXT,
  rule_query TEXT,
  rule_logic JSONB,
  insight_template JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insight_rules_active ON insight_rules(is_active) WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS update_insight_rules_updated_at ON insight_rules;
CREATE TRIGGER update_insight_rules_updated_at
    BEFORE UPDATE ON insight_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- =========================================================================
-- 010: FINANCIAL HEALTH
-- =========================================================================

CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_assets NUMERIC(15, 2) NOT NULL,
  total_liabilities NUMERIC(15, 2) NOT NULL,
  net_worth NUMERIC(15, 2) NOT NULL,
  cash_balance NUMERIC(15, 2),
  investment_balance NUMERIC(15, 2),
  crypto_balance NUMERIC(15, 2),
  other_assets NUMERIC(15, 2),
  credit_card_debt NUMERIC(15, 2),
  loan_debt NUMERIC(15, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_net_worth_user_id ON net_worth_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_net_worth_date ON net_worth_snapshots(snapshot_date DESC);

CREATE TABLE IF NOT EXISTS financial_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  debt_to_asset_ratio NUMERIC(5, 4),
  savings_rate NUMERIC(5, 4),
  emergency_fund_months NUMERIC(4, 2),
  portfolio_diversification NUMERIC(5, 4),
  debt_score INTEGER,
  savings_score INTEGER,
  emergency_fund_score INTEGER,
  diversification_score INTEGER
);

CREATE INDEX IF NOT EXISTS idx_financial_health_user_id ON financial_health_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_health_date ON financial_health_scores(calculated_at DESC);


-- =========================================================================
-- 011: SYNC JOBS AND AUDIT LOGS
-- =========================================================================

CREATE TABLE IF NOT EXISTS sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('plaid_transactions', 'plaid_balances', 'snaptrade_holdings', 'market_prices', 'market_news', 'sec_filings')),
  job_name TEXT NOT NULL,
  schedule TEXT,
  is_enabled BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_user_id ON sync_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_type ON sync_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_enabled ON sync_jobs(is_enabled) WHERE is_enabled = TRUE;

CREATE TABLE IF NOT EXISTS sync_runs (
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
  run_metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_job_id ON sync_runs(sync_job_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_user_id ON sync_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_started ON sync_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON sync_runs(status);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);


-- =========================================================================
-- 013: PLAID ITEMS
-- =========================================================================

CREATE TABLE IF NOT EXISTS plaid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plaid_item_id TEXT NOT NULL UNIQUE,
  plaid_access_token TEXT NOT NULL,
  institution_id UUID REFERENCES institutions(id),
  plaid_institution_id TEXT,
  institution_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'login_required', 'revoked')),
  error_code TEXT,
  error_message TEXT,
  available_products TEXT[] DEFAULT '{}',
  billed_products TEXT[] DEFAULT '{}',
  consented_products TEXT[] DEFAULT '{}',
  transactions_cursor TEXT,
  last_transactions_sync TIMESTAMPTZ,
  last_balances_sync TIMESTAMPTZ,
  last_holdings_sync TIMESTAMPTZ,
  webhook_url TEXT,
  consent_expiration TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plaid_items_user_id ON plaid_items(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_item_id ON plaid_items(plaid_item_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_status ON plaid_items(status);

DROP TRIGGER IF EXISTS update_plaid_items_updated_at ON plaid_items;
CREATE TRIGGER update_plaid_items_updated_at
    BEFORE UPDATE ON plaid_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- =========================================================================
-- 014: RECURRING TRANSACTIONS
-- =========================================================================

CREATE TABLE IF NOT EXISTS recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_name TEXT NOT NULL,
  description TEXT,
  average_amount NUMERIC(15, 2) NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'annual')),
  category_name TEXT,
  last_date DATE NOT NULL,
  next_expected_date DATE,
  occurrence_count INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  is_subscription BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, merchant_name, frequency)
);

CREATE INDEX IF NOT EXISTS idx_recurring_user_id ON recurring_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_transactions(is_active) WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS set_recurring_transactions_updated_at ON recurring_transactions;
CREATE TRIGGER set_recurring_transactions_updated_at
    BEFORE UPDATE ON recurring_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- =========================================================================
-- 017: AUTH EVENTS
-- =========================================================================

CREATE TABLE IF NOT EXISTS auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_events_email_type ON auth_events(email, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_user ON auth_events(user_id, created_at DESC);


-- =========================================================================
-- 018: WAITLIST
-- =========================================================================

CREATE TABLE IF NOT EXISTS waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT REFERENCES waitlist(referral_code) ON DELETE SET NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_referral_code ON waitlist(referral_code);
CREATE INDEX IF NOT EXISTS idx_waitlist_referred_by ON waitlist(referred_by);


-- =========================================================================
-- 019: PLAID LOGS
-- =========================================================================

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

CREATE INDEX IF NOT EXISTS idx_plaid_logs_user_id ON plaid_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_logs_created_at ON plaid_logs(created_at DESC);


-- =========================================================================
-- 021: ANALYSIS CACHE (public stock analysis)
-- =========================================================================

CREATE TABLE IF NOT EXISTS analysis_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker TEXT UNIQUE NOT NULL,
  analysis_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analysis_cache_ticker_created
  ON analysis_cache (ticker, created_at DESC);


-- =========================================================================
-- ROW-LEVEL SECURITY (consolidated from 012, 016, 020)
-- =========================================================================

-- ----- User-owned tables -----

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can view own profile') THEN
    CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can update own profile') THEN
    CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can insert own profile') THEN
    CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_preferences' AND policyname = 'Users can view own preferences') THEN
    CREATE POLICY "Users can view own preferences" ON user_preferences FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_preferences' AND policyname = 'Users can update own preferences') THEN
    CREATE POLICY "Users can update own preferences" ON user_preferences FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_preferences' AND policyname = 'Users can insert own preferences') THEN
    CREATE POLICY "Users can insert own preferences" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE linked_accounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'linked_accounts' AND policyname = 'Users can view own accounts') THEN
    CREATE POLICY "Users can view own accounts" ON linked_accounts FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'linked_accounts' AND policyname = 'Users can insert own accounts') THEN
    CREATE POLICY "Users can insert own accounts" ON linked_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'linked_accounts' AND policyname = 'Users can update own accounts') THEN
    CREATE POLICY "Users can update own accounts" ON linked_accounts FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'linked_accounts' AND policyname = 'Users can delete own accounts') THEN
    CREATE POLICY "Users can delete own accounts" ON linked_accounts FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'account_balances' AND policyname = 'Users can view own account balances') THEN
    CREATE POLICY "Users can view own account balances" ON account_balances FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'account_balances' AND policyname = 'Users can insert own account balances') THEN
    CREATE POLICY "Users can insert own account balances" ON account_balances FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Users can view own transactions') THEN
    CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Users can insert own transactions') THEN
    CREATE POLICY "Users can insert own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Users can update own transactions') THEN
    CREATE POLICY "Users can update own transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Users can delete own transactions') THEN
    CREATE POLICY "Users can delete own transactions" ON transactions FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE cash_flow_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cash_flow_snapshots' AND policyname = 'Users can view own cash flow') THEN
    CREATE POLICY "Users can view own cash flow" ON cash_flow_snapshots FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cash_flow_snapshots' AND policyname = 'Users can insert own cash flow') THEN
    CREATE POLICY "Users can insert own cash flow" ON cash_flow_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cash_flow_snapshots' AND policyname = 'Users can update own cash flow snapshots') THEN
    CREATE POLICY "Users can update own cash flow snapshots" ON cash_flow_snapshots FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE liabilities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'liabilities' AND policyname = 'Users can view own liabilities') THEN
    CREATE POLICY "Users can view own liabilities" ON liabilities FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'liabilities' AND policyname = 'Users can insert own liabilities') THEN
    CREATE POLICY "Users can insert own liabilities" ON liabilities FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'liabilities' AND policyname = 'Users can update own liabilities') THEN
    CREATE POLICY "Users can update own liabilities" ON liabilities FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'liabilities' AND policyname = 'Users can delete own liabilities') THEN
    CREATE POLICY "Users can delete own liabilities" ON liabilities FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'holdings' AND policyname = 'Users can view own holdings') THEN
    CREATE POLICY "Users can view own holdings" ON holdings FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'holdings' AND policyname = 'Users can insert own holdings') THEN
    CREATE POLICY "Users can insert own holdings" ON holdings FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'holdings' AND policyname = 'Users can update own holdings') THEN
    CREATE POLICY "Users can update own holdings" ON holdings FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'holdings' AND policyname = 'Users can delete own holdings') THEN
    CREATE POLICY "Users can delete own holdings" ON holdings FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'portfolio_snapshots' AND policyname = 'Users can view own portfolio snapshots') THEN
    CREATE POLICY "Users can view own portfolio snapshots" ON portfolio_snapshots FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'portfolio_snapshots' AND policyname = 'Users can insert own portfolio snapshots') THEN
    CREATE POLICY "Users can insert own portfolio snapshots" ON portfolio_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE portfolio_performance ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'portfolio_performance' AND policyname = 'Users can view own portfolio performance') THEN
    CREATE POLICY "Users can view own portfolio performance" ON portfolio_performance FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'portfolio_performance' AND policyname = 'Users can insert own portfolio performance') THEN
    CREATE POLICY "Users can insert own portfolio performance" ON portfolio_performance FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE tax_estimates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_estimates' AND policyname = 'Users can view own tax estimates') THEN
    CREATE POLICY "Users can view own tax estimates" ON tax_estimates FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_estimates' AND policyname = 'Users can insert own tax estimates') THEN
    CREATE POLICY "Users can insert own tax estimates" ON tax_estimates FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_estimates' AND policyname = 'Users can update own tax estimates') THEN
    CREATE POLICY "Users can update own tax estimates" ON tax_estimates FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE capital_gains ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'capital_gains' AND policyname = 'Users can view own capital gains') THEN
    CREATE POLICY "Users can view own capital gains" ON capital_gains FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'capital_gains' AND policyname = 'Users can insert own capital gains') THEN
    CREATE POLICY "Users can insert own capital gains" ON capital_gains FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE tax_optimization_tasks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_optimization_tasks' AND policyname = 'Users can view own tax tasks') THEN
    CREATE POLICY "Users can view own tax tasks" ON tax_optimization_tasks FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_optimization_tasks' AND policyname = 'Users can insert own tax tasks') THEN
    CREATE POLICY "Users can insert own tax tasks" ON tax_optimization_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_optimization_tasks' AND policyname = 'Users can update own tax tasks') THEN
    CREATE POLICY "Users can update own tax tasks" ON tax_optimization_tasks FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_optimization_tasks' AND policyname = 'Users can delete own tax tasks') THEN
    CREATE POLICY "Users can delete own tax tasks" ON tax_optimization_tasks FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insights' AND policyname = 'Users can view own insights') THEN
    CREATE POLICY "Users can view own insights" ON insights FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insights' AND policyname = 'Users can insert own insights') THEN
    CREATE POLICY "Users can insert own insights" ON insights FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insights' AND policyname = 'Users can update own insights') THEN
    CREATE POLICY "Users can update own insights" ON insights FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insights' AND policyname = 'Users can delete own insights') THEN
    CREATE POLICY "Users can delete own insights" ON insights FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE insight_sources ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insight_sources' AND policyname = 'Users can view insight sources for own insights') THEN
    CREATE POLICY "Users can view insight sources for own insights" ON insight_sources FOR SELECT
      USING (EXISTS (SELECT 1 FROM insights WHERE insights.id = insight_sources.insight_id AND insights.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insight_sources' AND policyname = 'Users can insert insight sources for own insights') THEN
    CREATE POLICY "Users can insert insight sources for own insights" ON insight_sources FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM insights WHERE insights.id = insight_sources.insight_id AND insights.user_id = auth.uid()));
  END IF;
END $$;

ALTER TABLE net_worth_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'net_worth_snapshots' AND policyname = 'Users can view own net worth') THEN
    CREATE POLICY "Users can view own net worth" ON net_worth_snapshots FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'net_worth_snapshots' AND policyname = 'Users can insert own net worth') THEN
    CREATE POLICY "Users can insert own net worth" ON net_worth_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'net_worth_snapshots' AND policyname = 'Users can update own net worth snapshots') THEN
    CREATE POLICY "Users can update own net worth snapshots" ON net_worth_snapshots FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE financial_health_scores ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financial_health_scores' AND policyname = 'Users can view own financial health') THEN
    CREATE POLICY "Users can view own financial health" ON financial_health_scores FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financial_health_scores' AND policyname = 'Users can insert own financial health') THEN
    CREATE POLICY "Users can insert own financial health" ON financial_health_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sync_jobs' AND policyname = 'Users can view own sync jobs') THEN
    CREATE POLICY "Users can view own sync jobs" ON sync_jobs FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sync_jobs' AND policyname = 'Users can insert own sync jobs') THEN
    CREATE POLICY "Users can insert own sync jobs" ON sync_jobs FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sync_jobs' AND policyname = 'Users can update own sync jobs') THEN
    CREATE POLICY "Users can update own sync jobs" ON sync_jobs FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);
  END IF;
END $$;

ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sync_runs' AND policyname = 'Users can view own sync runs') THEN
    CREATE POLICY "Users can view own sync runs" ON sync_runs FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sync_runs' AND policyname = 'Users can insert own sync runs') THEN
    CREATE POLICY "Users can insert own sync runs" ON sync_runs FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
  END IF;
END $$;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Users can view own audit logs') THEN
    CREATE POLICY "Users can view own audit logs" ON audit_logs FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Users can insert own audit logs') THEN
    CREATE POLICY "Users can insert own audit logs" ON audit_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plaid_items' AND policyname = 'Users can view own plaid items') THEN
    CREATE POLICY "Users can view own plaid items" ON plaid_items FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plaid_items' AND policyname = 'Users can insert own plaid items') THEN
    CREATE POLICY "Users can insert own plaid items" ON plaid_items FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plaid_items' AND policyname = 'Users can update own plaid items') THEN
    CREATE POLICY "Users can update own plaid items" ON plaid_items FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plaid_items' AND policyname = 'Users can delete own plaid items') THEN
    CREATE POLICY "Users can delete own plaid items" ON plaid_items FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recurring_transactions' AND policyname = 'Users can view own recurring transactions') THEN
    CREATE POLICY "Users can view own recurring transactions" ON recurring_transactions FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recurring_transactions' AND policyname = 'Users can insert own recurring transactions') THEN
    CREATE POLICY "Users can insert own recurring transactions" ON recurring_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recurring_transactions' AND policyname = 'Users can update own recurring transactions') THEN
    CREATE POLICY "Users can update own recurring transactions" ON recurring_transactions FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recurring_transactions' AND policyname = 'Users can delete own recurring transactions') THEN
    CREATE POLICY "Users can delete own recurring transactions" ON recurring_transactions FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'auth_events' AND policyname = 'Users can read own auth events') THEN
    CREATE POLICY "Users can read own auth events" ON auth_events FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE plaid_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plaid_logs' AND policyname = 'Users can read own plaid logs') THEN
    CREATE POLICY "Users can read own plaid logs" ON plaid_logs FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- ----- Shared/public tables -----

ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'institutions' AND policyname = 'Public read access to institutions') THEN
    CREATE POLICY "Public read access to institutions" ON institutions FOR SELECT TO authenticated, anon USING (true);
  END IF;
END $$;

ALTER TABLE securities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'securities' AND policyname = 'Public read access to securities') THEN
    CREATE POLICY "Public read access to securities" ON securities FOR SELECT TO authenticated, anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'securities' AND policyname = 'Authenticated users can insert securities') THEN
    CREATE POLICY "Authenticated users can insert securities" ON securities FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'securities' AND policyname = 'Authenticated users can update securities') THEN
    CREATE POLICY "Authenticated users can update securities" ON securities FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;

ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transaction_categories' AND policyname = 'Public read access to transaction categories') THEN
    CREATE POLICY "Public read access to transaction categories" ON transaction_categories FOR SELECT TO authenticated, anon USING (true);
  END IF;
END $$;

ALTER TABLE market_prices ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_prices' AND policyname = 'Public read access to market prices') THEN
    CREATE POLICY "Public read access to market prices" ON market_prices FOR SELECT TO authenticated, anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_prices' AND policyname = 'Authenticated users can insert market prices') THEN
    CREATE POLICY "Authenticated users can insert market prices" ON market_prices FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_prices' AND policyname = 'Authenticated users can update market prices') THEN
    CREATE POLICY "Authenticated users can update market prices" ON market_prices FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;

ALTER TABLE market_news ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_news' AND policyname = 'Public read access to market news') THEN
    CREATE POLICY "Public read access to market news" ON market_news FOR SELECT TO authenticated, anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_news' AND policyname = 'Authenticated users can insert market news') THEN
    CREATE POLICY "Authenticated users can insert market news" ON market_news FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_news' AND policyname = 'Authenticated users can update market news') THEN
    CREATE POLICY "Authenticated users can update market news" ON market_news FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;

ALTER TABLE sec_filings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sec_filings' AND policyname = 'Public read access to sec filings') THEN
    CREATE POLICY "Public read access to sec filings" ON sec_filings FOR SELECT TO authenticated, anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sec_filings' AND policyname = 'Authenticated users can insert sec filings') THEN
    CREATE POLICY "Authenticated users can insert sec filings" ON sec_filings FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE market_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_events' AND policyname = 'Public read access to market events') THEN
    CREATE POLICY "Public read access to market events" ON market_events FOR SELECT TO authenticated, anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_events' AND policyname = 'Authenticated users can insert market events') THEN
    CREATE POLICY "Authenticated users can insert market events" ON market_events FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_events' AND policyname = 'Authenticated users can update market events') THEN
    CREATE POLICY "Authenticated users can update market events" ON market_events FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;

ALTER TABLE insight_rules ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insight_rules' AND policyname = 'Public read access to insight rules') THEN
    CREATE POLICY "Public read access to insight rules" ON insight_rules FOR SELECT TO authenticated, anon USING (true);
  END IF;
END $$;

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'waitlist' AND policyname = 'Anyone can join waitlist') THEN
    CREATE POLICY "Anyone can join waitlist" ON waitlist FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'waitlist' AND policyname = 'Anyone can read waitlist entries') THEN
    CREATE POLICY "Anyone can read waitlist entries" ON waitlist FOR SELECT USING (true);
  END IF;
END $$;

ALTER TABLE analysis_cache ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'analysis_cache' AND policyname = 'Anyone can read analysis cache') THEN
    CREATE POLICY "Anyone can read analysis cache" ON analysis_cache FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'analysis_cache' AND policyname = 'Service role can manage analysis cache') THEN
    CREATE POLICY "Service role can manage analysis cache" ON analysis_cache FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;


-- =========================================================================
-- GRANTS
-- =========================================================================

GRANT SELECT, INSERT ON waitlist TO anon, authenticated;
GRANT SELECT ON plaid_logs TO authenticated;
GRANT INSERT ON plaid_logs TO authenticated;
GRANT ALL ON plaid_logs TO service_role;


-- =========================================================================
-- END OF CONSOLIDATED MIGRATIONS (21 migrations, 32 tables)
-- =========================================================================
