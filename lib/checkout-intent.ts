/**
 * Carrying "I want to buy" through signup.
 *
 * The homepage and pricing CTAs said "Start free trial" and linked to a bare
 * /signup, which pushed to /dashboard on success. So the intent died at the
 * door: someone told they were starting a trial got an account, the free tier,
 * and no card form. The pricing page was worse, because a logged-out visitor
 * who clicked reached /api/stripe/checkout, got a 401, and the modal printed
 * the word "Unauthorized" at them.
 *
 * The intent rides as a query param through signup and is picked up again on
 * the dashboard, where the onboarding overlay is already mounted underneath.
 * Dismissing the card form therefore lands on onboarding rather than a dead
 * page, which is the whole reason the destination is /dashboard and not back
 * to /pricing.
 */

/** The billing intervals a checkout intent may name. Mirrors BillingPeriod in
 *  lib/stripe.ts, kept local so client components need no server import. */
export type CheckoutIntent = 'pro' | 'pro_annual';

export const CHECKOUT_PARAM = 'checkout';

export function isCheckoutIntent(value: string | null | undefined): value is CheckoutIntent {
  return value === 'pro' || value === 'pro_annual';
}

/** Where a logged-out buyer should go: sign up, then resume checkout. */
export function signupUrlForIntent(intent: CheckoutIntent): string {
  const next = `/dashboard?${CHECKOUT_PARAM}=${intent}`;
  return `/signup?next=${encodeURIComponent(next)}`;
}

/** Only ever redirect to a path on this origin. A next= that leaves the site
 *  is an open redirect, and this one is reachable by anyone with a link. */
export function safeNext(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  if (next.includes('://')) return fallback;
  return next;
}
