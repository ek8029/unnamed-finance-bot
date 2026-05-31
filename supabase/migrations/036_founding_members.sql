-- =========================================================================
-- 036: FOUNDING MEMBERS BILLING PERIOD
-- =========================================================================
-- Extends the billing_period CHECK constraint to allow 'founding' for the
-- $5/mo founding member plan (locked price, 50 seats max).

ALTER TABLE user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_billing_period_check;

ALTER TABLE user_subscriptions
  ADD CONSTRAINT user_subscriptions_billing_period_check
  CHECK (billing_period IN ('monthly', 'annual', 'lifetime', 'founding'));
