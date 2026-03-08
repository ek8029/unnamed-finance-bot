-- Migration 010: Financial Health
-- Description: Create tables for net worth tracking and financial health scoring
-- Supports dashboard financial health metrics

-- =================================================================
-- NET WORTH SNAPSHOTS
-- =================================================================

CREATE TABLE net_worth_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  snapshot_date DATE NOT NULL,

  total_assets NUMERIC(15, 2) NOT NULL,
  total_liabilities NUMERIC(15, 2) NOT NULL,
  net_worth NUMERIC(15, 2) NOT NULL, -- assets - liabilities

  -- Asset breakdown
  cash_balance NUMERIC(15, 2),
  investment_balance NUMERIC(15, 2),
  crypto_balance NUMERIC(15, 2),
  other_assets NUMERIC(15, 2),

  -- Liability breakdown
  credit_card_debt NUMERIC(15, 2),
  loan_debt NUMERIC(15, 2),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, snapshot_date)
);

-- Indexes
CREATE INDEX idx_net_worth_user_id ON net_worth_snapshots(user_id);
CREATE INDEX idx_net_worth_date ON net_worth_snapshots(snapshot_date DESC);

-- Comments
COMMENT ON TABLE net_worth_snapshots IS 'Daily/monthly net worth history for trending';
COMMENT ON COLUMN net_worth_snapshots.net_worth IS 'Total assets - total liabilities';

-- =================================================================
-- FINANCIAL HEALTH SCORES
-- =================================================================

CREATE TABLE financial_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  calculated_at TIMESTAMPTZ DEFAULT NOW(),

  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),

  -- Component scores
  debt_to_asset_ratio NUMERIC(5, 4), -- 0.008 = 0.8%
  savings_rate NUMERIC(5, 4), -- 0.28 = 28%
  emergency_fund_months NUMERIC(4, 2), -- 6.7 months
  portfolio_diversification NUMERIC(5, 4), -- 0.72 = 72%

  -- Score components (weighted)
  debt_score INTEGER, -- 0-100
  savings_score INTEGER, -- 0-100
  emergency_fund_score INTEGER, -- 0-100
  diversification_score INTEGER -- 0-100
);

-- Indexes
CREATE INDEX idx_financial_health_user_id ON financial_health_scores(user_id);
CREATE INDEX idx_financial_health_date ON financial_health_scores(calculated_at DESC);

-- Comments
COMMENT ON TABLE financial_health_scores IS 'Financial health score with component metrics';
COMMENT ON COLUMN financial_health_scores.overall_score IS 'Overall financial health score (0-100)';
COMMENT ON COLUMN financial_health_scores.debt_to_asset_ratio IS 'Liabilities / assets (lower is better)';
COMMENT ON COLUMN financial_health_scores.savings_rate IS 'Monthly savings / income (0.28 = 28%)';
COMMENT ON COLUMN financial_health_scores.emergency_fund_months IS 'Months of expenses covered by liquid savings';
