-- =========================================================================
-- 037: MANUAL PORTFOLIO ENTRY
-- =========================================================================
-- Adds source tracking to linked_accounts and seeds a "Manual Portfolio"
-- institution so users can enter holdings without Plaid.

-- Add source column to linked_accounts
ALTER TABLE linked_accounts
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'plaid' CHECK (source IN ('plaid', 'manual'));

-- Seed manual portfolio institution
INSERT INTO institutions (name, slug, institution_type, supports_plaid, supports_snaptrade)
VALUES ('Manual Portfolio', 'manual-portfolio', 'brokerage', false, false)
ON CONFLICT (slug) DO NOTHING;
