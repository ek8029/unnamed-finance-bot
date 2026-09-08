import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeSnapshots } from '@/lib/plaid-sync';
import { POST } from '@/app/api/plaid/sync/route';
import { GET as snapshotCron } from '@/app/api/cron/snapshots/route';

const mocks = vi.hoisted(() => ({ db: null as unknown, sync: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => mocks.db }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.db }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: () => ({ allowed: true }) }));
vi.mock('@/lib/plaid', () => ({ plaidClient: {}, mapPlaidAccountType: () => 'checking' }));
vi.mock('@/lib/plaid-logger', () => ({ logPlaidSuccess: vi.fn(), logPlaidError: vi.fn() }));
vi.mock('@/lib/plaid-sync', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/plaid-sync')>();
  return { ...actual, syncPlaidItem: mocks.sync };
});

const USER = '10000000-0000-4000-8000-000000000001';
// The mock enforces the migration conflict keys, user FK fixture, required
// snapshot dates, and health-score range (003, 010, 052). It is not an RLS or
// complete PostgreSQL emulator. Failures below resolve {error}, never reject.
const keys: Record<string, string> = {
  net_worth_snapshots: 'user_id,snapshot_date',
  cash_flow_snapshots: 'user_id,snapshot_month',
  financial_health_scores: 'user_id',
};
let failure: { table: string; op: string } | null;
let saved: Map<string, Record<string, unknown>>;
let attempted: string[];

function database() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: USER } }, error: null }) },
    from(table: string) {
      let op = 'select';
      let payload: Record<string, unknown> | undefined;
      let conflict: string | undefined;
      let countOnly = false;
      const resolve = () => {
        if (op === 'upsert') attempted.push(table);
        if (failure?.table === table && failure.op === op) return { data: null, error: { code: '42501', message: 'Database operation denied' }, count: null };
        if (op === 'upsert') {
          if (conflict !== keys[table] || !conflict || payload?.user_id !== USER) return { data: null, error: { code: '23503', message: 'Invalid conflict key or user' } };
          for (const field of conflict.split(',').filter(field => field !== 'user_id')) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(String(payload[field]))) return { data: null, error: { code: '23502', message: 'Missing snapshot date' } };
          }
          if (table === 'financial_health_scores' && (!Number.isInteger(payload.overall_score) || Number(payload.overall_score) < 0 || Number(payload.overall_score) > 100)) return { data: null, error: { code: '23514', message: 'Health score check failed' } };
          saved.set(`${table}:${conflict.split(',').map(field => payload![field]).join(':')}`, payload);
          return { data: null, error: null };
        }
        if (countOnly) return { data: null, error: null, count: 2 }; // Existing history; current rows are this contract.
        const data = table === 'linked_accounts' ? [{ id: 'account-1', account_type: 'checking', account_subtype: 'checking', current_balance: 100, available_balance: 100 }]
          : table === 'transactions' ? [{ amount: 200 }, { amount: -50 }]
          : table === 'plaid_items' ? [{ id: 'item-a', user_id: USER, status: 'active', institution_name: 'Test bank' }]
          : [];
        return { data, error: null };
      };
      const query = {
        select: (_columns?: string, options?: { head?: boolean }) => { countOnly = options?.head === true; return query; },
        upsert: (value: Record<string, unknown>, options: { onConflict: string }) => { op = 'upsert'; payload = value; conflict = options.onConflict; return query; },
        eq: () => query, in: () => query, gte: () => query, lte: () => query, order: () => query, limit: () => query,
        then: (done: (result: unknown) => void) => done(resolve()),
      };
      return query;
    },
  };
}

describe('real snapshot failure propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', 'snapshot-boundary-test');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://example.invalid');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-not-a-real-key');
    failure = null;
    saved = new Map();
    attempted = [];
    mocks.db = database();
    mocks.sync.mockResolvedValue({ item_id: 'item-a', success: true });
  });
  afterEach(() => { vi.unstubAllEnvs(); });

  it('returns true only after the three current rows save, using their actual unique keys', async () => {
    expect(await computeSnapshots(mocks.db, USER)).toBe(true);
    expect(await computeSnapshots(mocks.db, USER)).toBe(true);
    expect(saved.size).toBe(3);
    expect(new Set(attempted)).toEqual(new Set(Object.keys(keys)));
  });

  it.each([
    ['linked_accounts', 'select'], ['holdings', 'select'],
    ['transactions', 'select'], ['investment_transactions', 'select'],
    ['net_worth_snapshots', 'upsert'], ['cash_flow_snapshots', 'upsert'], ['financial_health_scores', 'upsert'],
  ])('returns false for a resolved database error in %s %s', async (table, op) => {
    failure = { table, op };
    expect(await computeSnapshots(mocks.db, USER)).toBe(false);
    if (op === 'upsert') expect(attempted).toContain(table);
    if (table === 'linked_accounts' || table === 'holdings') expect(attempted).toHaveLength(0);
  });

  it('routes actual snapshot upsert failure to partial207 without losing imported balances', async () => {
    failure = { table: 'net_worth_snapshots', op: 'upsert' };
    const response = await POST(new Request('http://localhost/api/plaid/sync', { method: 'POST' }));
    expect(attempted).toEqual(['net_worth_snapshots']);
    expect(response.status).toBe(207);
    expect(await response.json()).toMatchObject({ success: false, synced: 1, failed: 0, warning: 'Balances refreshed, but the portfolio snapshot could not update yet.' });
  });

  it('the dedicated cron counts a returned failure rather than a successful snapshot', async () => {
    failure = { table: 'net_worth_snapshots', op: 'upsert' };
    const response = await snapshotCron(new Request('http://localhost/api/cron/snapshots', { headers: { Authorization: 'Bearer snapshot-boundary-test' } }));
    expect(response.status).toBe(200);
    expect(attempted).toEqual(['net_worth_snapshots']);
    expect(await response.json()).toEqual({ users: 1, ok: 0, failed: [USER.slice(0, 8)] });
  });
});
