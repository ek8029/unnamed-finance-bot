/**
 * Is this symbol a real, analyzable US ticker?
 *
 * Replaces the old "is it in the curated TOP_TICKERS list" gate on the public
 * /analyze page. The list was a popularity proxy for "is it real"; this asks
 * the real question. A symbol is analyzable if either:
 *   - it has an SEC CIK (covers all SEC-registered operating companies, incl.
 *     freshly-IPO'd names like SPCX), OR
 *   - it is in the curated TOP_TICKERS set (covers pure ETFs such as SPY/QQQ
 *     that may not appear in EDGAR's company_tickers map — never regress them).
 *
 * Cheap: the EDGAR map is cached 24h in memory, so this is a Map lookup after
 * the first load. Garbage strings (no CIK, not curated) return false and never
 * reach the paid data fetch or OpenAI.
 */
import { tickerHasCik } from '@/lib/edgar';
import { TOP_TICKERS } from '@/lib/top-tickers';

const CURATED = new Set<string>(TOP_TICKERS as readonly string[]);

export async function isAnalyzableTicker(symbol: string): Promise<boolean> {
  const upper = symbol.toUpperCase().replace(/[^A-Z.]/g, '');
  if (!upper) return false;
  if (CURATED.has(upper)) return true;
  return tickerHasCik(upper);
}
