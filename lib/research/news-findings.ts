// Headlines as CITABLE findings.
//
// They used to reach the model as loose text inside the market-data block, with
// no id. The composer is told to cite what it uses and the grounding gate drops
// any citation that is not a retrieved finding, so the model had headlines it
// could read but could not reference: the prose came out generic while the UI
// linked articles the answer never mentioned. Minting them as findings puts
// them in the same namespace as everything else, so "PLTR is up because X" can
// carry its receipt.

import type { NewsItem } from '@/lib/financial-data';
import type { Finding } from './types';

/** Stable, short, and safe for the citation-id regex ([a-z_]+:[^\]]+). */
function newsId(ticker: string, url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i++) h = ((h * 33) ^ url.charCodeAt(i)) >>> 0;
  return `news:${ticker.toLowerCase()}-${h.toString(36).slice(0, 7)}`;
}

/**
 * Turn a ticker's headlines into findings the model can cite.
 *
 * `summary` is what the model reads, so it leads with the headline; the article
 * blurb rides along as the quote (the receipt) when the feed provides one.
 */
export function newsFindings(ticker: string, news: NewsItem[], limit = 4): Finding[] {
  const out: Finding[] = [];
  const seen = new Set<string>();
  for (const n of news) {
    if (!n.url || !n.headline) continue;
    const id = newsId(ticker, n.url);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      kind: 'news',
      ticker: ticker.toUpperCase(),
      summary: n.headline,
      quote: n.summary && n.summary !== n.headline ? n.summary.slice(0, 400) : undefined,
      source: n.source || 'News',
      url: n.url,
      date: n.datetime ? new Date(n.datetime * 1000).toISOString().slice(0, 10) : null,
      verdict: 'neutral',
    });
    if (out.length >= limit) break;
  }
  return out;
}
