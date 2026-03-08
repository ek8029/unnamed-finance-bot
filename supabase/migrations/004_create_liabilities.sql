-- Migration 004: Liabilities
-- Description: Create liabilities table for tracking debts (credit cards, loans, mortgages)
-- Supports Plaid Liabilities API integration

-- =================================================================
-- LIABILITIES
-- =================================================================

CREATE TABLE liabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_account_id UUID REFERENCES linked_accounts(id) ON DELETE SET NULL,

  liability_type TEXT NOT NULL CHECK (liability_type IN ('credit_card', 'student_loan', 'mortgage', 'auto_loan', 'personal_loan', 'other')),
  lender_name TEXT NOT NULL,

  -- Amounts
  current_balance NUMERIC(15, 2) NOT NULL,
  original_amount NUMERIC(15, 2),
  minimum_payment NUMERIC(10, 2),

  -- Terms
  interest_rate NUMERIC(5, 4), -- 0.0499 = 4.99% APR
  payment_due_date INTEGER, -- Day of month (1-31)
  maturity_date DATE, -- Loan payoff date

  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_liabilities_user_id ON liabilities(user_id);
CREATE INDEX idx_liabilities_type ON liabilities(liability_type);
CREATE INDEX idx_liabilities_active ON liabilities(is_active) WHERE is_active = TRUE;

-- Comments
COMMENT ON TABLE liabilities IS 'User liabilities including credit cards, loans, and mortgages';
COMMENT ON COLUMN liabilities.linked_account_id IS 'Optional link to linked_accounts if liability has a connected account';
COMMENT ON COLUMN liabilities.interest_rate IS 'APR as decimal (0.0499 = 4.99%)';
COMMENT ON COLUMN liabilities.payment_due_date IS 'Day of month payment is due (1-31)';

-- =================================================================
-- TRIGGERS
-- =================================================================

-- Trigger for liabilities updated_at
CREATE TRIGGER update_liabilities_updated_at
    BEFORE UPDATE ON liabilities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
