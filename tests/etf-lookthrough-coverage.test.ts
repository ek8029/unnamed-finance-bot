import { describe, expect, it } from 'vitest';
import { getUnderlyingExposure, computePortfolioLookthrough, SINGLE_STOCK_MAP, LEVERAGED_ETF_MAP, ETF_HOLDINGS } from '../lib/etf-holdings';

/**
 * Every leveraged or inverse product held in production on 2026-09-21, read
 * from the holdings table. Six of these resolved to nothing, so their
 * underlying exposure read as zero while the position sat in the book at full
 * value: 46%, 37% and 68% of three users' books respectively.
 *
 * A product held by a real user and absent from the maps is the defect this
 * guards. When a new one appears in the book, add it here and to the map.
 */
const HELD_IN_PRODUCTION: Record<string, string> = {
  AMA: 'AMAT', AMAU: 'AMAT', AMDG: 'AMD', AMDL: 'AMD', AMZZ: 'AMZN',
  AVGX: 'AVGO', CRWG: 'CRWV', GGLL: 'GOOGL', HYNX: 'SKHY', LINT: 'INTC',
  LRCU: 'LRCX', METU: 'META', MRVU: 'MRVL', MSFL: 'MSFT', MSFU: 'MSFT',
  MULL: 'MU', MUU: 'MU', NVDL: 'NVDA', SNDG: 'SNDK', SNXX: 'SNDK',
  TSLL: 'TSLA', TSMX: 'TSM', WDCX: 'WDC',
};

/** Leveraged products over a basket rather than one stock. */
const HELD_BASKETS = ['MAGX', 'SOXL', 'SPXL', 'TQQQ', 'USD'];

/**
 * Held in production and deliberately NOT mapped, because the underlying is
 * not a ticker we can name from the fund name alone. Listed so the gap is on
 * the record instead of looking like an oversight.
 *
 * RAM: "Roundhill T-REX 2X Long DRAM Daily Target ETF". DRAM is a memory
 * basket, not a listed symbol. Mapping it needs the issuer's holdings file.
 */
const HELD_BUT_UNMAPPED = ['RAM'];

describe('look-through covers what users actually hold', () => {
  it('resolves every single-stock product held in production', () => {
    const unresolved = Object.keys(HELD_IN_PRODUCTION).filter(t => !(t in SINGLE_STOCK_MAP));
    expect(unresolved).toEqual([]);
  });

  it('maps each one to the right underlying', () => {
    for (const [product, underlying] of Object.entries(HELD_IN_PRODUCTION)) {
      expect(SINGLE_STOCK_MAP[product].underlying, `${product} underlying`).toBe(underlying);
    }
  });

  it('resolves every basket product held in production to a fund with constituents', () => {
    for (const product of HELD_BASKETS) {
      expect(product in LEVERAGED_ETF_MAP, `${product} in LEVERAGED_ETF_MAP`).toBe(true);
      const base = LEVERAGED_ETF_MAP[product].underlying;
      expect(ETF_HOLDINGS[base]?.length, `${product} -> ${base} has constituents`).toBeGreaterThan(0);
    }
  });

  it('produces non-empty exposure for every held product', () => {
    for (const product of [...Object.keys(HELD_IN_PRODUCTION), ...HELD_BASKETS]) {
      const exposure = getUnderlyingExposure(product, 10_000, 100_000);
      expect(exposure.length, `${product} exposure`).toBeGreaterThan(0);
    }
  });

  it('keeps the deliberately unmapped products documented, not silently absent', () => {
    // If one of these gains a mapping, move it into HELD_IN_PRODUCTION rather
    // than deleting the assertion, so the list stays an accurate record.
    for (const product of HELD_BUT_UNMAPPED) {
      expect(product in SINGLE_STOCK_MAP, `${product} unexpectedly mapped`).toBe(false);
      expect(product in LEVERAGED_ETF_MAP, `${product} unexpectedly mapped`).toBe(false);
    }
  });
});

describe('the six products that were missing', () => {
  // Each of these was held at real value and resolved to nothing before
  // 2026-09-21.
  it.each([
    ['AMA', 'AMAT', 2],
    ['AMDG', 'AMD', 2],
    ['MRVU', 'MRVL', 2],
    ['MUU', 'MU', 2],
    ['SNDG', 'SNDK', 2],
  ])('%s looks through to %s at %ix', (product, underlying, leverage) => {
    const exposure = getUnderlyingExposure(product, 10_000, 100_000);
    expect(exposure).toHaveLength(1);
    expect(exposure[0].ticker).toBe(underlying);
    expect(exposure[0].leverage).toBe(leverage);
    // 10k of a 2x product in a 100k book is 10% allocation, 20% effective.
    expect(exposure[0].effectiveWeight).toBeCloseTo(20, 6);
  });

  it('decomposes MAGX into the seven Magnificent Seven names at 2x', () => {
    const exposure = getUnderlyingExposure('MAGX', 10_000, 100_000);
    expect(exposure.map(e => e.ticker).sort()).toEqual(
      ['AAPL', 'AMZN', 'GOOGL', 'META', 'MSFT', 'NVDA', 'TSLA'],
    );
    // 10% allocation at 2x spread over the basket totals 20% effective.
    const total = exposure.reduce((s, e) => s + e.effectiveWeight, 0);
    expect(total).toBeCloseTo(20, 1);
  });
});

describe('the reported case: direct shares rotated into the 2x', () => {
  // The user sold 25 SKHY on 2026-07-17 and bought 152.8979 HYNX the same day
  // for a near-identical amount. True exposure must still show SKHY, because
  // he holds roughly twice the delta he held before.
  it('shows SKHY exposure for a book holding only HYNX', () => {
    const exposure = computePortfolioLookthrough(
      [{ ticker: 'HYNX', totalValue: 4472 }],
      4472,
    );
    const skhy = exposure.get('SKHY');
    expect(skhy).toBeDefined();
    expect(skhy!.indirectWeight).toBeCloseTo(200, 6);
    expect(skhy!.directWeight).toBe(0);
    expect(skhy!.sources).toContain('HYNX');
  });

  it('adds direct and indirect exposure to the same underlying', () => {
    const exposure = computePortfolioLookthrough(
      [{ ticker: 'AMAT', totalValue: 5_000 }, { ticker: 'AMAU', totalValue: 5_000 }],
      10_000,
    );
    const amat = exposure.get('AMAT')!;
    expect(amat.directWeight).toBeCloseTo(50, 6);
    expect(amat.indirectWeight).toBeCloseTo(100, 6);
    expect(amat.totalWeight).toBeCloseTo(150, 6);
  });

  it('does not invent exposure for an ordinary stock', () => {
    expect(getUnderlyingExposure('AMAT', 1_000, 10_000)).toEqual([]);
  });
});
