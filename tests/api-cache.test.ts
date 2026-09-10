// tests/api-cache.test.ts
// One shared request per endpoint. Six components asking for /api/user/tier on
// one page paid six Supabase auth round trips; this cache makes that one.
// The rules that matter for money code: a non-2xx is handed back to the caller
// and never cached, so use-tier's 401 retry still works, and a network throw is
// never cached either.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cachedGet, invalidate, __resetApiCache } from '@/lib/api-cache';

function res(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __resetApiCache();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

describe('cachedGet', () => {
  it('two concurrent callers share one request and both get the data', async () => {
    fetchMock.mockImplementation(async () => { await sleep(5); return res(200, { tier: 'pro' }); });
    const [a, b] = await Promise.all([
      cachedGet<{ tier: string }>('/api/user/tier'),
      cachedGet<{ tier: string }>('/api/user/tier'),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ ok: true, status: 200, data: { tier: 'pro' } });
    expect(b).toEqual({ ok: true, status: 200, data: { tier: 'pro' } });
  });

  it('a later caller inside the ttl fetches nothing', async () => {
    fetchMock.mockImplementation(async () => res(200, { tier: 'max' }));
    await cachedGet('/api/user/tier');
    const again = await cachedGet<{ tier: string }>('/api/user/tier');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(again.data).toEqual({ tier: 'max' });
  });

  it('a caller after the ttl refetches', async () => {
    fetchMock.mockImplementation(async () => res(200, { n: fetchMock.mock.calls.length }));
    await cachedGet('/api/thesis', 20);
    await sleep(35);
    const after = await cachedGet<{ n: number }>('/api/thesis', 20);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(after.data).toEqual({ n: 2 });
  });

  it('a 401 reaches the caller, is not cached, and the next call refetches', async () => {
    fetchMock.mockImplementationOnce(async () => res(401, { error: 'unauthorized' }));
    const first = await cachedGet<{ tier: string }>('/api/user/tier');
    expect(first).toEqual({ ok: false, status: 401, data: null });

    fetchMock.mockImplementationOnce(async () => res(200, { tier: 'pro' }));
    const second = await cachedGet<{ tier: string }>('/api/user/tier');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(second).toEqual({ ok: true, status: 200, data: { tier: 'pro' } });
  });

  it('a network throw yields status 0 and is not cached', async () => {
    fetchMock.mockImplementationOnce(async () => { throw new Error('offline'); });
    const first = await cachedGet('/api/user/profile');
    expect(first).toEqual({ ok: false, status: 0, data: null });

    fetchMock.mockImplementationOnce(async () => res(200, { profile: { email: 'a@b.c' } }));
    const second = await cachedGet<{ profile: { email: string } }>('/api/user/profile');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(second.data).toEqual({ profile: { email: 'a@b.c' } });
  });

  it('invalidate forces the next caller to refetch', async () => {
    fetchMock.mockImplementation(async () => res(200, { theses: [] }));
    await cachedGet('/api/thesis');
    invalidate('/api/thesis');
    await cachedGet('/api/thesis');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a 200 with an unreadable body is not cached', async () => {
    fetchMock.mockImplementationOnce(async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } }));
    const first = await cachedGet('/api/thesis');
    expect(first).toEqual({ ok: false, status: 200, data: null });
    fetchMock.mockImplementationOnce(async () => res(200, { theses: [1] }));
    const second = await cachedGet<{ theses: number[] }>('/api/thesis');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(second.data).toEqual({ theses: [1] });
  });
});
