import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  user: '11111111-1111-4111-8111-111111111111' as string | null,
  row: null as Record<string, unknown> | null, displayError: false,
  reads: [] as string[], subscriptions: vi.fn(), checkout: vi.fn(), portal: vi.fn(),
}));

// Read-only projection-aware boundary from migrations 021/028/064/071/076:
// a single row per auth user, unique customer, constrained tier/source/period/
// permanent grant. Every read requires the authenticated user_id; no writes.
vi.mock('@/lib/supabase/server', () => {
  const client = () => ({
    auth: { getUser: async () => ({ data: { user: h.user ? { id: h.user, email: 'owner@example.test' } : null }, error: null }) },
    from: (table: string) => {
      if (!['user_subscriptions', 'analysis_usage'].includes(table)) throw new Error(`Unexpected table ${table}`);
      let columns = ''; let scoped = false;
      const query = {
        select: (value: string) => { columns = value; h.reads.push(value); return query; },
        eq: (key: string, value: unknown) => {
          if (key !== 'user_id' || !h.user || value !== h.user) throw new Error('Owner-only read required');
          scoped = true; return query;
        },
        maybeSingle: async () => {
          if (!scoped || table !== 'user_subscriptions') throw new Error('UNIQUE(user_id) read required');
          if (h.displayError && columns.includes('current_period_end')) return { data: null, error: { message: 'unavailable' } };
          if (!h.row) return { data: null, error: null };
          expect(h.row.user_id).toBe(h.user);
          expect(['free', 'pro', 'max']).toContain(h.row.tier);
          expect(['stripe', 'revenuecat']).toContain(h.row.source);
          expect([null, 'monthly', 'annual', 'lifetime', 'founding', 'pro', 'max', 'pro_annual']).toContain(h.row.billing_period);
          expect([null, 'complimentary', 'lifetime']).toContain(h.row.permanent_access);
          const fields = columns.split(',').map(key => key.trim());
          for (const key of fields) if (!(key in h.row)) throw new Error(`Unknown projected column ${key}`);
          return { data: Object.fromEntries(fields.map(key => [key, h.row![key]])), error: null };
        },
        gte: async (key: string) => {
          if (!scoped || table !== 'analysis_usage' || key !== 'created_at') throw new Error('Scoped usage read required');
          return { count: 0, error: null };
        },
      };
      return query;
    },
  });
  return { createClient: async () => client(), createServiceClient: async () => client() };
});
vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({ subscriptions: { list: h.subscriptions }, checkout: { sessions: { create: h.checkout } }, billingPortal: { sessions: { create: h.portal } } }),
  getPriceId: () => 'price_fixture', isValidBillingPeriod: (value: string) => ['pro', 'pro_annual'].includes(value), getCheckoutMode: () => 'subscription',
}));

import { GET as tier } from '@/app/api/user/tier/route';
import { POST as checkout } from '@/app/api/stripe/checkout/route';
import { POST as portal } from '@/app/api/stripe/portal/route';

const customer = 'cus_private_fixture';
const base = {
  id: '22222222-2222-4222-8222-222222222222', user_id: '11111111-1111-4111-8111-111111111111',
  tier: 'free', source: 'stripe', stripe_customer_id: null, stripe_subscription_id: null,
  stripe_price_id: null, store_product_id: null, trial_ends_at: null, permanent_access: null,
  billing_period: null, current_period_end: null, cancel_at_period_end: false, updated_at: '2026-09-18T00:00:00Z',
};
const sendCheckout = () => checkout(new NextRequest('http://localhost/api/stripe/checkout', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ billingPeriod: 'pro' }),
}));
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-19T12:00:00Z'));
  h.user = base.user_id; h.row = { ...base }; h.displayError = false; h.reads = [];
  h.subscriptions.mockReset().mockResolvedValue({ data: [] });
  h.checkout.mockReset().mockResolvedValue({ client_secret: 'secret_fixture' });
  h.portal.mockReset().mockResolvedValue({ url: 'https://billing.stripe.com/fixture' });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('billing management is separate from entitlement and purchase', () => {
  it.each([
    ['fresh Free', {}, false, false, 'free', true],
    ['unpaid or ended Stripe', { stripe_customer_id: customer }, true, false, 'free', true],
    ['active Stripe', { tier: 'pro', stripe_customer_id: customer, stripe_subscription_id: 'sub_private', billing_period: 'pro' }, true, false, 'pro', false],
    ['Apple only', { tier: 'pro', source: 'revenuecat', store_product_id: 'helm_pro_monthly', billing_period: 'monthly' }, false, true, 'pro', false],
    ['both providers', { tier: 'pro', source: 'revenuecat', store_product_id: 'helm_pro_monthly', stripe_customer_id: customer, stripe_subscription_id: 'sub_private', billing_period: 'monthly' }, true, true, 'pro', false],
    ['Apple history after Stripe becomes current', { tier: 'pro', source: 'stripe', store_product_id: 'helm_pro_monthly', stripe_customer_id: customer, stripe_subscription_id: 'sub_private', billing_period: 'pro' }, true, true, 'pro', false],
    ['expired Apple history', { source: 'revenuecat', store_product_id: 'helm_pro_monthly' }, false, true, 'free', true],
    ['lifetime with Stripe customer', { tier: 'pro', permanent_access: 'lifetime', billing_period: 'lifetime', stripe_customer_id: customer }, false, false, 'pro', false],
    ['complimentary', { tier: 'pro', permanent_access: 'complimentary' }, false, false, 'pro', false],
    ['active no-card trial', { tier: 'pro', trial_ends_at: '2026-09-25T00:00:00Z' }, false, false, 'pro', true],
  ] as const)('%s exposes management without exposing identifiers or changing access', async (_, overrides, stripe, apple, realTier, canPurchasePro) => {
    h.row = { ...base, ...overrides };
    const response = await tier();
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.billingManagement).toEqual({ stripe, apple });
    expect(payload.realTier).toBe(realTier);
    expect(payload.canPurchasePro).toBe(canPurchasePro);
    expect(JSON.stringify(payload)).not.toMatch(/cus_private|sub_private|stripe_customer_id|stripe_subscription_id|store_product_id/);
    expect(h.subscriptions).not.toHaveBeenCalled();
    expect(h.checkout).not.toHaveBeenCalled();
  });
  it('distinguishes no subscription row from unavailable management data', async () => {
    h.row = null;
    expect((await (await tier()).json()).billingManagement).toEqual({ stripe: false, apple: false });
    h.row = { ...base, tier: 'pro' }; h.displayError = true;
    const response = await tier();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ realTier: 'pro', billingManagement: null });
  });
  it('does not expose management to a signed-out caller', async () => {
    h.user = null;
    const response = await tier();
    expect(response.status).toBe(401);
    expect(await response.json()).not.toHaveProperty('billingManagement');
    expect(h.reads).toHaveLength(0);
  });
});

describe('existing Stripe subscriptions recover through billing, never a second checkout', () => {
  it.each(['unpaid', 'past_due', 'active', 'trialing'])('keeps %s blocked with an actionable 400', async status => {
    h.row = { ...base, stripe_customer_id: customer };
    h.subscriptions.mockResolvedValue({ data: [{ id: 'sub_existing', status }] });
    const response = await sendCheckout();
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.code).toBe('billing_management_required');
    expect(payload.error).not.toContain('already have Pro');
    expect(h.checkout).not.toHaveBeenCalled();
    expect(h.subscriptions).toHaveBeenCalledWith(expect.objectContaining({ customer }));
  });
  it('makes a stored Pro rejection actionable without looking up providers', async () => {
    h.row = { ...base, tier: 'pro', source: 'revenuecat', store_product_id: 'helm_pro_monthly' };
    expect(await (await sendCheckout()).json()).toMatchObject({ code: 'membership_exists' });
    expect(h.checkout).not.toHaveBeenCalled(); expect(h.subscriptions).not.toHaveBeenCalled();
  });
  it('lets the same unpaid Free owner open their existing Stripe portal', async () => {
    h.row = { ...base, stripe_customer_id: customer };
    const response = await portal();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: 'https://billing.stripe.com/fixture' });
    expect(h.portal).toHaveBeenCalledWith(expect.objectContaining({ customer }));
    expect(h.checkout).not.toHaveBeenCalled(); expect(h.row.tier).toBe('free');
  });
  it('preserves portal authentication, absent-customer and lifetime branches', async () => {
    h.user = null; expect((await portal()).status).toBe(401);
    h.user = base.user_id; expect((await portal()).status).toBe(400);
    h.row = { ...base, tier: 'pro', billing_period: 'lifetime', stripe_customer_id: customer };
    expect(await (await portal()).json()).toMatchObject({ url: null, message: expect.stringContaining('Lifetime') });
    expect(h.portal).not.toHaveBeenCalled();
  });
});
