// tests/market-quotes-fill.test.ts
// /api/market/quotes?fill=close backfills tickers with no live quote from the
// newest market_prices row; without the param the response is unchanged.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/market/quotes/route';

const mocks = vi.hoisted(() => ({ liveQuotes: vi.fn(), from: vi.fn(), rows: [] as Record<string, unknown>[] }));
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
  return (await res.json()) as { quotes: Record<string, unknown>[] };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.liveQuotes.mockResolvedValue([AAPL]);
  // Newest first, as the route orders by price_date desc. close arrives as a
  // Postgres numeric string, which the schema (007) types NUMERIC(15, 4).
  mocks.rows = [
    { ticker: 'MSFT', close: '411.2500', price_date: '2026-09-08' },
    { ticker: 'MSFT', close: '405.0000', price_date: '2026-09-05' },
  ];
  const query = {
    select: () => query, in: () => query, gte: () => query, order: () => query,
    then: (resolve: (value: unknown) => void) => resolve({ data: mocks.rows, error: null }),
  };
  mocks.from.mockReturnValue(query);
});

describe('GET /api/market/quotes fill=close', () => {
  it('without fill returns only live quotes and no source key', async () => {
    const { quotes } = await get('tickers=AAPL,MSFT');
    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toEqual(AAPL);
    expect('source' in quotes[0]).toBe(false);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('with fill=close fills the missing ticker from the newest close', async () => {
    const { quotes } = await get('tickers=AAPL,MSFT&fill=close');
    expect(quotes).toHaveLength(2);
    expect(quotes[0]).toEqual({ ...AAPL, source: 'live' });
    expect(quotes[1]).toEqual({ ticker: 'MSFT', price: 411.25, prevClose: null, dayChangePct: null, asOf: Date.parse('2026-09-08'), source: 'close' });
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith('market_prices');
  });
  it('with fill=close and every ticker live, never reads market_prices', async () => {
    mocks.liveQuotes.mockResolvedValue([AAPL, MSFT]);
    const { quotes } = await get('tickers=AAPL,MSFT&fill=close');
    expect(quotes).toHaveLength(2);
    expect(quotes.every((q) => q.source === 'live')).toBe(true);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
