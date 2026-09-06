import { describe, it, expect } from 'vitest';
import { severeMoves, severeMoveKey } from '@/lib/market/severe-move';
import { SEVERE_MOVE_PCT } from '@/lib/thesis-investigation';

describe('severeMoves', () => {
  it('uses the scorer\'s own severe threshold, not a second one', () => {
    expect(SEVERE_MOVE_PCT).toBe(20);
  });

  it('flags a fall or a rise at or past the threshold from the prior close', () => {
    const prices = new Map([['NVDA', 80], ['AAPL', 120], ['TSLA', 79.9], ['MSFT', 100]]);
    const prev = new Map([['NVDA', 100], ['AAPL', 100], ['TSLA', 100], ['MSFT', 100]]);
    const moves = severeMoves(prices, prev);
    expect(moves.map((m) => [m.ticker, +(m.pct * 100).toFixed(1)])).toEqual([['NVDA', -20], ['AAPL', 20], ['TSLA', -20.1]]);
    expect(moves.find((m) => m.ticker === 'NVDA')).toEqual({ ticker: 'NVDA', pct: -0.2, price: 80, prevClose: 100 });
  });

  it('ignores a name with no prior close or a bad price rather than dividing by it', () => {
    const prices = new Map([['X', 50], ['Y', 0], ['Z', 10]]);
    const prev = new Map([['Y', 100], ['Z', 0]]);
    expect(severeMoves(prices, prev)).toEqual([]);
  });

  it('keys one investigation per ticker per trading day, matching the daily close move', () => {
    expect(severeMoveKey('NVDA', '2026-09-08')).toBe('price:NVDA:2026-09-08');
  });
});
