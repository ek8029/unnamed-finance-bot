/**
 * Singleton Stripe server client.
 * All server-side Stripe API calls import from here.
 * Do NOT import this in client components — use @stripe/react-stripe-js instead.
 */
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('[stripe] STRIPE_SECRET_KEY not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
});

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
