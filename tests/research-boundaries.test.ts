import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as history } from '@/app/api/market/history/route';
import { GET as financials } from '@/app/api/market/financials/route';
import { GET as tickerData } from '@/app/api/market/ticker-data/route';
import { analyzeStock } from '@/lib/analyze-stock';

const mocks = vi.hoisted(() => ({ db: vi.fn(), market: vi.fn(), history: vi.fn(), edgar: vi.fn(), ai: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: mocks.db }));
vi.mock('@/lib/financial-data', () => ({ getFullTickerData: mocks.market }));
vi.mock('@/lib/finazon', () => ({ getHistoricalPrices: mocks.history }));
vi.mock('@/lib/edgar', () => ({ getReportedFinancialsEdgar: mocks.edgar }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: () => ({ allowed: true }), getClientIP: () => 'fixture' }));
vi.mock('openai', () => ({ default: class { chat = { completions: { create: mocks.ai } }; } }));

beforeEach(() => vi.clearAllMocks());
it.each(['BRK.B', 'BRK-B', 'AAPL1', 'AA PL', 'BTC-USD'])('rejects %s across report APIs before provider or cache access', async raw => {
  for (const [get, key] of [[history, 'ticker'], [financials, 'symbol'], [tickerData, 'symbol']] as const) {
    const response = await get(new NextRequest(`http://localhost/api/market/fixture?${key}=${encodeURIComponent(raw)}`));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBeTruthy();
  }
  const analysis = await analyzeStock(raw, true);
  expect(analysis.analysis).toBeNull();
  for (const mock of Object.values(mocks)) expect(mock).not.toHaveBeenCalled();
});
it('passes a supported ticker unchanged to the market-data provider', async () => {
  mocks.market.mockResolvedValue({ symbol: 'AAPL', quote: { price: 100 }, profile: null });
  const response = await tickerData(new NextRequest('http://localhost/api/market/ticker-data?symbol=aapl'));
  expect(response.status).toBe(200);
  expect(mocks.market).toHaveBeenCalledWith('AAPL');
});
