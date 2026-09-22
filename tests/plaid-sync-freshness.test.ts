import { describe, it, expect, vi, beforeEach } from 'vitest';

// A working token is not a working feed. Plaid served one user's Edward Jones
// item the same 2026-07-30 snapshot for eight weeks with item.error null, and
// every sync stamped his accounts healthy. syncPlaidItem now reads item/get's
// status block and marks the accounts for reconnect when the provider's own
// timestamp is stale, without ever letting that check break the sync.

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

const emptyProducts = { accounts: [], added: [], modified: [], removed: [], has_more: false, next_cursor: 'c', holdings: [], securities: [], investment_transactions: [], total_investment_transactions: 0 };
const plaid = { accountsGet: vi.fn(), transactionsSync: vi.fn(), investmentsHoldingsGet: vi.fn(), itemGet: vi.fn() };
const logged: { endpoint: string; code?: string; message?: string }[] = [];

vi.mock('@/lib/plaid', () => ({
  plaidClient: new Proxy({}, {
    get: (_t, prop: string) => prop in plaid ? plaid[prop as keyof typeof plaid] : () => Promise.resolve({ data: emptyProducts }),
  }),
  mapPlaidAccountType: () => 'investment',
}));
vi.mock('@/lib/plaid/token-crypto', () => ({ readItemToken: () => Promise.resolve('access-token') }));
vi.mock('@/lib/plaid-logger', () => ({
  logPlaidSuccess: (_u: string, endpoint: string) => { logged.push({ endpoint }); return Promise.resolve(); },
  logPlaidError: (_u: string, endpoint: string, code: string, message: string) => { logged.push({ endpoint, code, message }); return Promise.resolve(); },
}));

const item = { id: 'item-ej', plaid_access_token: 'x', transactions_cursor: null, institution_name: 'Edward Jones', available_products: [], billed_products: [], consented_products: [] };
const account = { account_id: 'acct-2303', balances: { current: 46901, available: null, limit: null } };

describe('syncPlaidItem provider freshness', () => {
  beforeEach(() => {
    writes.length = 0;
    logged.length = 0;
    plaid.accountsGet.mockReset().mockResolvedValue({ data: { accounts: [account] } });
    plaid.transactionsSync.mockReset().mockResolvedValue({ data: emptyProducts });
    plaid.investmentsHoldingsGet.mockReset().mockResolvedValue({ data: emptyProducts });
    plaid.itemGet.mockReset();
  });

  it('marks every account on a frozen item for reconnect and says why', async () => {
    plaid.itemGet.mockResolvedValue({ data: {
      item: { error: null },
      status: { investments: { last_successful_update: '2026-07-30T14:16:05Z', last_failed_update: '2026-08-10T01:03:31Z' } },
    } });
    const { syncPlaidItem } = await import('../lib/plaid-sync');
    const result = await syncPlaidItem(supabase as never, 'user-1', item);

    const accountWrites = writes.filter((w) => w.table === 'linked_accounts' && w.op === 'update');
    // First the balance step stamps healthy, then the freshness step overrides it.
    const healthy = accountWrites.find((w) => (w.payload as { sync_status?: string }).sync_status === 'healthy');
    const reconnect = accountWrites.find((w) => (w.payload as { sync_status?: string }).sync_status === 'reconnect');
    expect(healthy).toBeDefined();
    expect(reconnect).toBeDefined();
    expect(accountWrites.indexOf(reconnect!)).toBeGreaterThan(accountWrites.indexOf(healthy!));
    // Scoped to the item's accounts, not by plaid_account_id: a frozen item is
    // frozen for all of them.
    expect(reconnect!.filters).toEqual([['plaid_item_ref', 'item-ej'], ['user_id', 'user-1']]);
    expect((reconnect!.payload as { sync_error: string }).sync_error).toContain('2026-07-30');

    expect(result.success).toBe(true);
    expect(result.warnings?.some((w) => w.includes('Edward Jones') && w.includes('2026-07-30'))).toBe(true);
    expect(logged.some((l) => l.endpoint === 'itemGet' && l.code === 'PROVIDER_STALE')).toBe(true);
  });

  it('leaves a fresh item healthy and records nothing', async () => {
    plaid.itemGet.mockResolvedValue({ data: {
      item: { error: null },
      status: { investments: { last_successful_update: new Date().toISOString() } },
    } });
    const { syncPlaidItem } = await import('../lib/plaid-sync');
    const result = await syncPlaidItem(supabase as never, 'user-1', item);

    expect(writes.some((w) => (w.payload as { sync_status?: string })?.sync_status === 'reconnect')).toBe(false);
    expect(result.warnings ?? []).toEqual([]);
    expect(logged.some((l) => l.code === 'PROVIDER_STALE')).toBe(false);
  });

  it('never lets a failed item/get break the sync or touch the healthy stamp', async () => {
    plaid.itemGet.mockRejectedValue(new Error('Plaid down'));
    const { syncPlaidItem } = await import('../lib/plaid-sync');
    const result = await syncPlaidItem(supabase as never, 'user-1', item);

    expect(result.success).toBe(true);
    expect(writes.some((w) => (w.payload as { sync_status?: string })?.sync_status === 'reconnect')).toBe(false);
    expect(writes.some((w) => (w.payload as { sync_status?: string })?.sync_status === 'healthy')).toBe(true);
  });

  it('treats a status block with no timestamps as unknown, not stale', async () => {
    plaid.itemGet.mockResolvedValue({ data: { item: { error: null }, status: {} } });
    const { syncPlaidItem } = await import('../lib/plaid-sync');
    await syncPlaidItem(supabase as never, 'user-1', item);
    expect(writes.some((w) => (w.payload as { sync_status?: string })?.sync_status === 'reconnect')).toBe(false);
  });
});
