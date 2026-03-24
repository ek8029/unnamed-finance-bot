/**
 * Server-side stock analysis with Supabase caching.
 * Used by both the public /analyze/[ticker] page and the dashboard chat API.
 * Caches results for 24 hours per ticker to avoid redundant API calls.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getFullTickerData, type TickerData } from '@/lib/financial-data';
import OpenAI from 'openai';
import type { StockAnalysis } from '@/components/analysis/types';
import { CACHE_TTL } from '@/lib/financial-config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CACHE_TTL_MS = CACHE_TTL.stockAnalysis;

// ── Check cache ──

async function getCachedAnalysis(ticker: string): Promise<StockAnalysis | null> {
  try {
    const supabase = await createServiceClient();
    const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString();

    const { data, error } = await supabase
      .from('analysis_cache')
      .select('analysis_json')
      .eq('ticker', ticker.toUpperCase())
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data.analysis_json as StockAnalysis;
  } catch {
    return null;
  }
}

async function setCachedAnalysis(ticker: string, analysis: StockAnalysis): Promise<void> {
  try {
    const supabase = await createServiceClient();
    await supabase
      .from('analysis_cache')
      .upsert(
        { ticker: ticker.toUpperCase(), analysis_json: analysis, created_at: new Date().toISOString() },
        { onConflict: 'ticker' }
      );
  } catch (error) {
    console.error('Failed to cache analysis:', error);
  }
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

export async function analyzeStock(ticker: string): Promise<{ analysis: StockAnalysis | null; fromCache: boolean }> {
  const symbol = ticker.toUpperCase().replace(/[^A-Z]/g, '');
  if (!symbol || symbol.length > 5) {
    return { analysis: null, fromCache: false };
  }

  // Check cache first
  const cached = await getCachedAnalysis(symbol);
  if (cached) {
    return { analysis: cached, fromCache: true };
  }

  // Fetch financial data
  const tickerData = await getFullTickerData(symbol);

  // If no data at all (invalid ticker), return null
  if (!tickerData.quote && !tickerData.profile) {
    return { analysis: null, fromCache: false };
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
    if (!content) return { analysis: null, fromCache: false };

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
    } catch (parseError) {
      console.error(`Failed to parse analysis for ${symbol}:`, parseError);
      return { analysis: null, fromCache: false };
    }

    // Cache the result
    await setCachedAnalysis(symbol, analysis);

    return { analysis, fromCache: false };
  } catch (error) {
    console.error('Stock analysis failed:', error);
    return { analysis: null, fromCache: false };
  }
}
