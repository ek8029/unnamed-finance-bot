import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reconcileSubscription } from '@/lib/billing-server';
import type { BillingRow } from '@/lib/billing-reconciliation';
const h = vi.hoisted(() => ({ db: null as unknown, subscriptions: [] as Record<string, unknown>[], saves: 0 }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: async () => h.db }));
vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({ subscriptions: { list: () => ({ async *[Symbol.asyncIterator]() { yield* h.subscriptions; } }) } }),
  tierForPriceId: () => 'pro', billingPeriodForPriceId: () => 'pro',
}));
const user = '11111111-1111-4111-8111-111111111111';
const expires = new Date(Date.now() + 86400000).toISOString();
let row: BillingRow;
beforeEach(() => {
  h.subscriptions = []; h.saves = 0;
  vi.stubEnv('REVENUECAT_API_KEY', 'fixture');
  row = { user_id: user, tier: 'pro', source: 'revenuecat', updated_at: '2026-09-01T00:00:00Z',
    stripe_customer_id: 'cus_fixture', stripe_subscription_id: 'sub_old', stripe_price_id: 'price_pro',
    store_product_id: 'helm_pro_monthly', billing_period: 'monthly', current_period_end: expires,
    trial_ends_at: null, cancel_at_period_end: false, permanent_access: null };
  // Schema: one auth user / UNIQUE(user_id), constrained tier/source/period,
  // compare-and-swap against updated_at. Reads project fields as PostgREST does.
  h.db = { from(table: string) {
    expect(table).toBe('user_subscriptions');
    let patch: BillingRow | null = null; const filters: Record<string, unknown> = {};
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters[key] = value; return query; },
      maybeSingle: async () => ({ data: filters.user_id === user ? { ...row } : null, error: null }),
      update: (next: BillingRow) => { patch = next; return query; },
      then: (resolve: (result: unknown) => unknown) => {
        if (!patch || filters.user_id !== user || filters.updated_at !== row.updated_at) return Promise.resolve(resolve({ data: [], error: null }));
        expect(['free', 'pro', 'max']).toContain(patch.tier);
        expect(['stripe', 'revenuecat']).toContain(patch.source);
        expect([null, 'monthly', 'annual', 'lifetime', 'founding', 'pro', 'max', 'pro_annual']).toContain(patch.billing_period);
        row = patch; h.saves++;
        return Promise.resolve(resolve({ data: [{ user_id: user }], error: null }));
      },
    }; return query;
  } };
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function apple(active: boolean) {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ subscriber: { entitlements: active ? {
    // The identifier the live RevenueCat dashboard returns, not a guess.
    'Helm Terminal Pro': { product_identifier: 'helm_pro_monthly', expires_date: expires },
  } : {}, subscriptions: active ? { helm_pro_monthly: { store: 'app_store' } } : {} } })));
}
describe('real reconciliation to provider and database boundary', () => {
  it('keeps Apple Pro when the Stripe list confirms the old subscription ended', async () => {
    apple(true);
    await reconcileSubscription(user, { requireRevenueCat: true });
    expect(row).toMatchObject({ tier: 'pro', source: 'revenuecat', stripe_subscription_id: null });
    expect(h.saves).toBe(1);
  });
  it('keeps current Stripe access after Apple expires, using item-level period data', async () => {
    apple(false);
    h.subscriptions = [{ id: 'sub_new', status: 'active', cancel_at_period_end: true,
      items: { data: [{ price: { id: 'price_pro' }, current_period_end: Date.parse(expires) / 1000 }] } }];
    await reconcileSubscription(user, { requireRevenueCat: true });
    expect(row).toMatchObject({ tier: 'pro', source: 'stripe', stripe_subscription_id: 'sub_new', cancel_at_period_end: true });
  });
  it('provider outage leaves the stored entitlement untouched', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })));
    await expect(reconcileSubscription(user, { requireRevenueCat: true })).rejects.toThrow('lookup failed');
    expect(h.saves).toBe(0); expect(row.tier).toBe('pro');
  });
  it('confirmed expiry of both providers removes paid access', async () => {
    apple(false);
    await reconcileSubscription(user, { requireRevenueCat: true });
    expect(row.tier).toBe('free'); expect(h.saves).toBe(1);
  });
});
