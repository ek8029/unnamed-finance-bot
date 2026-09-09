import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cachedUniverse, UNIVERSE_TTL_S } from '@/lib/watch/universe-cache';
import { buildWatchUniverse } from '@/lib/edgar-watch';
import { runNewsWatch } from '@/lib/news-watch';

// An in-memory Redis behind withRedis. Values round-trip through JSON the way
// the Upstash client serializes them, so an array comes back as an array.
const redisMock = vi.hoisted(() => ({
  store: new Map<string, string>(),
  ttl: new Map<string, number>(),
  mode: 'ok' as 'ok' | 'null' | 'throw',
}));
vi.mock('@/lib/redis', () => {
  const guard = () => { if (redisMock.mode === 'throw') throw new Error('redis down'); };
  const r = {
    get: async (k: string) => { guard(); const v = redisMock.store.get(k); return v === undefined ? null : JSON.parse(v); },
    set: async (k: string, v: unknown, opts?: { ex?: number }) => {
      guard();
      redisMock.store.set(k, JSON.stringify(v));
      if (opts?.ex) redisMock.ttl.set(k, opts.ex);
      return 'OK';
    },
  };
  return {
    withRedis: async <T,>(fn: (r: unknown) => Promise<T>, fallback: T) => {
      if (redisMock.mode === 'null') return fallback;
      try { return await fn(r); } catch { return fallback; }
    },
    redisKey: (...parts: string[]) => ['helm', ...parts].join(':'),
  };
});

// The wiring tests below import the real watchers; keep their other
// collaborators offline.
const cikMap = vi.hoisted(() => ({ value: new Map<string, number>() }));
vi.mock('@/lib/edgar', () => ({ getTickerCikMap: async () => cikMap.value }));
vi.mock('@/lib/free-news', () => ({ refreshRssNews: async () => 0 }));
vi.mock('@/lib/agent/judge-queue', () => ({ enqueueJudgeJobs: vi.fn(), recordLedgerRow: vi.fn() }));
vi.mock('@/lib/agent/heartbeat', () => ({ beat: vi.fn() }));
vi.mock('@/lib/agent/monitored', () => ({ monitoredThesisIds: async () => new Set<string>() }));

beforeEach(() => { redisMock.store.clear(); redisMock.ttl.clear(); redisMock.mode = 'ok'; });

const KEY = 'helm:watch:universe:edgar';

describe('cachedUniverse', () => {
  it('a hit returns the cached list without calling read', async () => {
    redisMock.store.set(KEY, JSON.stringify(['AAPL', 'NVDA']));
    const read = vi.fn(async () => ['SHOULD', 'NOT']);
    expect(await cachedUniverse('edgar', read)).toEqual(['AAPL', 'NVDA']);
    expect(read).not.toHaveBeenCalled();
  });

  it('a miss calls read once and stores the list for fifteen minutes', async () => {
    const read = vi.fn(async () => ['AAPL', 'NVDA']);
    expect(await cachedUniverse('edgar', read)).toEqual(['AAPL', 'NVDA']);
    expect(read).toHaveBeenCalledTimes(1);
    expect(JSON.parse(redisMock.store.get(KEY)!)).toEqual(['AAPL', 'NVDA']);
    expect(redisMock.ttl.get(KEY)).toBe(UNIVERSE_TTL_S);
    expect(UNIVERSE_TTL_S).toBe(15 * 60);
    // and the next call is a hit
    expect(await cachedUniverse('edgar', read)).toEqual(['AAPL', 'NVDA']);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('keys per watcher, so news and news-thesis do not share the edgar entry', async () => {
    await cachedUniverse('news', async () => ['A']);
    await cachedUniverse('news-thesis', async () => ['B']);
    expect(JSON.parse(redisMock.store.get('helm:watch:universe:news')!)).toEqual(['A']);
    expect(JSON.parse(redisMock.store.get('helm:watch:universe:news-thesis')!)).toEqual(['B']);
    expect(redisMock.store.has(KEY)).toBe(false);
  });

  it('an empty read is returned but not cached', async () => {
    expect(await cachedUniverse('edgar', async () => [])).toEqual([]);
    expect(redisMock.store.has(KEY)).toBe(false);
  });

  it('Redis null calls read every time', async () => {
    redisMock.mode = 'null';
    const read = vi.fn(async () => ['AAPL']);
    await cachedUniverse('edgar', read);
    await cachedUniverse('edgar', read);
    expect(read).toHaveBeenCalledTimes(2);
    expect(redisMock.store.size).toBe(0);
  });

  it('a Redis throw falls back to read', async () => {
    redisMock.mode = 'throw';
    const read = vi.fn(async () => ['AAPL']);
    expect(await cachedUniverse('edgar', read)).toEqual(['AAPL']);
    expect(read).toHaveBeenCalledTimes(1);
  });
});

/** A Supabase-shaped fake that records the tables read and answers every
 *  select with the rows given for that table (one page, under 1000). */
function fakeDb(rows: Record<string, { ticker: string; tracked?: boolean }[]>) {
  const reads: string[] = [];
  const from = (table: string) => {
    reads.push(table);
    const q: any = {
      select: () => q, range: () => q, neq: () => q, eq: () => q, in: () => q, gte: () => q, or: () => q, limit: () => q,
      then: (resolve: (v: unknown) => unknown) => resolve({ data: rows[table] ?? [], error: null }),
    };
    return q;
  };
  return { db: { from } as any, reads };
}

describe('buildWatchUniverse (edgar)', () => {
  beforeEach(() => { cikMap.value = new Map([['GRLD', 1907223], ['PDSB', 1472091]]); });

  it('a cache hit makes zero holdings or theses reads', async () => {
    redisMock.store.set(KEY, JSON.stringify(['GRLD', 'PDSB']));
    const { db, reads } = fakeDb({});
    const u = await buildWatchUniverse(db);
    expect(reads).toEqual([]);
    expect(u.tickers).toBe(2);
    expect(u.cikToTickers.get('0001907223')).toEqual(['GRLD']);
  });

  it('a miss reads both tables once and caches the sorted union', async () => {
    const { db, reads } = fakeDb({ holdings: [{ ticker: 'pdsb' }, { ticker: 'GRLD' }], theses: [{ ticker: 'GRLD', tracked: true }] });
    const u = await buildWatchUniverse(db);
    expect(reads.sort()).toEqual(['holdings', 'theses']);
    expect(u.tickers).toBe(2);
    expect(JSON.parse(redisMock.store.get(KEY)!)).toEqual(['GRLD', 'PDSB']);
  });
});

describe('runNewsWatch universe', () => {
  it('a cache hit on both lists makes zero holdings or theses reads', async () => {
    redisMock.store.set('helm:watch:universe:news', JSON.stringify(['AAPL', 'NVDA']));
    redisMock.store.set('helm:watch:universe:news-thesis', JSON.stringify(['NVDA']));
    const { db, reads } = fakeDb({});
    const r = await runNewsWatch(db, { log: [], now: new Date('2026-09-08T14:00:00Z'), size: 40 });
    expect(reads).toEqual([]);
    expect(r.tickers).toBe(2);
    expect(r.slice).toEqual(['AAPL', 'NVDA']);
    expect(r.errors).toEqual([]);
  });

  it('a miss reads the tables and caches the union and the thesis list separately', async () => {
    const { db, reads } = fakeDb({ holdings: [{ ticker: 'AAPL' }, { ticker: 'BTC-USD' }], theses: [{ ticker: 'NVDA', tracked: true }] });
    const r = await runNewsWatch(db, { log: [], now: new Date('2026-09-08T14:00:00Z'), size: 40 });
    expect(reads.sort()).toEqual(['holdings', 'theses']);
    expect(JSON.parse(redisMock.store.get('helm:watch:universe:news')!)).toEqual(['AAPL', 'BTC-USD', 'NVDA']);
    expect(JSON.parse(redisMock.store.get('helm:watch:universe:news-thesis')!)).toEqual(['NVDA']);
    // the -USD filter still applies after the cache
    expect(r.slice).toEqual(['AAPL', 'NVDA']);
  });
});
