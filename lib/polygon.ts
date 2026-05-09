/**
 * Polygon.io Market Data Client
 *
 * Lightweight client using fetch to call Polygon REST API v2/v3.
 * Powers: prices, news, ticker details, dividends, splits, and sentiment.
 */

import { POLYGON_BATCH_SIZE, POLYGON_BATCH_DELAY_MS, POLYGON_CALL_DELAY_MS } from '@/lib/financial-config';

const POLYGON_BASE_URL = 'https://api.polygon.io';

function getApiKey(): string {
  const key = process.env.POLYGON_API_KEY;
  if (!key) {
    throw new Error('POLYGON_API_KEY environment variable is not set');
  }
  return key;
}

// ----- Ticker Normalization -----

/**
 * Convert app-format tickers to Polygon-format tickers.
 * Crypto tickers like "BTC-USD" become "X:BTCUSD" on Polygon.
 */
export function toPolygonTicker(ticker: string): string {
  if (ticker.toUpperCase().includes('-USD')) {
    return 'X:' + ticker.toUpperCase().replace('-', '');
  }
  return ticker.toUpperCase();
}

/**
 * Convert a Polygon-format ticker back to the app-format ticker.
 */
export function fromPolygonTicker(polygonTicker: string, originalTicker: string): string {
  return originalTicker;
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

export interface TickerDetails {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  primary_exchange: string | null;
  type: string | null;
  currency_name: string | null;
  market_cap: number | null;
  description: string | null;
  sic_code: string | null;
  sic_description: string | null;
  homepage_url: string | null;
  total_employees: number | null;
  list_date: string | null;
  logo_url: string | null;
  icon_url: string | null;
}

export interface PolygonDividend {
  ticker: string;
  cash_amount: number;
  currency: string;
  declaration_date: string | null;
  ex_dividend_date: string;
  frequency: number; // 1=annual, 2=bi-annual, 4=quarterly, 12=monthly
  pay_date: string | null;
  record_date: string | null;
  dividend_type: string;
}

export interface PolygonSplit {
  ticker: string;
  execution_date: string;
  split_from: number;
  split_to: number;
}

// ----- Historical Price Function -----

/**
 * Fetch daily OHLCV bars for a ticker over a date range.
 * Uses /v2/aggs/ticker/{ticker}/range/1/day/{from}/{to}
 * Polygon free tier: 5 calls/min, up to 2 years of history.
 */
export async function getHistoricalPrices(
  ticker: string,
  from: string,
  to: string,
): Promise<{ date: string; close: number }[]> {
  try {
    const apiKey = getApiKey();
    const polygonTicker = toPolygonTicker(ticker);
    const url = `${POLYGON_BASE_URL}/v2/aggs/ticker/${encodeURIComponent(polygonTicker)}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=5000&apiKey=${apiKey}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (!data.results || data.results.length === 0) return [];

    return data.results.map((r: { t: number; c: number }) => ({
      date: new Date(r.t).toISOString().split('T')[0],
      close: r.c,
    }));
  } catch {
    return [];
  }
}

// ----- Price Functions -----

/**
 * Fetch the latest daily close price for a single ticker.
 * Uses the /v2/aggs/ticker/{ticker}/prev endpoint (previous day's OHLCV).
 */
export async function getLatestPrice(ticker: string): Promise<PolygonPrice | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const apiKey = getApiKey();
    const polygonTicker = toPolygonTicker(ticker);
    const url = `${POLYGON_BASE_URL}/v2/aggs/ticker/${encodeURIComponent(polygonTicker)}/prev?adjusted=true&apiKey=${apiKey}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`Polygon API error for ${ticker}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      console.warn(`No price data returned for ${ticker}`);
      return null;
    }

    const result = data.results[0];
    const date = new Date(result.t).toISOString().split('T')[0];

    return {
      ticker,
      close: result.c,
      open: result.o,
      high: result.h,
      low: result.l,
      volume: result.v,
      date,
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      console.error(`[polygon] Request timed out: ${ticker}`);
      return null;
    }
    console.error(`Failed to fetch price for ${ticker}:`, err);
    return null;
  }
}

/**
 * Fetch prices for multiple tickers in parallel batches.
 */
export async function getBatchPrices(tickers: string[]): Promise<Map<string, PolygonPrice>> {
  const results = new Map<string, PolygonPrice>();

  const seen = new Set<string>();
  const uniqueTickers: string[] = [];
  for (const t of tickers) {
    if (!t) continue;
    const upper = t.toUpperCase();
    if (!seen.has(upper)) {
      seen.add(upper);
      uniqueTickers.push(upper);
    }
  }

  for (let i = 0; i < uniqueTickers.length; i += POLYGON_BATCH_SIZE) {
    const batch = uniqueTickers.slice(i, i + POLYGON_BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(ticker => getLatestPrice(ticker))
    );

    for (let j = 0; j < batch.length; j++) {
      const result = batchResults[j];
      if (result.status === 'fulfilled' && result.value) {
        results.set(batch[j], result.value);
      }
    }

    if (i + POLYGON_BATCH_SIZE < uniqueTickers.length) {
      await new Promise(resolve => setTimeout(resolve, POLYGON_BATCH_DELAY_MS));
    }
  }

  return results;
}

// ----- Ticker Details -----

/**
 * Fetch company/security details from Polygon.
 * Returns sector, industry, market cap, description, logo, etc.
 * Uses /v3/reference/tickers/{ticker}
 */
export async function getTickerDetails(ticker: string): Promise<TickerDetails | null> {
  if (ticker.toUpperCase().includes('-USD')) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const apiKey = getApiKey();

    const url = `${POLYGON_BASE_URL}/v3/reference/tickers/${encodeURIComponent(ticker.toUpperCase())}?apiKey=${apiKey}`;

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status !== 404) {
        console.warn(`Polygon ticker details error for ${ticker}: ${response.status}`);
      }
      return null;
    }

    const data = await response.json();
    const r = data.results;
    if (!r) return null;

    return {
      ticker: r.ticker,
      name: r.name || ticker,
      market: r.market || 'stocks',
      locale: r.locale || 'us',
      primary_exchange: r.primary_exchange || null,
      type: r.type || null,
      currency_name: r.currency_name || null,
      market_cap: r.market_cap || null,
      description: r.description || null,
      sic_code: r.sic_code || null,
      sic_description: r.sic_description || null,
      homepage_url: r.homepage_url || null,
      total_employees: r.total_employees || null,
      list_date: r.list_date || null,
      logo_url: r.branding?.logo_url ? `${r.branding.logo_url}?apiKey=${apiKey}` : null,
      icon_url: r.branding?.icon_url ? `${r.branding.icon_url}?apiKey=${apiKey}` : null,
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      console.error(`[polygon] Request timed out: ${ticker}`);
      return null;
    }
    console.error(`Failed to fetch ticker details for ${ticker}:`, err);
    return null;
  }
}

/**
 * Fetch details for multiple tickers. Only fetches for tickers that need enrichment.
 * Rate-limited with delays between batches.
 */
export async function getBatchTickerDetails(
  tickers: string[]
): Promise<Map<string, TickerDetails>> {
  const results = new Map<string, TickerDetails>();

  const filtered = tickers.filter(t => t && !t.toUpperCase().includes('-USD'));
  const unique = [...new Set(filtered.map(t => t.toUpperCase()))];

  // Process one at a time with delays (free tier rate limit)
  for (let i = 0; i < unique.length; i++) {
    const details = await getTickerDetails(unique[i]);
    if (details) {
      results.set(unique[i], details);
    }

    // Delay between calls to stay under rate limit
    if (i < unique.length - 1) {
      await new Promise(resolve => setTimeout(resolve, POLYGON_CALL_DELAY_MS));
    }
  }

  return results;
}

// ----- Dividends -----

/**
 * Fetch upcoming dividends for given tickers.
 * Uses /v3/reference/dividends with ex_dividend_date filter.
 */
export async function getUpcomingDividends(
  tickers: string[],
  lookAheadDays: number = 90,
): Promise<PolygonDividend[]> {
  try {
    const apiKey = getApiKey();
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date(Date.now() + lookAheadDays * 86400000)
      .toISOString()
      .split('T')[0];

    // Filter out crypto tickers (no dividends)
    const stockTickers = tickers.filter(t => t && !t.toUpperCase().includes('-USD'));
    if (stockTickers.length === 0) return [];

    const allDividends: PolygonDividend[] = [];

    // Polygon v3 dividends supports ticker query param (one at a time on free tier)
    for (const ticker of stockTickers) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const params = new URLSearchParams({
          ticker: ticker.toUpperCase(),
          'ex_dividend_date.gte': today,
          'ex_dividend_date.lte': futureDate,
          limit: '10',
          order: 'asc',
          sort: 'ex_dividend_date',
          apiKey,
        });

        const response = await fetch(
          `${POLYGON_BASE_URL}/v3/reference/dividends?${params}`,
          { headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller.signal },
        );
        clearTimeout(timeout);

        if (!response.ok) continue;

        const data = await response.json();
        for (const d of data.results || []) {
          allDividends.push({
            ticker: d.ticker,
            cash_amount: d.cash_amount,
            currency: d.currency || 'USD',
            declaration_date: d.declaration_date || null,
            ex_dividend_date: d.ex_dividend_date,
            frequency: d.frequency || 0,
            pay_date: d.pay_date || null,
            record_date: d.record_date || null,
            dividend_type: d.dividend_type || 'CD',
          });
        }

        await new Promise(resolve => setTimeout(resolve, POLYGON_CALL_DELAY_MS));
      } catch (err) {
        clearTimeout(timeout);
        if (err instanceof Error && err.name === 'AbortError') {
          console.error(`[polygon] Dividend request timed out: ${ticker}`);
        }
      }
    }

    return allDividends;
  } catch (error) {
    console.error('Failed to fetch dividends:', error);
    return [];
  }
}

// ----- Splits -----

/**
 * Fetch recent and upcoming stock splits.
 * Uses /v3/reference/splits with execution_date filter.
 */
export async function getRecentSplits(
  tickers: string[],
  lookAroundDays: number = 90,
): Promise<PolygonSplit[]> {
  try {
    const apiKey = getApiKey();
    const pastDate = new Date(Date.now() - lookAroundDays * 86400000)
      .toISOString()
      .split('T')[0];
    const futureDate = new Date(Date.now() + lookAroundDays * 86400000)
      .toISOString()
      .split('T')[0];

    const stockTickers = tickers.filter(t => t && !t.toUpperCase().includes('-USD'));
    if (stockTickers.length === 0) return [];

    const allSplits: PolygonSplit[] = [];

    for (const ticker of stockTickers) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const params = new URLSearchParams({
          ticker: ticker.toUpperCase(),
          'execution_date.gte': pastDate,
          'execution_date.lte': futureDate,
          limit: '10',
          order: 'asc',
          sort: 'execution_date',
          apiKey,
        });

        const response = await fetch(
          `${POLYGON_BASE_URL}/v3/reference/splits?${params}`,
          { headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller.signal },
        );
        clearTimeout(timeout);

        if (!response.ok) continue;

        const data = await response.json();
        for (const s of data.results || []) {
          allSplits.push({
            ticker: s.ticker,
            execution_date: s.execution_date,
            split_from: s.split_from,
            split_to: s.split_to,
          });
        }

        await new Promise(resolve => setTimeout(resolve, POLYGON_CALL_DELAY_MS));
      } catch (err) {
        clearTimeout(timeout);
        if (err instanceof Error && err.name === 'AbortError') {
          console.error(`[polygon] Splits request timed out: ${ticker}`);
        }
      }
    }

    return allSplits;
  } catch (error) {
    console.error('Failed to fetch splits:', error);
    return [];
  }
}

// ----- News Functions -----

/**
 * Fetch news articles from Polygon filtered by tickers.
 * Uses the /v2/reference/news endpoint.
 */
export async function getTickerNews(
  tickers: string[],
  limit: number = 20,
): Promise<PolygonNewsArticle[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const apiKey = getApiKey();
    const tickerList = [...new Set(tickers.map(t => toPolygonTicker(t)))].join(',');

    const params = new URLSearchParams({
      'ticker.any_of': tickerList,
      limit: String(Math.min(limit, 50)),
      order: 'desc',
      sort: 'published_utc',
      apiKey,
    });

    const url = `${POLYGON_BASE_URL}/v2/reference/news?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`Polygon news API error: ${response.status} ${response.statusText}`);
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
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[polygon] News request timed out');
      return [];
    }
    console.error('Failed to fetch ticker news:', err);
    return [];
  }
}

// ----- Sentiment Analysis -----

// Keyword lists for basic rule-based sentiment scoring
const POSITIVE_WORDS = new Set([
  'beat', 'beats', 'exceeded', 'surpassed', 'upgrade', 'upgraded', 'upgrades',
  'raised', 'raises', 'raise', 'growth', 'growing', 'gains', 'gained', 'rally',
  'rallied', 'rallies', 'surge', 'surged', 'surges', 'soar', 'soared', 'soars',
  'record', 'high', 'highs', 'profit', 'profits', 'profitable', 'bullish',
  'outperform', 'outperforms', 'buy', 'strong', 'stronger', 'strength',
  'positive', 'optimistic', 'recovery', 'recovered', 'boost', 'boosted',
  'dividend', 'buyback', 'accelerate', 'accelerated', 'innovation', 'breakthrough',
]);

const NEGATIVE_WORDS = new Set([
  'miss', 'missed', 'misses', 'below', 'downgrade', 'downgraded', 'downgrades',
  'cut', 'cuts', 'decline', 'declined', 'declines', 'drop', 'dropped', 'drops',
  'fall', 'fell', 'falls', 'crash', 'crashed', 'crashes', 'plunge', 'plunged',
  'loss', 'losses', 'lost', 'losing', 'bearish', 'underperform', 'sell',
  'weak', 'weaker', 'weakness', 'negative', 'pessimistic', 'recession',
  'layoff', 'layoffs', 'lawsuit', 'investigation', 'fraud', 'warning',
  'bankruptcy', 'default', 'debt', 'risk', 'volatile', 'uncertainty',
  'inflation', 'tariff', 'tariffs', 'sanctions', 'shutdown',
]);

/**
 * Score sentiment of a text string.
 * Returns 'positive', 'negative', or 'neutral'.
 */
export function scoreSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  if (!text) return 'neutral';

  const words = text.toLowerCase().split(/\W+/);
  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) positiveCount++;
    if (NEGATIVE_WORDS.has(word)) negativeCount++;
  }

  const total = positiveCount + negativeCount;
  if (total === 0) return 'neutral';

  const score = (positiveCount - negativeCount) / total;
  if (score > 0.2) return 'positive';
  if (score < -0.2) return 'negative';
  return 'neutral';
}

// ----- Sector Mapping -----

const TICKER_SECTOR_OVERRIDE: Record<string, string> = {
  AAPL: 'Technology', MSFT: 'Technology', GOOGL: 'Technology', GOOG: 'Technology',
  AMZN: 'Consumer Cyclical', META: 'Technology', NVDA: 'Technology', TSLA: 'Consumer Cyclical',
  AMD: 'Technology', INTC: 'Technology', AVGO: 'Technology', CRM: 'Technology',
  ADBE: 'Technology', CSCO: 'Technology', ORCL: 'Technology', QCOM: 'Technology',
  TXN: 'Technology', AMAT: 'Technology', NFLX: 'Communication Services', DIS: 'Communication Services',
  CMCSA: 'Communication Services', VZ: 'Communication Services', T: 'Communication Services',
  JPM: 'Financial Services', BAC: 'Financial Services', GS: 'Financial Services',
  MS: 'Financial Services', WFC: 'Financial Services', C: 'Financial Services',
  BLK: 'Financial Services', SCHW: 'Financial Services', V: 'Financial Services',
  MA: 'Financial Services', AXP: 'Financial Services', COF: 'Financial Services',
  JNJ: 'Healthcare', UNH: 'Healthcare', PFE: 'Healthcare', ABBV: 'Healthcare',
  MRK: 'Healthcare', LLY: 'Healthcare', TMO: 'Healthcare', ABT: 'Healthcare',
  AMGN: 'Healthcare', GILD: 'Healthcare', ISRG: 'Healthcare', MDT: 'Healthcare',
  XOM: 'Energy', CVX: 'Energy', COP: 'Energy', SLB: 'Energy', EOG: 'Energy',
  PG: 'Consumer Defensive', KO: 'Consumer Defensive', PEP: 'Consumer Defensive',
  WMT: 'Consumer Defensive', COST: 'Consumer Defensive', MCD: 'Consumer Cyclical',
  NKE: 'Consumer Cyclical', SBUX: 'Consumer Cyclical', HD: 'Consumer Cyclical',
  LOW: 'Consumer Cyclical', TGT: 'Consumer Cyclical', TJX: 'Consumer Cyclical',
  CAT: 'Industrials', DE: 'Industrials', HON: 'Industrials', UNP: 'Industrials',
  BA: 'Industrials', GE: 'Industrials', RTX: 'Industrials', LMT: 'Industrials',
  NEE: 'Utilities', DUK: 'Utilities', SO: 'Utilities', D: 'Utilities',
  AMT: 'Real Estate', PLD: 'Real Estate', CCI: 'Real Estate', O: 'Real Estate',
  SPY: 'Diversified', VOO: 'Diversified', VTI: 'Diversified', QQQ: 'Technology',
  IWM: 'Diversified', DIA: 'Diversified', VGT: 'Technology', SCHD: 'Diversified',
  VYM: 'Diversified', BND: 'Fixed Income', AGG: 'Fixed Income', TLT: 'Fixed Income',
  LQD: 'Fixed Income', HYG: 'Fixed Income', GLD: 'Commodities', SLV: 'Commodities',
  VNQ: 'Real Estate', XLF: 'Financial Services', XLE: 'Energy', XLK: 'Technology',
  XLV: 'Healthcare', XLI: 'Industrials', XLP: 'Consumer Defensive', XLU: 'Utilities',
  XLY: 'Consumer Cyclical', XLB: 'Basic Materials', XLRE: 'Real Estate',
  ARKK: 'Technology', SOXX: 'Technology', SMH: 'Technology',
  BRK: 'Financial Services', 'BRK.B': 'Financial Services',
  PLTR: 'Technology', COIN: 'Financial Services', SQ: 'Financial Services',
  SHOP: 'Technology', SNOW: 'Technology', CRWD: 'Technology', NET: 'Technology',
  SOFI: 'Financial Services', HOOD: 'Financial Services', DKNG: 'Consumer Cyclical',
  RIVN: 'Consumer Cyclical', NIO: 'Consumer Cyclical', LCID: 'Consumer Cyclical',
  VXUS: 'Diversified', EFA: 'Diversified', VWO: 'Diversified', IEMG: 'Diversified',
  EEM: 'Diversified', VNQI: 'Real Estate', VIG: 'Diversified', VOOG: 'Diversified',
  VOOV: 'Diversified', VTV: 'Diversified', VUG: 'Diversified', MGK: 'Diversified',
  ITOT: 'Diversified', SPTM: 'Diversified', SPLG: 'Diversified', SPYG: 'Diversified',
  SPYV: 'Diversified', RSP: 'Diversified', QUAL: 'Diversified', MTUM: 'Diversified',
  USMV: 'Diversified', ACWI: 'Diversified', VT: 'Diversified', IXUS: 'Diversified',
  IEFA: 'Diversified', SPDW: 'Diversified', FXI: 'Diversified', EWJ: 'Diversified',
  EWZ: 'Diversified', INDA: 'Diversified', KWEB: 'Technology',
  IBB: 'Healthcare', XBI: 'Healthcare', XOP: 'Energy', KRE: 'Financial Services',
  ITB: 'Consumer Cyclical', JETS: 'Industrials', HACK: 'Technology', BOTZ: 'Technology',
  ICLN: 'Energy', TAN: 'Energy', XLC: 'Communication Services',
  ARKW: 'Technology', ARKG: 'Healthcare', ARKF: 'Financial Services',
  SOXL: 'Technology', TQQQ: 'Technology', SQQQ: 'Technology', UVXY: 'Diversified',
};

const SIC_TO_SECTOR: Record<string, string> = {
  'electronic computers': 'Technology',
  'computer peripheral equipment': 'Technology',
  'prepackaged software': 'Technology',
  'computer programming': 'Technology',
  'computer integrated systems design': 'Technology',
  'semiconductor': 'Technology',
  'semiconductors': 'Technology',
  'electronic components': 'Technology',
  'communication services': 'Communication Services',
  'telephone communications': 'Communication Services',
  'television broadcasting': 'Communication Services',
  'cable & other pay television services': 'Communication Services',
  'pharmaceutical preparations': 'Healthcare',
  'surgical & medical instruments': 'Healthcare',
  'hospital & medical service plans': 'Healthcare',
  'biological products': 'Healthcare',
  'national commercial banks': 'Financial Services',
  'state commercial banks': 'Financial Services',
  'security brokers': 'Financial Services',
  'fire, marine & casualty insurance': 'Financial Services',
  'investment advice': 'Financial Services',
  'real estate investment trusts': 'Real Estate',
  'crude petroleum & natural gas': 'Energy',
  'petroleum refining': 'Energy',
  'electric services': 'Utilities',
  'natural gas distribution': 'Utilities',
  'motor vehicles & passenger car bodies': 'Consumer Cyclical',
  'retail stores': 'Consumer Cyclical',
  'eating places': 'Consumer Cyclical',
  'beverages': 'Consumer Defensive',
  'soap, detergent, cleaning': 'Consumer Defensive',
  'food & kindred products': 'Consumer Defensive',
  'aerospace & defense': 'Industrials',
  'railroads': 'Industrials',
  'air transportation': 'Industrials',
  'mining': 'Basic Materials',
  'steel works': 'Basic Materials',
};

/**
 * Map a Polygon SIC description to a sector name.
 */
export function getTickerSectorOverride(ticker: string): string | null {
  return TICKER_SECTOR_OVERRIDE[ticker.toUpperCase()] || null;
}

export function mapSicToSector(sicDescription: string | null): string | null {
  if (!sicDescription) return null;
  const lower = sicDescription.toLowerCase();

  for (const [key, sector] of Object.entries(SIC_TO_SECTOR)) {
    if (lower.includes(key)) return sector;
  }

  // Fallback: try to infer from common words
  if (lower.includes('software') || lower.includes('computer') || lower.includes('data'))
    return 'Technology';
  if (lower.includes('pharma') || lower.includes('medical') || lower.includes('health'))
    return 'Healthcare';
  if (lower.includes('bank') || lower.includes('insurance') || lower.includes('financial'))
    return 'Financial Services';
  if (lower.includes('oil') || lower.includes('gas') || lower.includes('energy'))
    return 'Energy';
  if (lower.includes('retail') || lower.includes('restaurant'))
    return 'Consumer Cyclical';

  return null;
}
