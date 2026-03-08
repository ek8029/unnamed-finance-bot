-- Migration 006: Portfolio Snapshots and Performance
-- Description: Create tables for portfolio snapshots and performance metrics
-- Supports historical portfolio tracking and performance calculation

-- =================================================================
-- PORTFOLIO SNAPSHOTS
-- =================================================================

CREATE TABLE portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  snapshot_date DATE NOT NULL,

  total_value NUMERIC(15, 2) NOT NULL,
  total_cost_basis NUMERIC(15, 2),
  total_gain_loss NUMERIC(15, 2),
  total_gain_loss_pct NUMERIC(8, 4),

  -- Holdings snapshot (JSONB for flexibility)
  holdings_snapshot JSONB, -- Array of {ticker, shares, value, allocation}

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, snapshot_date)
);

-- Indexes
CREATE INDEX idx_portfolio_snapshots_user_id ON portfolio_snapshots(user_id);
CREATE INDEX idx_portfolio_snapshots_date ON portfolio_snapshots(snapshot_date DESC);

-- Comments
COMMENT ON TABLE portfolio_snapshots IS 'Point-in-time portfolio composition for historical analysis';
COMMENT ON COLUMN portfolio_snapshots.holdings_snapshot IS 'JSONB array of holdings at snapshot time';

-- =================================================================
-- PORTFOLIO PERFORMANCE
-- =================================================================

CREATE TABLE portfolio_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  calculated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Returns
  return_1d_pct NUMERIC(8, 4),
  return_1w_pct NUMERIC(8, 4),
  return_1m_pct NUMERIC(8, 4),
  return_3m_pct NUMERIC(8, 4),
  return_6m_pct NUMERIC(8, 4),
  return_ytd_pct NUMERIC(8, 4),
  return_1y_pct NUMERIC(8, 4),

  -- Risk metrics
  sharpe_ratio NUMERIC(6, 4),
  beta NUMERIC(6, 4),
  volatility NUMERIC(6, 4),

  -- Allocation metrics
  diversification_score NUMERIC(5, 4), -- 0-1 scale
  sector_concentration JSONB, -- {sector: percentage}
  asset_class_allocation JSONB -- {asset_class: percentage}
);

-- Indexes
CREATE INDEX idx_portfolio_performance_user_id ON portfolio_performance(user_id);
CREATE INDEX idx_portfolio_performance_date ON portfolio_performance(calculated_at DESC);

-- Comments
COMMENT ON TABLE portfolio_performance IS 'Calculated portfolio performance and risk metrics';
COMMENT ON COLUMN portfolio_performance.sharpe_ratio IS 'Risk-adjusted return metric';
COMMENT ON COLUMN portfolio_performance.beta IS 'Volatility relative to market';
COMMENT ON COLUMN portfolio_performance.diversification_score IS 'Portfolio diversification (0-1, higher is better)';
