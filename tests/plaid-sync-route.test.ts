import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../app/api/plaid/sync/route';
import { POST as LEGACY_POST } from '../app/api/accounts/sync/route';
import { requestConnectionSync, runAutomaticSync } from '@/lib/plaid/sync-client';

const mocks = vi.hoisted(() => ({
  user: vi.fn(), from: vi.fn(), sync: vi.fn(), snapshots: vi.fn(), limit: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.user }, from: mocks.from }),
}));
vi.mock('@/lib/plaid-sync', () => ({ syncPlaidItem: mocks.sync, computeSnapshots: mocks.snapshots }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mocks.limit }));

const items = [
  { id: 'item-a', institution_name: 'Test institution A', status: 'active', error_code: null as string | null },
  { id: 'item-b', institution_name: 'Test institution B', status: 'error', error_code: null as string | null },
];
let filters: [string, unknown][];
function requestedItems(selected = items) {
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
    in: (key: string, value: unknown) => { filters.push([key, value]); return query; },
    then: (resolve: (value: unknown) => void) => resolve({ data: selected.filter(item => filters.every(([key, value]) => key === 'user_id' || (Array.isArray(value) ? value.includes(item[key as keyof typeof item]) : item[key as keyof typeof item] === value))), error: null }),
  };
  mocks.from.mockImplementation((table: string) => {
    // Route-level writes would overwrite individual outcomes from the sync service.
    if (table !== 'plaid_items') throw new Error(`Unexpected bulk access: ${table}`);
    return query;
  });
}
const request = (itemId?: string) => new Request('http://localhost/api/plaid/sync', {
  method: 'POST', ...(itemId ? { body: JSON.stringify({ item_id: itemId }) } : {}),
});

describe('manual Plaid refresh reports actual outcomes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    filters = [];
    mocks.user.mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null });
    mocks.limit.mockReturnValue({ allowed: true });
    mocks.snapshots.mockResolvedValue(true);
    mocks.sync.mockImplementation(async (_client, _user, item) => ({ item_id: item.id, success: true }));
    requestedItems();
  });

  it('rejects unauthenticated requests before database or provider work', async () => {
    mocks.user.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it('reports a successful selected connection without touching other accounts', async () => {
    requestedItems([items[0]]);
    const response = await POST(request('item-a'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, synced: 1, failed: 0 });
    expect(filters).toEqual([['user_id', 'test-user'], ['status', ['active', 'error', 'login_required']], ['id', 'item-a']]);
    expect(mocks.sync).toHaveBeenCalledExactlyOnceWith(expect.anything(), 'test-user', items[0]);
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith('plaid_items');
  });

  it('keeps partial success visible and prevents callers from announcing complete success', async () => {
    mocks.sync.mockImplementation(async (_client, _user, item) => {
      if (item.id === 'item-b') throw new Error('Provider unavailable');
      return { item_id: item.id, success: true };
    });
    const response = await POST(request());
    expect(response.status).toBe(207);
    expect(response.ok).toBe(true);
    expect(await response.json()).toMatchObject({
      success: false, synced: 1, failed: 1,
      error: '1 connection refreshed; 1 could not refresh. Please try again.',
      results: [{ item_id: 'item-a', success: true }, { item_id: 'item-b', success: false }],
    });
    expect(mocks.snapshots).toHaveBeenCalledOnce();
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith('plaid_items');
  });

  it('does not announce a fresh sync time when every result failed', async () => {
    mocks.sync.mockImplementation(async (_client, _user, item) => ({ item_id: item.id, success: false }));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ success: false, synced: 0, failed: 2, synced_at: null });
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith('plaid_items');
  });

  it('does not invent a fresh sync for a manual-only account', async () => {
    requestedItems([]);
    const response = await POST(request());
    expect(await response.json()).toEqual({
      success: true, synced: 0, failed: 0, synced_at: null, results: [], message: 'No connections available to refresh. Add or reconnect an account.',
    });
    expect(mocks.sync).not.toHaveBeenCalled();
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith('plaid_items');
  });

  it('the legacy route uses the same real importer and partial outcome', async () => {
    mocks.sync.mockImplementation(async (_client, _user, item) => ({ item_id: item.id, success: item.id === 'item-a' }));
    const response = await LEGACY_POST(request());
    expect(response.status).toBe(207);
    expect(mocks.sync).toHaveBeenCalledTimes(2);
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith('plaid_items');
  });

  it('allows a specifically reauthenticated item before its repair webhook arrives', async () => {
    requestedItems([{ ...items[0], status: 'login_required' }]);
    expect((await POST(request('item-a'))).status).toBe(200);
    expect(mocks.sync).toHaveBeenCalledOnce();
  });

  it('does not call Plaid with a known revoked token', async () => {
    requestedItems([{ ...items[0], error_code: 'USER_PERMISSION_REVOKED' }]);
    expect((await POST(request('item-a'))).status).toBe(502);
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it('rejects malformed scope instead of syncing every institution', async () => {
    const response = await POST(new Request('http://localhost/api/plaid/sync', { method: 'POST', body: '{"item_id":null}' }));
    expect(response.status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('keeps imported results usable if snapshot generation fails', async () => {
    mocks.snapshots.mockRejectedValue(new Error('Snapshot unavailable'));
    const calls: string[] = [];
    const outcome = await requestConnectionSync({ fetchImpl: async (url, init) => {
      calls.push(url);
      if (url !== '/api/plaid/sync') return new Response('{}');
      const response = await POST(new Request(`http://localhost${url}`, init));
      expect(response.status).toBe(207);
      expect(await response.clone().json()).toMatchObject({ success: false, synced: 2, warning: expect.any(String) });
      return response;
    } });
    expect(outcome).toMatchObject({ status: 'partial', synced: 2, failed: 0, message: 'Balances refreshed, but the portfolio snapshot could not update yet.' });
    expect(calls).toEqual(['/api/plaid/sync', '/api/market/prices/refresh']);
  });

  it('returns partial207 when balances import but an optional product fails', async () => {
    mocks.sync.mockImplementation(async (_client, _user, item) => ({ item_id: item.id, success: true, warnings: ['Balances refreshed, but holdings could not fully refresh.'] }));
    const calls: string[] = [];
    const outcome = await requestConnectionSync({ fetchImpl: async (url, init) => {
      calls.push(url);
      if (url !== '/api/plaid/sync') return new Response('{}');
      const response = await POST(new Request(`http://localhost${url}`, init));
      expect(response.status).toBe(207);
      return response;
    } });
    expect(outcome).toMatchObject({ status: 'partial', synced: 2, failed: 0, message: 'Balances refreshed, but holdings could not fully refresh.' });
    expect(calls).toEqual(['/api/plaid/sync', '/api/market/prices/refresh']);
  });

  it('carries real route partial results through the settings/background caller and refreshes prices', async () => {
    mocks.sync.mockImplementation(async (_client, _user, item) => ({ item_id: item.id, success: item.id === 'item-a' }));
    const calls: string[] = [];
    const outcome = await requestConnectionSync({ fetchImpl: async (url, init) => {
      calls.push(url);
      return url === '/api/plaid/sync' ? POST(new Request(`http://localhost${url}`, init)) : new Response('{}');
    } });
    expect(outcome).toMatchObject({ status: 'partial', synced: 1, failed: 1 });
    expect(calls).toEqual(['/api/plaid/sync', '/api/market/prices/refresh']);
  });

  it('refreshes auto-sync summary and insights after partial import and throttles the next mount', async () => {
    mocks.sync.mockImplementation(async (_client, _user, item) => ({ item_id: item.id, success: item.id === 'item-a' }));
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    const calls: string[] = [];
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const options = { storage, onRefresh, now: () => 1000000, fetchImpl: async (url: string, init?: RequestInit) => {
      calls.push(url);
      return url === '/api/plaid/sync' ? POST(new Request(`http://localhost${url}`, init)) : new Response('{}');
    } };
    expect(await runAutomaticSync(options)).toMatchObject({ status: 'partial' });
    expect(await runAutomaticSync(options)).toBeNull();
    expect(calls).toEqual(['/api/plaid/sync', '/api/market/prices/refresh', '/api/insights/generate']);
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
