/**
 * Fund overlap between two ETFs, computed from the top-ten constituent lists
 * in lib/etf-holdings.ts.
 *
 * HARD LIMIT, and it must stay visible wherever this output is rendered:
 * ETF_HOLDINGS carries each fund's ten largest holdings with weights, not its
 * full basket. Everything here is therefore "shared among the two funds' ten
 * largest holdings" and every percentage is a floor on the real figure, never
 * the full-basket overlap. Nothing in this module extrapolates.
 */

import { ETF_HOLDINGS } from './etf-holdings';

/** Funds that carry real constituents. ETF_HOLDINGS also holds bond and
 *  commodity tickers with deliberately empty arrays; those cannot be compared. */
export const OVERLAP_FUNDS: { ticker: string; name: string }[] = [
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
  { ticker: 'VOO', name: 'Vanguard S&P 500 ETF' },
  { ticker: 'IVV', name: 'iShares Core S&P 500 ETF' },
  { ticker: 'VTI', name: 'Vanguard Total Stock Market ETF' },
  { ticker: 'ITOT', name: 'iShares Core S&P Total U.S. Stock Market ETF' },
  { ticker: 'SCHB', name: 'Schwab U.S. Broad Market ETF' },
  { ticker: 'QQQ', name: 'Invesco QQQ Trust' },
  { ticker: 'QQQM', name: 'Invesco NASDAQ 100 ETF' },
  { ticker: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF Trust' },
  { ticker: 'IWM', name: 'iShares Russell 2000 ETF' },
  { ticker: 'XLK', name: 'Technology Select Sector SPDR Fund' },
  { ticker: 'VGT', name: 'Vanguard Information Technology ETF' },
  { ticker: 'SOXX', name: 'iShares Semiconductor ETF' },
  { ticker: 'SMH', name: 'VanEck Semiconductor ETF' },
  { ticker: 'XLF', name: 'Financial Select Sector SPDR Fund' },
  { ticker: 'XLV', name: 'Health Care Select Sector SPDR Fund' },
  { ticker: 'XBI', name: 'SPDR S&P Biotech ETF' },
  { ticker: 'XLE', name: 'Energy Select Sector SPDR Fund' },
  { ticker: 'XLY', name: 'Consumer Discretionary Select Sector SPDR Fund' },
  { ticker: 'XLP', name: 'Consumer Staples Select Sector SPDR Fund' },
  { ticker: 'XLI', name: 'Industrial Select Sector SPDR Fund' },
  { ticker: 'XLU', name: 'Utilities Select Sector SPDR Fund' },
  { ticker: 'VNQ', name: 'Vanguard Real Estate ETF' },
  { ticker: 'XLC', name: 'Communication Services Select Sector SPDR Fund' },
  { ticker: 'SCHD', name: 'Schwab U.S. Dividend Equity ETF' },
  { ticker: 'VYM', name: 'Vanguard High Dividend Yield ETF' },
  { ticker: 'VIG', name: 'Vanguard Dividend Appreciation ETF' },
  { ticker: 'VUG', name: 'Vanguard Growth ETF' },
  { ticker: 'IWF', name: 'iShares Russell 1000 Growth ETF' },
  { ticker: 'VTV', name: 'Vanguard Value ETF' },
  { ticker: 'VXUS', name: 'Vanguard Total International Stock ETF' },
  { ticker: 'EFA', name: 'iShares MSCI EAFE ETF' },
  { ticker: 'EEM', name: 'iShares MSCI Emerging Markets ETF' },
  { ticker: 'GDX', name: 'VanEck Gold Miners ETF' },
  { ticker: 'ARKK', name: 'ARK Innovation ETF' },
  // MAGS carries seven equal-weighted names, which is its entire basket rather
  // than a top ten, so its overlap figures are exact rather than a floor.
  { ticker: 'MAGS', name: 'Roundhill Magnificent Seven ETF' },
  // DRAM is actively managed; issuer factsheet 06/30/2026, ten of 17 names.
  { ticker: 'DRAM', name: 'Roundhill Memory ETF' },
];

const FUND_NAMES: Record<string, string> = Object.fromEntries(
  OVERLAP_FUNDS.map((f) => [f.ticker, f.name]),
);

export function fundName(ticker: string): string | null {
  return FUND_NAMES[ticker.toUpperCase()] ?? null;
}

export interface SharedHolding {
  ticker: string;
  /** Weight inside fund A's top ten, as a percent of the fund. */
  weightA: number;
  /** Weight inside fund B's top ten, as a percent of the fund. */
  weightB: number;
}

export interface OverlapResult {
  tickerA: string;
  tickerB: string;
  /** Holdings appearing in both funds' top-ten lists, heaviest in A first. */
  shared: SharedHolding[];
  /** Sum of fund A's weights in the shared names, as a share of fund A. */
  sharedWeightA: number;
  /** Sum of fund B's weights in the shared names, as a share of fund B. */
  sharedWeightB: number;
  /** Top-ten names in A only, and in B only. */
  onlyA: string[];
  onlyB: string[];
  /** How many holdings each side's list actually carries (ten where full). */
  countA: number;
  countB: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Overlap between two funds' top-ten lists. Returns null when either ticker
 * has no constituents on file, so a caller never prints a number it cannot
 * stand behind.
 */
export function computeOverlap(rawA: string, rawB: string): OverlapResult | null {
  const tickerA = rawA.trim().toUpperCase();
  const tickerB = rawB.trim().toUpperCase();

  const holdingsA = ETF_HOLDINGS[tickerA];
  const holdingsB = ETF_HOLDINGS[tickerB];
  if (!holdingsA?.length || !holdingsB?.length) return null;

  const weightsB = new Map(holdingsB.map((h) => [h.ticker, h.weight]));
  const weightsA = new Map(holdingsA.map((h) => [h.ticker, h.weight]));

  const shared: SharedHolding[] = holdingsA
    .filter((h) => weightsB.has(h.ticker))
    .map((h) => ({
      ticker: h.ticker,
      weightA: h.weight,
      weightB: weightsB.get(h.ticker) as number,
    }))
    .sort((x, y) => y.weightA - x.weightA);

  const sum = (ns: number[]) => ns.reduce((t, n) => t + n, 0);

  return {
    tickerA,
    tickerB,
    shared,
    sharedWeightA: round2(sum(shared.map((s) => s.weightA))),
    sharedWeightB: round2(sum(shared.map((s) => s.weightB))),
    onlyA: holdingsA.filter((h) => !weightsB.has(h.ticker)).map((h) => h.ticker),
    onlyB: holdingsB.filter((h) => !weightsA.has(h.ticker)).map((h) => h.ticker),
    countA: holdingsA.length,
    countB: holdingsB.length,
  };
}
