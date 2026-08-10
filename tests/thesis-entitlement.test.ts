import { describe, it, expect } from 'vitest';
import { entitledToMonitoring, FREE_THESIS_LIMIT } from '@/lib/thesis-entitlement';

/**
 * The scoring cron now filters by entitlement. The failure that matters is not
 * a free user sneaking monitoring, it is a PAYING user silently losing it, so
 * most of these assert the keep side.
 */

type Row = {
  user_id: string;
  tier: string | null;
  trial_ends_at: string | null;
  stripe_subscription_id: string | null;
};

/** Minimal stand-in for the service client: one .from().select().in() chain. */
function fakeClient(rows: Row[], emails: Record<string, string> = {}) {
  return {
    from() {
      return {
        select() {
          return {
            in(_col: string, ids: string[]) {
              return Promise.resolve({ data: rows.filter((r) => ids.includes(r.user_id)) });
            },
          };
        },
      };
    },
    auth: {
      admin: {
        getUserById(id: string) {
          return Promise.resolve({ data: emails[id] ? { user: { email: emails[id] } } : null });
        },
      },
    },
  } as never;
}

const future = new Date(Date.now() + 7 * 86400000).toISOString();
const past = new Date(Date.now() - 7 * 86400000).toISOString();

describe('entitledToMonitoring', () => {
  it('keeps a paying pro subscriber', async () => {
    const s = await entitledToMonitoring(
      fakeClient([{ user_id: 'u1', tier: 'pro', trial_ends_at: null, stripe_subscription_id: 'sub_1' }]),
      ['u1'],
    );
    expect(s.has('u1')).toBe(true);
  });

  it('keeps a legacy max row, which normalises to pro', async () => {
    const s = await entitledToMonitoring(
      fakeClient([{ user_id: 'u1', tier: 'max', trial_ends_at: null, stripe_subscription_id: null }]),
      ['u1'],
    );
    expect(s.has('u1')).toBe(true);
  });

  it('keeps someone whose card-required trial is still running', async () => {
    const s = await entitledToMonitoring(
      fakeClient([{ user_id: 'u1', tier: 'pro', trial_ends_at: future, stripe_subscription_id: null }]),
      ['u1'],
    );
    expect(s.has('u1')).toBe(true);
  });

  it('drops someone whose trial has lapsed without paying', async () => {
    const s = await entitledToMonitoring(
      fakeClient([{ user_id: 'u1', tier: 'pro', trial_ends_at: past, stripe_subscription_id: null }]),
      ['u1'],
    );
    expect(s.has('u1')).toBe(false);
  });

  it('keeps a lapsed trial that later became a real subscription', async () => {
    const s = await entitledToMonitoring(
      fakeClient([{ user_id: 'u1', tier: 'pro', trial_ends_at: past, stripe_subscription_id: 'sub_1' }]),
      ['u1'],
    );
    expect(s.has('u1')).toBe(true);
  });

  it('drops a free user', async () => {
    const s = await entitledToMonitoring(
      fakeClient([{ user_id: 'u1', tier: 'free', trial_ends_at: null, stripe_subscription_id: null }]),
      ['u1'],
    );
    expect(s.has('u1')).toBe(false);
  });

  it('drops a user with no subscription row at all', async () => {
    const s = await entitledToMonitoring(fakeClient([]), ['ghost']);
    expect(s.has('ghost')).toBe(false);
  });

  it('does not promote anyone when the email lookup throws', async () => {
    const client = {
      from: () => ({ select: () => ({ in: () => Promise.resolve({ data: [] }) }) }),
      auth: { admin: { getUserById: () => Promise.reject(new Error('boom')) } },
    } as never;
    const s = await entitledToMonitoring(client, ['u1']);
    expect(s.size).toBe(0);
  });

  it('returns an empty set for no input without querying', async () => {
    const s = await entitledToMonitoring(fakeClient([]), []);
    expect(s.size).toBe(0);
  });

  it('separates entitled from unentitled in one batch', async () => {
    const s = await entitledToMonitoring(
      fakeClient([
        { user_id: 'payer', tier: 'pro', trial_ends_at: null, stripe_subscription_id: 'sub_1' },
        { user_id: 'freebie', tier: 'free', trial_ends_at: null, stripe_subscription_id: null },
        { user_id: 'lapsed', tier: 'pro', trial_ends_at: past, stripe_subscription_id: null },
      ]),
      ['payer', 'freebie', 'lapsed'],
    );
    expect([...s].sort()).toEqual(['payer']);
  });

  it('caps free accounts at one thesis', () => {
    // The cap is what makes a second thesis the upgrade, so pin the value.
    expect(FREE_THESIS_LIMIT).toBe(1);
  });
});
