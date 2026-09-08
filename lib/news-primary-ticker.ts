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
 * mentions. A provider tag alone does not establish the subject.
 */

/**
 * Strip basic boilerplate words from a company name so "Apple Inc." → "APPLE"
 * and "Alphabet Inc Class A" → "ALPHABET". Distinctive first words and known
 * company/brand aliases are considered separately below.
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
    .replace(/\s+/g, ' ')
    .trim();
}

// These tickers also occur as ordinary words in financial headlines. Even an
// uppercase RSS headline is not evidence that it refers to the listed company.
const COMMON_WORD_TICKERS = new Set(['ALL', 'ON', 'IT', 'KEY', 'CAR', 'A', 'AI', 'ARE', 'FOR', 'OUT', 'NOW', 'OPEN', 'REAL', 'LOVE', 'LIFE', 'FAST', 'GOOD', 'NICE', 'SAFE', 'CASH', 'SAVE', 'PLAY', 'TASK', 'TEAM', 'HOME', 'HOPE', 'NEXT', 'BEST', 'TRUE', 'WELL']);
const GENERIC_NAME_WORDS = new Set(['THE', 'ELI', 'INTERNATIONAL', 'UNITED', 'FIRST', 'GENERAL', 'GLOBAL', 'AMERICAN', 'NATIONAL', 'ADVANCED', 'TAIWAN', 'NEW', 'TRADE', 'DIGITAL', 'ENERGY', 'FINANCIAL', 'HEALTH', 'CAPITAL', 'PUBLIC', 'STANDARD', 'CORE']);
const COMPANY_ALIASES: Record<string, readonly string[]> = {
  GOOGL: ['Alphabet', 'Google'], GOOG: ['Alphabet', 'Google'],
  LLY: ['Eli Lilly', 'Lilly'], TSM: ['Taiwan Semiconductor', 'TSMC'],
  META: ['Meta', 'Facebook', 'Instagram'], AMZN: ['Amazon', 'AWS', 'Amazon Web Services'],
  NVDA: ['Nvidia'], AAPL: ['Apple'],
  ON: ['onsemi', 'ON Semiconductor'], ALL: ['Allstate'], IT: ['Gartner'],
  KEY: ['KeyCorp'], CAR: ['Avis Budget', 'Avis'], A: ['Agilent'], AI: ['C3.ai', 'C3 AI'],
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function companyAliases(ticker: string, companyName?: string | null): string[] {
  const aliases = [...(COMPANY_ALIASES[ticker] ?? [])];
  const name = normalizeCompanyName(companyName ?? '');
  // A missing company name often comes back as just its ticker. That must not
  // accidentally defeat the ordinary-word/short-symbol protection below.
  if (name && !(name === ticker && (ticker.length <= 3 || COMMON_WORD_TICKERS.has(ticker)))) {
    aliases.push(name);
    const first = name.split(' ')[0];
    if (first.length >= 4 && !GENERIC_NAME_WORDS.has(first) && !COMMON_WORD_TICKERS.has(first)) aliases.push(first);
  }
  return aliases;
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
  const symbol = ticker.trim().toUpperCase();
  if (!symbol) return false;
  const escaped = escapeRegex(symbol);
  if (new RegExp(`\\$${escaped}\\b`).test(titleUpper)) return true;
  if (new RegExp(`\\(${escaped}\\)`).test(titleUpper)) return true;
  if (symbol.length >= 4 && !COMMON_WORD_TICKERS.has(symbol) && new RegExp(`\\b${escaped}\\b`).test(titleUpper)) return true;
  return companyAliases(symbol, companyName).some(alias => new RegExp(`\\b${escapeRegex(alias.toUpperCase())}\\b`).test(titleUpper));
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
 *   4. Description evidence as a softer candidate signal (including one tag)
 *   5. `null` when the subject cannot be established
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
  const normalizedTickers = tickers.map((t) => t.toUpperCase());
  const titleUpper = (title || '').toUpperCase();
  // Summaries are a candidate signal for the classifier, never proof for the
  // portfolio readers. Strip common related-story/promotion footers first.
  const descriptionText = (description || '').split(/\b(?:also consider|read more|related (?:stories|articles)|most read from)\b/i)[0];

  // 1. Cashtag ($AAPL) or parenthesized ticker (AAPL) in title
  for (const t of normalizedTickers) {
    // Use a new RegExp each iteration — ticker may contain dots (BRK.B) etc.
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\$${escaped}\\b`).test(titleUpper)) return t;
    if (new RegExp(`\\(${escaped}\\)`).test(titleUpper)) return t;
  }

  // 2. Headline ticker/company/brand evidence, with the same short-symbol and
  // common-word safeguards used by every reader.
  for (const t of normalizedTickers) {
    if (titleTargetsTicker(title, t, nameMap?.get(t))) return t;
  }
  for (const t of normalizedTickers) {
    if (titleTargetsTicker(descriptionText, t, nameMap?.get(t))) return t;
  }

  // 5. No confident match — return null rather than guessing.
  // Polygon/Finnhub tag articles with tangentially mentioned tickers
  // (sidebar links, related articles, ads). Guessing tickers[0] causes
  // misattribution (e.g., Costco article tagged as NVDA news).
  return null;
}
