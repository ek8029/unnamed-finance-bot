import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readActivationState } from '@/lib/activation-state';

type Row = Record<string, unknown>;
function clientFor(tables: Record<string, Row[]>, failedTable?: string) {
  return {
    from(table: string) {
      let rows = tables[table] ?? [];
      const query = {
        select: () => query,
        eq(key: string, value: unknown) { rows = rows.filter(row => row[key] === value); return query; },
        neq(key: string, value: unknown) { rows = rows.filter(row => row[key] != null && row[key] !== value); return query; },
        limit: (size: number) => Promise.resolve({ data: rows.slice(0, size), error: table === failedTable ? { message: 'unavailable' } : null }),
      };
      return query;
    },
  } as unknown as SupabaseClient;
}

describe('persisted activation state', () => {
  it('recognizes manual holdings without Plaid', async () => {
    const result = await readActivationState(clientFor({ holdings: [{ id: 'h', user_id: 'a', shares: 2 }] }), 'a');
    expect(result).toEqual({ hasConnection: false, hasHoldings: true, hasThesis: false, hasSavedWork: true, accountCount: 0, hasBrief: false });
  });
  it('recognizes short positions too', async () => {
    expect((await readActivationState(clientFor({ holdings: [{ user_id: 'a', shares: -3 }] }), 'a')).hasSavedWork).toBe(true);
  });
  it('recognizes a confirmed reason without requiring a connected account', async () => {
    const result = await readActivationState(clientFor({ thesis_pillars: [{ user_id: 'a', confirmed: true, lifecycle: 'confirmed' }] }), 'a');
    expect(result.hasThesis).toBe(true);
  });
  it('does not treat drafts, dismissed reasons, zero holdings or another user as saved work', async () => {
    const result = await readActivationState(clientFor({
      plaid_items: [{ user_id: 'other' }],
      holdings: [{ user_id: 'a', shares: 0 }, { user_id: 'other', shares: 10 }],
      thesis_pillars: [
        { user_id: 'a', confirmed: false, lifecycle: 'draft' },
        { user_id: 'a', confirmed: true, lifecycle: 'dismissed' },
        { user_id: 'other', confirmed: true, lifecycle: 'confirmed' },
      ],
    }), 'a');
    expect(result.hasSavedWork).toBe(false);
  });
  it('recognizes a connection while its first holdings are syncing', async () => {
    expect((await readActivationState(clientFor({ plaid_items: [{ user_id: 'a' }] }), 'a')).hasSavedWork).toBe(true);
  });
  it.each(['holdings', 'thesis_pillars', 'plaid_items', 'linked_accounts', 'brief_digests'])('fails closed on %s read failures', async table => {
    await expect(readActivationState(clientFor({}, table), 'a')).rejects.toThrow('Could not verify');
  });
  it('reports the active account count and whether a brief exists', async () => {
    const s = await readActivationState(clientFor({
      linked_accounts: [
        { id: 'la1', user_id: 'a', is_active: true, source: 'plaid' },
        { id: 'la2', user_id: 'a', is_active: true, source: 'manual' },
        { id: 'la3', user_id: 'a', is_active: false, source: 'plaid' },
        { id: 'la4', user_id: 'other', is_active: true, source: 'plaid' },
      ],
      brief_digests: [{ id: 'b1', user_id: 'a', holdings: ['NVDA', 'AAPL'] }],
    }), 'a');
    expect(s.accountCount).toBe(2);
    expect(s.hasBrief).toBe(true);
  });
  it('does not count the generic brief, whose holdings are empty, as a brief', async () => {
    const s = await readActivationState(clientFor({ brief_digests: [{ id: 'b1', user_id: 'a', holdings: [] }] }), 'a');
    expect(s.hasBrief).toBe(false);
  });
  it('reports zero accounts and no brief for a fresh user', async () => {
    const s = await readActivationState(clientFor({}), 'a');
    expect(s.accountCount).toBe(0);
    expect(s.hasBrief).toBe(false);
  });
});
