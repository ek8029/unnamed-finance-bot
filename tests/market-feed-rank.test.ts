// tests/market-feed-rank.test.ts
import { describe, it, expect } from 'vitest';
import { rankFeed } from '@/lib/market-feed-rank';

const item = (ticker: string | null, weight: number | null, sortMs: number, isEvent = false) =>
  ({ ticker, weight, sortMs, isEvent });

describe('rankFeed', () => {
  it('caps how much of the page one ticker can take', () => {
    // The measured failure: AMZN published most, so AMZN took 9 of 20 slots.
    const items = [
      ...Array.from({ length: 9 }, (_, i) => item('AMZN', 1.0, 900 - i)),
      item('AAPL', 8.2, 100),
      item('NVDA', 6.4, 90),
    ];
    const out = rankFeed(items, { capPerTicker: 2, limit: 15 });
    expect(out.filter((i) => i.ticker === 'AMZN')).toHaveLength(2);
    expect(out.map((i) => i.ticker)).toContain('AAPL');
    expect(out.map((i) => i.ticker)).toContain('NVDA');
  });

  it('leads with the heaviest position, not the newest headline', () => {
    const out = rankFeed([
      item('AMZN', 1.0, 999),   // newest
      item('AAPL', 8.2, 100),   // heaviest
    ]);
    expect(out[0].ticker).toBe('AAPL');
  });

  it('gives every ticker one item before anyone gets a second', () => {
    const out = rankFeed([
      item('AAPL', 8.2, 300), item('AAPL', 8.2, 299),
      item('NVDA', 6.4, 200), item('NVDA', 6.4, 199),
      item('KO', 2.0, 100),
    ], { capPerTicker: 2, limit: 15 });
    expect(out.slice(0, 3).map((i) => i.ticker)).toEqual(['AAPL', 'NVDA', 'KO']);
  });

  it('keeps recency inside a single ticker', () => {
    const out = rankFeed([item('AAPL', 8.2, 100), item('AAPL', 8.2, 500)]);
    expect(out.map((i) => i.sortMs)).toEqual([500, 100]);
  });

  it('puts events first and orders them soonest-first', () => {
    const out = rankFeed([
      item('AAPL', 8.2, 500),
      item('NVDA', 6.4, 300, true),
      item('KO', 2.0, 100, true),
    ]);
    expect(out.slice(0, 2).map((i) => i.sortMs)).toEqual([100, 300]);
  });

  it('keeps unheld and market-wide items, ranked last', () => {
    const out = rankFeed([
      item(null, null, 900),
      item('AAPL', 8.2, 100),
    ]);
    expect(out[0].ticker).toBe('AAPL');
    expect(out).toHaveLength(2);
  });

  it('is total: same input, same order', () => {
    const items = [item('A', 1, 100), item('B', 1, 100), item('C', 1, 100)];
    expect(rankFeed(items).map((i) => i.ticker)).toEqual(rankFeed(items).map((i) => i.ticker));
  });

  it('an empty feed is empty, not a crash', () => {
    expect(rankFeed([])).toEqual([]);
  });
});
