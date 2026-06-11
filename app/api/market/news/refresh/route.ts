import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { refreshMarketNews } from '@/lib/market-sync';
import { rateLimit } from '@/lib/rate-limit';

/**
 * POST /api/market/news/refresh
 *
 * Refreshes market_news + market_events from free, license-clean
 * sources (Nasdaq per-ticker RSS, SEC EDGAR 8-K filings).
 */
export async function POST() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Global limit — news is shared across all users, no need to refresh often
    const { allowed } = rateLimit('news-refresh:global', 2, 3600);
    if (!allowed) {
      return NextResponse.json({
        success: true,
        message: 'News recently refreshed — serving existing articles',
      });
    }

    const serviceClient = await createServiceClient();
    const log: string[] = [];
    await refreshMarketNews(serviceClient, log);

    return NextResponse.json({ success: true, log });
  } catch (error) {
    console.error('Error refreshing market news:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
