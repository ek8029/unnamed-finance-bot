import { describe, it, expect } from 'vitest';
import { canonicalTicker, isSamePosition, looksLikeDescription } from '../lib/ticker-alias';
import { computePortfolioLookthrough } from '../lib/etf-holdings';

describe('canonicalTicker', () => {
  it('passes ordinary tickers through, uppercased and trimmed', () => {
    expect(canonicalTicker('aapl')).toBe('AAPL');
    expect(canonicalTicker(' NVDA ')).toBe('NVDA');
  });

  it('collapses the Schwab variant symbol onto the real ticker', () => {
    expect(canonicalTicker('SKHYV')).toBe('SKHY');
  });

  it('collapses the OTC unsponsored ADR onto the real ticker', () => {
    expect(canonicalTicker('HXSCL')).toBe('SKHY');
  });

  it('collapses a full security description used in place of a ticker', () => {
    expect(canonicalTicker('Sk Hynix Inc Xxxsponsored Trd Reg Way1 Adr Reps 0.1 Ord Shs')).toBe('SKHY');
  });

  it('never invents a mapping for unknown symbols', () => {
    expect(canonicalTicker('ZZZZ')).toBe('ZZZZ');
    expect(canonicalTicker('SCBP1')).toBe('SCBP1');
  });

  it('handles null and empty input without throwing', () => {
    expect(canonicalTicker(null)).toBe('');
    expect(canonicalTicker(undefined)).toBe('');
    expect(canonicalTicker('')).toBe('');
  });

  it('treats variants as the same position', () => {
    expect(isSamePosition('SKHY', 'SKHYV')).toBe(true);
    expect(isSamePosition('SKHY', 'AAPL')).toBe(false);
  });

  it('recognises descriptions vs symbols', () => {
    expect(looksLikeDescription('SKHY')).toBe(false);
    expect(looksLikeDescription('Sk Hynix Inc Adr')).toBe(true);
  });
});

describe('portfolio look-through with broker variants (Ben regression)', () => {
  it('aggregates a position split across variant symbols into one exposure', () => {
    // The reported bug: SK Hynix arrived under three identities, so exposure
    // showed three fragments (or none) instead of one real position.
    const exposure = computePortfolioLookthrough(
      [
        { ticker: 'SKHY', totalValue: 10_000 },
        { ticker: 'SKHYV', totalValue: 20_000 },
        { ticker: 'Sk Hynix Inc Xxxsponsored Trd Reg Way1 Adr Reps 0.1 Ord Shs', totalValue: 20_000 },
      ],
      100_000,
    );

    expect(exposure.has('SKHY')).toBe(true);
    expect(exposure.has('SKHYV')).toBe(false);
    expect(exposure.get('SKHY')!.totalWeight).toBeCloseTo(50, 5); // 50k of 100k
  });

  it('still splits genuinely different positions', () => {
    const exposure = computePortfolioLookthrough(
      [
        { ticker: 'SKHY', totalValue: 10_000 },
        { ticker: 'AAPL', totalValue: 10_000 },
      ],
      100_000,
    );
    expect(exposure.get('SKHY')!.totalWeight).toBeCloseTo(10, 5);
    expect(exposure.get('AAPL')!.totalWeight).toBeCloseTo(10, 5);
  });

  it('leaves ETF look-through behaviour intact', () => {
    // SPY should still decompose into constituents rather than sitting as direct.
    const exposure = computePortfolioLookthrough([{ ticker: 'SPY', totalValue: 10_000 }], 100_000);
    expect(exposure.has('SPY')).toBe(false);
    expect(exposure.size).toBeGreaterThan(1);
  });
});
