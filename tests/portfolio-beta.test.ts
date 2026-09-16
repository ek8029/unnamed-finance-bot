// tests/portfolio-beta.test.ts
// Pins the arithmetic the /tools/portfolio-beta-calculator page prints. Beta
// figures throughout are made up for the test, not fetched: this module never
// fetches beta, it only weights whatever the caller supplies.
import { describe, it, expect } from 'vitest';
import { computePortfolioBeta, MAX_ROWS, type PortfolioBetaInput } from '@/lib/portfolio-beta';

const row = (label: string, marketValue: number, beta: number) => ({ label, marketValue, beta });

describe('a single holding', () => {
  it('makes the portfolio beta equal to that holding\'s beta', () => {
    const r = computePortfolioBeta({ rows: [row('AAPL', 10_000, 1.2)] })!;
    expect(r.portfolioBeta).toBe(1.2);
    expect(r.rows[0].weight).toBe(1);
    expect(r.rows[0].contribution).toBe(1.2);
  });
});

describe('equal weights', () => {
  it('averages three equally sized holdings evenly', () => {
    const r = computePortfolioBeta({
      rows: [row('A', 1_000, 1.0), row('B', 1_000, 1.5), row('C', 1_000, 0.5)],
    })!;
    expect(r.rows.every((x) => x.weight === 1 / 3)).toBe(true);
    // (1.0 + 1.5 + 0.5) / 3 = 1.0
    expect(r.portfolioBeta).toBeCloseTo(1.0, 10);
  });
});

describe('cash dilutes beta', () => {
  it('pulls the portfolio beta toward zero as cash weight rises', () => {
    // $5,000 at beta 2.0, $5,000 cash: weighted average is 1.0.
    const r = computePortfolioBeta({ rows: [row('QQQ', 5_000, 2.0)], cash: 5_000 })!;
    expect(r.cashWeight).toBe(0.5);
    expect(r.portfolioBeta).toBeCloseTo(1.0, 10);
  });

  it('goes to exactly zero when the book is all cash', () => {
    const r = computePortfolioBeta({ rows: [], cash: 10_000 })!;
    expect(r.portfolioBeta).toBe(0);
    expect(r.cashWeight).toBe(1);
    expect(r.rows).toHaveLength(0);
  });

  it('treats an omitted cash figure as zero', () => {
    const r = computePortfolioBeta({ rows: [row('A', 1_000, 1.5)] })!;
    expect(r.cash).toBe(0);
    expect(r.cashWeight).toBe(0);
  });
});

describe('negative beta', () => {
  it('pulls the portfolio beta down, and can make it negative', () => {
    // $8,000 at 1.2 and $2,000 at -3.0: (8000*1.2 + 2000*-3) / 10000 = 0.36
    const r = computePortfolioBeta({ rows: [row('SPY', 8_000, 1.2), row('VIXY', 2_000, -3.0)] })!;
    expect(r.portfolioBeta).toBeCloseTo(0.36, 10);
  });

  it('is negative overall when the short holding dominates', () => {
    const r = computePortfolioBeta({ rows: [row('SPY', 2_000, 1.0), row('SH', 8_000, -1.0)] })!;
    expect(r.portfolioBeta).toBeCloseTo(-0.6, 10);
  });
});

describe('zero total returns null', () => {
  it('rejects an empty book with no cash', () => {
    expect(computePortfolioBeta({ rows: [] })).toBeNull();
  });

  it('rejects rows that are all zero dollars with no cash', () => {
    expect(computePortfolioBeta({ rows: [row('A', 0, 1.0), row('B', 0, 2.0)] })).toBeNull();
  });

  it('rejects zero cash and zero rows explicitly', () => {
    expect(computePortfolioBeta({ rows: [], cash: 0 })).toBeNull();
  });
});

describe('validation', () => {
  it('rejects a negative market value', () => {
    expect(computePortfolioBeta({ rows: [row('A', -100, 1.0)] })).toBeNull();
  });

  it('rejects negative cash', () => {
    expect(computePortfolioBeta({ rows: [row('A', 1_000, 1.0)], cash: -1 })).toBeNull();
  });

  it('rejects a non-finite beta', () => {
    expect(computePortfolioBeta({ rows: [row('A', 1_000, Number.NaN)] })).toBeNull();
    expect(computePortfolioBeta({ rows: [row('A', 1_000, Infinity)] })).toBeNull();
  });

  it('rejects a non-finite market value', () => {
    expect(computePortfolioBeta({ rows: [row('A', Infinity, 1.0)] })).toBeNull();
  });

  it('accepts a beta of exactly zero as a real value, not a missing one', () => {
    const r = computePortfolioBeta({ rows: [row('BIL', 1_000, 0)] })!;
    expect(r.portfolioBeta).toBe(0);
  });
});

describe('the 30-row cap', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => row(`T${i}`, 100, 1));

  it('accepts exactly 30 rows', () => {
    expect(computePortfolioBeta({ rows: rows(MAX_ROWS) })).not.toBeNull();
  });

  it('rejects 31 rows', () => {
    expect(computePortfolioBeta({ rows: rows(MAX_ROWS + 1) })).toBeNull();
  });
});

describe('top three contributors', () => {
  it('reports the full share when there are three or fewer holdings', () => {
    const r = computePortfolioBeta({ rows: [row('A', 1_000, 1.0), row('B', 1_000, 2.0)] })!;
    expect(r.topThreeShare).toBeCloseTo(1, 10);
  });

  it('reports less than the full share when a fourth holding contributes', () => {
    // Four equal-dollar holdings at betas 4, 3, 2, 1: portfolio beta 2.5.
    // Top three (4, 3, 2) contribute (4+3+2)/4 = 2.25 of the 2.5 total: 90%.
    const r = computePortfolioBeta({
      rows: [row('A', 1_000, 4), row('B', 1_000, 3), row('C', 1_000, 2), row('D', 1_000, 1)],
    })!;
    expect(r.topThreeShare).toBeCloseTo(0.9, 10);
  });

  it('ranks by the size of the contribution regardless of sign', () => {
    // A big negative contributor should still count among the top three.
    const r = computePortfolioBeta({
      rows: [row('A', 1_000, 0.1), row('B', 1_000, 0.1), row('C', 1_000, 0.1), row('D', 1_000, -5)],
    })!;
    // Top three by |contribution|: D (-1.25), then A and B or C (0.025 each).
    const total = r.portfolioBeta;
    expect(r.topThreeShare).toBeCloseTo((-1.25 + 0.025 + 0.025) / total, 10);
  });

  it('is zero when the portfolio beta itself is zero', () => {
    const r = computePortfolioBeta({ rows: [row('A', 1_000, 2), row('B', 1_000, -2)] })!;
    expect(r.portfolioBeta).toBe(0);
    expect(r.topThreeShare).toBe(0);
  });
});

describe('implied index moves', () => {
  it('scales the portfolio beta by 1, 5 and 10 percent', () => {
    const r = computePortfolioBeta({ rows: [row('A', 1_000, 1.5)] })!;
    expect(r.impliedMoves.map((m) => m.indexMove)).toEqual([0.01, 0.05, 0.1]);
    expect(r.impliedMoves.map((m) => m.portfolioMove)).toEqual([
      expect.closeTo(0.015, 10),
      expect.closeTo(0.075, 10),
      expect.closeTo(0.15, 10),
    ]);
  });

  it('produces a negative implied move for a negative-beta book', () => {
    const r = computePortfolioBeta({ rows: [row('SH', 1_000, -1.0)] })!;
    expect(r.impliedMoves[0].portfolioMove).toBeCloseTo(-0.01, 10);
  });
});

describe('rounding', () => {
  it('keeps full precision rather than rounding to cents', () => {
    // 1/3 weight each: the lib does not round this to a 2-decimal display figure.
    const r = computePortfolioBeta({
      rows: [row('A', 1_000, 1), row('B', 1_000, 1), row('C', 1_000, 1)],
    })!;
    expect(r.rows[0].weight).toBe(1 / 3);
  });

  it('does not round a beta value at all', () => {
    const r = computePortfolioBeta({ rows: [row('A', 1_000, 1.23456789)] })!;
    expect(r.portfolioBeta).toBe(1.23456789);
  });
});

describe('reconciliation identities over random input (seeded, no Math.random)', () => {
  it('row contributions always sum to the portfolio beta, over 2,000 cases', () => {
    let seed = 20260916;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

    for (let i = 0; i < 2000; i += 1) {
      const n = Math.floor(rnd() * MAX_ROWS) + 1;
      const rows = Array.from({ length: n }, (_, j) => ({
        label: `T${j}`,
        marketValue: Math.round(rnd() * 1_000_000) / 100,
        beta: Math.round((rnd() - 0.4) * 400) / 100,
      }));
      const cash = Math.round(rnd() * 500_000) / 100;
      const input: PortfolioBetaInput = { rows, cash };
      const r = computePortfolioBeta(input);

      const total = rows.reduce((s, x) => s + x.marketValue, 0) + cash;
      if (total <= 0) {
        expect(r).toBeNull();
        continue;
      }
      expect(r).not.toBeNull();
      if (!r) continue;

      const summed = r.rows.reduce((s, x) => s + x.contribution, 0);
      expect(summed).toBeCloseTo(r.portfolioBeta, 9);

      const weightSum = r.rows.reduce((s, x) => s + x.weight, 0) + r.cashWeight;
      expect(weightSum).toBeCloseTo(1, 9);

      for (const im of r.impliedMoves) {
        expect(im.portfolioMove).toBeCloseTo(r.portfolioBeta * im.indexMove, 9);
      }

      if (r.portfolioBeta === 0) {
        expect(r.topThreeShare).toBe(0);
      }
    }
  });
});
