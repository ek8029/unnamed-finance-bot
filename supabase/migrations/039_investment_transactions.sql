-- Migration 039: Investment Transactions
-- Description: Store Plaid investment transactions (buys, sells, dividends, fees)
-- so brokerage trade activity shows up in the Transactions ledger.

CREATE TABLE investment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES linked_accounts(id) ON DELETE CASCADE,
  security_id UUID REFERENCES securities(id),

  -- Plaid identifiers
  plaid_investment_transaction_id TEXT UNIQUE NOT NULL,

  -- Trade details
  ticker TEXT, -- Denormalized for speed (security_id may be null for delisted/unmatched)
  name TEXT, -- Plaid's transaction description, e.g. 'BUY AAPL 10 shares'
  transaction_type TEXT NOT NULL, -- Plaid subtype if present, else type (buy, sell, dividend, fee, ...)
  quantity NUMERIC(18, 8), -- Fractional shares supported; null for cash-only rows
  price NUMERIC(15, 4), -- Per-share price at execution
  amount NUMERIC(15, 2) NOT NULL, -- Signed cash impact: positive = inflow (sell/dividend), negative = outflow (buy)
  fees NUMERIC(15, 2),

  transaction_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_investment_transactions_user_date ON investment_transactions(user_id, transaction_date DESC);

-- Row Level Security
ALTER TABLE investment_transactions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own investment transactions
CREATE POLICY "Users read own investment transactions"
  ON investment_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role writes (Plaid sync inserts/updates rows)
CREATE POLICY "Service role writes investment transactions"
  ON investment_transactions FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE investment_transactions IS 'Plaid investment transactions (trades, dividends, fees) per user account';
COMMENT ON COLUMN investment_transactions.amount IS 'Signed cash impact, app convention: positive = money in, negative = money out';
