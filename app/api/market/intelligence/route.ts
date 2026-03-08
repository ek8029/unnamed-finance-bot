import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Optional filter by user's holdings (pass tickers as comma-separated)
    const tickersParam = searchParams.get('tickers');
    const userTickers = tickersParam ? tickersParam.split(',') : null;

    // Fetch market news and events in parallel
    const [newsResult, eventsResult] = await Promise.all([
      supabase
        .from('market_news')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(20),
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
    const news = (newsResult.data || []).map(article => ({
      id: article.id,
      type: 'news' as const,
      title: article.title,
      description: article.summary || article.content?.substring(0, 200) || '',
      source: article.source,
      url: article.url,
      sentiment: article.sentiment,
      tickers: article.tickers || [],
      sectors: article.sectors || [],
      publishedAt: article.published_at,
      // Determine relevance based on user tickers
      relevance: userTickers && article.tickers?.some((t: string) => userTickers.includes(t))
        ? 'Your Holdings'
        : article.sectors?.[0] || 'Market',
    }));

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
