// lib/filing-window.ts
//
// The SEC-filing lookback window for thesis scoring, kept separate from
// score-theses.ts so it can be unit tested. That module constructs an OpenAI
// client at import time, so anything importing it needs live credentials.
// lib/filing-extract.ts exists for the same reason.

/**
 * Filings need a much wider lookback than news, and the reason is arithmetic.
 *
 * The score-theses cron runs hourly on weekdays and `sinceDate` sets the window
 * to the last scan, so each run was asking EDGAR for filings from the last few
 * hours. A company files roughly 5 business-relevant periodic reports a year,
 * so that window is empty on virtually every run while news arrives
 * continuously. The corpus ended up with 2,124 news rows against 67 filing rows
 * (28 of 1,199 distinct source documents, 2.3%), which quietly undercut
 * "grounded in filings" everywhere it was claimed.
 *
 * The `filingReserve` in score-theses.ts cannot fix this. It stops filings
 * being crowded out WITHIN a run, but cannot invent a filing on a day nobody
 * filed.
 *
 * 120 days covers a full quarter plus filing lag, so every thesis sees its most
 * recent 10-Q or 10-K.
 */
export const FILING_LOOKBACK_DAYS = 120;

/**
 * Returns whichever is EARLIER: the caller's window, or FILING_LOOKBACK_DAYS
 * ago.
 *
 * Taking the earlier one matters because the demo seed passes an explicit
 * historical `since` for backfill, and narrowing that to 120 days would
 * silently truncate it. Dates are YYYY-MM-DD, so a lexical compare is a date
 * compare.
 *
 * Re-scanning the same window on every run is safe: candidates are deduped
 * against already-recorded source_keys before any fetch or model call, so a
 * filing already on record costs nothing.
 */
export function filingSinceDate(since: string, now: Date = new Date()): string {
  const start = new Date(now);
  start.setDate(start.getDate() - FILING_LOOKBACK_DAYS);
  const windowStart = start.toISOString().split('T')[0];
  return since < windowStart ? since : windowStart;
}
