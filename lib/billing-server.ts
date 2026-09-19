import { createServiceClient } from '@/lib/supabase/server';
import { getStripe, tierForPriceId, billingPeriodForPriceId } from '@/lib/stripe';
import { subscriptionPeriodEnd } from '@/lib/stripe-event-data';
import { reconcileBillingState, revenueCatAccess, type BillingOptions, type BillingRow, type ProviderAccess } from '@/lib/billing-reconciliation';

const COLUMNS = 'user_id,tier,source,updated_at,stripe_customer_id,stripe_subscription_id,stripe_price_id,store_product_id,billing_period,current_period_end,cancel_at_period_end,trial_ends_at,permanent_access';

export async function readRevenueCat(userId: string): Promise<ProviderAccess> {
  // The API v1 customer-info endpoint accepts the app's public SDK key;
  // subscriber attributes (which need a secret key) are not used here.
  const key = process.env.REVENUECAT_API_KEY ?? process.env.REVENUECAT_SECRET_API_KEY;
  if (!key) throw new Error('REVENUECAT_API_KEY is not configured');
  if (!userId) throw new Error('A billing account is required');
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    cache: 'no-store', signal: AbortSignal.timeout(10_000),
  });
  // An auth/outage/unknown response is never interpreted as no entitlement.
  if (!response.ok) throw new Error(`RevenueCat status lookup failed (${response.status})`);
  return revenueCatAccess(await response.json(), Date.now());
}

async function readStripe(customerId: string): Promise<ProviderAccess> {
  let best: ProviderAccess = { active: false };
  // Use current state across all subscriptions: an old deleted subscription
  // may coexist with a newer paid one under the same Stripe customer.
  for await (const sub of getStripe().subscriptions.list({ customer: customerId, status: 'all', limit: 100 })) {
    // A live subscription whose price id is not in this environment's config is
    // a configuration problem, not a cancellation. Falling through to `continue`
    // let reconciliation write tier 'free' over a paying customer, which is what
    // the old `?? 'pro'` fallback existed to prevent. Keep the entitlement and
    // make the misconfiguration loud instead.
    const known = sub.items.data.find(item => tierForPriceId(item.price.id))?.price.id;
    const price = known ?? sub.items.data[0]?.price.id ?? null;
    if (!price || !['active', 'trialing', 'past_due'].includes(sub.status)) continue;
    if (!known) {
      console.error('[billing] unrecognized Stripe price on a live subscription; check STRIPE_PRICE_* for this environment', { subscription: sub.id, price });
    }
    const end = subscriptionPeriodEnd(sub, price);
    if (Date.parse(end) <= Date.now() && sub.status !== 'past_due') continue;
    if (best.active && Date.parse(best.expiresAt!) >= Date.parse(end)) continue;
    best = { active: true, productId: price, subscriptionId: sub.id,
      period: billingPeriodForPriceId(price), expiresAt: end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null };
  }
  return best;
}

export async function reconcileSubscription(userId: string, options: BillingOptions = {}): Promise<BillingRow> {
  const db = await createServiceClient();
  return reconcileBillingState(userId, {
    now: Date.now,
    revenueCat: readRevenueCat,
    stripe: readStripe,
    load: async id => {
      const { data, error } = await db.from('user_subscriptions').select(COLUMNS).eq('user_id', id).maybeSingle();
      if (error) throw error;
      return data as BillingRow | null;
    },
    save: async (previous, next) => {
      if (!previous) {
        const { error } = await db.from('user_subscriptions').insert(next);
        if (error?.code === '23505') return false;
        if (error) throw error;
        return true;
      }
      const { data, error } = await db.from('user_subscriptions').update(next)
        .eq('user_id', next.user_id).eq('updated_at', previous.updated_at).select('user_id');
      if (error) throw error;
      return !!data?.length;
    },
  }, options);
}

export function billingResponse(row: BillingRow) {
  return { ok: true, tier: row.tier, realTier: row.tier, source: row.source,
    billingPeriod: row.billing_period, currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    billingSources: [row.source === 'revenuecat' && row.tier === 'pro' ? 'revenuecat' : null,
      row.stripe_subscription_id ? 'stripe' : null].filter(Boolean) };
}
