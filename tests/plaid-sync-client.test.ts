import { describe, expect, it, vi } from 'vitest';
import { AUTO_SYNC_ATTEMPT_KEY, AUTO_SYNC_RETRY_MS, readSyncResponse, requestConnectionSync, runAutomaticSync } from '@/lib/plaid/sync-client';

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

describe('Plaid sync caller boundaries', () => {
  it('a failed auto attempt is throttled on remount but can retry after five minutes', async () => {
    let time = 1_000_000;
    const storage = memoryStorage();
    const fetchImpl = vi.fn(async () => Response.json({ success: false, synced: 0, failed: 1, results: [{ success: false }] }, { status: 502 }));
    const onRefresh = vi.fn();
    const options = { storage, fetchImpl, onRefresh, now: () => time };
    expect(await runAutomaticSync(options)).toMatchObject({ status: 'failed' });
    expect(storage.getItem(AUTO_SYNC_ATTEMPT_KEY)).toBe(String(time));
    expect(storage.getItem('helm_last_auto_sync')).toBeNull();
    expect(await runAutomaticSync(options)).toBeNull();
    expect(fetchImpl).toHaveBeenCalledOnce();
    time += AUTO_SYNC_RETRY_MS;
    expect(await runAutomaticSync(options)).toMatchObject({ status: 'failed' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('claims an auto attempt before the request settles so mounts cannot race', async () => {
    const storage = memoryStorage();
    let resolve!: (response: Response) => void;
    const fetchImpl = vi.fn(() => new Promise<Response>(done => { resolve = done; }));
    const options = { storage, fetchImpl, onRefresh: vi.fn(), now: () => 1_000_000 };
    const first = runAutomaticSync(options);
    expect(await runAutomaticSync(options)).toBeNull();
    resolve(Response.json({ synced: 0, failed: 0, results: [] }));
    expect(await first).toMatchObject({ status: 'empty' });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('dedupes concurrent first-read/link imports for the same explicit item only', async () => {
    let resolve!: (response: Response) => void;
    const fetchImpl = vi.fn((url: string) => url === '/api/plaid/sync' ? new Promise<Response>(done => { resolve = done; }) : Promise.resolve(new Response('{}')));
    const first = requestConnectionSync({ itemId: 'same-item', fetchImpl });
    const second = requestConnectionSync({ itemId: 'same-item', fetchImpl });
    expect(first).toBe(second);
    resolve(Response.json({ success: true, synced: 1, failed: 0, results: [{ success: true }] }));
    expect((await first).status).toBe('synced');
    await second;
    expect(fetchImpl.mock.calls.map(call => call[0])).toEqual(['/api/plaid/sync', '/api/market/prices/refresh']);
  });

  it('does not mistake an empty or malformed response for a successful import', async () => {
    expect((await readSyncResponse(Response.json({}))).status).toBe('failed');
    expect((await readSyncResponse(new Response('not JSON'))).status).toBe('failed');
    expect((await readSyncResponse(Response.json({ success: true, synced: 0, failed: 0, results: [] }))).status).toBe('empty');
  });
});
