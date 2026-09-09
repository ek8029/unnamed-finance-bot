// tests/insights-standing-item.test.ts
// Task 13: a standing (non-row) Actions item, "Add your second account", carried
// while the user has exactly one active brokerage, the onboarding v3 flag is on,
// and the view is the default open one. A brokerage is one Plaid item (however
// many linked_accounts rows its sub-accounts occupy) or the manual book (however
// many rows hold it). hasThesisAccess is mocked false so the thesis-interlace
// branch (getConvictionByTicker / getThesisContextForActions / the holdings
// lookup) never runs; those are exercised by other tests, not this one.
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { readInsights } from '@/lib/insights-reader';
import { V3_COPY } from '@/lib/onboarding/v3-copy';

vi.mock('@/lib/thesis-access-server', () => ({ hasThesisAccess: async () => false }));

const user = { id: 'user-1', email: 'user@example.test' };

type InsightRow = {
  id: string;
  insight_type: string;
  priority: string;
  title: string;
  description: string;
  recommended_action: string | null;
  estimated_impact_amount: number | null;
  source_type: string;
  created_at: string;
  expires_at: string | null;
  snoozed_until: string | null;
  is_archived: boolean;
  is_dismissed: boolean;
  is_useful: boolean | null;
  related_entity_type: string | null;
  related_entity_ids: string[] | null;
};

/** The columns readInsights selects from linked_accounts: plaid_item_ref (067, nullable
 * FK to plaid_items), institution_id (002, NOT NULL), source (037, 'plaid' | 'manual'). */
type AccountRow = { id: string; plaid_item_ref: string | null; institution_id: string; source: 'plaid' | 'manual' };

const plaidRow = (id: string, item: string | null, institution = 'inst-1'): AccountRow => ({ id, plaid_item_ref: item, institution_id: institution, source: 'plaid' });
const manualRow = (id: string): AccountRow => ({ id, plaid_item_ref: null, institution_id: 'inst-manual', source: 'manual' });

const realRows: InsightRow[] = [
  {
    id: 'i1', insight_type: 'tax', priority: 'high', title: 'Harvest a loss', description: 'd1',
    recommended_action: null, estimated_impact_amount: 100, source_type: 'rule_based',
    created_at: '2026-09-01T00:00:00Z', expires_at: null, snoozed_until: null,
    is_archived: false, is_dismissed: false, is_useful: null, related_entity_type: null, related_entity_ids: null,
  },
  {
    id: 'i2', insight_type: 'portfolio', priority: 'medium', title: 'Trim NVDA', description: 'd2',
    recommended_action: null, estimated_impact_amount: null, source_type: 'rule_based',
    created_at: '2026-09-02T00:00:00Z', expires_at: null, snoozed_until: null,
    is_archived: false, is_dismissed: false, is_useful: null, related_entity_type: null, related_entity_ids: null,
  },
];

/**
 * Chainable fake enforcing two schema constraints:
 * - insights: any chain of .select/.eq/.in/.or/.gt/.order eventually resolves at .limit()
 * - linked_accounts: rows are returned ONLY once BOTH .eq('is_active', true) and
 *   .eq('user_id', accountOwnerId) have been called on the chain (matches the
 *   linked_accounts.is_active boolean column and the RLS-equivalent user scope):
 *   an implementation that dropped either filter would get rows back regardless
 *   of the real is_active state or of whose accounts they are, which this mock
 *   refuses to do. accountOwnerId defaults to the test user, so passing a
 *   different id models accounts that exist but belong to someone else.
 */
function fakeSupabase(insightsRows: InsightRow[], activeAccounts: AccountRow[], accountOwnerId: string = user.id) {
  return {
    from: (table: string) => {
      if (table === 'insights') {
        const query: Record<string, unknown> = {};
        Object.assign(query, {
          select: () => query,
          eq: () => query,
          in: () => query,
          or: () => query,
          gt: () => query,
          order: () => query,
          limit: () => Promise.resolve({ data: insightsRows, error: null }),
        });
        return query;
      }
      if (table === 'linked_accounts') {
        let sawActiveFilter = false;
        let sawUserFilter = false;
        const query: Record<string, unknown> = {};
        Object.assign(query, {
          select: () => query,
          eq: (col: string, val: unknown) => {
            if (col === 'is_active' && val === true) sawActiveFilter = true;
            if (col === 'user_id' && val === accountOwnerId) sawUserFilter = true;
            return query;
          },
          limit: () =>
            Promise.resolve({
              data: sawActiveFilter && sawUserFilter ? activeAccounts : [],
              error: null,
            }),
        });
        return query;
      }
      throw new Error(`insights-standing-item test: unexpected table "${table}"`);
    },
  };
}

const standing = (result: { id: string }[]) => result.find(r => r.id === 'standing-second-account');

describe('readInsights standing "second account" item', () => {
  beforeEach(() => { vi.stubEnv('NEXT_PUBLIC_ONBOARDING_V3', '1'); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it('one Plaid item, default options: exactly one standing item', async () => {
    const supabase = fakeSupabase([], [plaidRow('acct-0', 'item-a')]);
    const result = await readInsights(supabase as never, user);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'standing-second-account',
      source: 'standing',
      title: V3_COPY.inbox.secondAccountTitle,
      description: V3_COPY.inbox.secondAccountBody,
      priority: 'low',
      type: 'portfolio',
    });
  });

  it('three rows sharing one plaid_item_ref are one brokerage: the standing item shows', async () => {
    const supabase = fakeSupabase([], [plaidRow('acct-0', 'item-a'), plaidRow('acct-1', 'item-a'), plaidRow('acct-2', 'item-a')]);
    const result = await readInsights(supabase as never, user);
    expect(result).toHaveLength(1);
    expect(standing(result)).toBeDefined();
  });

  it('two manual rows are one book: the standing item shows', async () => {
    const supabase = fakeSupabase([], [manualRow('acct-0'), manualRow('acct-1')]);
    const result = await readInsights(supabase as never, user);
    expect(result).toHaveLength(1);
    expect(standing(result)).toBeDefined();
  });

  it('two Plaid items: no standing item', async () => {
    const supabase = fakeSupabase([], [plaidRow('acct-0', 'item-a'), plaidRow('acct-1', 'item-b', 'inst-2')]);
    const result = await readInsights(supabase as never, user);
    expect(standing(result)).toBeUndefined();
    expect(result).toHaveLength(0);
  });

  it('one Plaid item plus a manual account: two brokerages, no standing item', async () => {
    const supabase = fakeSupabase([], [plaidRow('acct-0', 'item-a'), manualRow('acct-1')]);
    const result = await readInsights(supabase as never, user);
    expect(standing(result)).toBeUndefined();
    expect(result).toHaveLength(0);
  });

  it('legacy Plaid rows with no plaid_item_ref count by institution: two institutions, no standing item', async () => {
    const supabase = fakeSupabase([], [plaidRow('acct-0', null, 'inst-1'), plaidRow('acct-1', null, 'inst-2')]);
    const result = await readInsights(supabase as never, user);
    expect(standing(result)).toBeUndefined();
    expect(result).toHaveLength(0);
  });

  it('flag unset: no standing item even with one brokerage', async () => {
    vi.stubEnv('NEXT_PUBLIC_ONBOARDING_V3', '');
    const supabase = fakeSupabase([], [plaidRow('acct-0', 'item-a')]);
    const result = await readInsights(supabase as never, user);
    expect(standing(result)).toBeUndefined();
    expect(result).toHaveLength(0);
  });

  it('the one active account belongs to a different user: no standing item', async () => {
    const supabase = fakeSupabase([], [plaidRow('acct-0', 'item-a')], 'someone-else');
    const result = await readInsights(supabase as never, user);
    expect(standing(result)).toBeUndefined();
    expect(result).toHaveLength(0);
  });

  it('status "done": no standing item even with one brokerage', async () => {
    const supabase = fakeSupabase([], [plaidRow('acct-0', 'item-a')]);
    const result = await readInsights(supabase as never, user, { status: 'done' });
    expect(standing(result)).toBeUndefined();
  });

  it('archived flag set: no standing item even with one brokerage', async () => {
    const supabase = fakeSupabase([], [plaidRow('acct-0', 'item-a')]);
    const result = await readInsights(supabase as never, user, { archived: 'true' });
    expect(standing(result)).toBeUndefined();
  });

  it('status "archived": no standing item even with one brokerage', async () => {
    const supabase = fakeSupabase([], [plaidRow('acct-0', 'item-a')]);
    const result = await readInsights(supabase as never, user, { status: 'archived' });
    expect(standing(result)).toBeUndefined();
  });

  it('appears alongside two real insight rows, and the client sorts it; this reader does not', async () => {
    const supabase = fakeSupabase(realRows, [plaidRow('acct-0', 'item-a')]);
    const result = await readInsights(supabase as never, user);
    expect(result).toHaveLength(3);
    const ids = result.map(r => r.id);
    expect(ids).toContain('i1');
    expect(ids).toContain('i2');
    expect(ids).toContain('standing-second-account');
    // Not asserting position: sorting into priority order is the client's job
    // (actions-client.tsx), not readInsights's; the standing item is appended
    // wherever the map/filter pipeline happens to leave it.
  });
});
