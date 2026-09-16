/**
 * Portfolio beta arithmetic: a weighted average of the beta figures the caller
 * supplies, plus where that average comes from.
 *
 * Beta is not fetched here. The caller (a person reading their broker's
 * position page or a data site) types in a beta per holding, and this module
 * only does the weighting: each holding's share of the total dollars, that
 * share times its beta, and the sum across holdings is the portfolio beta.
 * Cash is treated as a beta-0 holding because it does not move with the
 * index. It reads no market data and no user book.
 *
 * What it does NOT model:
 *   - It does not fetch or estimate beta for any ticker. A beta of 0 typed
 *     for a stock is treated as a real 0, not a missing value.
 *   - Non-linear or regime-dependent behavior. The weighted average and the
 *     implied index moves below are a linear approximation.
 *   - Idiosyncratic (stock-specific) risk. Two portfolios with the same
 *     portfolio beta can have very different total volatility.
 *
 * Every number here is full precision. Whole-cent and 2-decimal beta
 * rounding are display conventions applied by the page, not by this module.
 */

/** Above this the dollar arithmetic stops being meaningful to price. */
const MAX_AMOUNT = 1e12;
/** Up to 30 holdings, matching the form on the calculator page. */
export const MAX_ROWS = 30;

export interface BetaRow {
  label: string;
  marketValue: number;
  beta: number;
}

export interface PortfolioBetaInput {
  rows: BetaRow[];
  /** Cash and cash-equivalent dollars, always beta 0. Defaults to 0. */
  cash?: number;
}

/** One holding's share of the book and what it contributes to portfolio beta. */
export interface BetaRowResult {
  label: string;
  marketValue: number;
  beta: number;
  /** marketValue / totalValue. */
  weight: number;
  /** weight * beta. Sums across all rows and cash to portfolioBeta. */
  contribution: number;
}

/** The move in the portfolio implied by a given move in the index, at this beta. */
export interface ImpliedMove {
  /** e.g. 0.01 for a 1 percent index move. */
  indexMove: number;
  /** portfolioBeta * indexMove. */
  portfolioMove: number;
}

export interface PortfolioBetaResult {
  rows: BetaRowResult[];
  cash: number;
  cashWeight: number;
  totalValue: number;
  /** The weighted-average beta of the whole book, cash included. */
  portfolioBeta: number;
  /** Share of portfolioBeta coming from the three holdings with the largest
   *  absolute contribution. 0 when portfolioBeta itself is 0 (the ratio is
   *  not meaningful with nothing to divide by). Cash never counts as one of
   *  the three: its contribution is always 0. */
  topThreeShare: number;
  impliedMoves: ImpliedMove[];
}

const finiteWithin = (n: number, max: number) => Number.isFinite(n) && n >= 0 && n <= max;

/**
 * Weighted-average portfolio beta and the detail behind it. Returns null when
 * the input cannot produce a figure worth printing: more than 30 rows, a
 * negative or non-finite dollar amount, a non-finite beta, or a book that
 * totals to zero.
 */
export function computePortfolioBeta(input: PortfolioBetaInput): PortfolioBetaResult | null {
  const rows = input.rows;
  if (!Array.isArray(rows) || rows.length > MAX_ROWS) return null;

  const cash = input.cash ?? 0;
  if (!finiteWithin(cash, MAX_AMOUNT)) return null;

  for (const r of rows) {
    if (!finiteWithin(r.marketValue, MAX_AMOUNT)) return null;
    if (!Number.isFinite(r.beta)) return null;
  }

  const totalValue = rows.reduce((n, r) => n + r.marketValue, 0) + cash;
  if (totalValue <= 0) return null;

  const rowResults: BetaRowResult[] = rows.map((r) => {
    const weight = r.marketValue / totalValue;
    return { label: r.label, marketValue: r.marketValue, beta: r.beta, weight, contribution: weight * r.beta };
  });

  const cashWeight = cash / totalValue;
  const portfolioBeta = rowResults.reduce((n, r) => n + r.contribution, 0) + cashWeight * 0;

  const topThree = [...rowResults]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 3)
    .reduce((n, r) => n + r.contribution, 0);
  const topThreeShare = portfolioBeta !== 0 ? topThree / portfolioBeta : 0;

  const impliedMoves: ImpliedMove[] = [0.01, 0.05, 0.1].map((indexMove) => ({
    indexMove,
    portfolioMove: portfolioBeta * indexMove,
  }));

  return { rows: rowResults, cash, cashWeight, totalValue, portfolioBeta, topThreeShare, impliedMoves };
}
