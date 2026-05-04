/**
 * Finnhub Financial Data Client
 *
 * Provides quote data, company profiles, financials, recommendations,
 * earnings, and news via the Finnhub free tier (60 calls/min).
 * In-memory cache with 15-minute TTL to avoid rate limits.
 */

import { CACHE_TTL as GLOBAL_CACHE_TTL } from '@/lib/financial-config';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

function getApiKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error('FINNHUB_API_KEY environment variable is not set');
  return key;
}

// ── In-memory cache (15-min TTL) ──

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = GLOBAL_CACHE_TTL.financialData;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlOverride?: number): void {
  cache.set(key, { data, expiresAt: Date.now() + (ttlOverride ?? CACHE_TTL) });
}

async function finnhubFetch<T>(endpoint: string, params: Record<string, string>): Promise<T | null> {
  const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  try {
    const url = new URL(`${FINNHUB_BASE}${endpoint}`);
    url.searchParams.set('token', getApiKey());
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error(`Finnhub ${endpoint} error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    setCache(cacheKey, data);
    return data as T;
  } catch (error) {
    console.error(`Finnhub ${endpoint} failed:`, error);
    return null;
  }
}

// ── Types ──

export interface FinnhubQuote {
  c: number;   // current price
  d: number;   // change
  dp: number;  // percent change
  h: number;   // high
  l: number;   // low
  o: number;   // open
  pc: number;  // previous close
  t: number;   // timestamp
}

export interface FinnhubProfile {
  country: string;
  currency: string;
  exchange: string;
  finnhubIndustry: string;
  ipo: string;
  logo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
}

export interface FinnhubBasicFinancials {
  metric: Record<string, number | null>;
  metricType: string;
  symbol: string;
}

export interface FinnhubRecommendation {
  buy: number;
  hold: number;
  period: string;
  sell: number;
  strongBuy: number;
  strongSell: number;
  symbol: string;
}

export interface FinnhubEarning {
  actual: number | null;
  estimate: number | null;
  period: string;
  quarter: number;
  surprise: number | null;
  surprisePercent: number | null;
  symbol: string;
  year: number;
}

export interface FinnhubNewsItem {
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

// ── API Functions ──

/** Short TTL for quotes — 60s instead of 15min so the 60-second poll gets fresh data. */
const QUOTE_CACHE_TTL = 60 * 1000;

export async function getQuote(symbol: string): Promise<FinnhubQuote | null> {
  const cacheKey = `/quote:${JSON.stringify({ symbol: symbol.toUpperCase() })}`;
  const cached = getCached<FinnhubQuote>(cacheKey);
  if (cached) return cached;

  const url = new URL(`${FINNHUB_BASE}/quote`);
  url.searchParams.set('token', getApiKey());
  url.searchParams.set('symbol', symbol.toUpperCase());

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (res.status === 429) {
        // Rate limited — wait 1s and retry once
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      if (!res.ok) return null;
      const data = await res.json();
      // Finnhub returns c:0 when no data — treat as null
      if (!data || data.c === 0) return null;
      setCache(cacheKey, data, QUOTE_CACHE_TTL);
      return data as FinnhubQuote;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Fetch real-time quotes for multiple tickers from Finnhub.
 * Throttled to stay under the 60 calls/min free-tier limit.
 * Returns a Map of uppercase ticker → FinnhubQuote.
 *
 * Uses the in-memory cache (15min TTL) per ticker, so repeated calls
 * for the same ticker within the window are free.
 */
export async function getBatchQuotes(
  tickers: string[],
): Promise<Map<string, FinnhubQuote>> {
  const results = new Map<string, FinnhubQuote>();
  const unique = [...new Set(tickers.map(t => t.toUpperCase()))];

  // Process in batches of 10 with 1.2s delay between batches
  // to stay well under 60 calls/min (10 per 1.2s = ~50/min)
  const BATCH_SIZE = 10;
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    const quotes = await Promise.all(
      batch.map(async (ticker) => {
        const quote = await getQuote(ticker);
        return { ticker, quote };
      }),
    );
    for (const { ticker, quote } of quotes) {
      if (quote && quote.c > 0) {
        results.set(ticker, quote);
      }
    }
    // Throttle between batches (skip delay on last batch)
    if (i + BATCH_SIZE < unique.length) {
      await new Promise(resolve => setTimeout(resolve, 1200));
    }
  }

  return results;
}

export async function getCompanyProfile(symbol: string): Promise<FinnhubProfile | null> {
  return finnhubFetch<FinnhubProfile>('/stock/profile2', { symbol: symbol.toUpperCase() });
}

export async function getBasicFinancials(symbol: string): Promise<FinnhubBasicFinancials | null> {
  return finnhubFetch<FinnhubBasicFinancials>('/stock/metric', {
    symbol: symbol.toUpperCase(),
    metric: 'all',
  });
}

export async function getRecommendationTrends(symbol: string): Promise<FinnhubRecommendation[] | null> {
  return finnhubFetch<FinnhubRecommendation[]>('/stock/recommendation', {
    symbol: symbol.toUpperCase(),
  });
}

export async function getEarnings(symbol: string): Promise<FinnhubEarning[] | null> {
  return finnhubFetch<FinnhubEarning[]>('/stock/earnings', {
    symbol: symbol.toUpperCase(),
  });
}

export async function getCompanyNews(symbol: string): Promise<FinnhubNewsItem[] | null> {
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 86400000); // 30 days back
  return finnhubFetch<FinnhubNewsItem[]>('/company-news', {
    symbol: symbol.toUpperCase(),
    from: from.toISOString().split('T')[0],
    to: now.toISOString().split('T')[0],
  });
}

// ── Earnings Calendar ──

export interface EarningsCalendarItem {
  date: string;           // YYYY-MM-DD
  epsActual: number | null;
  epsEstimate: number | null;
  hour: string;           // "bmo" (before market open), "amc" (after market close), ""
  quarter: number;
  revenueActual: number | null;
  revenueEstimate: number | null;
  symbol: string;
  year: number;
}

interface EarningsCalendarResponse {
  earningsCalendar: EarningsCalendarItem[];
}

export async function getEarningsCalendar(
  from: string,
  to: string,
): Promise<EarningsCalendarItem[]> {
  const result = await finnhubFetch<EarningsCalendarResponse>('/calendar/earnings', { from, to });
  return result?.earningsCalendar || [];
}

// ── Aggregated fetch for a single ticker ──

export interface TickerData {
  symbol: string;
  quote: FinnhubQuote | null;
  profile: FinnhubProfile | null;
  financials: FinnhubBasicFinancials | null;
  recommendations: FinnhubRecommendation[] | null;
  earnings: FinnhubEarning[] | null;
  news: FinnhubNewsItem[] | null;
}

export async function getFullTickerData(symbol: string): Promise<TickerData> {
  const [quote, profile, financials, recommendations, earnings, news] = await Promise.all([
    getQuote(symbol),
    getCompanyProfile(symbol),
    getBasicFinancials(symbol),
    getRecommendationTrends(symbol),
    getEarnings(symbol),
    getCompanyNews(symbol),
  ]);

  return { symbol: symbol.toUpperCase(), quote, profile, financials, recommendations, earnings, news };
}
