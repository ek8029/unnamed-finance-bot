/**
 * Earnings dates derived from SEC EDGAR filings.
 *
 * An 8-K with item 2.02 ("Results of Operations and Financial Condition") IS
 * the earnings release. EDGAR is public domain, so deriving earnings dates from
 * it carries no licensing or redistribution restrictions, unlike third-party
 * earnings calendar APIs.
 */

import { getRecentFilings, BUSINESS_FORMS } from '@/lib/edgar';

export interface EdgarEarnings {
  lastReportDate: string | null;    // YYYY-MM-DD, most recent 8-K item 2.02
  nextEstimatedDate: string | null; // lastReportDate + ~91d, only if in the future
}

/**
 * Most recent earnings release date for a ticker, plus a rough estimate of the
 * next one (~one quarter out). Estimate is null unless it falls in the future.
 */
export async function getEdgarEarnings(ticker: string): Promise<EdgarEarnings> {
  try {
    // Business forms only, deep-scanned — without this, frequent issuers
    // (JPM's ~22k 424B2/FWP) crowd the 8-K/10-Q out of the first 100 filings
    // and the earnings calendar silently shows nothing for them.
    const filings = await getRecentFilings(ticker, undefined, BUSINESS_FORMS);
    const releases = filings
      .filter((f) => f.form === '8-K' && f.items.includes('2.02'))
      .sort((a, b) => (a.filingDate < b.filingDate ? 1 : -1));

    const lastReportDate = releases[0]?.filingDate ?? null;
    if (!lastReportDate) {
      return { lastReportDate: null, nextEstimatedDate: null };
    }

    // Quarters run ~91 days. Add to the last report date for a coarse estimate.
    const next = new Date(lastReportDate + 'T00:00:00Z');
    next.setUTCDate(next.getUTCDate() + 91);
    const nextStr = next.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const nextEstimatedDate = nextStr > today ? nextStr : null;

    return { lastReportDate, nextEstimatedDate };
  } catch {
    return { lastReportDate: null, nextEstimatedDate: null };
  }
}
