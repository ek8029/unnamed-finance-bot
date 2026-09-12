import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({ row: {} as Record<string, unknown>, authenticated: true, checkout: vi.fn(), subscriptions: vi.fn() }));
// Read-only schema boundary: one subscription per authenticated user
// (021 UNIQUE(user_id)); source distinguishes Stripe/App Store (064). Reject
// unexpected tables, filters and every write. Resolvers and both routes are real.
vi.mock('@/lib/supabase/server', () => {
  const client = () => ({
    auth: { getUser: async () => ({ data: { user: h.authenticated ? { id: 'user_fixture', email: 'fixture@example.test' } : null }, error: null }) },
    from: (table: string) => {
      if (!['user_subscriptions', 'analysis_usage'].includes(table)) throw new Error(`Unexpected table: ${table}`);
      let userId: string | null = null;
      const query = {
        select: () => query,
        eq: (field: string, value: string) => {
          if (field !== 'user_id' || value !== 'user_fixture') throw new Error('Must select the authenticated user');
          userId = value;
          return query;
        },
        maybeSingle: async () => {
          if (table !== 'user_subscriptions' || !userId) throw new Error('Subscription must be read by unique user_id');
          return { data: h.row, error: null };
        },
        gte: async (field: string) => {
          if (table !== 'analysis_usage' || !userId || field !== 'created_at') throw new Error('Usage must be scoped by user/date');
          return { count: 0, error: null };
        },
      };
      return query;
    },
  });
  return { createClient: async () => client(), createServiceClient: async () => client() };
});
vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({ subscriptions: { list: h.subscriptions }, checkout: { sessions: { create: h.checkout } } }),
  getPriceId: (period: string) => period === 'pro' ? 'price_monthly' : 'price_annual',
  isValidBillingPeriod: (period: string) => ['pro', 'pro_annual'].includes(period),
  getCheckoutMode: () => 'subscription',
}));

import { GET } from '@/app/api/user/tier/route';
import { POST } from '@/app/api/stripe/checkout/route';

const base = { user_id: 'user_fixture', tier: 'free', trial_ends_at: null, stripe_subscription_id: null, stripe_customer_id: 'cus_fixture', source: 'stripe' };
const future = '2026-09-20T00:00:00Z';
const past = '2026-09-01T00:00:00Z';
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-12T00:00:00Z'));
  h.row = { ...base }; h.authenticated = true;
  h.checkout.mockReset().mockResolvedValue({ client_secret: 'fixture_secret' });
  h.subscriptions.mockReset().mockResolvedValue({ data: [] });
});
afterEach(() => vi.useRealTimers());

describe('tier purchase marker agrees with existing checkout eligibility', () => {
  it.each([
    ['active no-card trial', { tier: 'pro', trial_ends_at: future }, true, 'pro', false],
    ['lapsed no-card trial', { tier: 'pro', trial_ends_at: past }, true, 'free', false],
    ['fresh Free', {}, true, 'free', true],
    ['paid Stripe', { tier: 'pro', stripe_subscription_id: 'sub_paid', trial_ends_at: past }, false, 'pro', false],
    ['card-required Stripe trial', { tier: 'pro', stripe_subscription_id: 'sub_trial', trial_ends_at: future }, false, 'pro', false],
    ['App Store with an old web trial', { tier: 'pro', source: 'revenuecat', trial_ends_at: past }, false, 'pro', false],
    ['permanent complimentary', { tier: 'pro', permanent_access: 'complimentary' }, false, 'pro', false],
    ['legacy Max complimentary', { tier: 'max', permanent_access: 'complimentary' }, false, 'pro', false],
  ] as const)('%s exposes purchase eligibility without changing its entitlement or trial terms', async (_, row, eligible, expectedTier, getsTrial) => {
    h.row = { ...base, ...row };
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    const payload = await response.json();
    expect(payload.canPurchasePro).toBe(eligible);
    expect(payload.realTier).toBe(expectedTier);
    expect(payload.tier).toBe(expectedTier);

    const checkoutResponse = await POST(new NextRequest('http://localhost/api/stripe/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ billingPeriod: 'pro' }),
    }));
    expect(checkoutResponse.status).toBe(eligible ? 200 : 400);
    if (eligible) {
      expect(h.checkout).toHaveBeenCalledTimes(1);
      const options = h.checkout.mock.calls[0][0];
      expect(options.subscription_data.trial_period_days).toBe(getsTrial ? 14 : undefined);
      expect(options.line_items).toEqual([{ price: 'price_monthly', quantity: 1 }]);
    } else expect(h.checkout).not.toHaveBeenCalled();
  });

  it('keeps the real no-card marker when feature open access masks trialEndsAt', async () => {
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'));
    h.row = { ...base, tier: 'pro', trial_ends_at: future };
    const payload = await (await GET()).json();
    expect(payload.openAccess).toBe(true);
    expect(payload.trialEndsAt).toBeNull();
    expect(payload.realTier).toBe('pro');
    expect(payload.canPurchasePro).toBe(true);
  });

  it('never mistakes a missing trial marker for a no-card trial', async () => {
    h.row = { ...base, tier: 'pro', trial_ends_at: undefined };
    expect((await (await GET()).json()).canPurchasePro).toBe(false);
  });

  it('keeps anonymous tier lookup at 401 without inventing a purchase marker', async () => {
    h.authenticated = false;
    const response = await GET();
    expect(response.status).toBe(401);
    expect(await response.json()).not.toHaveProperty('canPurchasePro');
    expect(h.checkout).not.toHaveBeenCalled();
  });
});
