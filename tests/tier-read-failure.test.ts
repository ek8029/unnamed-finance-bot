import { beforeEach, describe, expect, it, vi } from 'vitest';

// A failed subscription read used to answer as Free. supabase-js reports a
// failure as { data: null, error } and does not throw, and normalizeTier
// (undefined) is 'free', so one statement timeout told a paying account it was
// Free: /api/thesis/board answered 404 (the phone's paywall lock) and
// /api/user/tier answered tier 'free', both cached on the phone as the truth.
//
// Mock boundary, from the schema rather than from memory:
//   - user_subscriptions has UNIQUE(user_id) (021), so the read is one row or
//     none, addressed by the authenticated user's id. Any other filter throws.
//   - a failed read returns data null with an error object, as postgrest-js does.
//   - every write throws: a tier read must never write a default tier.
//   - no other table is reachable before the tier decision in these routes;
//     touching one throws, which proves the throw happens before any other work.
const h = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  /** 'first': only the first read fails (a blip). 'all': every read fails. */
  fail: 'none' as 'none' | 'first' | 'all',
  reads: 0,
}));

const USER_ID = 'user_fixture';
const EMAIL = 'fixture@example.test';
const TIMEOUT = { code: '57014', message: 'canceling statement due to statement timeout' };

vi.mock('@/lib/supabase/server', () => {
  const refuse = () => { throw new Error('Unexpected write'); };
  const client = () => ({
    auth: { getUser: async () => ({ data: { user: { id: USER_ID, email: EMAIL } }, error: null }) },
    from: (table: string) => {
      if (table !== 'user_subscriptions') throw new Error(`Unexpected table: ${table}`);
      let byUser = false;
      const query = {
        select: () => query,
        eq: (field: string, value: string) => {
          if (field !== 'user_id' || value !== USER_ID) throw new Error('Must read by the unique user_id');
          byUser = true;
          return query;
        },
        maybeSingle: async () => {
          if (!byUser) throw new Error('Subscription must be read by unique user_id');
          h.reads += 1;
          if (h.fail === 'all' || (h.fail === 'first' && h.reads === 1)) return { data: null, error: TIMEOUT };
          return { data: h.row, error: null };
        },
        insert: refuse, update: refuse, upsert: refuse, delete: refuse,
      };
      return query;
    },
  });
  return { createClient: async () => client() };
});
// The board's scoring and earnings sources are never reached in these cases;
// mocked so importing the route does not construct model clients.
vi.mock('@/lib/content/scoring-thesis', () => ({ getScoringThesisData: vi.fn(() => { throw new Error('Unexpected scoring read'); }) }));
vi.mock('@/lib/earnings-edgar', () => ({ getEdgarEarnings: vi.fn(() => { throw new Error('Unexpected earnings read'); }) }));

import { getRealSubscriptionInfo, getSubscriptionInfo, getUserTier, requirePro, checkAnalysisQuota } from '@/lib/tier';
import { hasThesisAccess } from '@/lib/thesis-access-server';
import { GET as boardGET } from '@/app/api/thesis/board/route';
import { GET as tierGET } from '@/app/api/user/tier/route';

const PAID = {
  user_id: USER_ID, tier: 'pro', trial_ends_at: null, stripe_subscription_id: 'sub_fixture',
  source: 'stripe', permanent_access: null,
};

beforeEach(() => {
  h.row = { ...PAID };
  h.fail = 'none';
  h.reads = 0;
});

describe('getRealSubscriptionInfo on a failed read', () => {
  it('reads a paying row as Pro with one read when nothing fails', async () => {
    expect((await getRealSubscriptionInfo(USER_ID)).tier).toBe('pro');
    expect(h.reads).toBe(1);
  });

  it('retries one failed read and answers from the retry', async () => {
    h.fail = 'first';
    expect((await getRealSubscriptionInfo(USER_ID)).tier).toBe('pro');
    expect(h.reads).toBe(2);
  });

  it('throws after the retry also fails instead of answering Free', async () => {
    h.fail = 'all';
    await expect(getRealSubscriptionInfo(USER_ID)).rejects.toThrow(/user_subscriptions read failed/);
    expect(h.reads).toBe(2);
  });

  it('still reads a missing row as Free, which is a real answer', async () => {
    h.row = null;
    expect((await getRealSubscriptionInfo(USER_ID)).tier).toBe('free');
    expect(h.reads).toBe(1);
  });

  it('propagates through every tier entry point', async () => {
    h.fail = 'all';
    // The open-access window closed 2026-08-09, so getSubscriptionInfo reads the table.
    await expect(getSubscriptionInfo(USER_ID)).rejects.toThrow(/user_subscriptions read failed/);
    await expect(getUserTier(USER_ID)).rejects.toThrow(/user_subscriptions read failed/);
    await expect(requirePro(USER_ID)).rejects.toThrow(/user_subscriptions read failed/);
    await expect(checkAnalysisQuota(USER_ID)).rejects.toThrow(/user_subscriptions read failed/);
    await expect(hasThesisAccess(USER_ID, EMAIL)).rejects.toThrow(/user_subscriptions read failed/);
  });
});

describe('routes that gate on the tier', () => {
  it('/api/thesis/board answers 500, not the 404 the phone reads as "Pro required"', async () => {
    h.fail = 'all';
    const res = await boardGET(new Request('http://localhost/api/thesis/board'));
    expect(res.status).toBe(500);
  });

  it('/api/thesis/board still answers 404 for a real Free row', async () => {
    h.row = { ...PAID, tier: 'free', stripe_subscription_id: null };
    const res = await boardGET(new Request('http://localhost/api/thesis/board'));
    expect(res.status).toBe(404);
  });

  it('/api/user/tier throws (Next answers a bare 500) instead of a 200 that says Free', async () => {
    h.fail = 'all';
    await expect(tierGET()).rejects.toThrow(/user_subscriptions read failed/);
  });
});
