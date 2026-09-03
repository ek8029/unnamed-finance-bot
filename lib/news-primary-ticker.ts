/**
 * Detect the PRIMARY ticker for a news article.
 *
 * Polygon's `/v2/reference/news` endpoint tags articles with every ticker
 * mentioned, including tangential mentions (e.g., a Spotify article that
 * mentions Apple Music is tagged ['SPOT', 'AAPL']). Using the full tickers
 * array to match articles to a user's portfolio produces false positives
 * like "AAPL news: Is Spotify a buy?".
 *
 * This module computes the article's actual subject by scanning the title
 * (and optionally the description) for explicit ticker or company-name
 * mentions, falling back to the first ticker in the Polygon-returned array.
 */

/**
 * Strip basic boilerplate words from a company name so "Apple Inc." → "APPLE"
 * and "Alphabet Inc Class A" → "ALPHABET". Keeps the first significant word,
 * which is what news headlines typically use.
 */
function normalizeCompanyName(name: string): string {
  if (!name) return '';
  return name
    .toUpperCase()
    // Punctuation becomes a SEPARATOR, not nothing. Deleting it turned
    // "Amazon.com Inc" into AMAZONCOM, which matches no headline, so every
    // Amazon article was invisible to name matching and only got tagged by
    // the single-ticker shortcut below. Measured 2026-09-03.
    .replace(/[,.]/g, ' ')
    .replace(/\b(INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|PLC|HOLDINGS|HLDGS|CLASS [A-Z]|NV|SA|AG|SE)\b/g, '')
    .trim()
    .split(/\s+/)[0] || '';
}

/**
 * True if the article TITLE explicitly targets the ticker — cashtag,
 * parenthesized or standalone ticker word, or company name. Description
 * mentions deliberately don't count: feeds tag articles with every ticker
 * mentioned anywhere in the body, including end-of-article CTAs ("...also
 * consider NVDA"), which makes description matches unreliable as a
 * relevance signal.
 */
export function titleTargetsTicker(
  title: string,
  ticker: string,
  companyName?: string | null,
): boolean {
  const titleUpper = (title || '').toUpperCase();
  if (!titleUpper) return false;
  const escaped = ticker.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`\\$${escaped}\\b`).test(titleUpper)) return true;
  if (new RegExp(`\\(${escaped}\\)`).test(titleUpper)) return true;
  if (new RegExp(`\\b${escaped}\\b`).test(titleUpper)) return true;
  if (companyName) {
    const normalized = normalizeCompanyName(companyName);
    if (normalized) {
      const escapedName = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escapedName}\\b`).test(titleUpper)) return true;
    }
  }
  return false;
}

/**
 * True if the headline is a multi-ticker roundup ("Pre-Market Most Active:
 * SMCI, SQQQ, NVDA...") rather than an article centered on one company.
 * A headline naming 3+ of the article's tagged tickers is a list, and
 * shouldn't surface as company-specific news for any of them.
 */
export function isTickerRoundup(title: string, tickers: string[]): boolean {
  if (!tickers || tickers.length <= 2) return false;
  const titleUpper = (title || '').toUpperCase();
  let hits = 0;
  for (const t of new Set(tickers.map((x) => x.toUpperCase()))) {
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`).test(titleUpper)) {
      hits++;
      if (hits >= 3) return true;
    }
  }
  return false;
}

/**
 * Detect the primary (subject) ticker for a news article.
 *
 * Strategy, highest confidence first:
 *   1. `$TICKER` or `(TICKER)` cashtag in the title — explicit author signal
 *   2. Standalone ticker word in the title — e.g. "NVDA beats estimates"
 *   3. Company name in the title — e.g. "Apple" → AAPL
 *   4. Same checks against the description as a softer fallback
 *   5. `tickers[0]` — Polygon's own "most relevant" best guess
 *   6. `null` if the article has no tickers at all
 *
 * @param title Article headline
 * @param description Article summary/body (optional, improves accuracy)
 * @param tickers The full array Polygon returned for this article
 * @param nameMap Optional ticker → company-name map (from the securities table).
 *                Used for company-name matching. Only names for tickers that
 *                are actually in `tickers` matter.
 */
export function detectPrimaryTicker(
  title: string,
  description: string | null | undefined,
  tickers: string[],
  nameMap?: Map<string, string>,
): string | null {
  if (!tickers || tickers.length === 0) return null;
  if (tickers.length === 1) return tickers[0]; // unambiguous

  const normalizedTickers = tickers.map((t) => t.toUpperCase());
  const titleUpper = (title || '').toUpperCase();
  const descUpper = (description || '').toUpperCase();

  // 1. Cashtag ($AAPL) or parenthesized ticker (AAPL) in title
  for (const t of normalizedTickers) {
    // Use a new RegExp each iteration — ticker may contain dots (BRK.B) etc.
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\$${escaped}\\b`).test(titleUpper)) return t;
    if (new RegExp(`\\(${escaped}\\)`).test(titleUpper)) return t;
  }

  // 2. Standalone ticker word in title (e.g. "NVDA beats estimates")
  for (const t of normalizedTickers) {
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`).test(titleUpper)) return t;
  }

  // 3. Company name in title (e.g. "Apple" → AAPL). Uses word-boundary
  // regex to prevent short prefixes like "CORE" matching inside "COREWEAVE".
  if (nameMap) {
    for (const t of normalizedTickers) {
      const fullName = nameMap.get(t);
      if (!fullName) continue;
      const normalized = normalizeCompanyName(fullName);
      if (!normalized) continue;
      const escapedName = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escapedName}\\b`).test(titleUpper)) return t;
    }
  }

  // 4. Same checks against description (lower confidence)
  if (descUpper) {
    for (const t of normalizedTickers) {
      const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\$${escaped}\\b`).test(descUpper)) return t;
    }
    if (nameMap) {
      for (const t of normalizedTickers) {
        const fullName = nameMap.get(t);
        if (!fullName) continue;
        const normalized = normalizeCompanyName(fullName);
        if (!normalized) continue;
        const escapedName = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`\\b${escapedName}\\b`).test(descUpper)) return t;
      }
    }
  }

  // 5. No confident match — return null rather than guessing.
  // Polygon/Finnhub tag articles with tangentially mentioned tickers
  // (sidebar links, related articles, ads). Guessing tickers[0] causes
  // misattribution (e.g., Costco article tagged as NVDA news).
  return null;
}
