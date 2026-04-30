import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getQuote } from '@/lib/financial-data';
import { rateLimit } from '@/lib/rate-limit';

const DEFAULT_TICKERS = ['SPY', 'QQQ', 'VIXY', 'TLT'];
const MAX_WATCHLIST_SIZE = 20;
const TICKER_REGEX = /^[A-Z]{1,5}$/;

// ── GET: Return user's watchlist tickers with live quotes ──

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = rateLimit(`watchlist:${user.id}`, 20, 60);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: limited.retryAfterSeconds },
        { status: 429 },
      );
    }

    // Fetch user's watchlist
    const { data: watchlistRows } = await supabase
      .from('user_watchlist')
      .select('ticker')
      .eq('user_id', user.id)
      .order('added_at', { ascending: true });

    const userTickers = (watchlistRows || []).map((r: { ticker: string }) => r.ticker);
    const isDefault = userTickers.length === 0;
    const tickers = isDefault ? DEFAULT_TICKERS : userTickers;

    // Fetch live quotes in parallel
    const results = await Promise.allSettled(
      tickers.map((ticker) => getQuote(ticker)),
    );

    const watchlist = tickers.map((ticker, i) => {
      const result = results[i];
      const quote = result.status === 'fulfilled' ? result.value : null;

      return {
        ticker,
        price: quote?.c ?? null,
        changePct: quote?.dp ?? null,
        changeAmt: quote?.d ?? null,
        isDefault,
      };
    });

    return NextResponse.json(
      { data: watchlist },
      {
        headers: {
          'Cache-Control': 'private, max-age=60',
        },
      },
    );
  } catch (error) {
    console.error('[watchlist] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch watchlist' },
      { status: 500 },
    );
  }
}

// ── POST: Add ticker to watchlist ──

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = rateLimit(`watchlist:${user.id}`, 20, 60);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: limited.retryAfterSeconds },
        { status: 429 },
      );
    }

    const body = await request.json();
    const ticker = typeof body.ticker === 'string' ? body.ticker.trim().toUpperCase() : '';

    if (!TICKER_REGEX.test(ticker)) {
      return NextResponse.json(
        { error: 'Invalid ticker. Must be 1-5 uppercase letters.' },
        { status: 400 },
      );
    }

    // Check current watchlist size
    const { count } = await supabase
      .from('user_watchlist')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if ((count ?? 0) >= MAX_WATCHLIST_SIZE) {
      return NextResponse.json(
        { error: `Watchlist is full. Maximum ${MAX_WATCHLIST_SIZE} tickers allowed.` },
        { status: 400 },
      );
    }

    // Insert — handle unique constraint gracefully
    const { error: insertError } = await supabase
      .from('user_watchlist')
      .insert({ user_id: user.id, ticker });

    if (insertError) {
      // Unique constraint violation (Postgres code 23505)
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Ticker already in watchlist' },
          { status: 409 },
        );
      }
      console.error('[watchlist] POST insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to add ticker' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, ticker }, { status: 201 });
  } catch (error) {
    console.error('[watchlist] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to add ticker' },
      { status: 500 },
    );
  }
}

// ── DELETE: Remove ticker from watchlist ──

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = rateLimit(`watchlist:${user.id}`, 20, 60);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: limited.retryAfterSeconds },
        { status: 429 },
      );
    }

    const body = await request.json();
    const ticker = typeof body.ticker === 'string' ? body.ticker.trim().toUpperCase() : '';

    if (!TICKER_REGEX.test(ticker)) {
      return NextResponse.json(
        { error: 'Invalid ticker. Must be 1-5 uppercase letters.' },
        { status: 400 },
      );
    }

    const { error: deleteError } = await supabase
      .from('user_watchlist')
      .delete()
      .eq('user_id', user.id)
      .eq('ticker', ticker);

    if (deleteError) {
      console.error('[watchlist] DELETE error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to remove ticker' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, ticker });
  } catch (error) {
    console.error('[watchlist] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to remove ticker' },
      { status: 500 },
    );
  }
}
