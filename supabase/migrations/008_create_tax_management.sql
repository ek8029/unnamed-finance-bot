-- Migration 008: Tax Management
-- Description: Create tables for tax estimates, capital gains, and tax optimization
-- Supports tax planning and optimization features

-- =================================================================
-- TAX ESTIMATES
-- =================================================================

CREATE TABLE tax_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  tax_year INTEGER NOT NULL,

  estimated_income_tax NUMERIC(15, 2) DEFAULT 0,
  short_term_capital_gains NUMERIC(15, 2) DEFAULT 0,
  long_term_capital_gains NUMERIC(15, 2) DEFAULT 0,
  deductions_identified NUMERIC(15, 2) DEFAULT 0,

  total_estimated_tax NUMERIC(15, 2) DEFAULT 0, -- sum of components - deductions
  estimated_quarterly_payment NUMERIC(15, 2) DEFAULT 0, -- total / 4

  calculated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, tax_year)
);

-- Indexes
CREATE INDEX idx_tax_estimates_user_id ON tax_estimates(user_id);
CREATE INDEX idx_tax_estimates_year ON tax_estimates(tax_year DESC);

-- Comments
COMMENT ON TABLE tax_estimates IS 'Annual tax liability estimates by component';
COMMENT ON COLUMN tax_estimates.estimated_quarterly_payment IS 'Estimated quarterly payment (total / 4)';

-- =================================================================
-- CAPITAL GAINS
-- =================================================================

CREATE TABLE capital_gains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  security_id UUID NOT NULL REFERENCES securities(id),
  ticker TEXT NOT NULL,

  -- Transaction details
  transaction_type TEXT CHECK (transaction_type IN ('buy', 'sell')),
  transaction_date DATE NOT NULL,
  shares NUMERIC(18, 8) NOT NULL,
  price_per_share NUMERIC(15, 4) NOT NULL,

  -- Gain/loss (for sells only)
  cost_basis NUMERIC(15, 2), -- Original purchase price
  proceeds NUMERIC(15, 2), -- Sale proceeds
  gain_loss NUMERIC(15, 2), -- proceeds - cost_basis
  gain_loss_type TEXT CHECK (gain_loss_type IN ('short_term', 'long_term')),

  tax_year INTEGER, -- Year gain/loss is realized

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_capital_gains_user_id ON capital_gains(user_id);
CREATE INDEX idx_capital_gains_ticker ON capital_gains(ticker);
CREATE INDEX idx_capital_gains_year ON capital_gains(tax_year);
CREATE INDEX idx_capital_gains_type ON capital_gains(gain_loss_type);

-- Comments
COMMENT ON TABLE capital_gains IS 'Realized and unrealized capital gains/losses tracking';
COMMENT ON COLUMN capital_gains.gain_loss_type IS 'Short-term (<1 year) or long-term (>=1 year)';

-- =================================================================
-- TAX OPTIMIZATION TASKS
-- =================================================================

CREATE TABLE tax_optimization_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  tax_year INTEGER NOT NULL,

  task_title TEXT NOT NULL,
  task_description TEXT,
  potential_savings NUMERIC(15, 2), -- Estimated tax savings

  task_type TEXT CHECK (task_type IN ('deduction', 'credit', 'strategy', 'harvesting')),
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')),

  deadline DATE, -- If time-sensitive

  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tax_tasks_user_id ON tax_optimization_tasks(user_id);
CREATE INDEX idx_tax_tasks_year ON tax_optimization_tasks(tax_year);
CREATE INDEX idx_tax_tasks_completed ON tax_optimization_tasks(is_completed);

-- Comments
COMMENT ON TABLE tax_optimization_tasks IS 'Suggested tax optimization strategies and actions';
COMMENT ON COLUMN tax_optimization_tasks.potential_savings IS 'Estimated dollar savings if task completed';
