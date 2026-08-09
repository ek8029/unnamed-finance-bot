/**
 * The curated comparison pairs, and the only ones allowed to spend money.
 *
 * /compare/[slugs] accepts any two 1-5 letter tickers, which is an unbounded
 * URL space, and every page in it called analyzeStock() with the default
 * allowGenerate=true. A crawler walking arbitrary pairs therefore billed a
 * Finnhub + OpenAI generation per URL, and every one of those URLs was
 * indexable because generateMetadata set no robots key. /analyze/[ticker]
 * already guards against exactly this with INDEXABLE_TICKERS; /compare did not.
 *
 * Reversed order is treated as curated for generation, so a shared
 * /compare/MSFT-vs-AAPL link still renders, but only the canonical order is
 * indexable, so the two orders do not compete as duplicates.
 */
export const COMPARISON_PAIRS = [
  // Original 10
  'AAPL-vs-MSFT', 'GOOGL-vs-META', 'VOO-vs-VTI', 'NVDA-vs-AMD',
  'TSLA-vs-RIVN', 'JPM-vs-GS', 'AMZN-vs-GOOGL', 'SPY-vs-QQQ',
  'NFLX-vs-DIS', 'CRM-vs-ADBE',
  // High-search additions
  'NVDA-vs-MSFT', 'AAPL-vs-GOOGL', 'AMZN-vs-MSFT', 'META-vs-GOOGL',
  'SCHD-vs-VYM', 'VOO-vs-SPY', 'VTI-vs-SPY', 'QQQ-vs-VOO',
  'NVDA-vs-AAPL', 'TSLA-vs-NVDA', 'AMD-vs-INTC', 'SOFI-vs-HOOD',
  'PLTR-vs-SNOW', 'COIN-vs-MARA', 'BA-vs-RTX', 'V-vs-MA',
  'UNH-vs-JNJ', 'XOM-vs-CVX', 'BND-vs-AGG', 'GLD-vs-SLV',
] as const;

const PAIR_SET: ReadonlySet<string> = new Set(COMPARISON_PAIRS);

/** Exact, canonical order. Only these are indexable. */
export function isCanonicalPair(ticker1: string, ticker2: string): boolean {
  return PAIR_SET.has(`${ticker1}-vs-${ticker2}`);
}

/** Either order. Only these may spend a generation on a cache miss. */
export function isCuratedPair(ticker1: string, ticker2: string): boolean {
  return isCanonicalPair(ticker1, ticker2) || isCanonicalPair(ticker2, ticker1);
}
