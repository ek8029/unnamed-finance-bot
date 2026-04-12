-- =========================================================================
-- 027: HOLDINGS ACQUIRED_AT (holding period tracking for tax analysis)
-- =========================================================================
-- Tax-loss harvesting needs to distinguish short-term (≤1 year) from
-- long-term (>1 year) holdings because they're taxed at different rates:
--   - Short-term gains: ordinary income rate (22-37% federal)
--   - Long-term gains: preferential rate (0/15/20% federal)
--
-- Per IRC §1222, the holding period is measured from the day AFTER
-- acquisition to the day of disposition. A position held for MORE than
-- 1 year (366+ days) qualifies for long-term treatment.
--
-- Plaid's investmentsHoldingsGet sometimes provides acquisition dates.
-- When it doesn't, acquired_at stays NULL and the tax analysis treats
-- the holding period as "unknown" (conservative middle-ground rate).

ALTER TABLE holdings
  ADD COLUMN IF NOT EXISTS acquired_at DATE;

-- Index for the tax-analysis query that filters by holding period
CREATE INDEX IF NOT EXISTS idx_holdings_acquired_at
  ON holdings (user_id, acquired_at)
  WHERE acquired_at IS NOT NULL;
