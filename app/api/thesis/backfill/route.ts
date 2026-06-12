import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { scoreOneThesis, type Thesis } from '@/lib/score-theses';

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

    const body = await request.json() as { ticker?: unknown };
    const rawTicker = typeof body.ticker === 'string' ? body.ticker.trim().toUpperCase() : '';
    if (!rawTicker || !/^[A-Z.\-]{1,10}$/.test(rawTicker)) {
      return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 });
    }
    const ticker = rawTicker;

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

    return NextResponse.json({ ok: true, evidenceAdded, statusChanges, log });
  } catch (err) {
    console.error('[thesis/backfill] unhandled error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
