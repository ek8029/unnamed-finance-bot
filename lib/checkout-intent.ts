/** Preserve an explicit Pro purchase through signup, login and email confirmation.
 * The dashboard opens requested checkout before setup; closing it reveals onboarding. */

/** The billing intervals a checkout intent may name. Mirrors BillingPeriod in
 *  lib/stripe.ts, kept local so client components need no server import. */
export type CheckoutIntent = 'pro' | 'pro_annual';

export const CHECKOUT_PARAM = 'checkout';

/** Session key retained to resume purchase intents parked by earlier setup flows. */
export const PENDING_CHECKOUT_KEY = 'helm_pending_checkout';

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
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\\\u0000-\u0020]/.test(next)) return fallback;
  try {
    const origin = 'https://helmterminal.dev';
    const parsed = new URL(next, origin);
    return parsed.origin === origin ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
  } catch { return fallback; }
}

export function confirmationUrl(origin: string, next: string | null | undefined): string {
  return `${origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;
}

export function loginUrlForNext(next: string, message?: string): string {
  const params = new URLSearchParams({ redirect: safeNext(next) });
  if (message) params.set('message', message);
  return `/login?${params}`;
}
