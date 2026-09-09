// tests/market-quotes-fill.test.ts
// /api/market/quotes?fill=close backfills tickers with no live quote from the
// newest market_prices row; without the param the response is unchanged.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/market/quotes/route';

const mocks = vi.hoisted(() => ({
  liveQuotes: vi.fn(), from: vi.fn(), inCall: vi.fn(), limit: vi.fn(),
  result: { data: null as Record<string, unknown>[] | null, error: null as { message: string } | null },
}));
vi.mock('@/lib/live-quotes', () => ({ getLiveQuotes: mocks.liveQuotes }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: () => ({ allowed: true }), getClientIP: () => 'fixture' }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'fixture-user' } }, error: null }) },
  from: mocks.from,
}) }));

const AAPL = { ticker: 'AAPL', price: 190.5, prevClose: 189, dayChangePct: 0.79, asOf: 1_700_000_000_000 };
const MSFT = { ticker: 'MSFT', price: 410, prevClose: 405, dayChangePct: 1.23, asOf: 1_700_000_000_000 };

async function get(query: string) {
  const res = await GET(new NextRequest(`http://localhost/api/market/quotes?${query}`));
  const body = (await res.json()) as { quotes: Record<string, unknown>[] };
  return { status: res.status, quotes: body.quotes };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.liveQuotes.mockResolvedValue([AAPL]);
  // Newest first, as the route orders by price_date desc. close arrives as a
  // Postgres numeric string, which the schema (007) types NUMERIC(15, 4).
  mocks.result = {
    data: [
      { ticker: 'MSFT', close: '411.2500', price_date: '2026-09-08' },
      { ticker: 'MSFT', close: '405.0000', price_date: '2026-09-05' },
    ],
    error: null,
  };
  const query = {
    select: () => query, in: mocks.inCall, gte: () => query, order: () => query, limit: mocks.limit,
    then: (resolve: (value: unknown) => void) => resolve(mocks.result),
  };
  mocks.inCall.mockReturnValue(query);
  mocks.limit.mockReturnValue(query);
  mocks.from.mockReturnValue(query);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

describe('GET /api/market/quotes fill=close', () => {
  it('without fill returns only live quotes and no source key', async () => {
    const { quotes } = await get('tickers=AAPL,MSFT');
    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toEqual(AAPL);
    expect('source' in quotes[0]).toBe(false);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('with fill=close fills the missing ticker from the newest close, in one bounded query', async () => {
    const { quotes } = await get('tickers=AAPL,MSFT&fill=close');
    expect(quotes).toHaveLength(2);
    expect(quotes[0]).toEqual({ ...AAPL, source: 'live' });
    expect(quotes[1]).toEqual({ ticker: 'MSFT', price: 411.25, prevClose: null, dayChangePct: null, asOf: Date.parse('2026-09-08'), source: 'close' });
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith('market_prices');
    expect(mocks.inCall).toHaveBeenCalledWith('ticker', ['MSFT']);
    expect(mocks.limit).toHaveBeenCalledWith(8);
    expect(console.error).not.toHaveBeenCalled();
  });
  it('with fill=close and every ticker live, never reads market_prices', async () => {
    mocks.liveQuotes.mockResolvedValue([AAPL, MSFT]);
    const { quotes } = await get('tickers=AAPL,MSFT&fill=close');
    expect(quotes).toHaveLength(2);
    expect(quotes.every((q) => q.source === 'live')).toBe(true);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('a failed close read is logged and the live quotes still return 200', async () => {
    mocks.result = { data: null, error: { message: 'boom' } };
    const { status, quotes } = await get('tickers=AAPL,MSFT&fill=close');
    expect(status).toBe(200);
    expect(quotes).toEqual([{ ...AAPL, source: 'live' }]);
    expect(console.error).toHaveBeenCalledWith('[quotes] fill=close read failed', { message: 'boom' });
  });
  it('a missing ticker with no rows is omitted, not zero-priced', async () => {
    mocks.result = { data: [], error: null };
    const { quotes } = await get('tickers=AAPL,MSFT&fill=close');
    expect(quotes).toEqual([{ ...AAPL, source: 'live' }]);
    expect(console.error).not.toHaveBeenCalled();
  });
});
