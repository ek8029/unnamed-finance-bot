-- 044: add 'max' tier (Pro $20 / Max $50 model). Founding/Lifetime billing
-- periods are being retired in the UI but stay valid for grandfathered subs.
-- tier rank: free < pro < max. Max is a superset of Pro access.

ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_tier_check;
ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_tier_check
  CHECK (tier IN ('free', 'pro', 'max'));
