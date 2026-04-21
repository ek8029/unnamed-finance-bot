/**
 * Finnhub Company News Client
 *
 * Second news source alongside Polygon. Uses the Finnhub /company-news
 * endpoint to fetch per-ticker news articles.
 *
 * Rate limit strategy: Finnhub free tier allows 60 calls/min.
 * We process 5 tickers at a time with a 200ms delay between each call
 * to stay comfortably under the limit (~15 calls every 3 seconds).
 */

import { scoreSentiment, type PolygonNewsArticle } from '@/lib/polygon';
import { detectPrimaryTicker } from '@/lib/news-primary-ticker';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

/** Max tickers to process per batch before pausing */
const BATCH_SIZE = 5;

/** Delay between individual Finnhub calls (ms) */
const CALL_DELAY_MS = 200;

function getApiKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error('FINNHUB_API_KEY environment variable is not set');
  return key;
}

interface FinnhubNewsResponse {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

/**
 * Fetch company news from Finnhub for a list of tickers.
 * Returns articles mapped to the same shape as Polygon articles
 * (PolygonNewsArticle) so they can be inserted into market_news uniformly.
 *
 * Fetches the last 3 days of news for each ticker.
 */
export async function fetchFinnhubNews(
  tickers: string[],
): Promise<PolygonNewsArticle[]> {
  const apiKey = getApiKey();
  const articles: PolygonNewsArticle[] = [];

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
  const to = now.toISOString().split('T')[0];
  const from = threeDaysAgo.toISOString().split('T')[0];

  // Deduplicate tickers
  const unique = [...new Set(tickers.map(t => t.toUpperCase()))];

  // Filter out crypto tickers (Finnhub company-news doesn't cover them)
  const stockTickers = unique.filter(t => !t.includes('-USD'));

  for (let i = 0; i < stockTickers.length; i++) {
    const ticker = stockTickers[i];

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const url = `${FINNHUB_BASE}/company-news?symbol=${encodeURIComponent(ticker)}&from=${from}&to=${to}&token=${apiKey}`;

      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited — back off and skip remaining in this batch
          console.warn(`[finnhub-news] Rate limited at ticker ${ticker}, backing off`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        console.warn(`[finnhub-news] Error for ${ticker}: ${response.status}`);
        continue;
      }

      const data: FinnhubNewsResponse[] = await response.json();
      if (!Array.isArray(data)) continue;

      // Take at most 10 articles per ticker to avoid flooding
      for (const item of data.slice(0, 10)) {
        if (!item.url || !item.headline) continue;

        articles.push({
          title: item.headline,
          description: item.summary || '',
          article_url: item.url,
          image_url: item.image || null,
          published_utc: new Date(item.datetime * 1000).toISOString(),
          author: null,
          source: item.source ? { name: item.source } : null,
          // Finnhub `related` field is a comma-separated ticker list
          tickers: item.related
            ? item.related.split(',').map(t => t.trim()).filter(Boolean)
            : [ticker],
          keywords: item.category ? [item.category] : [],
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.error(`[finnhub-news] Request timed out: ${ticker}`);
      } else {
        console.error(`[finnhub-news] Failed for ${ticker}:`, err);
      }
    }

    // Rate limit delay between calls
    if (i < stockTickers.length - 1) {
      await new Promise(resolve => setTimeout(resolve, CALL_DELAY_MS));
    }

    // Extra pause between batches of BATCH_SIZE
    if ((i + 1) % BATCH_SIZE === 0 && i < stockTickers.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return articles;
}

/**
 * Fetch Finnhub news for specific tickers and insert new articles
 * into market_news, deduplicating by URL against existing articles.
 *
 * Used by both the daily cron and the on-demand background refresh.
 */
export async function refreshFinnhubNews(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tickers: string[],
  log: string[],
): Promise<number> {
  if (!process.env.FINNHUB_API_KEY) {
    log.push('[finnhub-news] FINNHUB_API_KEY not set — skipping');
    return 0;
  }

  if (tickers.length === 0) {
    log.push('[finnhub-news] No tickers provided');
    return 0;
  }

  try {
    const articles = await fetchFinnhubNews(tickers);
    if (articles.length === 0) {
      log.push('[finnhub-news] No articles from Finnhub');
      return 0;
    }

    // Deduplicate against existing articles by URL
    const urls = articles.map(a => a.article_url).filter(Boolean);
    const { data: existing } = await supabase
      .from('market_news')
      .select('url')
      .in('url', urls);

    const existingUrls = new Set(
      (existing || []).map((a: { url: string }) => a.url),
    );
    const newArticles = articles.filter(
      a => a.article_url && !existingUrls.has(a.article_url),
    );

    if (newArticles.length === 0) {
      log.push(`[finnhub-news] All ${articles.length} articles already exist`);
      return 0;
    }

    // Build ticker → security name map for primary ticker detection
    const allTickers = [
      ...new Set(newArticles.flatMap(a => a.tickers)),
    ];
    const tickerNameMap = new Map<string, string>();
    const tickerSectorMap = new Map<string, string>();

    if (allTickers.length > 0) {
      const { data: securities } = await supabase
        .from('securities')
        .select('ticker, security_name, sector')
        .in('ticker', allTickers);

      for (const s of (securities || []) as { ticker: string; security_name: string | null; sector: string | null }[]) {
        const upper = s.ticker?.toUpperCase();
        if (!upper) continue;
        if (s.security_name) tickerNameMap.set(upper, s.security_name);
        if (s.sector) tickerSectorMap.set(upper, s.sector);
      }
    }

    const inserts = newArticles.map(article => {
      const sentiment = scoreSentiment(`${article.title} ${article.description}`);
      const sectors = [
        ...new Set(
          article.tickers
            .map(t => tickerSectorMap.get(t.toUpperCase()))
            .filter(Boolean),
        ),
      ];
      const primaryTicker = detectPrimaryTicker(
        article.title,
        article.description,
        article.tickers,
        tickerNameMap,
      );

      return {
        title: article.title,
        summary: article.description || null,
        content: null,
        url: article.article_url,
        image_url: article.image_url || null,
        source: article.source?.name || null,
        author: article.author || null,
        published_at: article.published_utc || new Date().toISOString(),
        tickers: article.tickers,
        primary_ticker: primaryTicker,
        sectors: sectors.length > 0 ? sectors : null,
        sentiment,
      };
    });

    const { error } = await supabase.from('market_news').insert(inserts);
    if (error) {
      log.push(`[finnhub-news] Insert failed: ${error.message}`);
      return 0;
    }

    const skipped = articles.length - newArticles.length;
    log.push(
      `[finnhub-news] Inserted ${newArticles.length} new articles (${skipped} duplicates skipped)`,
    );
    return newArticles.length;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.push(`[finnhub-news] Error: ${msg}`);
    console.error('[finnhub-news] refreshFinnhubNews failed:', error);
    return 0;
  }
}
