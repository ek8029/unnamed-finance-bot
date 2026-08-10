import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasThesisAccess } from '@/lib/thesis-access-server';
import { draftPillars } from '@/lib/thesis-seed';
import { rateLimit } from '@/lib/rate-limit';
import { triggerBackfill, ONBOARDING_AUTO_TRACK_CAP } from '@/lib/thesis-backfill-trigger';
import { FREE_THESIS_LIMIT } from '@/lib/thesis-entitlement';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Free users may draft and confirm a capped number of theses and read the
    // history behind them; ongoing monitoring is what Pro buys, and that is
    // enforced in the scoring cron via entitledToMonitoring.
    //
    // This route used to 404 for anyone below Pro, which meant a free user's
    // onboarding silently produced no theses at all. That is the reason the
    // no-card connect trial existed: it was propping up the flagship moment.
    const pro = await hasThesisAccess(user.id, user.email);

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

    // The cap applies to NEW theses only. Re-seeding one they already hold must
    // keep working, or a free user could not reopen their own thesis.
    if (!thesis && !pro) {
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

    if (!thesis) {
      const { data: inserted, error: insertError } = await supabase
        .from('theses')
        .insert({ user_id: user.id, ticker, tracked: false })
        .select('*')
        .maybeSingle();

      if (insertError || !inserted) {
        // Unique violation = a concurrent draft (double-fired effect, double
        // click) already created the row. Adopt it instead of failing the draft.
        const { data: existing } = await supabase
          .from('theses')
          .select('*')
          .eq('user_id', user.id)
          .eq('ticker', ticker)
          .maybeSingle();
        if (!existing) {
          console.error('[thesis/seed] insert thesis error:', insertError);
          return NextResponse.json({ error: 'Failed to create thesis' }, { status: 500 });
        }
        thesis = existing;
      } else {
        thesis = inserted;
      }
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

    // Draft new pillars via AI, grounded in what we already know:
    // - every existing claim (incl. dismissed — those must never be re-proposed)
    // - the securities row, so funds/ETFs get the vehicle-level prompt
    const { data: sec } = await supabase
      .from('securities')
      .select('security_name, asset_class')
      .eq('ticker', ticker)
      .maybeSingle();

    const drafted = await draftPillars(ticker, {
      existingClaims: pillars.map((p: { claim: string }) => p.claim),
      assetClass: (sec?.asset_class as string | null) ?? null,
      securityName: (sec?.security_name as string | null) ?? null,
    });

    let allPillars = pillars;

    if (drafted.length > 0) {
      // Re-check right before insert: a concurrent request may have drafted
      // pillars while our (slow) model call ran. Never double-insert drafts.
      if (!resuggest) {
        const { data: recheck } = await supabase
          .from('thesis_pillars')
          .select('*')
          .eq('thesis_id', thesis.id)
          .order('sort_order', { ascending: true });
        if ((recheck ?? []).length > 0) {
          return NextResponse.json({
            thesis,
            pillars: (recheck ?? []).filter((p: { lifecycle: string }) => p.lifecycle !== 'dismissed'),
          });
        }
      }

      const maxExistingSortOrder =
        pillars.length > 0
          ? Math.max(...pillars.map((p: { sort_order: number }) => p.sort_order ?? 0))
          : -1;

      const toInsert = drafted.map((p, i) => ({
        thesis_id: thesis.id,
        user_id: user.id,
        claim: p.claim,
        breaks_if: p.breaksIf,
        origin: 'ai_draft' as const,
        confirmed: false,
        status: 'unverified' as const,
        sort_order: maxExistingSortOrder + 1 + i,
      }));

      let { data: insertedPillars, error: insertPillarsError } = await supabase
        .from('thesis_pillars')
        .insert(toInsert)
        .select('*');

      // Graceful pre-migration fallback: if the breaks_if column (migration 053)
      // is not applied yet, retry without it rather than failing the draft.
      if (insertPillarsError && /breaks_if/i.test(insertPillarsError.message ?? '')) {
        const stripped = toInsert.map(({ breaks_if: _omit, ...rest }) => rest);
        const retry = await supabase.from('thesis_pillars').insert(stripped).select('*');
        insertedPillars = retry.data;
        insertPillarsError = retry.error;
      }

      if (insertPillarsError) {
        console.error('[thesis/seed] insert pillars error:', insertPillarsError);
        return NextResponse.json({ error: 'Failed to insert pillars' }, { status: 500 });
      }

      allPillars = [...pillars, ...(insertedPillars ?? [])];
    }

    // Auto-track what the user confirmed, up to a cap, and load its history.
    //
    // This used to require that the ticker be the user's single LARGEST holding
    // and that they had zero tracked theses. It almost never fired. Of twelve
    // real users holding theses, five had nothing monitored at all, and every
    // one of them was a trial user: they confirmed a thesis, the app saved it,
    // and the agent never looked at it again. Nothing in the UI said so.
    //
    // It also tracked without backfilling, because the backfill trigger lived
    // only in the PATCH route. So even the user who picked their largest
    // holding got a thesis with an empty record, and adverse findings arrive at
    // roughly half a per thesis per month, so a fortnight showed them nothing.
    //
    // Confirming a pillar is still the bar: tracking implies the agent has
    // user-vetted reasons to watch, and an unconfirmed draft must never produce
    // a tracked-but-empty thesis.
    const hasConfirmed = allPillars.some(
      (p: { confirmed: boolean; lifecycle: string }) => p.confirmed && p.lifecycle !== 'dismissed',
    );
    const { count: trackedCount, error: trackedCountError } = await supabase
      .from('theses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('tracked', true);

    if (
      hasConfirmed &&
      !trackedCountError &&
      !thesis.tracked &&
      (trackedCount ?? 0) < ONBOARDING_AUTO_TRACK_CAP
    ) {
      const { error: updateError } = await supabase
        .from('theses')
        .update({ tracked: true })
        .eq('id', thesis.id);

      if (!updateError) {
        thesis = { ...thesis, tracked: true };
        // Twelve months of history, so the thesis has a record immediately
        // rather than waiting on the next thing to happen in the market.
        triggerBackfill(request, ticker);
      }
    }

    // dismissed rows kept in dedupe set above but never surfaced to the client
    return NextResponse.json({ thesis, pillars: allPillars.filter((p: { lifecycle: string }) => p.lifecycle !== 'dismissed') });
  } catch (error) {
    console.error('[thesis/seed] unhandled error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
