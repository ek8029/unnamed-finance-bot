import { describe, expect, it, vi } from 'vitest';
import { reconcileBillingState, revenueCatAccess, revenueCatUsers, type BillingRow, type BillingDependencies, type ProviderAccess } from '../lib/billing-reconciliation';

const user = 'd80b9593-96f3-478c-9d71-269928664eda';
const other = 'e80b9593-96f3-478c-9d71-269928664eda';
const now = Date.parse('2026-09-07T12:00:00Z');
const tomorrow = new Date(now + 86_400_000).toISOString();
const active: ProviderAccess = { active: true, productId: 'helm_pro_monthly', period: 'monthly', expiresAt: tomorrow };
function row(overrides: Partial<BillingRow> = {}): BillingRow {
  return { user_id: user, tier: 'free', source: 'revenuecat', updated_at: new Date(now - 1000).toISOString(),
    stripe_customer_id: null, stripe_subscription_id: null, stripe_price_id: null, store_product_id: 'helm_pro_monthly',
    billing_period: null, current_period_end: null, cancel_at_period_end: false, trial_ends_at: null, ...overrides };
}
function fixture(initial: BillingRow | null = row()) {
  let stored = initial;
  const deps: BillingDependencies = {
    now: () => now,
    load: vi.fn(async () => stored && { ...stored }),
    revenueCat: vi.fn(async () => active),
    stripe: vi.fn(async () => ({ active: false })),
    save: vi.fn(async (previous, next) => {
      if (previous?.updated_at !== stored?.updated_at) return false;
      stored = next;
      return true;
    }),
  };
  return { deps, get: () => stored, replace: (next: BillingRow) => { stored = next; } };
}
const deferred = <T>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
};

describe('authoritative billing reconciliation', () => {
  it('does not resurrect a cancelled Stripe trial using its historical marker', async () => {
    const f = fixture(row({ tier: 'pro', source: 'stripe', stripe_customer_id: 'cus_1',
      stripe_subscription_id: 'sub_cancelled', trial_ends_at: tomorrow }));
    vi.mocked(f.deps.revenueCat).mockResolvedValue({ active: false });
    await reconcileBillingState(user, f.deps);
    expect(f.get()?.tier).toBe('free');
    await reconcileBillingState(user, f.deps);
    expect(f.get()?.tier).toBe('free');
  });
  it('cannot replay expiration over a current renewed subscription', async () => {
    const f = fixture(row({ tier: 'pro' }));
    // A webhook type is deliberately not an input to access computation.
    await reconcileBillingState(user, f.deps);
    await reconcileBillingState(user, f.deps);
    expect(f.get()?.tier).toBe('pro');
    expect(f.get()?.current_period_end).toBe(tomorrow);
  });
  it('re-fetches an older provider response after a competing renewal writes', async () => {
    const f = fixture();
    const stale = deferred<ProviderAccess>();
    const started = deferred<void>();
    vi.mocked(f.deps.revenueCat).mockImplementationOnce(() => { started.resolve(); return stale.promise; });
    const older = reconcileBillingState(user, f.deps);
    await started.promise;
    await reconcileBillingState(user, f.deps);
    stale.resolve({ active: false });
    await older;
    expect(f.get()?.tier).toBe('pro');
    expect(f.deps.revenueCat).toHaveBeenCalledTimes(3);
  });
  it('does not write or downgrade on a RevenueCat outage', async () => {
    const f = fixture(row({ tier: 'pro' }));
    vi.mocked(f.deps.revenueCat).mockRejectedValue(new Error('503'));
    await expect(reconcileBillingState(user, f.deps)).rejects.toThrow('503');
    expect(f.deps.save).not.toHaveBeenCalled();
    expect(f.get()?.tier).toBe('pro');
  });
  it('does not write or downgrade on a Stripe outage', async () => {
    const f = fixture(row({ tier: 'pro', stripe_customer_id: 'cus_1' }));
    vi.mocked(f.deps.stripe).mockRejectedValue(new Error('Stripe unavailable'));
    await expect(reconcileBillingState(user, f.deps)).rejects.toThrow();
    expect(f.deps.save).not.toHaveBeenCalled();
  });
  it('keeps Apple access when an old Stripe subscription ends', async () => {
    const f = fixture(row({ tier: 'pro', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_old' }));
    await reconcileBillingState(user, f.deps);
    expect(f.get()).toMatchObject({ tier: 'pro', source: 'revenuecat', stripe_subscription_id: null });
  });
  it('keeps Stripe access when Apple expires and reports the correct billing source', async () => {
    const f = fixture(row({ tier: 'pro', stripe_customer_id: 'cus_1' }));
    vi.mocked(f.deps.revenueCat).mockResolvedValue({ active: false });
    vi.mocked(f.deps.stripe).mockResolvedValue({ active: true, productId: 'price_pro', subscriptionId: 'sub_active', expiresAt: tomorrow });
    await reconcileBillingState(user, f.deps);
    expect(f.get()).toMatchObject({ tier: 'pro', source: 'stripe', stripe_subscription_id: 'sub_active' });
  });
  it('does not convert an expired Stripe subscription into a permanent comp', async () => {
    const f = fixture(row({ tier: 'pro', source: 'stripe', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_old' }));
    vi.mocked(f.deps.revenueCat).mockResolvedValue({ active: false });
    await reconcileBillingState(user, f.deps);
    expect(f.get()?.tier).toBe('free');
    await reconcileBillingState(user, f.deps);
    expect(f.get()?.tier).toBe('free');
  });
  it('preserves a manual comp and an unexpired manual trial', async () => {
    for (const trial of [null, tomorrow]) {
      const f = fixture(row({ tier: 'pro', source: 'stripe', store_product_id: null, trial_ends_at: trial,
        permanent_access: trial ? null : 'complimentary' }));
      await reconcileBillingState(user, f.deps);
      expect(f.get()?.tier).toBe('pro');
      expect(f.deps.revenueCat).not.toHaveBeenCalled();
    }
  });
  it('does not restore an expired manual trial', async () => {
    const f = fixture(row({ tier: 'pro', source: 'stripe', store_product_id: null, trial_ends_at: new Date(now - 1).toISOString() }));
    await reconcileBillingState(user, f.deps);
    expect(f.get()?.tier).toBe('free');
  });
  it('retains a complimentary grant across Apple activation, expiry, and a retry', async () => {
    const f = fixture(row({ tier: 'pro', source: 'stripe', permanent_access: 'complimentary' }));
    await reconcileBillingState(user, f.deps, { requireRevenueCat: true });
    expect(f.get()).toMatchObject({ source: 'revenuecat', permanent_access: 'complimentary' });
    vi.mocked(f.deps.revenueCat).mockResolvedValue({ active: false });
    await reconcileBillingState(user, f.deps);
    await reconcileBillingState(user, f.deps);
    expect(f.get()).toMatchObject({ tier: 'pro', source: 'stripe', permanent_access: 'complimentary' });
  });
  it('retains a lifetime grant when overlapping Apple and Stripe subscriptions both expire', async () => {
    const f = fixture(row({ tier: 'pro', source: 'stripe', permanent_access: 'lifetime',
      billing_period: 'lifetime', stripe_customer_id: 'cus_1' }));
    vi.mocked(f.deps.stripe).mockResolvedValue({ active: true, subscriptionId: 'sub_1', expiresAt: tomorrow });
    await reconcileBillingState(user, f.deps, { requireRevenueCat: true });
    vi.mocked(f.deps.revenueCat).mockResolvedValue({ active: false });
    await reconcileBillingState(user, f.deps);
    vi.mocked(f.deps.stripe).mockResolvedValue({ active: false });
    await reconcileBillingState(user, f.deps);
    expect(f.get()).toMatchObject({ tier: 'pro', source: 'stripe', permanent_access: 'lifetime',
      billing_period: 'lifetime', current_period_end: '9999-12-31T23:59:59Z' });
  });
  it('records a newly confirmed legacy lifetime sale independently of active Apple access', async () => {
    const f = fixture();
    await reconcileBillingState(user, f.deps, { legacyLifetime: true, requireRevenueCat: true });
    expect(f.get()?.permanent_access).toBe('lifetime');
    vi.mocked(f.deps.revenueCat).mockResolvedValue({ active: false });
    await reconcileBillingState(user, f.deps);
    expect(f.get()).toMatchObject({ tier: 'pro', permanent_access: 'lifetime', billing_period: 'lifetime' });
  });
  it('falls back to an unexpired manual trial after Apple expires without making it permanent', async () => {
    const f = fixture(row({ tier: 'pro', trial_ends_at: tomorrow }));
    vi.mocked(f.deps.revenueCat).mockResolvedValue({ active: false });
    await reconcileBillingState(user, f.deps);
    expect(f.get()).toMatchObject({ tier: 'pro', source: 'stripe', permanent_access: null });
    f.deps.now = () => Date.parse(tomorrow) + 1;
    await reconcileBillingState(user, f.deps);
    expect(f.get()?.tier).toBe('free');
  });
  it('does not infer a new comp from an expired Apple or Stripe row with no remaining subscription id', async () => {
    for (const source of ['stripe', 'revenuecat'] as const) {
      const f = fixture(row({ tier: 'pro', source, permanent_access: null }));
      vi.mocked(f.deps.revenueCat).mockResolvedValue({ active: false });
      await reconcileBillingState(user, f.deps);
      expect(f.get()).toMatchObject({ tier: 'free', permanent_access: null });
    }
  });
  it('re-fetches after a concurrent admin grant revocation and does not resurrect it', async () => {
    const f = fixture(row({ tier: 'pro', permanent_access: 'complimentary' }));
    const provider = deferred<ProviderAccess>();
    const started = deferred<void>();
    vi.mocked(f.deps.revenueCat).mockImplementationOnce(() => { started.resolve(); return provider.promise; });
    vi.mocked(f.deps.revenueCat).mockResolvedValueOnce({ active: false });
    const pending = reconcileBillingState(user, f.deps);
    await started.promise;
    f.replace(row({ tier: 'free', permanent_access: null, updated_at: new Date(now + 1).toISOString() }));
    provider.resolve({ active: false });
    await pending;
    expect(f.get()).toMatchObject({ tier: 'free', permanent_access: null });
    expect(f.deps.revenueCat).toHaveBeenCalledTimes(2);
  });
  it('reports contention as retryable instead of overwriting after exhausting CAS retries', async () => {
    const f = fixture();
    vi.mocked(f.deps.save).mockResolvedValue(false);
    await expect(reconcileBillingState(user, f.deps)).rejects.toThrow('retry required');
    expect(f.deps.save).toHaveBeenCalledTimes(4);
  });
});

describe('RevenueCat identity and entitlement parsing', () => {
  it('handles the official transfer shape without app_user_id', () => {
    expect(revenueCatUsers({ type: 'TRANSFER', transferred_from: [user, '$RCAnonymousID:old'], transferred_to: [other] })).toEqual([user, other]);
  });
  it('resolves known UUID aliases without interpreting anonymous identifiers as accounts', () => {
    expect(revenueCatUsers({ type: 'RENEWAL', app_user_id: '$RCAnonymousID:id', original_app_user_id: user, aliases: [user, other] })).toEqual([user, other]);
  });
  function customer(expiry: string, changes: Record<string, unknown> = {}) {
    return { subscriber: { entitlements: { pro: { product_identifier: 'helm_pro_monthly', expires_date: expiry, ...changes } },
      subscriptions: { helm_pro_monthly: { store: 'app_store', unsubscribe_detected_at: null, refunded_at: null } } } };
  }
  it('preserves access through a billing grace period', () => {
    expect(revenueCatAccess(customer(new Date(now - 1).toISOString(), { grace_period_expires_date: tomorrow }), now).active).toBe(true);
  });
  it('expires access and re-enables it from a current refund-reversal snapshot', () => {
    expect(revenueCatAccess(customer(new Date(now - 1).toISOString()), now).active).toBe(false);
    expect(revenueCatAccess(customer(tomorrow), now).active).toBe(true);
  });
  it('rejects malformed provider responses instead of calling them free', () => {
    expect(() => revenueCatAccess({}, now)).toThrow();
    expect(() => revenueCatAccess(customer('not-a-date'), now)).toThrow();
  });
});
