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
    .replace(/[,.]/g, '')
    .replace(/\b(INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|PLC|HOLDINGS|HLDGS|CLASS [A-Z]|NV|SA|AG|SE)\b/g, '')
    .trim()
    .split(/\s+/)[0] || '';
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

  // 3. Company name in title (e.g. "Apple" → AAPL)
  if (nameMap) {
    for (const t of normalizedTickers) {
      const fullName = nameMap.get(t);
      if (!fullName) continue;
      const normalized = normalizeCompanyName(fullName);
      if (normalized && titleUpper.includes(normalized)) return t;
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
        if (normalized && descUpper.includes(normalized)) return t;
      }
    }
  }

  // 5. Fallback to Polygon's first ticker (its own relevance guess)
  return normalizedTickers[0];
}
