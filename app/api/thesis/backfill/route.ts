import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { scoreOneThesis, type Thesis } from '@/lib/score-theses';
import { canBackfill } from '@/lib/thesis-rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

// POST /api/thesis/backfill — trigger 12-month evidence backfill for a tracked thesis
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // The past is free. Backfill is a one-off read of what already happened to
    // a thesis the user confirmed, and it is what makes a new thesis show
    // something instead of an empty page. Pro buys what happens next, enforced
    // in the scoring cron. Still rate limited below, because it costs EDGAR
    // fetches regardless of who asks.

    const body = await request.json() as { ticker?: unknown };
    const rawTicker = typeof body.ticker === 'string' ? body.ticker.trim().toUpperCase() : '';
    if (!rawTicker || !/^[A-Z.\-]{1,10}$/.test(rawTicker)) {
      return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 });
    }
    const ticker = rawTicker;

    // Rate limit per user: backfill runs up to 40 SEC EDGAR fetches per call.
    // Redis-backed, because the in-memory limiter is per-lambda-instance and so
    // is not a per-user bound at all under concurrency. Now that free accounts
    // can reach this route, it is the only thing standing in front of the bill
    // and in front of an EDGAR IP block that would hit every paying user.
    const limit = await canBackfill(user.id);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', retryAfterSeconds: limit.retryAfterSeconds },
        { status: 429 },
      );
    }

    // Fetch thesis
    const { data: thesis, error: thesisError } = await supabase
      .from('theses')
      .select('id, user_id, ticker, tracked, last_scanned_at')
      .eq('user_id', user.id)
      .eq('ticker', ticker)
      .maybeSingle();

    if (thesisError) {
      console.error('[thesis/backfill] thesis fetch error:', thesisError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    if (!thesis) {
      return NextResponse.json({ error: 'Thesis not found' }, { status: 404 });
    }
    if (!thesis.tracked) {
      return NextResponse.json({ error: 'Thesis is not tracked' }, { status: 400 });
    }

    // Require at least one confirmed pillar
    const { count, error: countError } = await supabase
      .from('thesis_pillars')
      .select('id', { count: 'exact', head: true })
      .eq('thesis_id', thesis.id)
      .eq('confirmed', true);

    if (countError) {
      console.error('[thesis/backfill] pillar count error:', countError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    if ((count ?? 0) < 1) {
      return NextResponse.json({ error: 'No confirmed pillars' }, { status: 400 });
    }

    // 12 months ago
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    const since = d.toISOString().split('T')[0];

    const log: string[] = [];
    const { evidenceAdded, statusChanges } = await scoreOneThesis(
      supabase,
      thesis as Thesis,
      log,
      { since, isBackfill: true, maxCandidates: 40 }
    );

    // The log carries raw Supabase error strings, OpenAI SDK messages, judge
    // model names and internal pillar UUIDs. All of it concerns the caller's own
    // data, so this is not cross-tenant disclosure, but it is schema and vendor
    // fingerprinting and there is no reason to hand it to a browser. Counts are
    // what the client actually uses; the detail stays in the server logs.
    if (log.length > 0) console.log(`[thesis/backfill] ${ticker} ${user.id.slice(0, 8)}:`, log.join(' | '));
    return NextResponse.json({ ok: true, evidenceAdded, statusChanges });
  } catch (err) {
    console.error('[thesis/backfill] unhandled error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
