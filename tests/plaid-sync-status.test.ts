import { describe, it, expect, vi, beforeEach } from 'vitest';

// A successful balance read is proof the token works, so the item must come
// back to `active` no matter what an earlier run wrote. Nothing else clears
// `error`, and the cron only syncs active items.

type Write = { table: string; op: string; payload: unknown; filters: unknown[] };
const writes: Write[] = [];
let transactionWriteError = false;

function chain(table: string) {
  const state = { op: '', payload: undefined as unknown, filters: [] as unknown[] };
  const done = () => {
    if (state.op) writes.push({ table, op: state.op, payload: state.payload, filters: state.filters });
    return { data: [], error: table === 'transactions' && transactionWriteError ? { message: 'Write failed' } : null, count: 0 };
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

const emptyProducts = { accounts: [], added: [], modified: [], removed: [], has_more: false, next_cursor: 'c', holdings: [], securities: [], investment_transactions: [], total_investment_transactions: 0 };
const plaid = { accountsGet: vi.fn(), transactionsSync: vi.fn(), investmentsHoldingsGet: vi.fn() };
vi.mock('@/lib/plaid', () => ({
  plaidClient: new Proxy({}, {
    get: (_t, prop: string) => prop in plaid ? plaid[prop as keyof typeof plaid] : () => Promise.resolve({ data: emptyProducts }),
  }),
  mapPlaidAccountType: () => 'investment',
}));
vi.mock('@/lib/plaid/token-crypto', () => ({ readItemToken: () => Promise.resolve('access-token') }));
vi.mock('@/lib/plaid-logger', () => ({ logPlaidSuccess: () => Promise.resolve(), logPlaidError: () => Promise.resolve() }));

const item = { id: 'item-1', plaid_access_token: 'x', transactions_cursor: null, institution_name: 'Fidelity', available_products: [], billed_products: [], consented_products: [] };

describe('syncPlaidItem item status', () => {
  beforeEach(() => {
    writes.length = 0;
    transactionWriteError = false;
    plaid.accountsGet.mockReset();
    plaid.transactionsSync.mockReset().mockResolvedValue({ data: emptyProducts });
    plaid.investmentsHoldingsGet.mockReset().mockResolvedValue({ data: emptyProducts });
  });

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

  it('preserves a provider null balance instead of manufacturing zero', async () => {
    plaid.accountsGet.mockResolvedValue({ data: { accounts: [{ account_id: 'account-1', balances: { current: null, available: null, limit: null } }] } });
    const { syncPlaidItem } = await import('../lib/plaid-sync');
    await syncPlaidItem(supabase, 'user-1', item);
    expect(writes.find(write => write.table === 'linked_accounts')?.payload).toMatchObject({ current_balance: null, available_balance: null });
  });

  it('retains the previous transaction cursor and timestamp after a later page fails', async () => {
    plaid.accountsGet.mockResolvedValue({ data: { accounts: [] } });
    plaid.transactionsSync.mockResolvedValueOnce({ data: { ...emptyProducts, added: [{ transaction_id: 'tx-1', account_id: 'account-1' }], has_more: true, next_cursor: 'partial-page' } }).mockRejectedValueOnce(new Error('PRODUCT_NOT_READY'));
    const { syncPlaidItem } = await import('../lib/plaid-sync');
    const result = await syncPlaidItem(supabase, 'user-1', { ...item, transactions_cursor: 'old-cursor' });
    expect(result).toMatchObject({ success: true, warnings: ['Balances refreshed, but transactions could not fully refresh.'] });
    expect(writes.some(write => write.table === 'transactions')).toBe(false);
    for (const write of writes.filter(write => write.table === 'plaid_items')) {
      expect(write.payload).not.toHaveProperty('transactions_cursor');
      expect(write.payload).not.toHaveProperty('last_transactions_sync');
    }
    expect(writes.some(write => write.table === 'plaid_items' && 'last_balances_sync' in (write.payload as object))).toBe(true);
  });

  it('does not advance transaction freshness when the provider pagination limit is exhausted', async () => {
    plaid.accountsGet.mockResolvedValue({ data: { accounts: [] } });
    plaid.transactionsSync.mockResolvedValue({ data: { ...emptyProducts, has_more: true } });
    const { syncPlaidItem } = await import('../lib/plaid-sync');
    const result = await syncPlaidItem(supabase, 'user-1', item);
    expect(plaid.transactionsSync).toHaveBeenCalledTimes(50);
    expect(result.warnings).toContain('Balances refreshed, but transactions could not fully refresh.');
    expect(writes.some(write => write.table === 'plaid_items' && 'last_transactions_sync' in (write.payload as object))).toBe(false);
  });

  it('does not advance transaction cursor after a resolved database write error', async () => {
    transactionWriteError = true;
    plaid.accountsGet.mockResolvedValue({ data: { accounts: [] } });
    plaid.transactionsSync.mockResolvedValue({ data: { ...emptyProducts, modified: [{ transaction_id: 'tx-1', amount: 15 }] } });
    const { syncPlaidItem } = await import('../lib/plaid-sync');
    const result = await syncPlaidItem(supabase, 'user-1', item);
    expect(result.warnings).toContain('Balances refreshed, but transactions could not fully refresh.');
    expect(writes.some(write => write.table === 'plaid_items' && 'transactions_cursor' in (write.payload as object))).toBe(false);
  });

  it('exposes a holdings provider failure without stamping holdings freshness', async () => {
    plaid.accountsGet.mockResolvedValue({ data: { accounts: [] } });
    plaid.investmentsHoldingsGet.mockRejectedValue(new Error('Investments unavailable'));
    const { syncPlaidItem } = await import('../lib/plaid-sync');
    const result = await syncPlaidItem(supabase, 'user-1', { ...item, available_products: ['investments'] });
    expect(result.warnings).toContain('Balances refreshed, but holdings could not fully refresh.');
    expect(writes.some(write => write.table === 'plaid_items' && 'last_holdings_sync' in (write.payload as object))).toBe(false);
  });
});
