-- 051: the billing_period CHECK constraint silently broke EVERY Stripe conversion.
-- Migration 044 moved the product to pro/max tiers, and the Stripe webhook writes
-- billing_period = 'pro' | 'max' (lib/stripe.ts BillingPeriod). But the constraint
-- (028, widened by 036) still only allowed monthly/annual/lifetime/founding. So the
-- checkout.completed upsert threw check_violation (23514) -> 500 -> Stripe retried
-- ~3 days then gave up -> the customer was CHARGED but their tier never left 'free'.
-- Proof: every user_subscriptions row had billing_period = NULL (no write ever landed).
-- Expand to a superset so current (pro/max) + grandfathered (monthly/annual/lifetime/
-- founding) values are all legal.

ALTER TABLE user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_billing_period_check;

ALTER TABLE user_subscriptions
  ADD CONSTRAINT user_subscriptions_billing_period_check
  CHECK (billing_period IN ('monthly', 'annual', 'lifetime', 'founding', 'pro', 'max'));
