-- Migration 029: Recurring Detection Enhancements
-- Adds 'subscription' insight type and price_change_pct column for recurring charges

-- =================================================================
-- INSIGHTS: Add 'subscription' to insight_type CHECK constraint
-- =================================================================

ALTER TABLE insights DROP CONSTRAINT IF EXISTS insights_insight_type_check;
ALTER TABLE insights ADD CONSTRAINT insights_insight_type_check
  CHECK (insight_type IN ('spending', 'portfolio', 'market', 'tax', 'credit', 'subscription'));

-- =================================================================
-- RECURRING_TRANSACTIONS: Add price_change_pct column
-- =================================================================

ALTER TABLE recurring_transactions
  ADD COLUMN IF NOT EXISTS price_change_pct NUMERIC(7, 2);

COMMENT ON COLUMN recurring_transactions.price_change_pct IS 'Percentage price change vs. previous charge (48.39 = 48.39% increase). NULL if no prior charge.';

-- Index for upcoming charges (next_expected_date within the next 7 days)
CREATE INDEX IF NOT EXISTS idx_recurring_next_expected
  ON recurring_transactions(next_expected_date)
  WHERE is_active = TRUE;
