import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/dashboard/overview/route';

const mocks = vi.hoisted(() => ({ user: vi.fn(), sync: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.user }, from: mocks.from }) }));
vi.mock('@/lib/plaid-sync', () => ({ syncAllItems: mocks.sync }));
// Use the real in-memory rate limiter: mocking it would miss the remount race.

let lastBalanceSync: string | null | undefined;
let userNumber = 0;
let userId: string;
let now: number;

function readOnlyQuery(table: string) {
  let columns = '';
  const query = {
    select: (value: string) => { columns = value; return query; },
    eq: () => query,
    order: () => query,
    limit: () => query,
    gte: () => query,
    maybeSingle: async () => ({ data: table === 'plaid_items' && columns === 'last_balances_sync' && lastBalanceSync !== undefined ? { last_balances_sync: lastBalanceSync } : null, error: null }),
    then: (resolve: (value: unknown) => void) => resolve({ data: [], error: null }),
    // This handler is read-only except for its explicitly mocked sync service.
    // Do not permit a fake freshness write through a permissive query mock.
    update: () => { throw new Error('Unexpected account freshness write'); },
    insert: () => { throw new Error('Unexpected database insert'); },
    upsert: () => { throw new Error('Unexpected database upsert'); },
  };
  return query;
}

describe('overview automatic sync boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    now = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    userId = `overview-attempt-user-${++userNumber}`;
    mocks.user.mockImplementation(async () => ({ data: { user: { id: userId } }, error: null }));
    mocks.from.mockImplementation(readOnlyQuery);
    mocks.sync.mockResolvedValue([]);
    lastBalanceSync = new Date(now - 2 * 60 * 60 * 1000).toISOString();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('throttles failed imports across repeated real GETs and permits a later retry', async () => {
    mocks.sync.mockRejectedValue(new Error('Provider unavailable'));
    const first = await GET();
    expect(first.status).toBe(200);
    expect((await first.json()).sync_triggered).toBe(true);
    expect((await (await GET()).json()).sync_triggered).toBe(false);
    expect(mocks.sync).toHaveBeenCalledOnce();
    now += 5 * 60 * 1000 + 1;
    expect((await (await GET()).json()).sync_triggered).toBe(true);
    expect(mocks.sync).toHaveBeenCalledTimes(2);
  });

  it('claims the attempt while the first import is still pending', async () => {
    let complete!: () => void;
    mocks.sync.mockImplementation(() => new Promise<void>(resolve => { complete = resolve; }));
    expect((await (await GET()).json()).sync_triggered).toBe(true);
    expect((await (await GET()).json()).sync_triggered).toBe(false);
    expect(mocks.sync).toHaveBeenCalledOnce();
    complete();
  });

  it('keeps the attempt cooldown scoped to the authenticated user', async () => {
    await GET();
    userId = `overview-attempt-user-${++userNumber}`;
    expect((await (await GET()).json()).sync_triggered).toBe(true);
    expect(mocks.sync).toHaveBeenCalledTimes(2);
  });

  it('does not claim a sync for fresh accounts or an account without an active connection', async () => {
    lastBalanceSync = new Date(now - 60_000).toISOString();
    expect((await (await GET()).json()).sync_triggered).toBe(false);
    lastBalanceSync = undefined;
    expect((await (await GET()).json()).sync_triggered).toBe(false);
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it('preserves authentication before any database or provider work', async () => {
    mocks.user.mockResolvedValue({ data: { user: null }, error: null });
    expect((await GET()).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
  });
});
