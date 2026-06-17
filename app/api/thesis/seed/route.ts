import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasThesisAccess } from '@/lib/thesis-access-server';
import { draftPillars } from '@/lib/thesis-seed';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await hasThesisAccess(user.id, user.email))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json() as { ticker?: unknown; resuggest?: unknown };
    const rawTicker = body.ticker;

    if (typeof rawTicker !== 'string' || rawTicker.trim().length === 0) {
      return NextResponse.json({ error: 'ticker is required' }, { status: 400 });
    }

    const ticker = rawTicker.trim().toUpperCase();
    if (!/^[A-Z.\-]{1,10}$/.test(ticker)) {
      return NextResponse.json({ error: 'Invalid ticker format' }, { status: 400 });
    }

    const resuggest = body.resuggest === true;

    // Rate limit per user: draftPillars calls gpt-4o. Tighter cap on the
    // resuggest regeneration path since it re-bills the model every call.
    const limit = resuggest
      ? rateLimit(`thesis-seed-resuggest:${user.id}`, 5, 3600)
      : rateLimit(`thesis-seed:${user.id}`, 10, 3600);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', retryAfterSeconds: limit.retryAfterSeconds },
        { status: 429 },
      );
    }

    // Fetch or create thesis
    let { data: thesis, error: thesisError } = await supabase
      .from('theses')
      .select('*')
      .eq('user_id', user.id)
      .eq('ticker', ticker)
      .maybeSingle();

    if (thesisError) {
      console.error('[thesis/seed] fetch thesis error:', thesisError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!thesis) {
      const { data: inserted, error: insertError } = await supabase
        .from('theses')
        .insert({ user_id: user.id, ticker, tracked: false })
        .select('*')
        .maybeSingle();

      if (insertError || !inserted) {
        console.error('[thesis/seed] insert thesis error:', insertError);
        return NextResponse.json({ error: 'Failed to create thesis' }, { status: 500 });
      }
      thesis = inserted;
    }

    // Fetch existing pillars (dismissed rows intentionally included -- a dismissed draft must never be re-proposed)
    const { data: existingPillars, error: pillarsError } = await supabase
      .from('thesis_pillars')
      .select('*')
      .eq('thesis_id', thesis.id)
      .order('sort_order', { ascending: true });

    if (pillarsError) {
      console.error('[thesis/seed] fetch pillars error:', pillarsError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const pillars = existingPillars ?? [];

    if (pillars.length > 0 && !resuggest) {
      // dismissed rows kept in dedupe set above but never surfaced to the client
      return NextResponse.json({ thesis, pillars: pillars.filter((p: { lifecycle: string }) => p.lifecycle !== 'dismissed') });
    }

    // Draft new pillars via AI
    const drafted = await draftPillars(ticker);

    let allPillars = pillars;

    if (drafted.length > 0) {
      const maxExistingSortOrder =
        pillars.length > 0
          ? Math.max(...pillars.map((p: { sort_order: number }) => p.sort_order ?? 0))
          : -1;

      const toInsert = drafted.map((p, i) => ({
        thesis_id: thesis.id,
        user_id: user.id,
        claim: p.claim,
        origin: 'ai_draft' as const,
        confirmed: false,
        status: 'unverified' as const,
        sort_order: maxExistingSortOrder + 1 + i,
      }));

      const { data: insertedPillars, error: insertPillarsError } = await supabase
        .from('thesis_pillars')
        .insert(toInsert)
        .select('*');

      if (insertPillarsError) {
        console.error('[thesis/seed] insert pillars error:', insertPillarsError);
        return NextResponse.json({ error: 'Failed to insert pillars' }, { status: 500 });
      }

      allPillars = [...pillars, ...(insertedPillars ?? [])];
    }

    // Auto-track: if user has no tracked theses and this ticker is their largest holding
    const { count: trackedCount, error: trackedCountError } = await supabase
      .from('theses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('tracked', true);

    if (!trackedCountError && (trackedCount ?? 0) === 0) {
      const { data: largestHolding } = await supabase
        .from('holdings')
        .select('ticker, total_value')
        .eq('user_id', user.id)
        .order('total_value', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (largestHolding?.ticker === ticker) {
        const { error: updateError } = await supabase
          .from('theses')
          .update({ tracked: true })
          .eq('id', thesis.id);

        if (!updateError) {
          thesis = { ...thesis, tracked: true };
        }
      }
    }

    // dismissed rows kept in dedupe set above but never surfaced to the client
    return NextResponse.json({ thesis, pillars: allPillars.filter((p: { lifecycle: string }) => p.lifecycle !== 'dismissed') });
  } catch (error) {
    console.error('[thesis/seed] unhandled error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
