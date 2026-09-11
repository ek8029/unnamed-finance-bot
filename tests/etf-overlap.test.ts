// tests/etf-overlap.test.ts
// The overlap math reads two top-ten constituent lists out of ETF_HOLDINGS and
// nothing else. These tests pin the contract the /tools/etf-overlap page prints:
// a real pair, a disjoint pair, a fund against itself, an unknown ticker, and
// the two summed percentages staying inside 0 to 100.
import { describe, it, expect } from 'vitest';
import { ETF_HOLDINGS } from '@/lib/etf-holdings';
import { computeOverlap, fundName, OVERLAP_FUNDS } from '@/lib/etf-overlap';

describe('OVERLAP_FUNDS', () => {
  it('lists exactly the funds that carry constituents', () => {
    const withHoldings = Object.entries(ETF_HOLDINGS)
      .filter(([, list]) => list.length > 0)
      .map(([ticker]) => ticker)
      .sort();
    expect(OVERLAP_FUNDS.map((f) => f.ticker).sort()).toEqual(withHoldings);
  });

  it('gives every fund a name', () => {
    for (const f of OVERLAP_FUNDS) {
      expect(fundName(f.ticker)).toBe(f.name);
      expect(f.name.length).toBeGreaterThan(0);
    }
  });
});

describe('computeOverlap', () => {
  it('finds the megacaps QQQ and VOO both carry in their top ten', () => {
    const r = computeOverlap('QQQ', 'VOO');
    expect(r).not.toBeNull();
    const shared = r!.shared.map((s) => s.ticker);
    for (const t of ['AAPL', 'NVDA', 'MSFT', 'AMZN', 'AVGO', 'META', 'GOOGL', 'TSLA']) {
      expect(shared).toContain(t);
    }
    expect(r!.shared).toHaveLength(9);
    // Both weights come straight from each fund's own list, never copied across.
    const nvda = r!.shared.find((s) => s.ticker === 'NVDA')!;
    expect(nvda.weightA).toBe(8.25);
    expect(nvda.weightB).toBe(8.29);
    expect(r!.sharedWeightA).toBeCloseTo(47.69, 2);
    expect(r!.sharedWeightB).toBeCloseTo(37.36, 2);
    expect(r!.onlyA).toEqual(['COST']);
    expect(r!.onlyB).toEqual(['MU']);
  });

  it('sorts shared holdings heaviest first in fund A', () => {
    const r = computeOverlap('QQQ', 'VOO')!;
    const weights = r.shared.map((s) => s.weightA);
    expect([...weights].sort((x, y) => y - x)).toEqual(weights);
  });

  it('reports no shared names for two funds whose top tens are disjoint', () => {
    const r = computeOverlap('XLE', 'XBI');
    expect(r).not.toBeNull();
    expect(r!.shared).toEqual([]);
    expect(r!.sharedWeightA).toBe(0);
    expect(r!.sharedWeightB).toBe(0);
    expect(r!.onlyA).toHaveLength(10);
    expect(r!.onlyB).toHaveLength(10);
  });

  it('shares every name when a fund is compared with itself', () => {
    const r = computeOverlap('SPY', 'SPY');
    expect(r).not.toBeNull();
    expect(r!.shared).toHaveLength(ETF_HOLDINGS.SPY.length);
    expect(r!.onlyA).toEqual([]);
    expect(r!.onlyB).toEqual([]);
    expect(r!.sharedWeightA).toBe(r!.sharedWeightB);
    for (const s of r!.shared) expect(s.weightA).toBe(s.weightB);
  });

  it('returns null rather than a number it cannot stand behind', () => {
    expect(computeOverlap('NOTATICKER', 'VOO')).toBeNull();
    expect(computeOverlap('VOO', 'ZZZZ')).toBeNull();
    // On file, but deliberately empty: no constituents means no overlap claim.
    expect(computeOverlap('TLT', 'VOO')).toBeNull();
    expect(computeOverlap('', 'VOO')).toBeNull();
  });

  it('accepts lowercase and padded input', () => {
    const r = computeOverlap(' qqq ', 'voo');
    expect(r).not.toBeNull();
    expect(r!.tickerA).toBe('QQQ');
    expect(r!.tickerB).toBe('VOO');
  });

  it('keeps both summed percentages inside 0 to 100 for every pair', () => {
    const tickers = OVERLAP_FUNDS.map((f) => f.ticker);
    for (const a of tickers) {
      for (const b of tickers) {
        const r = computeOverlap(a, b)!;
        expect(r).not.toBeNull();
        for (const pct of [r.sharedWeightA, r.sharedWeightB]) {
          expect(pct).toBeGreaterThanOrEqual(0);
          expect(pct).toBeLessThanOrEqual(100);
        }
        // A shared name cannot outnumber either side's list.
        expect(r.shared.length).toBeLessThanOrEqual(Math.min(r.countA, r.countB));
        expect(r.shared.length + r.onlyA.length).toBe(r.countA);
        expect(r.shared.length + r.onlyB.length).toBe(r.countB);
      }
    }
  });
});
