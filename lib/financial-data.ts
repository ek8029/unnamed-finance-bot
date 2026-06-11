/**
 * Financial Data Layer
 *
 * Prices and quotes: Finazon us_stocks_essential (licensed for commercial
 * display, no redistribution restrictions).
 * Company profiles and fundamentals: SEC EDGAR (public domain).
 *
 * Per-ticker news: Nasdaq + Yahoo Finance RSS via lib/free-news (headline +
 * link + attribution only).
 *
 * Analyst recommendations and earnings estimates/calendar have no licensed
 * provider after the Finnhub/Polygon migration — those functions return
 * empty results until a new source is wired in.
 */

import { cache as reactCache } from 'react';
import { getDailyBars, getIntradayQuote } from '@/lib/finazon';
import { fetchTickerHeadlines, fetchYahooHeadlines } from '@/lib/free-news';
import {
  getReportedFinancialsEdgar,
  getCompanyProfileEdgar,
  type ReportedFinancials,
  type StatementLineItem,
} from '@/lib/edgar';
import { CACHE_TTL as GLOBAL_CACHE_TTL, FINAZON_TS_RPM } from '@/lib/financial-config';

// Statement types moved to lib/edgar.ts — re-exported for existing importers.
export type { ReportedFinancials, StatementLineItem };

// ── In-memory cache ──

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

// ── Types ──

export interface StockQuote {
  c: number;   // current price
  d: number;   // change
  dp: number;  // percent change
  h: number;   // high
  l: number;   // low
  o: number;   // open
  pc: number;  // previous close
  t: number;   // timestamp
}

export interface CompanyProfile {
  country: string;
  currency: string;
  exchange: string;
  industry: string;
  ipo: string;
  logo: string;
  marketCapitalization: number; // in millions
  name: string;
  phone: string;
  shareOutstanding: number; // in millions
  ticker: string;
  weburl: string;
}

export interface BasicFinancials {
  metric: Record<string, number | null>;
  metricType: string;
  symbol: string;
}

export interface RecommendationTrend {
  buy: number;
  hold: number;
  period: string;
  sell: number;
  strongBuy: number;
  strongSell: number;
  symbol: string;
}

export interface EarningsSurprise {
  actual: number | null;
  estimate: number | null;
  period: string;
  quarter: number;
  surprise: number | null;
  surprisePercent: number | null;
  symbol: string;
  year: number;
}

export interface NewsItem {
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

// ── Quotes (Finazon daily bars) ──

/** Short TTL for quotes — 60s so the 60-second poll gets fresh data. */
const QUOTE_CACHE_TTL = 60 * 1000;

export async function getQuote(symbol: string): Promise<StockQuote | null> {
  const upper = symbol.toUpperCase();
  const cacheKey = `quote:${upper}`;
  const cached = getCached<StockQuote>(cacheKey);
  if (cached) return cached;

  // Hourly-derived quote keeps full decimal precision (the 1d bars are
  // rounded to whole dollars). Fall back to daily bars if unavailable.
  const intraday = await getIntradayQuote(upper);

  let c: number, pc: number, h: number, l: number, o: number, date: string;
  if (intraday) {
    ({ price: c, prevClose: pc, high: h, low: l, open: o, date } = intraday);
  } else {
    const bars = await getDailyBars(upper, 2);
    if (bars.length === 0) return null;
    const latest = bars[0];
    if (!latest.close || latest.close <= 0) return null;
    c = latest.close;
    pc = bars.length > 1 && bars[1].close > 0 ? bars[1].close : latest.open;
    h = latest.high;
    l = latest.low;
    o = latest.open;
    date = latest.date;
  }

  const change = c - pc;

  const quote: StockQuote = {
    c,
    d: change,
    dp: pc > 0 ? (change / pc) * 100 : 0,
    h,
    l,
    o,
    pc,
    t: Math.floor(new Date(date).getTime() / 1000),
  };

  setCache(cacheKey, quote, QUOTE_CACHE_TTL);
  return quote;
}

/**
 * Fetch quotes for multiple tickers, throttled to the Finazon
 * time_series requests-per-minute budget.
 * Returns a Map of uppercase ticker → StockQuote.
 */
export async function getBatchQuotes(
  tickers: string[],
): Promise<Map<string, StockQuote>> {
  const results = new Map<string, StockQuote>();
  const unique = [...new Set(tickers.filter(Boolean).map(t => t.toUpperCase()))];

  const BATCH_SIZE = 5;
  const batchDelayMs = Math.ceil((BATCH_SIZE * 60_000) / FINAZON_TS_RPM);

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map(t => getQuote(t)));
    for (let j = 0; j < batch.length; j++) {
      const r = settled[j];
      if (r.status === 'fulfilled' && r.value && r.value.c > 0) {
        results.set(batch[j], r.value);
      }
    }
    if (i + BATCH_SIZE < unique.length) {
      await new Promise(resolve => setTimeout(resolve, batchDelayMs));
    }
  }

  return results;
}

// ── Fundamentals helpers (EDGAR statement line items) ──

function lineValue(items: StatementLineItem[], label: string): number | null {
  const item = items.find(i => i.label === label);
  return item != null ? item.value : null;
}

function sharesFrom(report: ReportedFinancials): number | null {
  return (
    lineValue(report.ic, 'Shares outstanding, diluted (weighted avg)') ??
    lineValue(report.ic, 'Shares outstanding, basic (weighted avg)')
  );
}

// ── Company profile (EDGAR + Finazon price) ──

export async function getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
  const upper = symbol.toUpperCase();
  const cacheKey = `profile:${upper}`;
  const cached = getCached<CompanyProfile>(cacheKey);
  if (cached) return cached;

  const [edgarProfile, quote, reports] = await Promise.all([
    getCompanyProfileEdgar(upper),
    getQuote(upper),
    getReportedFinancialsEdgar(upper),
  ]);

  if (!edgarProfile) return null;

  const shares = reports.length > 0 ? sharesFrom(reports[0]) : null;
  const marketCapM = quote && shares ? (quote.c * shares) / 1_000_000 : 0;

  const profile: CompanyProfile = {
    country: 'US',
    currency: 'USD',
    exchange: edgarProfile.exchange || '',
    industry: edgarProfile.sicDescription || '',
    ipo: '',
    logo: '',
    marketCapitalization: marketCapM,
    name: edgarProfile.name,
    phone: '',
    shareOutstanding: shares ? shares / 1_000_000 : 0,
    ticker: upper,
    weburl: '',
  };

  setCache(cacheKey, profile);
  return profile;
}

// ── Basic financials (derived from EDGAR annual reports + price) ──

export async function getBasicFinancials(symbol: string): Promise<BasicFinancials | null> {
  const upper = symbol.toUpperCase();
  const cacheKey = `fundamentals:${upper}`;
  const cached = getCached<BasicFinancials>(cacheKey);
  if (cached) return cached;

  const [reports, quote, bars] = await Promise.all([
    getReportedFinancialsEdgar(upper),
    getQuote(upper),
    getDailyBars(upper, 260),
  ]);

  const metric: Record<string, number | null> = {};

  if (bars.length > 0) {
    metric['52WeekHigh'] = Math.max(...bars.map(b => b.high));
    metric['52WeekLow'] = Math.min(...bars.map(b => b.low));
  }

  if (reports.length > 0) {
    const cur = reports[0];
    const prev = reports.length > 1 ? reports[1] : null;
    const price = quote?.c ?? null;

    const revenue = lineValue(cur.ic, 'Revenue');
    const grossProfit = lineValue(cur.ic, 'Gross profit');
    const operatingIncome = lineValue(cur.ic, 'Operating income');
    const netIncome = lineValue(cur.ic, 'Net income');
    const epsBasic = lineValue(cur.ic, 'EPS, basic');
    const epsDiluted = lineValue(cur.ic, 'EPS, diluted');
    const eps = epsDiluted ?? epsBasic;
    const shares = sharesFrom(cur);
    const equity = lineValue(cur.bs, "Total stockholders' equity");
    const currentAssets = lineValue(cur.bs, 'Total current assets');
    const currentLiabilities = lineValue(cur.bs, 'Total current liabilities');
    const longTermDebt = lineValue(cur.bs, 'Long-term debt');
    const cfo = lineValue(cur.cf, 'Cash from operating activities');
    const capex = lineValue(cur.cf, 'Capital expenditures');
    const dividendsPaid = lineValue(cur.cf, 'Dividends paid');

    const marketCap = price != null && shares ? price * shares : null;

    if (price != null && eps != null && eps !== 0) metric['peBasicExclExtraTTM'] = price / eps;
    if (epsBasic != null) metric['epsBasicExclExtraTTM'] = epsBasic;
    if (marketCap != null && revenue) metric['psTTM'] = marketCap / revenue;
    if (marketCap != null && equity && equity !== 0) metric['pbQuarterly'] = marketCap / equity;
    if (grossProfit != null && revenue) metric['grossMarginTTM'] = (grossProfit / revenue) * 100;
    if (operatingIncome != null && revenue) metric['operatingMarginTTM'] = (operatingIncome / revenue) * 100;
    if (netIncome != null && revenue) metric['netProfitMarginTTM'] = (netIncome / revenue) * 100;
    if (netIncome != null && equity && equity !== 0) metric['roeTTM'] = (netIncome / equity) * 100;
    if (currentAssets != null && currentLiabilities) {
      metric['currentRatioQuarterly'] = currentAssets / currentLiabilities;
    }
    if (longTermDebt != null && equity && equity !== 0) {
      const de = longTermDebt / equity;
      metric['totalDebtToEquityQuarterly'] = de;
      metric['debtEquityQuarterly'] = de;
    }
    if (revenue != null && shares) metric['revenuePerShareTTM'] = revenue / shares;
    if (equity != null && shares) metric['bookValuePerShareQuarterly'] = equity / shares;
    if (cfo != null && shares) {
      metric['fcfPerShareTTM'] = (cfo - Math.abs(capex ?? 0)) / shares;
    }
    if (dividendsPaid != null && marketCap) {
      metric['dividendYieldIndicatedAnnual'] = (Math.abs(dividendsPaid) / marketCap) * 100;
    }

    if (prev) {
      const prevRevenue = lineValue(prev.ic, 'Revenue');
      const prevEps = lineValue(prev.ic, 'EPS, diluted') ?? lineValue(prev.ic, 'EPS, basic');
      if (revenue != null && prevRevenue) {
        metric['revenueGrowthTTMYoy'] = ((revenue - prevRevenue) / Math.abs(prevRevenue)) * 100;
      }
      if (eps != null && prevEps) {
        metric['epsGrowthTTMYoy'] = ((eps - prevEps) / Math.abs(prevEps)) * 100;
      }
    }
  }

  if (Object.keys(metric).length === 0) return null;

  const result: BasicFinancials = { metric, metricType: 'annual-derived', symbol: upper };
  setCache(cacheKey, result);
  return result;
}

// ── Unavailable post-migration (no licensed provider) ──

export async function getRecommendationTrends(_symbol: string): Promise<RecommendationTrend[] | null> {
  return null;
}

export async function getEarnings(_symbol: string): Promise<EarningsSurprise[] | null> {
  return null;
}

export async function getCompanyNews(symbol: string): Promise<NewsItem[] | null> {
  const [nasdaq, yahoo] = await Promise.all([
    fetchTickerHeadlines(symbol),
    fetchYahooHeadlines(symbol),
  ]);

  // Same story often appears on both feeds under different URLs
  const normTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
  const seen = new Set<string>();
  const items: NewsItem[] = [];
  for (const a of [...nasdaq, ...yahoo]) {
    const nt = normTitle(a.title);
    if (seen.has(nt) || seen.has(a.url)) continue;
    seen.add(nt);
    seen.add(a.url);
    items.push({
      category: 'company',
      datetime: Math.floor(new Date(a.publishedAt).getTime() / 1000),
      headline: a.title,
      id: items.length + 1,
      image: '',
      related: symbol.toUpperCase(),
      source: a.source || '',
      summary: a.description,
      url: a.url,
    });
  }

  items.sort((a, b) => b.datetime - a.datetime);
  return items.length > 0 ? items.slice(0, 20) : null;
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

export async function getEarningsCalendar(
  _from: string,
  _to: string,
): Promise<EarningsCalendarItem[]> {
  return [];
}

// ── Aggregated fetch for a single ticker ──

export interface TickerData {
  symbol: string;
  quote: StockQuote | null;
  profile: CompanyProfile | null;
  financials: BasicFinancials | null;
  recommendations: RecommendationTrend[] | null;
  earnings: EarningsSurprise[] | null;
  news: NewsItem[] | null;
}

// React cache() dedupes calls within a single request — generateMetadata and
// the page component share one fetch instead of each hitting the providers.
export const getFullTickerData = reactCache(async (symbol: string): Promise<TickerData> => {
  const [quote, profile, financials, news] = await Promise.all([
    getQuote(symbol),
    getCompanyProfile(symbol),
    getBasicFinancials(symbol),
    getCompanyNews(symbol),
  ]);

  return {
    symbol: symbol.toUpperCase(),
    quote,
    profile,
    financials,
    recommendations: null,
    earnings: null,
    news,
  };
});
