// POST /api/thesis/adopt { ticker } — FOLLOW a house thesis verbatim.
// Creates the user's thesis with provenance (source='house', house_ref) and
// copies the house pillars as confirmed, origin='house'. The inherited catch
// history stays where it honestly lives: the public /thesis/[ticker] page —
// it is Helm's track record, never presented as the user's own.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getHouseThesis } from '@/lib/content/house-theses';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: { ticker?: unknown };
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }
    const ticker = typeof body.ticker === 'string' ? body.ticker.trim().toUpperCase() : '';
    const house = ticker ? getHouseThesis(ticker) : undefined;
    if (!house) return NextResponse.json({ error: 'No house thesis for that ticker' }, { status: 404 });

    // Existing thesis with pillars => nothing to adopt over (never clobber user work).
    const { data: existing } = await supabase
      .from('theses')
      .select('id')
      .eq('user_id', user.id)
      .eq('ticker', ticker)
      .maybeSingle();
    if (existing) {
      const { count } = await supabase
        .from('thesis_pillars')
        .select('id', { count: 'exact', head: true })
        .eq('thesis_id', existing.id);
      if ((count ?? 0) > 0) {
        return NextResponse.json({ error: `You already have a ${ticker} thesis. Edit it from the Theses page.` }, { status: 409 });
      }
    }

    let thesisId = existing?.id as string | undefined;
    if (!thesisId) {
      const { data: inserted, error: insErr } = await supabase
        .from('theses')
        .insert({
          user_id: user.id,
          ticker,
          tracked: true,
          source: 'house',
          house_ref: ticker,
          notes: `Follows Helm's ${ticker} thesis (adopted ${new Date().toISOString().slice(0, 10)}).`,
        })
        .select('id')
        .maybeSingle();
      if (insErr || !inserted) {
        console.error('[adopt] thesis insert failed:', insErr);
        return NextResponse.json({ error: 'Failed to create thesis' }, { status: 500 });
      }
      thesisId = inserted.id;
    } else {
      await supabase
        .from('theses')
        .update({ tracked: true, source: 'house', house_ref: ticker })
        .eq('id', thesisId);
    }

    const { error: pillarErr } = await supabase.from('thesis_pillars').insert(
      house.pillars.map((p, i) => ({
        thesis_id: thesisId,
        user_id: user.id,
        claim: p.claim,
        origin: 'house',
        confirmed: true,
        lifecycle: 'confirmed',
        status: 'unverified',
        sort_order: i,
      })),
    );
    if (pillarErr) {
      console.error('[adopt] pillar insert failed:', pillarErr);
      return NextResponse.json({ error: 'Failed to copy pillars' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ticker, pillars: house.pillars.length });
  } catch (err) {
    console.error('[adopt] unhandled:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
