import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/stripe/webhook/route';

const mocks = vi.hoisted(() => ({
  capture: vi.fn(), from: vi.fn(), retrieve: vi.fn(), upsert: vi.fn(), update: vi.fn(), lookup: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: async () => ({ from: mocks.from }) }));
vi.mock('@/lib/posthog-server', () => ({ captureServer: mocks.capture }));
vi.mock('@/lib/emails/resend', () => ({ resend: null, FROM_EMAIL: 'unused@example.test' }));
vi.mock('@/lib/stripe', async () => {
  const { default: SDK } = await import('stripe');
  const sdk = new SDK('sk_test_fixture_only');
  return { getStripe: () => ({ webhooks: sdk.webhooks, subscriptions: { retrieve: mocks.retrieve } }),
    tierForPriceId: () => 'pro', billingPeriodForPriceId: () => 'pro' };
});
const sdk = new Stripe('sk_test_fixture_only');
const secret = 'whsec_local_fixture_only';
const period = 1_800_000_000;
const subscription = { id: 'sub_fixture', customer: 'cus_fixture', current_period_end: period,
  cancel_at_period_end: false, trial_end: null, items: { data: [{ price: { id: 'price_pro' } }] } };
function send(type: string, object: unknown, validSignature = true) {
  const body = JSON.stringify({ id: 'evt_fixture', object: 'event', type, livemode: false, data: { object } });
  const signature = sdk.webhooks.generateTestHeaderString({ payload: body, secret: validSignature ? secret : 'wrong_secret' });
  return POST(new NextRequest('http://localhost/api/stripe/webhook', { method: 'POST', body, headers: { 'stripe-signature': signature } }));
}
const invoice = { id: 'in_fixture', customer: 'cus_fixture', amount_paid: 2000, status: 'paid', currency: 'usd', livemode: false, billing_reason: 'subscription_cycle' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', secret);
  mocks.lookup.mockResolvedValue({ data: { user_id: 'user_fixture' }, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  const query: Record<string, unknown> = {};
  Object.assign(query, { select: () => query, eq: () => query, or: () => query, maybeSingle: mocks.lookup,
    upsert: mocks.upsert, update: mocks.update,
    then: (resolve: (value: unknown) => void) => Promise.resolve({ data: [{ user_id: 'user_fixture' }], error: null }).then(resolve) });
  mocks.update.mockReturnValue(query);
  mocks.from.mockReturnValue(query);
  mocks.retrieve.mockResolvedValue(subscription);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('signed Stripe webhook lifecycle with isolated services', () => {
  it('rejects a bad signature before database access', async () => {
    expect((await send('invoice.payment_succeeded', invoice, false)).status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('handles the item-level period shape observed in the live 2026 event', async () => {
    const modern = { ...subscription, current_period_end: undefined, items: { data: [{ price: { id: 'price_pro' }, current_period_end: period }] } };
    expect((await send('customer.subscription.updated', modern)).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ current_period_end: new Date(period * 1000).toISOString() }));
  });
  it('continues to accept older subscription-level periods', async () => {
    expect((await send('customer.subscription.updated', subscription)).status).toBe(200);
  });
  it('requests retry before a database update when the event has no valid period', async () => {
    expect((await send('customer.subscription.updated', { ...subscription, current_period_end: undefined })).status).toBe(500);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('does not report zero-dollar trial invoices as payment', async () => {
    expect((await send('invoice.payment_succeeded', { ...invoice, amount_paid: 0 })).status).toBe(200);
    expect(mocks.capture).not.toHaveBeenCalled();
  });
  it('records a positive invoice without pretending a renewal is a trial conversion', async () => {
    expect((await send('invoice.payment_succeeded', invoice)).status).toBe(200);
    expect(mocks.capture).toHaveBeenCalledWith('invoice_paid', 'user_fixture', expect.objectContaining({ amount_paid: 2000, billing_reason: 'subscription_cycle', livemode: false }));
  });
  it('uses the same deduplication ID on a repeated invoice delivery', async () => {
    await send('invoice.payment_succeeded', invoice);
    await send('invoice.payment_succeeded', invoice);
    expect(mocks.capture.mock.calls[0][2].$insert_id).toBe(mocks.capture.mock.calls[1][2].$insert_id);
  });
  it('reads the subscription reference from the newer invoice parent shape', async () => {
    await send('invoice.payment_succeeded', { ...invoice, parent: { subscription_details: { subscription: 'sub_modern' } } });
    expect(mocks.capture.mock.calls[0][2].subscription_id).toBe('sub_modern');
  });
  it.each([{ data: null, error: { message: 'Database unavailable' } }, { data: null, error: null }])('retries an invoice whose customer cannot yet be resolved', async result => {
    mocks.lookup.mockResolvedValue(result);
    expect((await send('invoice.payment_succeeded', invoice)).status).toBe(500);
    expect(mocks.capture).not.toHaveBeenCalled();
  });
  it.each([null, period])('distinguishes paid checkout from a trial checkout', async trialEnd => {
    mocks.retrieve.mockResolvedValue({ ...subscription, trial_end: trialEnd });
    const response = await send('checkout.session.completed', { id: 'cs_fixture', customer: 'cus_fixture', subscription: 'sub_fixture', livemode: false,
      metadata: { supabase_user_id: 'user_fixture', billing_period: 'pro' } });
    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user_fixture', stripe_customer_id: 'cus_fixture', tier: 'pro' }), { onConflict: 'user_id' });
    expect(mocks.capture.mock.calls[0][0]).toBe(trialEnd ? 'trial_started' : 'checkout_completed');
  });
  it('requests retry when provisioning fails', async () => {
    mocks.upsert.mockResolvedValue({ error: { message: 'Database unavailable' } });
    expect((await send('checkout.session.completed', { id: 'cs_fixture', subscription: 'sub_fixture',
      metadata: { supabase_user_id: 'user_fixture', billing_period: 'pro' } })).status).toBe(500);
    expect(mocks.capture).not.toHaveBeenCalled();
  });
});
