/**
 * Server-side helper to fetch pre-cached analyses for homepage demo.
 * Uses the analysis_cache table (publicly readable via RLS).
 */
import { createStaticServiceClient } from '@/lib/supabase/server';
import type { StockAnalysis } from '@/components/analysis/types';

// Curated tickers: large-caps with clear verdicts and good metric spreads
const DEMO_TICKERS = ['AAPL', 'NVDA', 'TSLA', 'GOOGL', 'AMZN', 'META', 'MSFT', 'JPM'];

export interface DemoAnalysis {
  ticker: string;
  analysis: StockAnalysis;
  computedAt: string;
}

/**
 * Fetch cached analyses for demo tickers. Returns only tickers with
 * valid, complete analyses (has verdict, summary, and metrics).
 * Safe to call server-side — uses service client.
 */
export async function getDemoAnalyses(): Promise<DemoAnalysis[]> {
  try {
    const supabase = createStaticServiceClient();

    const { data, error } = await supabase
      .from('analysis_cache')
      .select('ticker, analysis_json, created_at')
      .in('ticker', DEMO_TICKERS)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    // Filter to complete analyses and deduplicate by ticker
    const seen = new Set<string>();
    const results: DemoAnalysis[] = [];

    for (const row of data) {
      if (seen.has(row.ticker)) continue;
      seen.add(row.ticker);

      const analysis = row.analysis_json as StockAnalysis;
      if (!analysis?.verdict || !analysis?.summary || !analysis?.metrics?.length) continue;

      results.push({
        ticker: row.ticker,
        analysis,
        computedAt: row.created_at,
      });
    }

    // Return up to 5 demo analyses
    return results.slice(0, 5);
  } catch {
    return [];
  }
}
