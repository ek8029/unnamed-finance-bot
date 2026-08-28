import { describe, it, expect } from 'vitest';
import { toFactorMetrics, hasAnyMetric, isEnrichable } from '../lib/factor-lens-fundamentals';

describe('toFactorMetrics', () => {
  it('maps profile market cap (millions) to billions and picks the five ratios the report reads', () => {
    const m = toFactorMetrics(
      { marketCapitalization: 2_500_000 } as never,
      { metric: { peBasicExclExtraTTM: 31.2, pbQuarterly: 40.1, psTTM: 9.4, roeTTM: 120.5, totalDebtToEquityQuarterly: 1.7 } } as never,
    );
    expect(m).toEqual({ marketCapB: 2500, pe: 31.2, pb: 40.1, ps: 9.4, roe: 120.5, debtToEquity: 1.7 });
  });

  it('falls back to debtEquityQuarterly and leaves absent ratios null', () => {
    const m = toFactorMetrics(null, { metric: { debtEquityQuarterly: 0.4 } } as never);
    expect(m).toEqual({ marketCapB: null, pe: null, pb: null, ps: null, roe: null, debtToEquity: 0.4 });
  });

  it('treats a zero or missing market cap as unknown, not $0B', () => {
    expect(toFactorMetrics({ marketCapitalization: 0 } as never, null).marketCapB).toBeNull();
    expect(toFactorMetrics(null, null).marketCapB).toBeNull();
  });
});

describe('hasAnyMetric', () => {
  it('is false when every field is null, so a provider outage is never cached for a day', () => {
    expect(hasAnyMetric({ marketCapB: null, pe: null, pb: null, ps: null, roe: null, debtToEquity: null })).toBe(false);
    expect(hasAnyMetric({ marketCapB: 12, pe: null, pb: null, ps: null, roe: null, debtToEquity: null })).toBe(true);
  });
});

describe('isEnrichable', () => {
  it('only single-name equities go to EDGAR; funds and crypto have no filings to read', () => {
    expect(isEnrichable('equity')).toBe(true);
    expect(isEnrichable(null)).toBe(true);
    expect(isEnrichable(undefined)).toBe(true);
    expect(isEnrichable('etf')).toBe(false);
    expect(isEnrichable('mutual_fund')).toBe(false);
    expect(isEnrichable('crypto')).toBe(false);
    expect(isEnrichable('bond')).toBe(false);
  });
});
