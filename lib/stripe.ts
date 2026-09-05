/**
 * Singleton Stripe server client.
 * All server-side Stripe API calls import from here.
 * Do NOT import this in client components — use @stripe/react-stripe-js instead.
 */
import Stripe from 'stripe';

/**
 * Lazy Stripe client — only constructed when first accessed.
 * This prevents the build from crashing when STRIPE_SECRET_KEY isn't set
 * (e.g., during Vercel builds before the operator creates a Stripe account).
 * API routes that use `getStripe()` will return 503 if the key is missing.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    _stripe = new Stripe(key, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
    });
  }
  return _stripe;
}

/** @deprecated Use getStripe() instead — this crashes at build time if key is missing */
export const stripe = null as unknown as Stripe;

// ONE paid tier, sold at two intervals. Both are the same product in Stripe,
// which is what lets a subscription change interval later instead of being
// cancelled and rebought:
//   Pro monthly  $20/mo   -> STRIPE_PRICE_PRO
//   Pro annual   $149/yr  -> STRIPE_PRICE_PRO_ANNUAL
// Max is retired. Its old price ID still resolves, so anyone mid-subscription
// on it keeps working and simply reads as Pro; nothing new can be sold at it.
//
// This is an INTERVAL, not a tier. Both land on tier 'pro', and anything that
// asks "how much access does this person have" must use the tier, never this.
export type BillingPeriod = 'pro' | 'pro_annual';

/** Map a billing period to its Stripe Price ID. Returns null if invalid/unset. */
export function getPriceId(billingPeriod: string): string | null {
  if (billingPeriod === 'pro') return process.env.STRIPE_PRICE_PRO ?? null;
  if (billingPeriod === 'pro_annual') return process.env.STRIPE_PRICE_PRO_ANNUAL ?? null;
  return null;
}

/** Validate a billing period string. */
export function isValidBillingPeriod(value: string): value is BillingPeriod {
  return value === 'pro' || value === 'pro_annual';
}

/** Kept for the checkout-session mode argument. */
export function getCheckoutMode(_billingPeriod: BillingPeriod): 'payment' | 'subscription' {
  return 'subscription';
}

/** Resolve which tier a Stripe Price ID corresponds to (webhook source of truth).
 *  The retired Max price maps to 'pro' so existing subscribers keep access. */
export function tierForPriceId(priceId: string | null | undefined): 'pro' | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro';
  if (priceId === process.env.STRIPE_PRICE_PRO_ANNUAL) return 'pro';
  if (priceId === process.env.STRIPE_PRICE_MAX) return 'pro';
  return null;
}

/** Which INTERVAL a price is sold at, for the stored `billing_period`.
 *
 *  subscription.updated used to write the tier into billing_period, which was
 *  harmless while 'pro' was the only value and would now flatten every annual
 *  subscriber to 'pro' on their first webhook after purchase. The interval is
 *  what that column is for. */
export function billingPeriodForPriceId(priceId: string | null | undefined): BillingPeriod | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PRO_ANNUAL) return 'pro_annual';
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro';
  if (priceId === process.env.STRIPE_PRICE_MAX) return 'pro';
  return null;
}
