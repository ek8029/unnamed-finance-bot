import { describe, it, expect, vi, beforeEach } from 'vitest';

// A successful balance read is proof the token works, so the item must come
// back to `active` no matter what an earlier run wrote. Nothing else clears
// `error`, and the cron only syncs active items.

type Write = { table: string; op: string; payload: unknown; filters: unknown[] };
const writes: Write[] = [];

function chain(table: string) {
  const state = { op: '', payload: undefined as unknown, filters: [] as unknown[] };
  const done = () => {
    if (state.op) writes.push({ table, op: state.op, payload: state.payload, filters: state.filters });
    return { data: [], error: null, count: 0 };
  };
  const c: Record<string, unknown> = {};
  const self = new Proxy(c, {
    get(_t, prop: string) {
      if (prop === 'then') return (res: (v: unknown) => void) => res(done());
      if (prop === 'maybeSingle' || prop === 'single') return () => Promise.resolve({ data: null, error: null });
      if (['update', 'upsert', 'insert', 'delete'].includes(prop)) return (payload: unknown) => { state.op = prop; state.payload = payload; return self; };
      return (...args: unknown[]) => { if (prop === 'eq' || prop === 'in') state.filters.push(args); return self; };
    },
  });
  return self;
}
const supabase = { from: (table: string) => chain(table) };

const plaid = { accountsGet: vi.fn() };
vi.mock('@/lib/plaid', () => ({
  plaidClient: new Proxy({}, {
    get: (_t, prop: string) => prop === 'accountsGet'
      ? plaid.accountsGet
      : () => Promise.resolve({ data: { accounts: [], added: [], modified: [], removed: [], has_more: false, next_cursor: 'c', holdings: [], securities: [], investment_transactions: [], total_investment_transactions: 0 } }),
  }),
  mapPlaidAccountType: () => 'investment',
}));
vi.mock('@/lib/plaid/token-crypto', () => ({ readItemToken: () => Promise.resolve('access-token') }));
vi.mock('@/lib/plaid-logger', () => ({ logPlaidSuccess: () => Promise.resolve(), logPlaidError: () => Promise.resolve() }));

const item = { id: 'item-1', plaid_access_token: 'x', transactions_cursor: null, institution_name: 'Fidelity', available_products: [], billed_products: [], consented_products: [] };

describe('syncPlaidItem item status', () => {
  beforeEach(() => { writes.length = 0; plaid.accountsGet.mockReset(); });

  it('a successful balance read writes the item back to active', async () => {
    plaid.accountsGet.mockResolvedValue({ data: { accounts: [] } });
    const { syncPlaidItem } = await import('../lib/plaid-sync');
    await syncPlaidItem(supabase as never, 'user-1', item);
    const statusWrites = writes.filter((w) => w.table === 'plaid_items' && w.op === 'update' && (w.payload as { status?: string }).status);
    expect(statusWrites).toHaveLength(1);
    expect(statusWrites[0].payload).toEqual({ status: 'active', error_code: null, error_message: null });
    expect(statusWrites[0].filters).toEqual([['id', 'item-1']]);
  });

  it('a failed balance read throws and writes no status (the caller records the error)', async () => {
    plaid.accountsGet.mockRejectedValue(Object.assign(new Error('Request failed with status code 400'), { response: { data: { error_code: 'INVALID_ACCESS_TOKEN', error_type: 'INVALID_INPUT', error_message: 'invalid token' } } }));
    const { syncPlaidItem } = await import('../lib/plaid-sync');
    await expect(syncPlaidItem(supabase as never, 'user-1', item)).rejects.toThrow('400');
    expect(writes.filter((w) => w.table === 'plaid_items' && (w.payload as { status?: string })?.status)).toHaveLength(0);
  });
});
