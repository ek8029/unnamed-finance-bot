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

export type BillingPeriod = 'monthly' | 'annual' | 'lifetime';

const BILLING_PERIOD_TO_PRICE: Record<BillingPeriod, string | undefined> = {
  monthly: process.env.STRIPE_PRICE_MONTHLY,
  annual: process.env.STRIPE_PRICE_ANNUAL,
  lifetime: process.env.STRIPE_PRICE_LIFETIME,
};

/** Map a billing period to its Stripe Price ID. Returns null for invalid input. */
export function getPriceId(billingPeriod: string): string | null {
  const priceId = BILLING_PERIOD_TO_PRICE[billingPeriod as BillingPeriod];
  return priceId ?? null;
}

/** Validate a billing period string. */
export function isValidBillingPeriod(value: string): value is BillingPeriod {
  return value === 'monthly' || value === 'annual' || value === 'lifetime';
}

/** Whether this billing period uses Stripe 'payment' mode (one-time) vs 'subscription'. */
export function getCheckoutMode(billingPeriod: BillingPeriod): 'payment' | 'subscription' {
  return billingPeriod === 'lifetime' ? 'payment' : 'subscription';
}
