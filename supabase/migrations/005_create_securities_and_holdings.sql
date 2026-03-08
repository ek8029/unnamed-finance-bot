-- Migration 005: Securities and Holdings
-- Description: Create tables for securities (stocks, ETFs, crypto) and user holdings
-- Supports SnapTrade integration and portfolio management

-- =================================================================
-- SECURITIES
-- =================================================================

CREATE TABLE securities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifiers
  ticker TEXT NOT NULL UNIQUE, -- 'AAPL', 'BTC-USD', 'SPY'
  security_name TEXT NOT NULL, -- 'Apple Inc.', 'Bitcoin USD'
  cusip TEXT,
  isin TEXT,

  -- Classification
  asset_class TEXT CHECK (asset_class IN ('equity', 'etf', 'mutual_fund', 'crypto', 'bond', 'commodity', 'other')),
  sector TEXT, -- 'Technology', 'Healthcare', 'Financials'
  industry TEXT, -- 'Consumer Electronics', 'Software'

  -- Metadata
  exchange TEXT, -- 'NASDAQ', 'NYSE', 'Coinbase'
  currency TEXT DEFAULT 'USD',
  logo_url TEXT,

  -- Current data (updated periodically)
  current_price NUMERIC(15, 4),
  last_updated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_securities_ticker ON securities(ticker);
CREATE INDEX idx_securities_asset_class ON securities(asset_class);
CREATE INDEX idx_securities_sector ON securities(sector);

-- Comments
COMMENT ON TABLE securities IS 'Master list of all tradeable securities (stocks, ETFs, crypto, bonds)';
COMMENT ON COLUMN securities.ticker IS 'Stock ticker or crypto symbol (e.g., AAPL, BTC-USD)';
COMMENT ON COLUMN securities.cusip IS 'Committee on Uniform Securities Identification Procedures number';
COMMENT ON COLUMN securities.isin IS 'International Securities Identification Number';

-- =================================================================
-- HOLDINGS
-- =================================================================

CREATE TABLE holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES linked_accounts(id) ON DELETE CASCADE,
  security_id UUID NOT NULL REFERENCES securities(id),

  -- Position details
  ticker TEXT NOT NULL, -- Denormalized for speed
  shares NUMERIC(18, 8) NOT NULL, -- Support fractional shares + crypto decimals

  -- Cost basis
  average_cost_basis NUMERIC(15, 4), -- Average price paid per share
  total_cost_basis NUMERIC(15, 2), -- Total amount invested

  -- Current valuation
  current_price NUMERIC(15, 4) NOT NULL,
  total_value NUMERIC(15, 2) NOT NULL, -- shares * current_price

  -- Performance
  unrealised_gain_loss NUMERIC(15, 2), -- total_value - total_cost_basis
  unrealised_gain_loss_pct NUMERIC(8, 4), -- Percentage gain/loss
  day_change_pct NUMERIC(8, 4), -- Today's change percentage

  -- Portfolio metrics
  portfolio_allocation_pct NUMERIC(5, 2), -- Percentage of total portfolio

  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, account_id, security_id)
);

-- Indexes
CREATE INDEX idx_holdings_user_id ON holdings(user_id);
CREATE INDEX idx_holdings_account_id ON holdings(account_id);
CREATE INDEX idx_holdings_security_id ON holdings(security_id);
CREATE INDEX idx_holdings_ticker ON holdings(ticker);

-- Comments
COMMENT ON TABLE holdings IS 'User investment positions (stocks, ETFs, crypto)';
COMMENT ON COLUMN holdings.shares IS 'Number of shares/units held (supports fractional and crypto decimals)';
COMMENT ON COLUMN holdings.ticker IS 'Denormalized ticker for query performance';
COMMENT ON COLUMN holdings.unrealised_gain_loss IS 'Current profit/loss (not yet sold)';
