-- 049: 14-day Pro trial, granted on first Plaid connect.
-- trial_ends_at non-null marks that the user has EVER had a trial (no restarts).
-- Active trial  = tier 'pro' AND trial_ends_at > now() AND no Stripe subscription.
-- Expired trial = read-time downgrade to 'free' in lib/tier.ts (no cron needed);
-- a real Stripe checkout clears trial_ends_at via the webhook upsert.

ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
