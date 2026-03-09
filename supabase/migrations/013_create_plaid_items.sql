-- Migration 013: Plaid Items
-- Description: Track Plaid Item connections (one per institution link)
-- Each Item represents a user's connection to a single financial institution via Plaid

-- =================================================================
-- PLAID ITEMS
-- =================================================================

CREATE TABLE plaid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Plaid identifiers
  plaid_item_id TEXT NOT NULL UNIQUE,
  plaid_access_token TEXT NOT NULL, -- Encrypted in production via Supabase Vault

  -- Institution info
  institution_id UUID REFERENCES institutions(id),
  plaid_institution_id TEXT, -- Plaid's institution identifier
  institution_name TEXT,

  -- Connection state
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'login_required', 'revoked')),
  error_code TEXT,
  error_message TEXT,

  -- Products enabled on this item
  available_products TEXT[] DEFAULT '{}',
  billed_products TEXT[] DEFAULT '{}',
  consented_products TEXT[] DEFAULT '{}',

  -- Sync cursors (for incremental transaction sync)
  transactions_cursor TEXT,
  last_transactions_sync TIMESTAMPTZ,
  last_balances_sync TIMESTAMPTZ,
  last_holdings_sync TIMESTAMPTZ,

  -- Webhook
  webhook_url TEXT,

  -- Consent
  consent_expiration TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_plaid_items_user_id ON plaid_items(user_id);
CREATE INDEX idx_plaid_items_item_id ON plaid_items(plaid_item_id);
CREATE INDEX idx_plaid_items_status ON plaid_items(status);

-- Comments
COMMENT ON TABLE plaid_items IS 'Tracks Plaid Item connections (one per user-institution link)';
COMMENT ON COLUMN plaid_items.plaid_access_token IS 'Plaid access token - should be encrypted at rest';
COMMENT ON COLUMN plaid_items.transactions_cursor IS 'Cursor for Plaid transactions/sync incremental updates';

-- Trigger for updated_at
CREATE TRIGGER update_plaid_items_updated_at
    BEFORE UPDATE ON plaid_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =================================================================
-- ROW-LEVEL SECURITY
-- =================================================================

ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plaid items"
  ON plaid_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plaid items"
  ON plaid_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plaid items"
  ON plaid_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own plaid items"
  ON plaid_items FOR DELETE
  USING (auth.uid() = user_id);
