import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasThesisAccess } from '@/lib/thesis-access-server';
import { computePrebuyRisk } from '@/lib/prebuy-risk';

// GET /api/prebuy-risk?ticker=AAPL — pre-buy risk for a name the user is researching.
// Gated behind hasThesisAccess (hard 403). Reuses the candidate's already-drafted
// pillars (from /api/thesis/seed) to drive shared-driver overlap; no new model spend.
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await hasThesisAccess(user.id, user.email))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const rawTicker = searchParams.get('ticker');

    if (!rawTicker || rawTicker.trim().length === 0) {
      return NextResponse.json({ error: 'ticker is required' }, { status: 400 });
    }

    const ticker = rawTicker.trim().toUpperCase();
    if (!/^[A-Z.\-]{1,10}$/.test(ticker)) {
      return NextResponse.json({ error: 'Invalid ticker format' }, { status: 400 });
    }

    // Pull the candidate's pillars (drafted by /api/thesis/seed) so the shared-driver
    // check has claims to compare. Dismissed rows excluded.
    const { data: thesis } = await supabase
      .from('theses')
      .select('id')
      .eq('user_id', user.id)
      .eq('ticker', ticker)
      .maybeSingle();

    let candidatePillars: { claim: string }[] = [];
    if (thesis) {
      const { data: pillars } = await supabase
        .from('thesis_pillars')
        .select('claim, lifecycle')
        .eq('thesis_id', thesis.id)
        .eq('user_id', user.id);
      candidatePillars = (pillars ?? [])
        .filter((p: { lifecycle: string }) => p.lifecycle !== 'dismissed')
        .map((p: { claim: string }) => ({ claim: p.claim }))
        .filter((p) => typeof p.claim === 'string' && p.claim.trim().length > 0);
    }

    const risk = await computePrebuyRisk({ ticker, userId: user.id, candidatePillars });

    return NextResponse.json({ risk });
  } catch (err) {
    console.error('[prebuy-risk] GET unhandled error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
