-- Migration 002: Institutions and Linked Accounts
-- Description: Create tables for financial institutions, user accounts, and balance history
-- Supports Plaid and SnapTrade integrations

-- =================================================================
-- INSTITUTIONS
-- =================================================================

CREATE TABLE institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- 'Chase', 'Fidelity', 'Coinbase'
  slug TEXT NOT NULL UNIQUE, -- 'chase', 'fidelity', 'coinbase'
  logo_url TEXT,
  website_url TEXT,
  institution_type TEXT, -- 'bank', 'brokerage', 'crypto_exchange'
  supports_plaid BOOLEAN DEFAULT FALSE,
  supports_snaptrade BOOLEAN DEFAULT FALSE,
  plaid_institution_id TEXT, -- Plaid's institution ID
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_institutions_slug ON institutions(slug);
CREATE INDEX idx_institutions_plaid ON institutions(plaid_institution_id) WHERE plaid_institution_id IS NOT NULL;

-- Comments
COMMENT ON TABLE institutions IS 'Master catalog of financial institutions (banks, brokerages, crypto exchanges)';
COMMENT ON COLUMN institutions.slug IS 'URL-friendly identifier';
COMMENT ON COLUMN institutions.plaid_institution_id IS 'Plaid API institution identifier for future integration';

-- =================================================================
-- LINKED ACCOUNTS
-- =================================================================

CREATE TABLE linked_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id),

  account_name TEXT NOT NULL, -- 'Chase Checking', 'Fidelity Brokerage'
  account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'credit_card', 'brokerage', 'crypto', 'loan', 'mortgage')),
  account_subtype TEXT, -- 'high_yield_savings', 'roth_ira', etc.

  -- Account identifiers
  account_number_last4 TEXT, -- Last 4 digits for display
  official_name TEXT, -- Full account name from API

  -- Current state
  current_balance NUMERIC(15, 2) DEFAULT 0,
  available_balance NUMERIC(15, 2),
  credit_limit NUMERIC(15, 2), -- For credit cards
  currency TEXT DEFAULT 'USD',

  -- Connection metadata
  plaid_access_token TEXT, -- Encrypted Plaid token (later)
  plaid_account_id TEXT, -- Plaid's account ID
  snaptrade_account_id TEXT, -- SnapTrade's account ID

  -- Sync status
  is_active BOOLEAN DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('healthy', 'pending', 'error', 'disconnected')),
  sync_error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_linked_accounts_user_id ON linked_accounts(user_id);
CREATE INDEX idx_linked_accounts_institution_id ON linked_accounts(institution_id);
CREATE INDEX idx_linked_accounts_type ON linked_accounts(account_type);
CREATE INDEX idx_linked_accounts_active ON linked_accounts(is_active) WHERE is_active = TRUE;

-- Comments
COMMENT ON TABLE linked_accounts IS 'User financial accounts from banks, brokerages, and crypto exchanges';
COMMENT ON COLUMN linked_accounts.account_type IS 'Primary account classification';
COMMENT ON COLUMN linked_accounts.plaid_access_token IS 'Encrypted access token for Plaid API (future)';
COMMENT ON COLUMN linked_accounts.sync_status IS 'Connection health: healthy, pending, error, disconnected';

-- =================================================================
-- ACCOUNT BALANCES (Historical Snapshots)
-- =================================================================

CREATE TABLE account_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES linked_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  balance NUMERIC(15, 2) NOT NULL,
  available_balance NUMERIC(15, 2),
  snapshot_date DATE NOT NULL,

  -- Cash flow (calculated from transactions)
  inflows NUMERIC(15, 2) DEFAULT 0, -- Money in during period
  outflows NUMERIC(15, 2) DEFAULT 0, -- Money out during period

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(account_id, snapshot_date)
);

-- Indexes
CREATE INDEX idx_account_balances_user_id ON account_balances(user_id);
CREATE INDEX idx_account_balances_account_id ON account_balances(account_id);
CREATE INDEX idx_account_balances_date ON account_balances(snapshot_date DESC);

-- Comments
COMMENT ON TABLE account_balances IS 'Historical daily/monthly balance snapshots for trending and analysis';
COMMENT ON COLUMN account_balances.snapshot_date IS 'Date of balance snapshot (daily or monthly)';
COMMENT ON COLUMN account_balances.inflows IS 'Total deposits/income during period';
COMMENT ON COLUMN account_balances.outflows IS 'Total withdrawals/expenses during period';

-- =================================================================
-- TRIGGERS
-- =================================================================

-- Trigger for linked_accounts updated_at
CREATE TRIGGER update_linked_accounts_updated_at
    BEFORE UPDATE ON linked_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
