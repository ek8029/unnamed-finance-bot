// tests/trial-row.test.ts
// One rule for what a trial row is. A Stripe subscription is marked by its id;
// an App Store subscription by source, and it never clears the old web-trial
// marker, so that marker alone must not read as a lapsed trial.
import { describe, it, expect } from 'vitest';
import { isTrialRow } from '@/lib/tier-shared';
import { entitledToMonitoring } from '@/lib/thesis-entitlement';

const past = '2026-08-25T00:00:00Z';

describe('isTrialRow', () => {
  it('a web trial with nothing behind it is a trial row', () => {
    expect(isTrialRow({ trial_ends_at: past, stripe_subscription_id: null, source: 'stripe' })).toBe(true);
  });
  it('a Stripe subscription keeps the marker and is not a trial row', () => {
    expect(isTrialRow({ trial_ends_at: past, stripe_subscription_id: 'sub_1', source: 'stripe' })).toBe(false);
  });
  it('an App Store subscription keeps the marker and is not a trial row', () => {
    expect(isTrialRow({ trial_ends_at: past, stripe_subscription_id: null, source: 'revenuecat' })).toBe(false);
  });
  it('no marker, no row, no trial', () => {
    expect(isTrialRow({ trial_ends_at: null, stripe_subscription_id: null, source: 'stripe' })).toBe(false);
    expect(isTrialRow({ trial_ends_at: null, stripe_subscription_id: null })).toBe(false);
    expect(isTrialRow(null)).toBe(false);
  });
});

/** The service client as entitledToMonitoring uses it: one .from().select().in() chain, plus the email backstop. */
function fakeClient(rows: Record<string, unknown>[]) {
  return {
    from: () => ({ select: () => ({ in: () => Promise.resolve({ data: rows, error: null }) }) }),
    auth: { admin: { getUserById: () => Promise.resolve({ data: null }) } },
  } as never;
}

describe('entitledToMonitoring with an App Store subscriber', () => {
  it('keeps monitoring for a RevenueCat pro row that still carries an old web trial', async () => {
    const got = await entitledToMonitoring(
      fakeClient([{ user_id: 'u1', tier: 'pro', trial_ends_at: past, stripe_subscription_id: null, source: 'revenuecat' }]),
      ['u1'],
    );
    expect(got.has('u1')).toBe(true);
  });
  it('still drops a lapsed web trial', async () => {
    const got = await entitledToMonitoring(
      fakeClient([{ user_id: 'u1', tier: 'pro', trial_ends_at: past, stripe_subscription_id: null, source: 'stripe' }]),
      ['u1'],
    );
    expect(got.has('u1')).toBe(false);
  });
});
