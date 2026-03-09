/**
 * Polygon.io Market Data Client
 *
 * Lightweight client using fetch to call Polygon REST API v2.
 * Used for fetching real-time prices and market news for user holdings.
 */

const POLYGON_BASE_URL = 'https://api.polygon.io';
const BATCH_SIZE = 5; // Max parallel requests per batch (respect rate limits)

function getApiKey(): string {
  const key = process.env.POLYGON_API_KEY;
  if (!key) {
    throw new Error('POLYGON_API_KEY environment variable is not set');
  }
  return key;
}

// ----- Types -----

export interface PolygonPrice {
  ticker: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  date: string; // YYYY-MM-DD
}

export interface PolygonNewsArticle {
  title: string;
  description: string;
  article_url: string;
  image_url: string | null;
  published_utc: string;
  author: string | null;
  source: { name: string } | null;
  tickers: string[];
  keywords: string[];
}

// ----- Price Functions -----

/**
 * Fetch the latest daily close price for a single ticker.
 * Uses the /v2/aggs/ticker/{ticker}/prev endpoint (previous day's OHLCV).
 * Returns null if the request fails or no data is available.
 */
export async function getLatestPrice(
  ticker: string
): Promise<PolygonPrice | null> {
  try {
    const apiKey = getApiKey();
    const url = `${POLYGON_BASE_URL}/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev?adjusted=true&apiKey=${apiKey}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      // No caching — we always want fresh prices
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(
        `Polygon API error for ${ticker}: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      console.warn(`No price data returned for ${ticker}`);
      return null;
    }

    const result = data.results[0];

    // Convert the Unix ms timestamp to a date string
    const date = new Date(result.t).toISOString().split('T')[0];

    return {
      ticker: data.ticker || ticker,
      close: result.c,
      open: result.o,
      high: result.h,
      low: result.l,
      volume: result.v,
      date,
    };
  } catch (error) {
    console.error(`Failed to fetch price for ${ticker}:`, error);
    return null;
  }
}

/**
 * Fetch prices for multiple tickers in parallel batches.
 * Processes BATCH_SIZE tickers at a time to respect Polygon rate limits.
 * Returns a map of ticker -> PolygonPrice (only includes successful fetches).
 */
export async function getBatchPrices(
  tickers: string[]
): Promise<Map<string, PolygonPrice>> {
  const results = new Map<string, PolygonPrice>();

  // Deduplicate tickers
  const uniqueTickers = [...new Set(tickers.map(t => t.toUpperCase()))];

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < uniqueTickers.length; i += BATCH_SIZE) {
    const batch = uniqueTickers.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(ticker => getLatestPrice(ticker))
    );

    for (let j = 0; j < batch.length; j++) {
      const result = batchResults[j];
      if (result.status === 'fulfilled' && result.value) {
        results.set(batch[j], result.value);
      }
    }

    // Small delay between batches to be respectful of rate limits
    if (i + BATCH_SIZE < uniqueTickers.length) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  return results;
}

// ----- News Functions -----

/**
 * Fetch news articles from Polygon filtered by tickers.
 * Uses the /v2/reference/news endpoint.
 * Returns an array of articles, or an empty array on failure.
 */
export async function getTickerNews(
  tickers: string[],
  limit: number = 20
): Promise<PolygonNewsArticle[]> {
  try {
    const apiKey = getApiKey();

    // Polygon accepts a comma-separated list of tickers for the ticker.any_of param
    const tickerList = [...new Set(tickers.map(t => t.toUpperCase()))].join(',');

    const params = new URLSearchParams({
      'ticker.any_of': tickerList,
      limit: String(Math.min(limit, 50)), // Polygon max is 50 per request
      order: 'desc',
      sort: 'published_utc',
      apiKey,
    });

    const url = `${POLYGON_BASE_URL}/v2/reference/news?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(
        `Polygon news API error: ${response.status} ${response.statusText}`
      );
      return [];
    }

    const data = await response.json();

    if (!data.results || !Array.isArray(data.results)) {
      console.warn('No news results returned from Polygon');
      return [];
    }

    return data.results.map((article: Record<string, unknown>) => ({
      title: article.title || '',
      description: article.description || '',
      article_url: article.article_url || '',
      image_url: article.image_url || null,
      published_utc: article.published_utc || '',
      author: article.author || null,
      source: article.publisher || null,
      tickers: Array.isArray(article.tickers) ? article.tickers : [],
      keywords: Array.isArray(article.keywords) ? article.keywords : [],
    }));
  } catch (error) {
    console.error('Failed to fetch ticker news:', error);
    return [];
  }
}
