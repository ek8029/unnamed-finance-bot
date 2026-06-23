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

// Two paid tiers, both recurring monthly subscriptions:
//   Pro  $20/mo  -> STRIPE_PRICE_PRO
//   Max  $50/mo  -> STRIPE_PRICE_MAX
// The `billingPeriod` field on checkout/webhook now carries the tier name.
export type BillingPeriod = 'pro' | 'max';

const BILLING_PERIOD_TO_PRICE: Record<BillingPeriod, string | undefined> = {
  pro: process.env.STRIPE_PRICE_PRO,
  max: process.env.STRIPE_PRICE_MAX,
};

/** Map a billing period (tier) to its Stripe Price ID. Returns null if invalid/unset. */
export function getPriceId(billingPeriod: string): string | null {
  const priceId = BILLING_PERIOD_TO_PRICE[billingPeriod as BillingPeriod];
  return priceId ?? null;
}

/** Validate a billing period string. */
export function isValidBillingPeriod(value: string): value is BillingPeriod {
  return value === 'pro' || value === 'max';
}

/** Both tiers are subscriptions. Kept for the checkout-session mode argument. */
export function getCheckoutMode(_billingPeriod: BillingPeriod): 'payment' | 'subscription' {
  return 'subscription';
}

/** Resolve which tier a Stripe Price ID corresponds to (webhook source of truth). */
export function tierForPriceId(priceId: string | null | undefined): 'pro' | 'max' | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_MAX) return 'max';
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro';
  return null;
}
