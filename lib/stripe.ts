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

// ONE paid tier, a recurring monthly subscription:
//   Pro  $20/mo  -> STRIPE_PRICE_PRO
// Max is retired. Its old price ID still resolves, so anyone mid-subscription
// on it keeps working and simply reads as Pro; nothing new can be sold at it.
// The `billingPeriod` field on checkout/webhook carries the tier name.
export type BillingPeriod = 'pro';

/** Map a billing period (tier) to its Stripe Price ID. Returns null if invalid/unset. */
export function getPriceId(billingPeriod: string): string | null {
  return billingPeriod === 'pro' ? (process.env.STRIPE_PRICE_PRO ?? null) : null;
}

/** Validate a billing period string. */
export function isValidBillingPeriod(value: string): value is BillingPeriod {
  return value === 'pro';
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
  if (priceId === process.env.STRIPE_PRICE_MAX) return 'pro';
  return null;
}
