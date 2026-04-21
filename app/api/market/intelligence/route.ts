import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Optional filter by user's holdings (pass tickers as comma-separated)
    const tickersParam = searchParams.get('tickers');
    const userTickers = tickersParam ? tickersParam.split(',') : null;

    // Fetch market news and events in parallel
    // When user tickers provided, fetch holding-specific news + general (no primary_ticker)
    // When no tickers, fetch all recent news
    const newsQuery = supabase
      .from('market_news')
      .select('*')
      .order('published_at', { ascending: false });

    if (userTickers && userTickers.length > 0) {
      // Only news about user's holdings OR general market news (null primary_ticker)
      newsQuery.or(`primary_ticker.in.(${userTickers.join(',')}),primary_ticker.is.null`);
    }

    const [newsResult, eventsResult] = await Promise.all([
      newsQuery.limit(20),
      supabase
        .from('market_events')
        .select('*')
        .gte('event_date', new Date().toISOString().split('T')[0])
        .order('event_date', { ascending: true })
        .limit(10),
    ]);

    if (newsResult.error) {
      console.error('Error fetching market news:', newsResult.error);
    }
    if (eventsResult.error) {
      console.error('Error fetching market events:', eventsResult.error);
    }

    // Transform news for frontend
    const news = (newsResult.data || []).map(article => {
      // Use primary_ticker for relevance — the article's actual subject,
      // not a tangentially mentioned ticker from Polygon's full tag array
      const primary = article.primary_ticker || (article.tickers || [])[0] || null;
      const isUserHolding = userTickers && primary && userTickers.includes(primary);
      return {
        id: article.id,
        type: 'news' as const,
        title: article.title,
        description: article.summary || article.content?.substring(0, 200) || '',
        source: article.source,
        url: article.url,
        sentiment: article.sentiment,
        tickers: article.tickers || [],
        primaryTicker: primary,
        sectors: article.sectors || [],
        publishedAt: article.published_at,
        relevance: isUserHolding
          ? 'Your Holdings'
          : article.sectors?.[0] || 'Market',
      };
    });

    // Transform events for frontend
    const events = (eventsResult.data || []).map(event => {
      let metadata = {};
      try {
        metadata = typeof event.metadata === 'string'
          ? JSON.parse(event.metadata)
          : event.metadata || {};
      } catch {
        metadata = {};
      }

      return {
        id: event.id,
        type: event.event_type as 'earnings' | 'dividend' | 'split' | 'merger' | 'ipo' | 'macro' | 'fed_announcement',
        title: event.title,
        description: event.description || '',
        ticker: event.ticker,
        eventDate: event.event_date,
        impactLevel: event.impact_level,
        metadata,
        // Determine relevance
        relevance: event.ticker
          ? (userTickers?.includes(event.ticker) ? 'Your Holdings' : event.ticker)
          : 'Market-Wide',
      };
    });

    // Combine and sort by relevance/recency
    const intelligence = [
      ...news.map(n => ({
        ...n,
        sortDate: new Date(n.publishedAt),
        category: 'news' as const,
      })),
      ...events.map(e => ({
        ...e,
        sortDate: new Date(e.eventDate),
        category: 'event' as const,
      })),
    ].sort((a, b) => {
      // Prioritize items related to user holdings
      const aRelevant = a.relevance === 'Your Holdings';
      const bRelevant = b.relevance === 'Your Holdings';
      if (aRelevant && !bRelevant) return -1;
      if (!aRelevant && bRelevant) return 1;
      // Then sort by date (news by published, events by upcoming)
      if (a.category === 'event' && b.category === 'event') {
        return a.sortDate.getTime() - b.sortDate.getTime();
      }
      return b.sortDate.getTime() - a.sortDate.getTime();
    });

    return NextResponse.json({
      news,
      events,
      intelligence: intelligence.slice(0, 15),
      counts: {
        news: news.length,
        events: events.length,
      },
    });
  } catch (error) {
    console.error('Error fetching market intelligence:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market intelligence' },
      { status: 500 }
    );
  }
}
