import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getTickerNews } from '@/lib/polygon';

export async function POST() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch all unique tickers from the user's holdings
    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('ticker')
      .eq('user_id', user.id);

    if (holdingsError) {
      console.error('Error fetching holdings:', holdingsError);
      return NextResponse.json(
        { error: 'Failed to fetch holdings' },
        { status: 500 }
      );
    }

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No holdings to fetch news for',
        inserted: 0,
      });
    }

    const uniqueTickers = [...new Set(holdings.map(h => h.ticker).filter(Boolean))];

    if (uniqueTickers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No valid tickers found',
        inserted: 0,
      });
    }

    // 2. Fetch news from Polygon
    const articles = await getTickerNews(uniqueTickers, 30);

    if (articles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No news articles returned from Polygon',
        inserted: 0,
      });
    }

    // 3. Check which article URLs already exist to avoid duplicates
    const articleUrls = articles
      .map(a => a.article_url)
      .filter(url => url && url.length > 0);

    const { data: existingArticles } = await supabase
      .from('market_news')
      .select('url')
      .in('url', articleUrls);

    const existingUrls = new Set(
      (existingArticles || []).map(a => a.url)
    );

    // 4. Filter to only new articles
    const newArticles = articles.filter(
      a => a.article_url && !existingUrls.has(a.article_url)
    );

    if (newArticles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All articles already exist',
        fetched: articles.length,
        inserted: 0,
      });
    }

    // 5. Insert new articles into market_news
    const inserts = newArticles.map(article => ({
      title: article.title,
      summary: article.description || null,
      content: null, // Polygon does not return full content
      url: article.article_url,
      image_url: article.image_url || null,
      source: article.source?.name || null,
      author: article.author || null,
      published_at: article.published_utc || new Date().toISOString(),
      tickers: article.tickers,
      sectors: null, // Polygon news does not include sector data
      sentiment: null, // Sentiment would require a separate analysis step
    }));

    const { error: insertError } = await supabase
      .from('market_news')
      .insert(inserts);

    if (insertError) {
      console.error('Error inserting market news:', insertError);
      return NextResponse.json(
        { error: 'Failed to insert news articles' },
        { status: 500 }
      );
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
      { status: 500 }
    );
  }
}
