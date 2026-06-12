import { describe, it, expect } from 'vitest';
import { resolveSector } from '@/lib/portfolio-analysis';
import { getTickerSectorOverride } from '@/lib/market-classify';

type Raw = Parameters<typeof resolveSector>[2];

function rawHolding(ticker: string, sector: string | null): Raw[number] {
  return {
    ticker,
    shares: 1,
    current_price: 100,
    total_value: 100,
    average_cost_basis: null,
    total_cost_basis: null,
    unrealised_gain_loss: null,
    unrealised_gain_loss_pct: null,
    day_change_pct: null,
    portfolio_allocation_pct: null,
    security: {
      security_name: ticker,
      asset_class: 'equity',
      sector,
      industry: null,
      exchange: 'NASDAQ',
    },
  } as Raw[number];
}

describe('resolveSector', () => {
  it('uses the direct sector when known', () => {
    expect(resolveSector('AAPL', 'Technology', [])).toBe('Technology');
  });

  it('falls through when direct sector is Unknown', () => {
    expect(resolveSector('AAPL', 'Unknown', [])).toBe('Technology');
  });

  it('resolves common tickers via the curated override', () => {
    expect(resolveSector('MSFT', null, [])).toBe('Technology');
    expect(resolveSector('SPY', null, [])).toBe('Diversified');
  });

  it('resolves single-stock leveraged products via their underlying', () => {
    // Ben's actual holdings from the June 12 report
    expect(resolveSector('MULL', null, [])).toBe('Technology'); // 2x MU
    expect(resolveSector('AMDL', null, [])).toBe('Technology'); // 2x AMD
    expect(resolveSector('SNXX', null, [])).toBe('Technology'); // 2x SNDK
    expect(resolveSector('LRCU', null, [])).toBe('Technology'); // 2x LRCX
    expect(resolveSector('ASMG', null, [])).toBe('Technology'); // 2x ASML
    expect(resolveSector('MSFL', null, [])).toBe('Technology'); // 2x MSFT
  });

  it('resolves leveraged index ETFs', () => {
    expect(resolveSector('TQQQ', null, [])).toBe('Technology');
    expect(resolveSector('SPXL', null, [])).toBe('Diversified'); // 3x SPY
  });

  it('is case-insensitive on ticker', () => {
    expect(resolveSector('mull', null, [])).toBe('Technology');
  });

  it('falls back to a co-held underlying position sector', () => {
    // APT has no curated override; APTS maps to it in SINGLE_STOCK_MAP
    const raw = [rawHolding('APT', 'Healthcare')];
    expect(resolveSector('APTS', null, raw)).toBe('Healthcare');
  });

  it('returns Unknown for unrecognized tickers', () => {
    expect(resolveSector('ZZZZZ', null, [])).toBe('Unknown');
  });
});

describe('TICKER_SECTOR_OVERRIDE additions for product underlyings', () => {
  it('covers all semis/storage underlyings', () => {
    for (const t of ['MU', 'LRCX', 'SNDK', 'STX', 'WDC', 'TSM', 'SMCI', 'MRVL', 'ASML']) {
      expect(getTickerSectorOverride(t), t).toBe('Technology');
    }
  });

  it('covers other product underlyings', () => {
    expect(getTickerSectorOverride('MSTR')).toBe('Technology');
    expect(getTickerSectorOverride('MARA')).toBe('Financial Services');
    expect(getTickerSectorOverride('RDDT')).toBe('Communication Services');
    expect(getTickerSectorOverride('ABNB')).toBe('Consumer Cyclical');
    expect(getTickerSectorOverride('MRNA')).toBe('Healthcare');
    expect(getTickerSectorOverride('VRT')).toBe('Industrials');
    expect(getTickerSectorOverride('GDX')).toBe('Basic Materials');
  });
});
