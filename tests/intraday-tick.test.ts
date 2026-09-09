import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
afterEach(() => vi.unstubAllEnvs());
import { readFileSync } from 'fs';
import { join } from 'path';
import { repriceHolding, toHoldingUpdate } from '../lib/market/last-trade';
import { intradayNetWorthSeries, onlyToday, portfolioTotalsByUser } from '../lib/market/intraday-series';
import { etDay, previousWeekday } from '../lib/market/tick-diff';
import { runIntradayTick } from '../lib/market/intraday-tick';

// The full tick against a fake database: every from(table) call is recorded
// with its op chain, holdings and market_prices answer from fixtures, every
// other table answers empty. Finazon, market hours, push, severe moves and
// the heartbeat are stubbed at the module boundary; Redis is in memory
// (`store` null = unconfigured) with the JSON round trip the real client does.
const dbMock = vi.hoisted(() => ({
  holdings: [] as Record<string, unknown>[],
  closes: [] as { ticker: string; close: number; price_date: string }[],
  calls: [] as { table: string; op: string; chain: unknown[][] }[],
  /** When set, every statement of this table and op answers with an error. */
  fail: null as { table: string; op: string } | null,
}));
const finMock = vi.hoisted(() => ({ prices: [] as [string, number][] }));
const hbMock = vi.hoisted(() => ({ beat: vi.fn(async () => {}) }));
const redisMock = vi.hoisted(() => ({ store: new Map<string, unknown>() as Map<string, unknown> | null, sets: [] as string[] }));

vi.mock('@/lib/supabase/server', () => {
  const from = (table: string) => {
    const call = { table, op: 'select', chain: [] as unknown[][] };
    dbMock.calls.push(call);
    const filters: Record<string, unknown> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {};
    for (const m of ['select', 'neq', 'in', 'lt', 'order', 'range', 'eq', 'limit', 'is']) {
      b[m] = (...args: unknown[]) => { call.chain.push([m, ...args]); if (m === 'in' || m === 'lt') filters[String(args[0])] = args[1]; return b; };
    }
    for (const m of ['update', 'upsert', 'insert', 'delete']) {
      b[m] = (...args: unknown[]) => { call.op = m; call.chain.push([m, ...args]); return b; };
    }
    const answer = () => {
      if (call.op !== 'select') {
        const f = dbMock.fail;
        return f && f.table === table && f.op === call.op ? { data: null, error: { message: 'boom' } } : { data: null, error: null };
      }
      if (table === 'holdings') return { data: dbMock.holdings, error: null };
      if (table === 'market_prices') {
        const tickers = filters.ticker as string[] | undefined;
        const before = String(filters.price_date);
        const rows = dbMock.closes
          .filter((c) => (!tickers || tickers.includes(c.ticker)) && c.price_date < before)
          .sort((x, y) => (x.price_date < y.price_date ? 1 : -1));
        return { data: rows, error: null };
      }
      return { data: [], error: null };
    };
    b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(answer()).then(resolve, reject);
    return b;
  };
  return { createServiceClient: async () => ({ from }) };
});
vi.mock('@/lib/finazon', () => ({ getBatchLastTradePrices: async () => new Map(finMock.prices) }));
vi.mock('@/lib/live-quotes', () => ({ isUsMarketHours: () => true }));
vi.mock('@/lib/push/send', () => ({ liveTokenUsers: async () => new Set<string>(), sendPush: async () => ({ sent: 0 }) }));
vi.mock('@/lib/market/severe-move', () => ({ severeMoves: () => [], enqueueSevereMoves: async () => ({ theses: 0, queued: 0, error: null }) }));
vi.mock('@/lib/agent/heartbeat', () => ({ beat: hbMock.beat }));
vi.mock('@/lib/redis', () => {
  const wire = (v: unknown) => JSON.parse(JSON.stringify(v));
  const r = {
    get: async (k: string) => redisMock.store!.get(k) ?? null,
    set: async (k: string, v: unknown) => { redisMock.store!.set(k, wire(v)); redisMock.sets.push(k); return 'OK'; },
  };
  return {
    withRedis: async <T,>(fn: (r: unknown) => Promise<T>, fallback: T) => {
      try { if (!redisMock.store) return fallback; return await fn(r); } catch { return fallback; }
    },
    redisKey: (...parts: string[]) => ['helm', ...parts].join(':'),
  };
});

describe('repriceHolding', () => {
  it('values the position at the last trade and stores the day change as a fraction', () => {
    const r = repriceHolding({ shares: 100, total_cost_basis: 11466 }, 479.09, 456.745);
    expect(r.current_price).toBe(479.09);
    expect(r.total_value).toBeCloseTo(47909, 2);
    expect(r.unrealised_gain_loss).toBeCloseTo(36443, 2);
    expect(r.unrealised_gain_loss_pct).toBeCloseTo(3.1784, 3);
    expect(r.day_change_pct).toBeCloseTo(0.04892, 4);
  });

  it('leaves gain and day change null when cost basis or prior close is unknown', () => {
    const r = repriceHolding({ shares: 5, total_cost_basis: null }, 100, null);
    expect(r.total_value).toBe(500);
    expect(r.unrealised_gain_loss).toBeNull();
    expect(r.unrealised_gain_loss_pct).toBeNull();
    expect(r.day_change_pct).toBeNull();
  });

  it('treats a zero prior close as unknown rather than dividing by it', () => {
    expect(repriceHolding({ shares: 1, total_cost_basis: 1 }, 10, 0).day_change_pct).toBeNull();
  });

  it('does not overwrite a stored day change with null when the prior close is unknown', () => {
    const known = toHoldingUpdate(repriceHolding({ shares: 1, total_cost_basis: 1 }, 10, 8), 'now');
    expect(known.day_change_pct).toBeCloseTo(0.25, 6);
    const unknown = toHoldingUpdate(repriceHolding({ shares: 1, total_cost_basis: 1 }, 10, null), 'now');
    expect('day_change_pct' in unknown).toBe(false);
    expect(unknown.current_price).toBe(10);
    expect(unknown.last_updated_at).toBe('now');
  });
});

describe('intraday tick cron', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'test-secret');
  });

  it('rejects a wrong bearer in-process', async () => {
    const { GET } = await import('../app/api/cron/intraday-prices/route');
    const res = await GET(new Request('http://cron.internal/api/cron/intraday-prices', {
      headers: { Authorization: 'Bearer wrong' },
    }));
    expect(res.status).toBe(401);
  });

  it('is scheduled every five minutes across the session in both DST regimes', () => {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8'));
    const run = (cfg.crons as { path: string; schedule: string }[]).find((c) => c.path === '/api/cron/intraday-prices');
    expect(run).toBeTruthy();
    const [min, hour, , , dow] = run!.schedule.split(' ');
    expect(min).toBe('*/5');
    expect(dow).toBe('1-5');
    const [from, to] = hour.split('-').map(Number);
    expect(from).toBeLessThanOrEqual(13); // 9:30 EDT = 13:30 UTC
    expect(to).toBeGreaterThanOrEqual(21); // 16:00 EST = 21:00 UTC
  });
});

describe('intraday (1D) series', () => {
  it('sums the book per user, using the tick price where one landed', () => {
    const totals = portfolioTotalsByUser(
      [
        { id: 'a', user_id: 'u1', total_value: 1000 },
        { id: 'b', user_id: 'u1', total_value: 500 },
        { id: 'c', user_id: 'u2', total_value: 42 },
      ],
      new Map([['a', 1100]]), // only holding a was repriced this tick
    );
    expect(totals.get('u1')).toBe(1600);
    expect(totals.get('u2')).toBe(42);
  });

  it('adds flat cash and liabilities back so the last point is the displayed net worth', () => {
    const pts = [
      { captured_at: '2026-08-26T14:35:00.000Z', total_value: '48000' },
      { captured_at: '2026-08-26T13:35:00.000Z', total_value: 47000 },
    ];
    // net worth 60,000 with a 48,000 book: 12,000 of cash minus debt.
    const s = intradayNetWorthSeries(pts, 60000, 48000);
    expect(s.map((p) => p.value)).toEqual([59000, 60000]);
    expect(s[0].at < s[1].at).toBe(true);
  });

  it('keeps only points from today in New York', () => {
    const now = new Date('2026-08-26T18:00:00Z'); // 14:00 ET
    const kept = onlyToday(
      [
        { captured_at: '2026-08-26T14:00:00Z', total_value: 1 }, // 10:00 ET today
        { captured_at: '2026-08-26T02:00:00Z', total_value: 2 }, // 22:00 ET yesterday
        { captured_at: '2026-08-25T18:00:00Z', total_value: 3 },
      ],
      now,
    );
    expect(kept.map((p) => p.total_value)).toEqual([1]);
  });
});

describe('intraday tick writes only what changed', () => {
  const today = etDay(new Date()).day;
  const PREV_KEY = `helm:tick:prevclose:${today}`;
  const LAST_KEY = `helm:tick:last:${today}`;
  const FIRST_KEY = `helm:tick:first:${today}`;
  const fresh = new Date().toISOString();
  const stale = new Date(Date.now() - 2 * 86_400_000).toISOString();
  // Session dates, so the fixtures hold on a Monday too (Sunday is not a session).
  const yesterday = previousWeekday(today);
  const twoSessionsBack = previousWeekday(yesterday);
  const closeAt = (close: number, date: string) => ({ close, date });
  // current_price arrives from Postgres as a NUMERIC(15, 4) string.
  const holding = (id: string, user_id: string, ticker: string, security_id: string, price: number, last_updated_at: string) => ({
    id, user_id, ticker, security_id, shares: 10, total_cost_basis: 1000, total_value: price * 10,
    current_price: price.toFixed(4), last_updated_at,
  });
  const calls = (table: string, op?: string) => dbMock.calls.filter((c) => c.table === table && (!op || c.op === op));
  const step = (c: { chain: unknown[][] }, name: string) => c.chain.find((s) => s[0] === name);

  beforeEach(() => {
    dbMock.holdings = [];
    dbMock.closes = [];
    dbMock.calls.length = 0;
    dbMock.fail = null;
    finMock.prices = [];
    redisMock.store = new Map();
    redisMock.sets.length = 0;
    hbMock.beat.mockClear();
    // A mid-session tick: the day's first tick has already run.
    redisMock.store.set(FIRST_KEY, '1');
  });

  it('reads the prior close from the day cache and never touches market_prices', async () => {
    redisMock.store!.set(PREV_KEY, { AAPL: closeAt(140, yesterday), MSFT: closeAt(290, yesterday) });
    dbMock.closes = [{ ticker: 'AAPL', close: 999, price_date: yesterday }];
    dbMock.holdings = [holding('h1', 'u1', 'AAPL', 's1', 150, fresh), holding('h3', 'u2', 'AAPL', 's1', 150, stale)];
    finMock.prices = [['AAPL', 150], ['MSFT', 300]];
    const { body } = await runIntradayTick();
    expect(calls('market_prices')).toHaveLength(0);
    expect(body.prev_close_source).toBe('cache');
    // The stale row is rewritten against the cached close, not the table's.
    const [u] = calls('holdings', 'update');
    expect(step(u, 'eq')).toEqual(['eq', 'id', 'h3']);
    expect((step(u, 'update')![1] as { day_change_pct: number }).day_change_pct).toBeCloseTo(10 / 140, 6);
    expect(redisMock.sets.filter((k) => k === PREV_KEY)).toHaveLength(0);
  });

  it('reads only the tickers the cache is missing, merges, and re-sets the cache', async () => {
    redisMock.store!.set(PREV_KEY, { AAPL: closeAt(140, yesterday) });
    dbMock.closes = [{ ticker: 'MSFT', close: 290, price_date: yesterday }, { ticker: 'AAPL', close: 999, price_date: yesterday }];
    dbMock.holdings = [holding('h1', 'u1', 'AAPL', 's1', 150, stale), holding('h2', 'u1', 'MSFT', 's2', 300, stale)];
    finMock.prices = [['AAPL', 150], ['MSFT', 300]];
    const { body } = await runIntradayTick();
    const reads = calls('market_prices');
    expect(reads).toHaveLength(1);
    expect(step(reads[0], 'in')).toEqual(['in', 'ticker', ['MSFT']]);
    expect(body.prev_close_source).toBe('cache+db');
    expect(redisMock.store!.get(PREV_KEY)).toEqual({ AAPL: closeAt(140, yesterday), MSFT: closeAt(290, yesterday) });
  });

  it('re-reads a cached close dated behind the rest of the universe until it catches up', async () => {
    // ORCL's close failed to write last night and the morning sync backfilled
    // it later: the cache still holds the older session's close.
    redisMock.store!.set(PREV_KEY, { AAPL: closeAt(140, yesterday), MSFT: closeAt(290, yesterday), ORCL: closeAt(100, twoSessionsBack) });
    dbMock.closes = [
      { ticker: 'ORCL', close: 105, price_date: yesterday },
      { ticker: 'ORCL', close: 100, price_date: twoSessionsBack },
      { ticker: 'AAPL', close: 999, price_date: yesterday },
    ];
    dbMock.holdings = [holding('h1', 'u1', 'AAPL', 's1', 150, fresh), holding('h5', 'u1', 'ORCL', 's5', 110, stale)];
    finMock.prices = [['AAPL', 150], ['MSFT', 300], ['ORCL', 110]];
    const { body } = await runIntradayTick();
    const reads = calls('market_prices');
    expect(reads).toHaveLength(1);
    expect(step(reads[0], 'in')).toEqual(['in', 'ticker', ['ORCL']]);
    expect(body.prev_close_source).toBe('cache+db');
    expect(redisMock.store!.get(PREV_KEY)).toEqual({ AAPL: closeAt(140, yesterday), MSFT: closeAt(290, yesterday), ORCL: closeAt(105, yesterday) });
    // The healed close is what the row is repriced against.
    const [u] = calls('holdings', 'update');
    expect(step(u, 'eq')).toEqual(['eq', 'id', 'h5']);
    expect((step(u, 'update')![1] as { day_change_pct: number }).day_change_pct).toBeCloseTo(5 / 105, 6);
  });

  it('re-reads the whole universe when every cached close is two sessions back', async () => {
    // Last night's close write failed for everyone and the morning backfill
    // landed after the first tick built the cache.
    redisMock.store!.set(PREV_KEY, { AAPL: closeAt(139, twoSessionsBack), MSFT: closeAt(289, twoSessionsBack) });
    dbMock.closes = [
      { ticker: 'AAPL', close: 140, price_date: yesterday },
      { ticker: 'MSFT', close: 290, price_date: yesterday },
      { ticker: 'AAPL', close: 139, price_date: twoSessionsBack },
    ];
    dbMock.holdings = [holding('h1', 'u1', 'AAPL', 's1', 150, fresh), holding('h2', 'u1', 'MSFT', 's2', 300, fresh)];
    finMock.prices = [['AAPL', 150], ['MSFT', 300]];
    const { body } = await runIntradayTick();
    const reads = calls('market_prices');
    expect(reads).toHaveLength(1);
    expect(step(reads[0], 'in')).toEqual(['in', 'ticker', ['AAPL', 'MSFT']]);
    expect(body.prev_close_source).toBe('cache+db');
    expect(redisMock.store!.get(PREV_KEY)).toEqual({ AAPL: closeAt(140, yesterday), MSFT: closeAt(290, yesterday) });
  });

  it('treats a cache value in the old bare-number shape as a miss and rewrites it in the dated shape', async () => {
    redisMock.store!.set(PREV_KEY, { AAPL: 140, MSFT: 290 });
    dbMock.closes = [{ ticker: 'AAPL', close: 141, price_date: yesterday }, { ticker: 'MSFT', close: 291, price_date: yesterday }];
    dbMock.holdings = [holding('h1', 'u1', 'AAPL', 's1', 150, fresh), holding('h2', 'u1', 'MSFT', 's2', 300, fresh)];
    finMock.prices = [['AAPL', 150], ['MSFT', 300]];
    const { body } = await runIntradayTick();
    const reads = calls('market_prices');
    expect(reads).toHaveLength(1);
    expect(step(reads[0], 'in')).toEqual(['in', 'ticker', ['AAPL', 'MSFT']]);
    expect(body.prev_close_source).toBe('db');
    expect(redisMock.store!.get(PREV_KEY)).toEqual({ AAPL: closeAt(141, yesterday), MSFT: closeAt(291, yesterday) });
  });

  it('writes nothing when every print matches a row touched this session, and stamps the last-print map once', async () => {
    redisMock.store!.set(PREV_KEY, { AAPL: closeAt(140, yesterday), MSFT: closeAt(290, yesterday) });
    redisMock.store!.set(LAST_KEY, { AAPL: 150, MSFT: 300 });
    dbMock.holdings = [holding('h1', 'u1', 'AAPL', 's1', 150, fresh), holding('h2', 'u1', 'MSFT', 's2', 300, fresh)];
    finMock.prices = [['AAPL', 150], ['MSFT', 300]];
    const { body } = await runIntradayTick();
    expect(calls('holdings', 'update')).toHaveLength(0);
    expect(calls('securities')).toHaveLength(0);
    expect(body.holdings_updated).toBe(0);
    expect(body.holdings_skipped).toBe(2);
    expect(body.securities_updated).toBe(0);
    expect(redisMock.sets.filter((k) => k === LAST_KEY)).toHaveLength(1);
    // Skipped rows still count toward the user's snapshot at their stored value.
    const [snap] = calls('portfolio_intraday_snapshots', 'insert');
    expect(step(snap, 'insert')![1]).toEqual([expect.objectContaining({ user_id: 'u1', total_value: 4500 })]);
    expect(calls('portfolio_intraday_snapshots', 'delete')).toHaveLength(1);
  });

  it('rewrites exactly the holdings of a ticker whose print moved and one securities statement for it', async () => {
    redisMock.store!.set(PREV_KEY, { AAPL: closeAt(140, yesterday), MSFT: closeAt(290, yesterday) });
    redisMock.store!.set(LAST_KEY, { AAPL: 150, MSFT: 300 });
    dbMock.holdings = [
      holding('h1', 'u1', 'AAPL', 's1', 150, fresh),
      holding('h2', 'u1', 'MSFT', 's2', 300, fresh),
      holding('h4', 'u2', 'MSFT', 's2', 300, fresh),
    ];
    finMock.prices = [['AAPL', 150], ['MSFT', 301]];
    const { body } = await runIntradayTick();
    const updates = calls('holdings', 'update');
    expect(updates.map((u) => step(u, 'eq')![2]).sort()).toEqual(['h2', 'h4']);
    expect((step(updates[0], 'update')![1] as { current_price: number }).current_price).toBe(301);
    const sec = calls('securities');
    expect(sec).toHaveLength(1);
    expect(sec[0].op).toBe('update');
    expect(step(sec[0], 'update')![1]).toEqual({ current_price: 301, last_updated_at: expect.any(String) });
    expect(step(sec[0], 'in')).toEqual(['in', 'id', ['s2']]);
    expect(body.holdings_updated).toBe(2);
    expect(body.holdings_skipped).toBe(1);
    expect(body.securities_updated).toBe(1);
    expect(redisMock.store!.get(LAST_KEY)).toEqual({ AAPL: 150, MSFT: 301 });
    expect(hbMock.beat).toHaveBeenCalledTimes(1);
    expect(hbMock.beat).toHaveBeenCalledWith(expect.anything(), 'intraday-prices', expect.objectContaining({
      tickers: 2, priced: 2, updatedHoldings: 2, skippedHoldings: 1, updatedSecurities: 1, prevCloseSource: 'cache', ms: expect.any(Number),
    }));
  });

  it('without Redis: prior close from the table, stale stamps rewritten, every priced security written', async () => {
    redisMock.store = null;
    dbMock.closes = [{ ticker: 'AAPL', close: 140, price_date: yesterday }, { ticker: 'MSFT', close: 290, price_date: yesterday }];
    dbMock.holdings = [
      holding('h1', 'u1', 'AAPL', 's1', 150, fresh),
      holding('h2', 'u1', 'MSFT', 's2', 300, fresh),
      holding('h3', 'u2', 'AAPL', 's1', 150, stale),
    ];
    finMock.prices = [['AAPL', 150], ['MSFT', 300]];
    const { body } = await runIntradayTick();
    const reads = calls('market_prices');
    expect(reads).toHaveLength(1);
    expect(step(reads[0], 'in')).toEqual(['in', 'ticker', ['AAPL', 'MSFT']]);
    expect(body.prev_close_source).toBe('db');
    // The diff against the stored row needs no Redis: equal and touched today is still skipped.
    expect(calls('holdings', 'update').map((u) => step(u, 'eq')![2])).toEqual(['h3']);
    expect(body.holdings_skipped).toBe(2);
    // No last-print map, so every print is a change: one statement per distinct print.
    const sec = calls('securities');
    expect(sec.flatMap((c) => step(c, 'in')![2] as string[]).sort()).toEqual(['s1', 's2']);
    expect(sec.every((c) => c.op === 'update')).toBe(true);
    expect(body.securities_updated).toBe(2);
    expect(hbMock.beat).toHaveBeenCalledWith(expect.anything(), 'intraday-prices', expect.objectContaining({ prevCloseSource: 'db' }));
  });

  it('the first tick of the day (no first-tick key) reprices every priced holding, then sets the key', async () => {
    redisMock.store!.delete(FIRST_KEY);
    redisMock.store!.set(PREV_KEY, { AAPL: closeAt(140, yesterday), MSFT: closeAt(290, yesterday) });
    // Both rows carry today's stamp at the print (the Plaid sync mark): the stamp rule alone would skip them.
    dbMock.holdings = [holding('h1', 'u1', 'AAPL', 's1', 150, fresh), holding('h2', 'u1', 'MSFT', 's2', 300, fresh)];
    finMock.prices = [['AAPL', 150], ['MSFT', 300]];
    const { body } = await runIntradayTick();
    expect(calls('holdings', 'update').map((u) => step(u, 'eq')![2]).sort()).toEqual(['h1', 'h2']);
    expect(body.holdings_updated).toBe(2);
    expect(body.holdings_skipped).toBe(0);
    expect(redisMock.store!.get(FIRST_KEY)).toBeTruthy();
  });

  it('a later tick with the first-tick key present skips rows the stamp rule skips', async () => {
    redisMock.store!.set(PREV_KEY, { AAPL: closeAt(140, yesterday), MSFT: closeAt(290, yesterday) });
    dbMock.holdings = [holding('h1', 'u1', 'AAPL', 's1', 150, fresh), holding('h2', 'u1', 'MSFT', 's2', 300, fresh)];
    finMock.prices = [['AAPL', 150], ['MSFT', 300]];
    const { body } = await runIntradayTick();
    expect(calls('holdings', 'update')).toHaveLength(0);
    expect(body.holdings_skipped).toBe(2);
  });

  it('does not set the first-tick key when no holdings write landed, so the next tick forces again', async () => {
    redisMock.store!.delete(FIRST_KEY);
    redisMock.store!.set(PREV_KEY, { AAPL: closeAt(140, yesterday) });
    dbMock.holdings = [holding('h1', 'u1', 'AAPL', 's1', 150, fresh)];
    finMock.prices = [['AAPL', 150]];
    dbMock.fail = { table: 'holdings', op: 'update' };
    const { body } = await runIntradayTick();
    expect(body.holdings_updated).toBe(0);
    expect(redisMock.store!.get(FIRST_KEY)).toBeUndefined();
  });

  it('without Redis nothing forces: the stamp rule alone decides', async () => {
    redisMock.store = null;
    dbMock.closes = [{ ticker: 'AAPL', close: 140, price_date: yesterday }];
    dbMock.holdings = [holding('h1', 'u1', 'AAPL', 's1', 150, fresh)];
    finMock.prices = [['AAPL', 150]];
    const { body } = await runIntradayTick();
    expect(calls('holdings', 'update')).toHaveLength(0);
    expect(body.holdings_skipped).toBe(1);
  });

  it('a failed securities write stays out of the last-print map and is retried on the next tick', async () => {
    redisMock.store!.set(PREV_KEY, { AAPL: closeAt(140, yesterday), MSFT: closeAt(290, yesterday) });
    redisMock.store!.set(LAST_KEY, { AAPL: 150, MSFT: 300 });
    dbMock.holdings = [holding('h1', 'u1', 'AAPL', 's1', 150, fresh), holding('h2', 'u1', 'MSFT', 's2', 300, fresh)];
    finMock.prices = [['AAPL', 150], ['MSFT', 301]];
    dbMock.fail = { table: 'securities', op: 'update' };
    const first = await runIntradayTick();
    expect(first.body.securities_updated).toBe(0);
    expect(redisMock.store!.get(LAST_KEY)).toEqual({ AAPL: 150, MSFT: 300 });

    dbMock.fail = null;
    dbMock.calls.length = 0;
    // The holdings row now carries the moved print, so only the securities write is outstanding.
    dbMock.holdings = [holding('h1', 'u1', 'AAPL', 's1', 150, fresh), holding('h2', 'u1', 'MSFT', 's2', 301, fresh)];
    const second = await runIntradayTick();
    const sec = calls('securities');
    expect(sec).toHaveLength(1);
    expect(step(sec[0], 'update')![1]).toEqual({ current_price: 301, last_updated_at: expect.any(String) });
    expect(step(sec[0], 'in')).toEqual(['in', 'id', ['s2']]);
    expect(second.body.securities_updated).toBe(1);
    expect(calls('holdings', 'update')).toHaveLength(0);
    expect(redisMock.store!.get(LAST_KEY)).toEqual({ AAPL: 150, MSFT: 301 });
  });
});
