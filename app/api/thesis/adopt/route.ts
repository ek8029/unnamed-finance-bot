// POST /api/thesis/adopt { ticker, pillarIds?, customReason? }
//
// ADOPT a house thesis. Provenance stays explicit (source='house', house_ref,
// origin='house'): this is Helm's reasoning being followed, not the user's own
// history. The inherited catch history stays where it honestly lives, on the
// public /thesis/[ticker] page — it is Helm's track record, never presented as
// the user's.
//
// RECOGNITION, NOT AUTHORING. `pillarIds` lets the caller adopt only the reasons
// that are actually theirs. Picking which claims you hold is what makes it your
// thesis instead of Helm's opinion, and it is the difference between a later
// alert landing on a belief you held and one arguing with a belief you never
// did. Omit `pillarIds` to take the whole thesis (the /dashboard/theses/adopt
// grid does this).
//
// `customReason` is the "something else" escape. A forced choice among three
// house claims is worse than no thesis.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserTier } from '@/lib/tier';
import { getHouseThesis } from '@/lib/content/house-theses';
import { FREE_THESIS_LIMIT } from '@/lib/thesis-entitlement';
import { validateBreaksIf } from '@/lib/pillar-breaks-if';

const MAX_REASON = 300;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: { ticker?: unknown; pillarIds?: unknown; customReason?: unknown; customBreaksIf?: unknown };
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }
    const ticker = typeof body.ticker === 'string' ? body.ticker.trim().toUpperCase() : '';
    const house = ticker ? getHouseThesis(ticker) : undefined;
    if (!house) return NextResponse.json({ error: 'No house thesis for that ticker' }, { status: 404 });

    // Which house claims the user recognised as their own. Unknown ids are
    // dropped rather than erroring: a stale client must not block adoption.
    const wanted = Array.isArray(body.pillarIds)
      ? new Set(body.pillarIds.filter((x): x is string => typeof x === 'string'))
      : null;
    const chosen = wanted ? house.pillars.filter((p) => wanted.has(p.id)) : house.pillars;

    const rawReason = typeof body.customReason === 'string' ? body.customReason.trim() : '';
    const customReason = rawReason ? rawReason.slice(0, MAX_REASON) : null;

    if (chosen.length === 0 && !customReason) {
      return NextResponse.json({ error: 'Pick at least one reason' }, { status: 400 });
    }

    // Their own words still need their own kill criterion. Helm must not invent
    // a test for a claim it did not write, but a pillar with no test at all is
    // invisible to the scorer: the judge only returns `contradicts` when a
    // source advances the breaks_if condition.
    let customBreaksIf: string | null = null;
    if (customReason) {
      const checked = validateBreaksIf(body.customBreaksIf);
      if (!checked.ok) {
        return NextResponse.json({ error: checked.error, field: 'customBreaksIf' }, { status: 400 });
      }
      customBreaksIf = checked.value;
    }

    // Existing thesis with pillars => nothing to adopt over (never clobber user work).
    const { data: existing } = await supabase
      .from('theses')
      .select('id, tracked')
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

    // Free tier tracks ONE thesis. This route used to set tracked=true
    // unconditionally, which walked straight around the gate that
    // PATCH /api/thesis/[ticker] enforces. Adopting is still allowed at the cap
    // — the thesis is created untracked and the response says so, rather than
    // silently implying the cron is watching it.
    let tracked = true;
    if (!existing?.tracked) {
      const tier = await getUserTier(user.id);
      if (tier === 'free') {
        // Ownership cap, matching /api/thesis and /api/thesis/seed. Without it
        // this route was the way around it: 41 house theses exist, so a free
        // account could adopt all of them against an advertised limit of one.
        if (!existing) {
          const { count: owned } = await supabase
            .from('theses')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id);
          if ((owned ?? 0) >= FREE_THESIS_LIMIT) {
            return NextResponse.json(
              {
                error: `Free accounts can hold ${FREE_THESIS_LIMIT} thesis. Pro tracks every position you own.`,
                code: 'PRO_REQUIRED',
              },
              { status: 403 },
            );
          }
        }
        const { count } = await supabase
          .from('theses')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('tracked', true);
        if ((count ?? 0) >= FREE_THESIS_LIMIT) tracked = false;
      }
    }

    const partial = chosen.length < house.pillars.length;
    const notes = partial || customReason
      ? `Adopted from Helm's ${ticker} thesis (${new Date().toISOString().slice(0, 10)}).`
      : `Follows Helm's ${ticker} thesis (adopted ${new Date().toISOString().slice(0, 10)}).`;

    let thesisId = existing?.id as string | undefined;
    if (!thesisId) {
      const { data: inserted, error: insErr } = await supabase
        .from('theses')
        .insert({
          user_id: user.id,
          ticker,
          tracked,
          source: 'house',
          house_ref: ticker,
          notes,
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
        .update({ tracked, source: 'house', house_ref: ticker, notes })
        .eq('id', thesisId);
    }

    const rows = chosen.map((p, i) => ({
      thesis_id: thesisId,
      user_id: user.id,
      claim: p.claim,
      // The kill criterion came across on every house pillar and was being
      // dropped here. It is the field that makes a pillar falsifiable, and
      // barely any user-authored pillar has one.
      breaks_if: p.breaks_if,
      origin: 'house',
      confirmed: true,
      lifecycle: 'confirmed',
      status: 'unverified',
      sort_order: i,
    }));

    // Their own words, when the house claims did not cover it, with the kill
    // criterion they wrote for it. Helm still does not invent the test.
    if (customReason) {
      rows.push({
        thesis_id: thesisId,
        user_id: user.id,
        claim: customReason,
        breaks_if: customBreaksIf as unknown as string,
        origin: 'user',
        confirmed: true,
        lifecycle: 'confirmed',
        status: 'unverified',
        sort_order: rows.length,
      });
    }

    const { error: pillarErr } = await supabase.from('thesis_pillars').insert(rows);
    if (pillarErr) {
      console.error('[adopt] pillar insert failed:', pillarErr);
      return NextResponse.json({ error: 'Failed to copy pillars' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ticker, pillars: rows.length, tracked, partial });
  } catch (err) {
    console.error('[adopt] unhandled:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
