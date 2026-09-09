// tests/insights-standing-item.test.ts
// Task 13: a standing (non-row) Actions item, "Add your second account", carried
// while the user has exactly one active linked_accounts row and the view is the
// default open one. hasThesisAccess is mocked false so the thesis-interlace branch
// (getConvictionByTicker / getThesisContextForActions / the holdings lookup) never
// runs — those are exercised by other tests, not this one.
import { describe, it, expect, vi } from 'vitest';
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
 * - linked_accounts: rows are returned ONLY once .eq('is_active', true) has been called
 *   on the chain (matches the linked_accounts.is_active boolean column) — an
 *   implementation that dropped that filter would get rows back regardless of the
 *   real is_active state, which this mock refuses to do.
 */
function fakeSupabase(insightsRows: InsightRow[], activeAccountCount: number) {
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
        const query: Record<string, unknown> = {};
        Object.assign(query, {
          select: () => query,
          eq: (col: string, val: unknown) => {
            if (col === 'is_active' && val === true) sawActiveFilter = true;
            return query;
          },
          limit: () =>
            Promise.resolve({
              data: sawActiveFilter
                ? Array.from({ length: activeAccountCount }, (_, i) => ({ id: `acct-${i}` }))
                : [],
              error: null,
            }),
        });
        return query;
      }
      throw new Error(`insights-standing-item test: unexpected table "${table}"`);
    },
  };
}

describe('readInsights standing "second account" item', () => {
  it('one active account, default options: exactly one standing item', async () => {
    const supabase = fakeSupabase([], 1);
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

  it('two active accounts: no standing item', async () => {
    const supabase = fakeSupabase([], 2);
    const result = await readInsights(supabase as never, user);
    expect(result.find(r => r.id === 'standing-second-account')).toBeUndefined();
    expect(result).toHaveLength(0);
  });

  it('status "done": no standing item even with one active account', async () => {
    const supabase = fakeSupabase([], 1);
    const result = await readInsights(supabase as never, user, { status: 'done' });
    expect(result.find(r => r.id === 'standing-second-account')).toBeUndefined();
  });

  it('archived flag set: no standing item even with one active account', async () => {
    const supabase = fakeSupabase([], 1);
    const result = await readInsights(supabase as never, user, { archived: 'true' });
    expect(result.find(r => r.id === 'standing-second-account')).toBeUndefined();
  });

  it('status "archived": no standing item even with one active account', async () => {
    const supabase = fakeSupabase([], 1);
    const result = await readInsights(supabase as never, user, { status: 'archived' });
    expect(result.find(r => r.id === 'standing-second-account')).toBeUndefined();
  });

  it('appears alongside two real insight rows, and the client sorts it — this reader does not', async () => {
    const supabase = fakeSupabase(realRows, 1);
    const result = await readInsights(supabase as never, user);
    expect(result).toHaveLength(3);
    const ids = result.map(r => r.id);
    expect(ids).toContain('i1');
    expect(ids).toContain('i2');
    expect(ids).toContain('standing-second-account');
    // Not asserting position: sorting into priority order is the client's job
    // (actions-client.tsx), not readInsights's — the standing item is appended
    // wherever the map/filter pipeline happens to leave it.
  });
});
