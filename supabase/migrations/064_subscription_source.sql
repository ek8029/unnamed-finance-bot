-- Where a subscription came from.
--
-- user_subscriptions has been Stripe's table: every column on it named a Stripe
-- concept, and the tier was written only by the Stripe webhook. Adding StoreKit
-- means a user can now pay on either rail, and something has to say which row
-- is authoritative.
--
-- ONE ROW PER USER, still. The app and the website both read this row today,
-- and splitting it would make every reader learn a merge rule. `source` records
-- which rail last wrote it and `updated_at` breaks the tie, so most-recent-wins
-- is a property of the data rather than a convention each caller reimplements.
--
-- Backfilled to 'stripe' rather than defaulted-and-left-null, because every
-- existing row genuinely came from Stripe and a null would be indistinguishable
-- from "we do not know".

ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'stripe',
  -- Which product was bought, on whichever rail. Stripe rows already carry
  -- stripe_price_id; this is the StoreKit equivalent, kept separate so neither
  -- rail has to pretend to be the other.
  ADD COLUMN IF NOT EXISTS store_product_id TEXT;

-- Only these two exist. A typo'd source would silently defeat the tie-break.
ALTER TABLE user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_source_check;
ALTER TABLE user_subscriptions
  ADD CONSTRAINT user_subscriptions_source_check
  CHECK (source IN ('stripe', 'revenuecat'));

COMMENT ON COLUMN user_subscriptions.source IS
  'Which rail last wrote this row: stripe or revenuecat. With updated_at, this is how most-recent-wins is resolved when someone has paid on both.';
COMMENT ON COLUMN user_subscriptions.store_product_id IS
  'StoreKit product identifier, e.g. helm_pro_monthly. Null for Stripe rows, which use stripe_price_id.';
