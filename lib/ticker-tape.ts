/**
 * Server-side: fetch live ticker tape data for homepage.
 * Mixes staple tickers with recently-analyzed "trending" tickers.
 */
import { getBatchQuotes } from '@/lib/financial-data';
import { createServiceClient } from '@/lib/supabase/server';

const STAPLE_TICKERS = ['NVDA', 'AAPL', 'TSLA', 'MSFT', 'GOOGL', 'META', 'AMZN', 'SPY', 'QQQ', 'JPM'];

export interface TickerTapeItem {
  symbol: string;
  price: string;
  change: string;
  positive: boolean;
}

export async function getTickerTapeData(): Promise<TickerTapeItem[]> {
  try {
    // Get trending tickers from recent analysis cache
    let trendingTickers: string[] = [];
    try {
      const supabase = await createServiceClient();
      const { data } = await supabase
        .from('analysis_cache')
        .select('ticker')
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        const seen = new Set(STAPLE_TICKERS);
        trendingTickers = data
          .map(r => r.ticker)
          .filter(t => !seen.has(t))
          .slice(0, 4);
      }
    } catch {
      // Supabase unavailable — use staples only
    }

    const allTickers = [...STAPLE_TICKERS, ...trendingTickers];
    const quotes = await getBatchQuotes(allTickers);

    const items: TickerTapeItem[] = [];
    for (const symbol of allTickers) {
      const q = quotes.get(symbol);
      if (!q || !q.c) continue;
      items.push({
        symbol,
        price: q.c.toFixed(2),
        change: `${q.dp >= 0 ? '+' : ''}${q.dp.toFixed(2)}%`,
        positive: q.dp >= 0,
      });
    }

    return items.length > 0 ? items : getFallbackData();
  } catch {
    return getFallbackData();
  }
}

function getFallbackData(): TickerTapeItem[] {
  return STAPLE_TICKERS.map(s => ({
    symbol: s,
    price: '—',
    change: '—',
    positive: true,
  }));
}
