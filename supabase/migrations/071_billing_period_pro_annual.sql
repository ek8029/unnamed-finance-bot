-- 071: allow billing_period = 'pro_annual', for the $149/yr plan.
--
-- This is the same defect 051 was written to fix, and 051's header describes
-- exactly what happens when it is missed: the Stripe subscription is created
-- and the card is charged, the webhook's upsert dies on a check violation, and
-- the user's tier never leaves 'free'. Verified against production before
-- writing this: updating a row to 'pro_annual' returns
--   [23514] new row for relation "user_subscriptions" violates check
--   constraint "user_subscriptions_billing_period_check"
--
-- Two writers send the value once the annual plan is live:
--   app/api/stripe/webhook/route.ts  checkout.session.completed  (session metadata)
--   app/api/stripe/webhook/route.ts  customer.subscription.updated (billingPeriodForPriceId)
-- The second one matters beyond activation: without it, an annual subscriber's
-- cancel_at_period_end and current_period_end never sync, so cancelling in the
-- Stripe portal would appear to do nothing in the app.
--
-- The legacy values stay. 'monthly' | 'annual' | 'lifetime' predate 044 and are
-- still on old rows; 'founding' is read by /api/founding-member-count; 'max' is
-- retired but not purged.
--
-- APPLY THIS BEFORE DEPLOYING THE ANNUAL PLAN.

ALTER TABLE user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_billing_period_check;

ALTER TABLE user_subscriptions
  ADD CONSTRAINT user_subscriptions_billing_period_check
  CHECK (billing_period IN (
    'monthly', 'annual', 'lifetime', 'founding', 'pro', 'max', 'pro_annual'
  ));

-- Verify:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname = 'user_subscriptions_billing_period_check';
