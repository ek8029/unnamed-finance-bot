/**
 * Ordering for the market intelligence feed.
 *
 * The feed used to sort by recency inside "is this about a holding". Measured
 * 2026-09-03 on a 36-ticker book: 9 of the 20 slots went to AMZN, a 1.0%
 * position, while 12 of the 36 held tickers got nothing at all. Whoever
 * published most in the last hour won the page.
 *
 * Two rules fix that, and neither needs a model:
 *   - a cap per ticker, so no single name can take the page
 *   - order by what the position is worth to this reader, not by clock
 *
 * Within one ticker, recency still decides. Across tickers, weight does.
 */

export interface RankableItem {
  /** The subject. Null for market-wide items. */
  ticker: string | null;
  /** Share of the reader's book, 0-100. Absent for anything they do not hold. */
  weight?: number | null;
  /** Higher sorts first inside a ticker. Milliseconds. */
  sortMs: number;
  /** Events are dated forward and are never crowded out by news. */
  isEvent?: boolean;
}

export interface RankOptions {
  /** How many items one ticker may occupy. */
  capPerTicker?: number;
  /** How many to return. */
  limit?: number;
}

/**
 * Rank and cap. Events keep their own lane at the top, since an earnings date
 * on a held position is a different kind of fact from a headline about it.
 *
 * Deterministic: same input, same order. No randomness, no model.
 */
export function rankFeed<T extends RankableItem>(items: T[], opts: RankOptions = {}): T[] {
  const capPerTicker = opts.capPerTicker ?? 2;
  const limit = opts.limit ?? 15;

  const events = items.filter((i) => i.isEvent).sort((a, b) => a.sortMs - b.sortMs);
  const news = items.filter((i) => !i.isEvent);

  // Group news by ticker so a cap can be applied, and so the interleave below
  // can take one item from each ticker before anyone gets a second.
  const byTicker = new Map<string, T[]>();
  for (const item of news) {
    const key = item.ticker ?? '__market__';
    const list = byTicker.get(key);
    if (list) list.push(item);
    else byTicker.set(key, [item]);
  }
  for (const list of byTicker.values()) {
    list.sort((a, b) => b.sortMs - a.sortMs);
  }

  // Heaviest position first. A ticker with no weight (not held, or market-wide)
  // sorts last but is not dropped: it is what fills a thin day.
  const weightOf = (list: T[]) => list[0]?.weight ?? -1;
  const groups = [...byTicker.entries()].sort((a, b) => {
    const d = weightOf(b[1]) - weightOf(a[1]);
    if (d !== 0) return d;
    // Ties break on recency so the order is total, never arbitrary.
    return (b[1][0]?.sortMs ?? 0) - (a[1][0]?.sortMs ?? 0);
  });

  // Round-robin: every ticker gets its first item before any gets a second.
  const ranked: T[] = [];
  for (let round = 0; round < capPerTicker; round++) {
    for (const [, list] of groups) {
      const item = list[round];
      if (item) ranked.push(item);
    }
  }

  return [...events, ...ranked].slice(0, limit);
}
