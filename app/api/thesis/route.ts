import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasThesisAccess } from '@/lib/thesis-access-server';
import { FREE_THESIS_LIMIT } from '@/lib/thesis-entitlement';

// GET /api/thesis — list all user theses with their pillars (no evidence)
// Reading your own theses is free, and the scoring cron keeps one free thesis
// under watch (selectMonitored). Pro buys monitoring for every position and
// the agentic pipelines. Creating one is capped for free users.
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { data: theses, error: thesesError } = await supabase
      .from('theses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (thesesError) {
      console.error('[thesis] GET list theses error:', thesesError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const thesesList = theses ?? [];

    if (thesesList.length === 0) {
      return NextResponse.json({ theses: [] });
    }

    const thesisIds = thesesList.map((t) => t.id);

    const { data: pillars, error: pillarsError } = await supabase
      .from('thesis_pillars')
      .select('*')
      .in('thesis_id', thesisIds)
      .neq('lifecycle', 'dismissed')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true });

    if (pillarsError) {
      console.error('[thesis] GET list pillars error:', pillarsError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const pillarsByThesis = new Map<string, typeof pillars>();
    for (const pillar of pillars ?? []) {
      const existing = pillarsByThesis.get(pillar.thesis_id) ?? [];
      existing.push(pillar);
      pillarsByThesis.set(pillar.thesis_id, existing);
    }

    const pillarIds = (pillars ?? []).map((p) => p.id);
    let latestByPillar = new Map<string, unknown>();
    if (pillarIds.length > 0) {
      const { data: evidence, error: evidenceError } = await supabase
        .from('pillar_evidence')
        .select('*')
        .in('pillar_id', pillarIds)
        .order('created_at', { ascending: false });
      if (evidenceError) {
        console.error('[thesis] GET list evidence error:', evidenceError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }
      latestByPillar = new Map();
      for (const e of evidence ?? []) {
        const cur = latestByPillar.get(e.pillar_id) as { verdict: string } | undefined;
        if (!cur) { latestByPillar.set(e.pillar_id, e); continue; }
        if (cur.verdict !== 'contradicts' && e.verdict === 'contradicts') latestByPillar.set(e.pillar_id, e);
      }
    }

    const result = thesesList.map((t) => ({
      ...t,
      pillars: (pillarsByThesis.get(t.id) ?? []).map((p) => ({
        ...p,
        latest_evidence: latestByPillar.get(p.id) ?? null,
      })),
    }));

    return NextResponse.json({ theses: result });
  } catch (err) {
    console.error('[thesis] GET list unhandled error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// POST /api/thesis — create (or return existing) thesis for a ticker
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const pro = await hasThesisAccess(user.id, user.email);

    const body = await request.json() as { ticker?: unknown };
    const rawTicker = body.ticker;

    if (typeof rawTicker !== 'string' || rawTicker.trim().length === 0) {
      return NextResponse.json({ error: 'ticker is required' }, { status: 400 });
    }

    const ticker = rawTicker.trim().toUpperCase();
    if (!/^[A-Z.\-]{1,10}$/.test(ticker)) {
      return NextResponse.json({ error: 'Invalid ticker format' }, { status: 400 });
    }

    // Return existing thesis if already present
    const { data: existing, error: fetchError } = await supabase
      .from('theses')
      .select('*')
      .eq('user_id', user.id)
      .eq('ticker', ticker)
      .maybeSingle();

    if (fetchError) {
      console.error('[thesis] POST fetch error:', fetchError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({ thesis: existing });
    }

    // Same cap as the seed route, applied to new theses only so reopening one
    // they already hold keeps working.
    if (!pro) {
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

    const { data: inserted, error: insertError } = await supabase
      .from('theses')
      .insert({ user_id: user.id, ticker, tracked: false })
      .select('*')
      .maybeSingle();

    if (insertError || !inserted) {
      console.error('[thesis] POST insert error:', insertError);
      return NextResponse.json({ error: 'Failed to create thesis' }, { status: 500 });
    }

    return NextResponse.json({ thesis: inserted }, { status: 201 });
  } catch (err) {
    console.error('[thesis] POST unhandled error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
