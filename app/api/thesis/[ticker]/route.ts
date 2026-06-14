import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isThesisUser } from '@/lib/thesis-access';
import { getUserTier } from '@/lib/tier';

function parseTicker(raw: string): { ticker: string } | { error: string } {
  const ticker = raw.trim().toUpperCase();
  if (!/^[A-Z.\-]{1,10}$/.test(ticker)) {
    return { error: 'Invalid ticker format' };
  }
  return { ticker };
}

// GET /api/thesis/[ticker] — one thesis + pillars (ordered) + evidence per pillar
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isThesisUser(user.email)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { ticker: raw } = await params;
    const parsed = parseTicker(raw);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { ticker } = parsed;

    const { data: thesis, error: thesisError } = await supabase
      .from('theses')
      .select('*')
      .eq('user_id', user.id)
      .eq('ticker', ticker)
      .maybeSingle();

    if (thesisError) {
      console.error('[thesis/ticker] GET thesis error:', thesisError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!thesis) {
      return NextResponse.json({ error: 'Thesis not found' }, { status: 404 });
    }

    const { data: pillars, error: pillarsError } = await supabase
      .from('thesis_pillars')
      .select('*')
      .eq('thesis_id', thesis.id)
      .neq('lifecycle', 'dismissed')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true });

    if (pillarsError) {
      console.error('[thesis/ticker] GET pillars error:', pillarsError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const pillarList = pillars ?? [];

    if (pillarList.length === 0) {
      return NextResponse.json({ thesis, pillars: [] });
    }

    const pillarIds = pillarList.map((p) => p.id);

    const { data: evidence, error: evidenceError } = await supabase
      .from('pillar_evidence')
      .select('*')
      .in('pillar_id', pillarIds)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (evidenceError) {
      console.error('[thesis/ticker] GET evidence error:', evidenceError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const evidenceByPillar = new Map<string, typeof evidence>();
    for (const e of evidence ?? []) {
      const existing = evidenceByPillar.get(e.pillar_id) ?? [];
      existing.push(e);
      evidenceByPillar.set(e.pillar_id, existing);
    }

    const pillarsWithEvidence = pillarList.map((p) => ({
      ...p,
      evidence: evidenceByPillar.get(p.id) ?? [],
    }));

    return NextResponse.json({ thesis, pillars: pillarsWithEvidence });
  } catch (err) {
    console.error('[thesis/ticker] GET unhandled error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// PATCH /api/thesis/[ticker] — update notes and/or tracked
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isThesisUser(user.email)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { ticker: raw } = await params;
    const parsed = parseTicker(raw);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { ticker } = parsed;

    const body = await request.json() as { notes?: unknown; tracked?: unknown };

    // Fetch current row
    const { data: thesis, error: fetchError } = await supabase
      .from('theses')
      .select('*')
      .eq('user_id', user.id)
      .eq('ticker', ticker)
      .maybeSingle();

    if (fetchError) {
      console.error('[thesis/ticker] PATCH fetch error:', fetchError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!thesis) {
      return NextResponse.json({ error: 'Thesis not found' }, { status: 404 });
    }

    // Build update payload — only whitelisted fields
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if ('notes' in body) {
      if (body.notes !== null && typeof body.notes !== 'string') {
        return NextResponse.json({ error: 'notes must be a string or null' }, { status: 400 });
      }
      updates.notes = body.notes ?? null;
    }

    if ('tracked' in body) {
      if (typeof body.tracked !== 'boolean') {
        return NextResponse.json({ error: 'tracked must be a boolean' }, { status: 400 });
      }

      // Free-tier gate: only apply when transitioning false -> true
      if (body.tracked === true && thesis.tracked === false) {
        const tier = await getUserTier(user.id);
        if (tier === 'free') {
          const { count } = await supabase
            .from('theses')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('tracked', true);
          if ((count ?? 0) >= 1) {
            return NextResponse.json(
              { error: 'Free tier tracks one thesis. Upgrade to track all your positions.' },
              { status: 403 },
            );
          }
        }
      }

      updates.tracked = body.tracked;
    }

    const { data: updated, error: updateError } = await supabase
      .from('theses')
      .update(updates)
      .eq('user_id', user.id)
      .eq('ticker', ticker)
      .select('*')
      .maybeSingle();

    if (updateError || !updated) {
      console.error('[thesis/ticker] PATCH update error:', updateError);
      return NextResponse.json({ error: 'Failed to update thesis' }, { status: 500 });
    }

    // Fire-and-forget backfill on track enable. Aborts after 3s; the backfill
    // route continues processing server-side. Silently skipped if it fails
    // (backfill re-triggers on next track toggle or manual call).
    if (body.tracked === true && thesis.tracked === false) {
      try {
        const backfillUrl = new URL('/api/thesis/backfill', request.url);
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 3000);
        fetch(backfillUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: request.headers.get('cookie') ?? '',
          },
          body: JSON.stringify({ ticker }),
          signal: controller.signal,
        }).catch(() => {});
      } catch {
        // never block the PATCH response on backfill
      }
    }

    return NextResponse.json({ thesis: updated });
  } catch (err) {
    console.error('[thesis/ticker] PATCH unhandled error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// DELETE /api/thesis/[ticker] — delete thesis (cascades to pillars + evidence)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isThesisUser(user.email)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { ticker: raw } = await params;
    const parsed = parseTicker(raw);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { ticker } = parsed;

    const { data: thesis, error: fetchError } = await supabase
      .from('theses')
      .select('id')
      .eq('user_id', user.id)
      .eq('ticker', ticker)
      .maybeSingle();

    if (fetchError) {
      console.error('[thesis/ticker] DELETE fetch error:', fetchError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!thesis) {
      return NextResponse.json({ error: 'Thesis not found' }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from('theses')
      .delete()
      .eq('user_id', user.id)
      .eq('id', thesis.id);

    if (deleteError) {
      console.error('[thesis/ticker] DELETE error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete thesis' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[thesis/ticker] DELETE unhandled error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// POST /api/thesis/[ticker] — add a user-authored pillar
export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isThesisUser(user.email)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { ticker: raw } = await params;
    const parsed = parseTicker(raw);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { ticker } = parsed;

    const body = await request.json() as { claim?: unknown };
    if (typeof body.claim !== 'string' || body.claim.trim().length === 0) {
      return NextResponse.json({ error: 'claim is required and must be a non-empty string' }, { status: 400 });
    }
    const claim = body.claim.trim();

    const { data: thesis, error: thesisError } = await supabase
      .from('theses')
      .select('id')
      .eq('user_id', user.id)
      .eq('ticker', ticker)
      .maybeSingle();

    if (thesisError) {
      console.error('[thesis/ticker] POST pillar fetch error:', thesisError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!thesis) {
      return NextResponse.json({ error: 'Thesis not found' }, { status: 404 });
    }

    // Compute sort_order = max existing + 1 (or 0 if none)
    const { data: maxRow, error: maxError } = await supabase
      .from('thesis_pillars')
      .select('sort_order')
      .eq('thesis_id', thesis.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxError) {
      console.error('[thesis/ticker] POST pillar sort_order error:', maxError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const sortOrder = maxRow != null ? (maxRow.sort_order ?? 0) + 1 : 0;

    const { data: pillar, error: insertError } = await supabase
      .from('thesis_pillars')
      .insert({
        thesis_id: thesis.id,
        user_id: user.id,
        claim,
        origin: 'user',
        confirmed: true,
        status: 'unverified',
        sort_order: sortOrder,
        lifecycle: 'confirmed',
        lifecycle_at: new Date().toISOString(),
      })
      .select('*')
      .maybeSingle();

    if (insertError || !pillar) {
      console.error('[thesis/ticker] POST pillar insert error:', insertError);
      return NextResponse.json({ error: 'Failed to insert pillar' }, { status: 500 });
    }

    return NextResponse.json({ pillar }, { status: 201 });
  } catch (err) {
    console.error('[thesis/ticker] POST unhandled error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
