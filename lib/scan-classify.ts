// What kind of thing did the person type into the scan box? Pure functions,
// no I/O, so the onboarding's first decision is testable without EDGAR.
//
// Ninety days of off-house scans said the "no thesis yet" dead end was four
// different situations wearing one card: company names and typos typed as
// tickers (APPL, HEICO, MICRON), things that never file with the SEC (XAUUSD,
// EURUSD, ES, ETH), funds (VOO, GLD), and a minority of real US equities Helm
// had simply not written up (TTWO, CRM). Each gets its own honest answer.

export interface CompanyEntry {
  ticker: string;
  title: string;
}

export type ScanKind = 'house' | 'filer' | 'suggest' | 'unreadable' | 'unknown';

function normalizeTitle(title: string): string {
  return title.toUpperCase().replace(/[^A-Z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Rank EDGAR's company list against what was typed. Exact ticker, then ticker
 * prefix, then title prefix, then a word in the title; two-character queries
 * only ever match tickers (too many titles start with "AM"). Duplicate titles
 * (share classes) collapse to their best-scoring ticker. No match returns
 * nothing: never the alphabetically nearest company.
 */
export function rankCompanyMatches(query: string, entries: CompanyEntry[], limit: number): CompanyEntry[] {
  const q = query.trim().toUpperCase();
  if (q.length === 0) return [];
  const scored: { entry: CompanyEntry; score: number }[] = [];
  for (const entry of entries) {
    const t = entry.ticker.toUpperCase();
    let score = 0;
    if (t === q) score = 100;
    else if (q.length >= 2 && t.startsWith(q)) score = 80 - (t.length - q.length);
    else if (q.length >= 3) {
      const title = normalizeTitle(entry.title);
      if (title.startsWith(q)) score = 60 - Math.min(19, Math.floor(title.length / 4));
      else if (title.split(' ').some((w) => w.startsWith(q))) score = 40 - Math.min(19, Math.floor(title.length / 4));
    }
    if (score > 0) scored.push({ entry, score });
  }
  scored.sort((a, b) => b.score - a.score || a.entry.ticker.length - b.entry.ticker.length);
  const seenTitles = new Set<string>();
  const out: CompanyEntry[] = [];
  for (const { entry } of scored) {
    const key = normalizeTitle(entry.title);
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}

export function classifyScanSymbol(input: {
  house: boolean;
  filer: boolean;
  suggestions: CompanyEntry[];
  /** false when the EDGAR list could not be loaded, so filer/suggestions mean nothing. */
  known?: boolean;
}): { kind: ScanKind } {
  if (input.house) return { kind: 'house' };
  if (input.known === false) return { kind: 'unknown' };
  if (input.filer) return { kind: 'filer' };
  if (input.suggestions.length > 0) return { kind: 'suggest' };
  return { kind: 'unreadable' };
}
