import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getSourceTier } from '@/lib/news-quality';
import { newsDisposition } from '@/lib/news-relevance';
import { rankFeed } from '@/lib/market-feed-rank';

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
    const userTickers = tickersParam ? [...new Set(tickersParam.split(',').map(t => t.trim().toUpperCase()).filter(t => /^[A-Z][A-Z.\-]{0,6}$/.test(t)))] : null;

    // ── Build holdings lookup for "Impact on You" context ──
    const holdingsLookup = new Map<string, { totalValue: number; portfolioWeight: number }>();
    if (userTickers && userTickers.length > 0) {
      const { data: holdings } = await supabase
        .from('holdings')
        .select('ticker, total_value, portfolio_allocation_pct')
        .eq('user_id', user.id)
        .in('ticker', userTickers);

      for (const h of (holdings || []) as { ticker: string; total_value: number; portfolio_allocation_pct: number }[]) {
        const upper = h.ticker?.toUpperCase();
        if (!upper) continue;
        const existing = holdingsLookup.get(upper);
        if (existing) {
          existing.totalValue += Number(h.total_value);
          existing.portfolioWeight += Number(h.portfolio_allocation_pct);
        } else {
          holdingsLookup.set(upper, {
            totalValue: Number(h.total_value),
            portfolioWeight: Number(h.portfolio_allocation_pct),
          });
        }
      }
    }

    // Fetch market news and events in parallel
    // When user tickers provided, fetch holding-specific news + general (no primary_ticker)
    // When no tickers, fetch all recent news
    const newsQuery = supabase
      .from('market_news')
      .select('*')
      .order('published_at', { ascending: false });

    if (userTickers && userTickers.length > 0) {
      // Holdings news, general market news, and articles filed under someone
      // else's ticker that the classifier re-aimed at a name this reader holds
      // (migration 070). A Costco story tagged AMZN is this reader's news if
      // they hold COST, and it would otherwise never reach them.
      newsQuery.or(
        `primary_ticker.in.(${userTickers.join(',')}),primary_ticker.is.null,subject_ticker.in.(${userTickers.join(',')})`,
      );
    }

    // Pull more than we show: mentions are dropped below, and a feed that
    // fetched exactly 20 would go short by however many were filtered.
    const [newsResult, eventsResult] = await Promise.all([
      newsQuery.limit(60),
      (userTickers && userTickers.length > 0
        ? supabase
            .from('market_events')
            .select('*')
            .in('ticker', userTickers)
            .gte('event_date', new Date().toISOString().split('T')[0])
            .order('event_date', { ascending: true })
            .limit(10)
        : Promise.resolve({ data: [], error: null })
      ),
    ]);

    if (newsResult.error) {
      console.error('Error fetching market news:', newsResult.error);
    }
    if (eventsResult.error) {
      console.error('Error fetching market events:', eventsResult.error);
    }

    const newsTickers = [...new Set((newsResult.data ?? []).flatMap(article => [article.primary_ticker, article.subject_ticker, ...(article.tickers ?? [])]).filter((ticker): ticker is string => typeof ticker === 'string' && Boolean(ticker)))];
    const { data: companies } = newsTickers.length > 0
      ? await supabase.from('securities').select('ticker, security_name').in('ticker', newsTickers)
      : { data: [] };
    const names = new Map<string, string>((companies ?? []).filter(company => company.security_name).map(company => [company.ticker.toUpperCase(), company.security_name as string]));

    // Transform news for frontend
    // Deduplicate by URL (articles with multiple tickers can appear multiple times)
    const seenUrls = new Set<string>();
    const dedupedNews = (newsResult.data || []).filter(article => {
      const key = article.url || article.id;
      if (seenUrls.has(key)) return false;
      seenUrls.add(key);
      return true;
    }).filter(article => newsDisposition(article, names).kind !== 'excluded');

    const news = dedupedNews.map(article => {
      // Use primary_ticker for relevance — the article's actual subject,
      // not a tangentially mentioned ticker from the article's full tag array
      // Only use primary_ticker — never fall back to tickers[0] which causes misattribution.
      // A re-aimed row (070) is attributed to the company it is actually about,
      // so the impact note and the ranking weight describe the right holding.
      const primary = newsDisposition(article, names).ticker;
      const isUserHolding = userTickers && primary && userTickers.includes(primary);

      // "Impact on You" context
      const holding = primary ? holdingsLookup.get(primary.toUpperCase()) : null;

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
        subjectVerdict: article.subject_verdict ?? null,
        subjectTicker: article.subject_ticker ?? null,
        sectors: article.sectors || [],
        publishedAt: article.published_at,
        relevance: isUserHolding
          ? 'Your Holdings'
          : 'Market context',
        // New fields
        sourceTier: getSourceTier(article.source),
        positionValue: holding?.totalValue ?? null,
        portfolioWeight: holding?.portfolioWeight ?? null,
        impactNote: holding
          ? `You hold $${Math.round(holding.totalValue).toLocaleString('en-US')} of ${primary} (${holding.portfolioWeight.toFixed(1)}% of portfolio)`
          : null,
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

    // Rank by what a position is worth to this reader, capped so no single
    // ticker takes the page. Recency still decides inside a ticker. Measured
    // 2026-09-03: pure recency gave AMZN, a 1.0% position, 9 of the 20 slots
    // while 12 of the 36 held tickers got nothing at all.
    const intelligence = rankFeed(
      [
        ...news.map(n => ({
          ...n,
          // The subject is what the cap groups on; a null one is market-wide.
          ticker: n.primaryTicker ?? null,
          weight: n.portfolioWeight,
          sortMs: new Date(n.publishedAt).getTime(),
          isEvent: false,
          category: 'news' as const,
        })),
        ...events.map(e => ({
          ...e,
          ticker: e.ticker ?? null,
          weight: e.ticker ? holdingsLookup.get(e.ticker.toUpperCase())?.portfolioWeight ?? null : null,
          sortMs: new Date(e.eventDate).getTime(),
          isEvent: true,
          category: 'event' as const,
        })),
      ],
      { capPerTicker: 2, limit: 15 },
    );

    return NextResponse.json({
      news,
      events,
      intelligence,
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
