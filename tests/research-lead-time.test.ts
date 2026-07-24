import { describe, it, expect } from 'vitest';
import { forwardMove, summarizeLeadTimes, type PricePoint } from '@/lib/research/lead-time';

// 10 trading days: flat, then a slide starting day 3.
const series: PricePoint[] = [
  { date: '2026-07-01', close: 100 },
  { date: '2026-07-02', close: 101 },
  { date: '2026-07-03', close: 100 },
  { date: '2026-07-06', close: 97 },
  { date: '2026-07-07', close: 94 }, // -6% from base, crosses 5% on day 4
  { date: '2026-07-08', close: 95 },
  { date: '2026-07-09', close: 92 },
  { date: '2026-07-10', close: 96 },
];

describe('forwardMove', () => {
  it('finds the threshold crossing and the worst adverse move', () => {
    const m = forwardMove(series, '2026-07-01', 10, 5, 'down')!;
    expect(m.baseDate).toBe('2026-07-01');
    expect(m.daysToThreshold).toBe(4); // 94 is the 4th trading day after base
    expect(m.maxAdversePct).toBeCloseTo(-8, 0); // 92 vs 100
    expect(m.endPct).toBeCloseTo(-4, 0);
  });

  it('snaps a weekend catch date to the next trading day', () => {
    const m = forwardMove(series, '2026-07-04', 10, 5, 'down')!;
    expect(m.baseDate).toBe('2026-07-06'); // Monday
  });

  it('reports a miss when the move never crosses the threshold', () => {
    const m = forwardMove(series, '2026-07-01', 2, 5, 'down')!;
    expect(m.daysToThreshold).toBeNull();
  });

  it('handles the up direction for supporting evidence', () => {
    const up: PricePoint[] = [
      { date: '2026-07-01', close: 100 },
      { date: '2026-07-02', close: 106 },
    ];
    const m = forwardMove(up, '2026-07-01', 5, 5, 'up')!;
    expect(m.daysToThreshold).toBe(1);
    expect(m.maxAdversePct).toBeCloseTo(6, 0);
  });

  it('returns null with no data after the date', () => {
    expect(forwardMove(series, '2026-07-10', 10, 5, 'down')).toBeNull();
    expect(forwardMove(series, '2026-08-01', 10, 5, 'down')).toBeNull();
  });
});

describe('summarizeLeadTimes', () => {
  it('counts confirmations and misses honestly and takes medians', () => {
    const mk = (days: number | null, move: number) => ({
      baseDate: 'x',
      basePrice: 1,
      maxAdversePct: move,
      daysToThreshold: days,
      endPct: move,
    });
    const s = summarizeLeadTimes([mk(2, -6), mk(8, -9), mk(null, -1), mk(4, -7)]);
    expect(s.catches).toBe(4);
    expect(s.confirmed).toBe(3);
    expect(s.missed).toBe(1);
    expect(s.medianLeadDays).toBe(4);
    expect(s.medianConfirmedMovePct).toBe(-7);
  });

  it('handles the empty set', () => {
    const s = summarizeLeadTimes([]);
    expect(s.catches).toBe(0);
    expect(s.medianLeadDays).toBeNull();
  });
});
