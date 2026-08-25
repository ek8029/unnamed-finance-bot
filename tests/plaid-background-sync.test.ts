import { describe, it, expect } from 'vitest';
import { runBackgroundSync } from '../lib/plaid/background-sync';

type Call = { url: string; method?: string };

function fakeFetch(plan: Record<string, () => Promise<Response>>, calls: Call[]) {
  return (input: string, init?: RequestInit) => {
    calls.push({ url: input, method: init?.method });
    const h = plan[input];
    if (!h) return Promise.reject(new Error(`unplanned ${input}`));
    return h();
  };
}
const ok = () => Promise.resolve(new Response('{}', { status: 200 }));
const bad = () => Promise.resolve(new Response('{}', { status: 500 }));
const never = () => new Promise<Response>(() => {});
const noSleep = () => new Promise<void>(() => {});
const instant = () => Promise.resolve();

describe('runBackgroundSync', () => {
  it('syncs, then refreshes prices, in that order', async () => {
    const calls: Call[] = [];
    const r = await runBackgroundSync({
      fetchImpl: fakeFetch({ '/api/plaid/sync': ok, '/api/market/prices/refresh': ok }, calls),
      sleep: noSleep,
    });
    expect(r).toBe('synced');
    expect(calls.map((c) => c.url)).toEqual(['/api/plaid/sync', '/api/market/prices/refresh']);
    expect(calls.every((c) => c.method === 'POST')).toBe(true);
  });

  it('reports a failed sync and does not touch prices', async () => {
    const calls: Call[] = [];
    const r = await runBackgroundSync({
      fetchImpl: fakeFetch({ '/api/plaid/sync': bad, '/api/market/prices/refresh': ok }, calls),
      sleep: noSleep,
    });
    expect(r).toBe('failed');
    expect(calls.map((c) => c.url)).toEqual(['/api/plaid/sync']);
  });

  it('a thrown sync is a failure, not an unhandled rejection', async () => {
    const r = await runBackgroundSync({
      fetchImpl: () => Promise.reject(new Error('offline')),
      sleep: noSleep,
    });
    expect(r).toBe('failed');
  });

  it('a failed price refresh still counts as synced', async () => {
    const calls: Call[] = [];
    const r = await runBackgroundSync({
      fetchImpl: fakeFetch({ '/api/plaid/sync': ok, '/api/market/prices/refresh': () => Promise.reject(new Error('x')) }, calls),
      sleep: noSleep,
    });
    expect(r).toBe('synced');
  });

  it('gives up with timeout when the sync never answers', async () => {
    const calls: Call[] = [];
    const r = await runBackgroundSync({
      fetchImpl: fakeFetch({ '/api/plaid/sync': never }, calls),
      sleep: instant,
    });
    expect(r).toBe('timeout');
  });
});
