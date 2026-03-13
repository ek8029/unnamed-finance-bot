/**
 * Finnhub Financial Data Client
 *
 * Provides quote data, company profiles, financials, recommendations,
 * earnings, and news via the Finnhub free tier (60 calls/min).
 * In-memory cache with 15-minute TTL to avoid rate limits.
 */

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
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
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

export async function getQuote(symbol: string): Promise<FinnhubQuote | null> {
  return finnhubFetch<FinnhubQuote>('/quote', { symbol: symbol.toUpperCase() });
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
