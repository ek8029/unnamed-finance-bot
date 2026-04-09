import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getTickerNews, scoreSentiment } from '@/lib/polygon';
import { rateLimit } from '@/lib/rate-limit';
import { detectPrimaryTicker } from '@/lib/news-primary-ticker';

export async function POST() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed } = rateLimit(`news-refresh:${user.id}`, 3, 300);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    // 1. Fetch all unique tickers from the user's holdings + their sectors
    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('ticker, security_id')
      .eq('user_id', user.id);

    if (holdingsError) {
      console.error('Error fetching holdings:', holdingsError);
      return NextResponse.json({ error: 'Failed to fetch holdings' }, { status: 500 });
    }

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({ success: true, message: 'No holdings', inserted: 0 });
    }

    const uniqueTickers = [...new Set(holdings.map(h => h.ticker).filter(Boolean))];
    if (uniqueTickers.length === 0) {
      return NextResponse.json({ success: true, message: 'No valid tickers', inserted: 0 });
    }

    // Build ticker -> sector map from securities table
    const securityIds = [...new Set(
      holdings.map(h => h.security_id).filter(Boolean)
    )];
    const tickerSectorMap = new Map<string, string>();
    const tickerNameMap = new Map<string, string>();
    if (securityIds.length > 0) {
      const { data: securities } = await supabase
        .from('securities')
        .select('ticker, sector, security_name')
        .in('id', securityIds);
      for (const s of securities || []) {
        const upperTicker = s.ticker?.toUpperCase();
        if (!upperTicker) continue;
        if (s.sector) tickerSectorMap.set(upperTicker, s.sector);
        if (s.security_name) tickerNameMap.set(upperTicker, s.security_name);
      }
    }

    // 2. Fetch news from Polygon
    const articles = await getTickerNews(uniqueTickers, 30);

    if (articles.length === 0) {
      return NextResponse.json({ success: true, message: 'No news from Polygon', inserted: 0 });
    }

    // 3. Check which article URLs already exist
    const articleUrls = articles.map(a => a.article_url).filter(Boolean);
    const { data: existingArticles } = await supabase
      .from('market_news')
      .select('url')
      .in('url', articleUrls);

    const existingUrls = new Set((existingArticles || []).map(a => a.url));

    // 4. Filter to only new articles
    const newArticles = articles.filter(a => a.article_url && !existingUrls.has(a.article_url));

    if (newArticles.length === 0) {
      return NextResponse.json({
        success: true,
        fetched: articles.length,
        inserted: 0,
        message: 'All articles already exist',
      });
    }

    // 5. Insert new articles with sentiment scoring, sector tagging, and primary-ticker detection
    const inserts = newArticles.map(article => {
      // Score sentiment from title + description
      const sentiment = scoreSentiment(
        `${article.title} ${article.description}`
      );

      // Map tickers to sectors
      const sectors = [...new Set(
        article.tickers
          .map(t => tickerSectorMap.get(t.toUpperCase()))
          .filter(Boolean)
      )];

      // Determine primary (subject) ticker — prevents tangentially mentioned
      // tickers from being misattributed to the article in the daily brief
      const primaryTicker = detectPrimaryTicker(
        article.title,
        article.description,
        article.tickers,
        tickerNameMap,
      );

      return {
        title: article.title,
        summary: article.description || null,
        content: null,
        url: article.article_url,
        image_url: article.image_url || null,
        source: article.source?.name || null,
        author: article.author || null,
        published_at: article.published_utc || new Date().toISOString(),
        tickers: article.tickers,
        primary_ticker: primaryTicker,
        sectors: sectors.length > 0 ? sectors : null,
        sentiment,
      };
    });

    const { error: insertError } = await supabase.from('market_news').insert(inserts);

    if (insertError) {
      console.error('Error inserting market news:', insertError);
      return NextResponse.json({ error: 'Failed to insert news' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      fetched: articles.length,
      inserted: newArticles.length,
      duplicatesSkipped: articles.length - newArticles.length,
    });
  } catch (error) {
    console.error('Error refreshing market news:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
