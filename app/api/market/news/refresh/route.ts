import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * POST /api/market/news/refresh
 *
 * Disabled after the Polygon/Finnhub migration — no licensed news
 * provider. Existing market_news rows continue to serve the feed.
 */
export async function POST() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      fetched: 0,
      inserted: 0,
      message: 'News refresh disabled — no news provider configured',
    });
  } catch (error) {
    console.error('Error refreshing market news:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
