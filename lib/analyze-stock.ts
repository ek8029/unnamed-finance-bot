/**
 * Server-side stock analysis with Supabase caching.
 * Used by both the public /analyze/[ticker] page and the dashboard chat API.
 * Cache TTL is market-hours-aware: 30 min during US equity market hours
 * (9:30am–4:00pm ET, Mon–Fri), 24 hr off-hours and weekends.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getFullTickerData, type TickerData } from '@/lib/financial-data';
import OpenAI from 'openai';
import type { StockAnalysis } from '@/components/analysis/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Methodology version — bump when the analysis pipeline changes materially. */
const METHODOLOGY_VERSION = 'v1.0';
const DATA_SOURCES = ['finnhub.io', 'openai-gpt-4o-mini'];

/**
 * Cache TTL depends on US equity market hours (9:30am–4:00pm ET, Mon–Fri).
 * YMYL finance content must not be hours stale.
 *
 * Tightened from the previous (30min market / 24h off-hours) values to:
 *   - Market hours:  15 min — catches intraday news + price moves
 *   - Off-hours:     4 hr   — catches earnings releases, after-hours moves,
 *                            8-K filings, pre-market activity
 *
 * These are fallback TTLs for tickers NOT in the popular list. Tickers in
 * lib/popular-tickers.ts (top 50) are proactively refreshed by
 * /api/cron/refresh-tickers on a schedule and rarely hit the TTL fallback.
 *
 * Long-tail tickers refresh on the first visit after the TTL expires —
 * the visitor pays a ~5-15 second wait while Finnhub + OpenAI run, then
 * subsequent visitors get the cached result for the next 15min/4h.
 */
function getCacheTtlMs(): number {
  const now = new Date();
  // Convert to ET regardless of server timezone
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay(); // 0=Sun, 6=Sat
  const hour = et.getHours();
  const minute = et.getMinutes();
  const minutesSinceMidnight = hour * 60 + minute;

  const isWeekday = day >= 1 && day <= 5;
  const marketOpen = 9 * 60 + 30; // 9:30am ET
  const marketClose = 16 * 60;    // 4:00pm ET
  const isMarketHours = isWeekday && minutesSinceMidnight >= marketOpen && minutesSinceMidnight < marketClose;

  return isMarketHours
    ? 15 * 60 * 1000        // 15 min during market hours
    : 4 * 60 * 60 * 1000;   // 4 hr off-hours
}

export interface CachedAnalysisResult {
  analysis: StockAnalysis;
  computedAt: string; // ISO timestamp
  dataSources: string[];
  methodologyVersion: string;
}

// ── Check cache ──

async function getCachedAnalysis(ticker: string): Promise<CachedAnalysisResult | null> {
  try {
    const supabase = await createServiceClient();
    const cutoff = new Date(Date.now() - getCacheTtlMs()).toISOString();

    const { data, error } = await supabase
      .from('analysis_cache')
      .select('analysis_json, created_at, data_sources, methodology_version')
      .eq('ticker', ticker.toUpperCase())
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return {
      analysis: data.analysis_json as StockAnalysis,
      computedAt: data.created_at,
      dataSources: (data.data_sources as string[]) || DATA_SOURCES,
      methodologyVersion: (data.methodology_version as string) || METHODOLOGY_VERSION,
    };
  } catch {
    return null;
  }
}

async function setCachedAnalysis(ticker: string, analysis: StockAnalysis): Promise<string> {
  const computedAt = new Date().toISOString();
  try {
    const supabase = await createServiceClient();
    await supabase
      .from('analysis_cache')
      .upsert(
        {
          ticker: ticker.toUpperCase(),
          analysis_json: analysis,
          created_at: computedAt,
          data_sources: DATA_SOURCES,
          methodology_version: METHODOLOGY_VERSION,
        },
        { onConflict: 'ticker' }
      );
  } catch (error) {
    console.error('Failed to cache analysis:', error);
  }
  return computedAt;
}

// ── Build data context ──

function buildDataContext(td: TickerData): string {
  const lines: string[] = [`=== ${td.symbol} ===`];

  if (td.profile) {
    lines.push(`Company: ${td.profile.name}`);
    lines.push(`Industry: ${td.profile.finnhubIndustry}`);
    lines.push(`Market Cap: $${(td.profile.marketCapitalization * 1_000_000).toLocaleString()}`);
    lines.push(`Exchange: ${td.profile.exchange}`);
  }

  if (td.quote) {
    lines.push(`Current Price: $${td.quote.c}`);
    lines.push(`Change: ${td.quote.d >= 0 ? '+' : ''}${td.quote.d} (${td.quote.dp >= 0 ? '+' : ''}${td.quote.dp}%)`);
    lines.push(`Day Range: $${td.quote.l} - $${td.quote.h}`);
    lines.push(`Previous Close: $${td.quote.pc}`);
  }

  if (td.financials?.metric) {
    const m = td.financials.metric;
    const ml: string[] = [];
    if (m['peBasicExclExtraTTM'] != null) ml.push(`P/E (TTM): ${m['peBasicExclExtraTTM']?.toFixed(2)}`);
    if (m['psTTM'] != null) ml.push(`P/S (TTM): ${m['psTTM']?.toFixed(2)}`);
    if (m['pbQuarterly'] != null) ml.push(`P/B: ${m['pbQuarterly']?.toFixed(2)}`);
    if (m['epsGrowthTTMYoy'] != null) ml.push(`EPS Growth YoY: ${m['epsGrowthTTMYoy']?.toFixed(2)}%`);
    if (m['revenueGrowthTTMYoy'] != null) ml.push(`Revenue Growth YoY: ${m['revenueGrowthTTMYoy']?.toFixed(2)}%`);
    if (m['roeTTM'] != null) ml.push(`ROE (TTM): ${m['roeTTM']?.toFixed(2)}%`);
    if (m['currentRatioQuarterly'] != null) ml.push(`Current Ratio: ${m['currentRatioQuarterly']?.toFixed(2)}`);
    if (m['debtEquityQuarterly'] != null) ml.push(`D/E Ratio: ${m['debtEquityQuarterly']?.toFixed(2)}`);
    if (m['dividendYieldIndicatedAnnual'] != null) ml.push(`Dividend Yield: ${m['dividendYieldIndicatedAnnual']?.toFixed(2)}%`);
    if (m['52WeekHigh'] != null) ml.push(`52W High: $${m['52WeekHigh']}`);
    if (m['52WeekLow'] != null) ml.push(`52W Low: $${m['52WeekLow']}`);
    if (m['beta'] != null) ml.push(`Beta: ${m['beta']?.toFixed(2)}`);
    if (ml.length > 0) {
      lines.push('Key Metrics:');
      lines.push(...ml.map(l => `  ${l}`));
    }
  }

  if (td.recommendations?.length) {
    const r = td.recommendations[0];
    lines.push(`Analyst Consensus (${r.period}): ${r.strongBuy} Strong Buy, ${r.buy} Buy, ${r.hold} Hold, ${r.sell} Sell, ${r.strongSell} Strong Sell`);
  }

  if (td.earnings?.length) {
    lines.push('Recent Earnings:');
    td.earnings.slice(0, 4).forEach(e => {
      const beat = e.surprise != null ? (e.surprise > 0 ? ' (BEAT)' : e.surprise < 0 ? ' (MISS)' : ' (MET)') : '';
      lines.push(`  Q${e.quarter} ${e.year}: Actual $${e.actual ?? 'N/A'} vs Est $${e.estimate ?? 'N/A'}${beat}`);
    });
  }

  if (td.news?.length) {
    lines.push('Recent Headlines:');
    td.news.slice(0, 5).forEach(n => {
      const date = new Date(n.datetime * 1000).toISOString().split('T')[0];
      lines.push(`  [${date}] ${n.headline} (${n.source})`);
    });
  }

  return lines.join('\n');
}

// ── System prompt ──

const SYSTEM_PROMPT = `You are a senior equity research analyst at Helm Intelligence, an institutional-grade financial terminal. You deliver opinionated, data-rich analysis.

RULES:
- Always reference SPECIFIC numbers from the data. Never say "strong growth" without the exact percentage.
- Be opinionated. Take a clear bullish, bearish, or neutral stance.
- Format monetary values: $2,150,000,000 → $2.15B. Use B/M/T suffixes.
- Every sentence should contain a number or specific insight.
- Respond with valid JSON. Do NOT include markdown code fences.

Respond with this JSON structure:
{
  "type": "stock_analysis",
  "ticker": "SYMBOL",
  "companyName": "Full Company Name",
  "verdict": "bullish" | "bearish" | "neutral",
  "summary": "One concise paragraph with specific numbers and a clear thesis.",
  "metrics": [
    { "label": "Metric Name", "value": "Formatted Value", "change": "+X.X%" or null, "context": "vs benchmark" or null }
  ],
  "bullCase": "2-3 sentences with specific data points.",
  "bearCase": "2-3 sentences with specific data points.",
  "recommendation": "One decisive sentence.",
  "newsHighlights": [
    { "headline": "...", "sentiment": "positive" | "negative" | "neutral", "date": "YYYY-MM-DD" }
  ]
}

Include 4-6 metrics (always include Price). Include 2-4 news highlights if available.`;

// ── Main export ──

export interface AnalyzeStockResult {
  analysis: StockAnalysis | null;
  fromCache: boolean;
  computedAt: string | null;
  dataSources: string[];
  methodologyVersion: string;
}

export async function analyzeStock(ticker: string): Promise<AnalyzeStockResult> {
  const symbol = ticker.toUpperCase().replace(/[^A-Z]/g, '');
  const emptyResult: AnalyzeStockResult = {
    analysis: null,
    fromCache: false,
    computedAt: null,
    dataSources: DATA_SOURCES,
    methodologyVersion: METHODOLOGY_VERSION,
  };
  if (!symbol || symbol.length > 5) {
    return emptyResult;
  }

  // Check cache first
  const cached = await getCachedAnalysis(symbol);
  if (cached) {
    return {
      analysis: cached.analysis,
      fromCache: true,
      computedAt: cached.computedAt,
      dataSources: cached.dataSources,
      methodologyVersion: cached.methodologyVersion,
    };
  }

  // Fetch financial data
  const tickerData = await getFullTickerData(symbol);

  // If no data at all (invalid ticker), return null
  if (!tickerData.quote && !tickerData.profile) {
    return emptyResult;
  }

  const dataContext = buildDataContext(tickerData);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `FINANCIAL DATA:\n${dataContext}\n\nAnalyze ${symbol} stock.` },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return emptyResult;

    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let analysis: StockAnalysis;
    try {
      analysis = JSON.parse(cleaned);
      analysis.type = 'stock_analysis';
      // Ensure required arrays exist
      if (!Array.isArray(analysis.metrics)) analysis.metrics = [];
      if (!Array.isArray(analysis.newsHighlights)) analysis.newsHighlights = [];
      if (!analysis.ticker) analysis.ticker = symbol;
      if (!analysis.verdict) analysis.verdict = 'neutral';

      // Enrich AI-generated headlines with URLs from the original Finnhub data
      if (tickerData.news?.length && analysis.newsHighlights.length) {
        for (const highlight of analysis.newsHighlights) {
          const match = tickerData.news.find(n =>
            n.headline === highlight.headline ||
            n.headline.toLowerCase().includes(highlight.headline.toLowerCase()) ||
            highlight.headline.toLowerCase().includes(n.headline.toLowerCase())
          );
          if (match?.url) highlight.url = match.url;
        }
      }
    } catch (parseError) {
      console.error(`Failed to parse analysis for ${symbol}:`, parseError);
      return emptyResult;
    }

    // Cache the result — returns the computed_at ISO string
    const computedAt = await setCachedAnalysis(symbol, analysis);

    return {
      analysis,
      fromCache: false,
      computedAt,
      dataSources: DATA_SOURCES,
      methodologyVersion: METHODOLOGY_VERSION,
    };
  } catch (error) {
    console.error('Stock analysis failed:', error);
    return emptyResult;
  }
}
