-- Migration 003: Transactions and Categories
-- Description: Create tables for transaction categories, transactions, and cash flow snapshots
-- Supports Plaid transaction sync and cash flow analysis

-- =================================================================
-- TRANSACTION CATEGORIES
-- =================================================================

CREATE TABLE transaction_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- 'Groceries', 'Dining', 'Salary', 'Investment'
  category_group TEXT, -- 'Food & Drink', 'Income', 'Transfer'
  icon TEXT, -- Icon identifier
  color TEXT, -- Hex color for UI
  is_income BOOLEAN DEFAULT FALSE,
  is_expense BOOLEAN DEFAULT FALSE,
  is_transfer BOOLEAN DEFAULT FALSE
);

-- Indexes
CREATE INDEX idx_transaction_categories_group ON transaction_categories(category_group);

-- Comments
COMMENT ON TABLE transaction_categories IS 'Transaction category taxonomy for classification';
COMMENT ON COLUMN transaction_categories.category_group IS 'Parent category grouping';
COMMENT ON COLUMN transaction_categories.is_income IS 'TRUE if category represents income';
COMMENT ON COLUMN transaction_categories.is_expense IS 'TRUE if category represents expense';
COMMENT ON COLUMN transaction_categories.is_transfer IS 'TRUE if category represents account transfer';

-- =================================================================
-- TRANSACTIONS
-- =================================================================

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES linked_accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES transaction_categories(id),

  -- Transaction details
  amount NUMERIC(15, 2) NOT NULL, -- Negative for expenses, positive for income
  transaction_date DATE NOT NULL,
  posted_date DATE,
  description TEXT NOT NULL,
  merchant_name TEXT,

  -- Classification
  category_name TEXT, -- Denormalized for speed
  is_pending BOOLEAN DEFAULT FALSE,

  -- External references
  plaid_transaction_id TEXT UNIQUE, -- Plaid's transaction ID

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_plaid ON transactions(plaid_transaction_id) WHERE plaid_transaction_id IS NOT NULL;

-- Comments
COMMENT ON TABLE transactions IS 'All user transactions from bank and credit card accounts';
COMMENT ON COLUMN transactions.amount IS 'Negative for expenses/withdrawals, positive for income/deposits';
COMMENT ON COLUMN transactions.category_name IS 'Denormalized category name for query performance';
COMMENT ON COLUMN transactions.plaid_transaction_id IS 'Plaid API transaction identifier (future)';

-- =================================================================
-- CASH FLOW SNAPSHOTS
-- =================================================================

CREATE TABLE cash_flow_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  snapshot_month DATE NOT NULL, -- First day of month

  total_income NUMERIC(15, 2) DEFAULT 0,
  total_expenses NUMERIC(15, 2) DEFAULT 0,
  net_flow NUMERIC(15, 2) DEFAULT 0, -- income - expenses

  savings_amount NUMERIC(15, 2) DEFAULT 0,
  savings_rate NUMERIC(5, 4), -- 0.28 = 28%

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, snapshot_month)
);

-- Indexes
CREATE INDEX idx_cash_flow_user_id ON cash_flow_snapshots(user_id);
CREATE INDEX idx_cash_flow_month ON cash_flow_snapshots(snapshot_month DESC);

-- Comments
COMMENT ON TABLE cash_flow_snapshots IS 'Monthly aggregated cash flow metrics calculated from transactions';
COMMENT ON COLUMN cash_flow_snapshots.snapshot_month IS 'First day of the month for this snapshot';
COMMENT ON COLUMN cash_flow_snapshots.net_flow IS 'Net cash flow: total_income - total_expenses';
COMMENT ON COLUMN cash_flow_snapshots.savings_rate IS 'Decimal savings rate (0.28 = 28%)';

-- =================================================================
-- TRIGGERS
-- =================================================================

-- Trigger for transactions updated_at
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
