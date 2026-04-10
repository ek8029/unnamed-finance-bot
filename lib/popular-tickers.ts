/**
 * Top tickers by US market cap + retail interest, refreshed on a cron.
 *
 * These tickers are guaranteed to have a fresh AI analysis in the
 * analysis_cache table, refreshed every hour during US market hours and
 * every 4 hours off-hours by /api/cron/refresh-tickers.
 *
 * Long-tail tickers (anything not in this list) refresh on-demand the
 * next time a user visits, with a 4-hour TTL fallback in lib/analyze-stock.ts.
 *
 * To add or remove tickers, edit this list directly. The cron will pick up
 * the new list on its next run.
 *
 * Cost note: refreshing 50 tickers ~13×/day (during market hours) plus 6×/day
 * (off-hours) is ~950 OpenAI GPT-4o-mini calls/day = ~$8/month at current
 * pricing. Adding more tickers scales linearly.
 */

export const POPULAR_TICKERS: readonly string[] = [
  // Mega-cap tech (most-viewed retail tickers)
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'GOOG', 'AMZN', 'META', 'TSLA',
  'AVGO', 'ORCL',

  // Mega-cap finance + healthcare
  'BRK.B', 'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'MS',
  'UNH', 'JNJ', 'LLY', 'ABBV', 'MRK', 'PFE',

  // Mega-cap consumer + industrial
  'WMT', 'COST', 'PG', 'KO', 'PEP', 'HD', 'MCD', 'NKE',
  'XOM', 'CVX',

  // High-retail-interest tech / EV / crypto-adjacent
  'AMD', 'NFLX', 'DIS', 'CRM', 'ADBE', 'PYPL', 'COIN',
  'PLTR', 'SOFI', 'HOOD', 'RIVN', 'LCID',

  // Major ETFs (highest retail volume)
  'SPY', 'QQQ', 'VOO', 'IWM', 'VTI',
];

/** Set lookup for fast "is this ticker tier-1" checks. */
export const POPULAR_TICKERS_SET = new Set<string>(POPULAR_TICKERS);

/** Convenience: is the given ticker in the popular list? */
export function isPopularTicker(ticker: string): boolean {
  return POPULAR_TICKERS_SET.has(ticker.toUpperCase());
}
