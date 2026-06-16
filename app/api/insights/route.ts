import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { isThesisUser } from '@/lib/thesis-access';
import { getThesisContextForActions, getConvictionByTicker, type ActionThesisContext, type Conviction } from '@/lib/thesis-conviction';

/** Strip volatile dollar amounts and percentages for stable dedup */
function normalizeTitle(title: string): string {
  return title
    .replace(/\$[\d,]+(\.\d+)?/g, '$X')
    .replace(/\d+(\.\d+)?%/g, 'X%');
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const priority = searchParams.get('priority');
    const status = searchParams.get('status');
    const archived = searchParams.get('archived');

    let query = supabase
      .from('insights')
      .select('id, insight_type, priority, title, description, recommended_action, estimated_impact_amount, source_type, created_at, expires_at, snoozed_until, is_archived, is_dismissed, is_useful, related_entity_type, related_entity_ids')
      .eq('user_id', user.id);

    if (status === 'snoozed') {
      // Currently snoozed items
      query = query
        .eq('is_dismissed', false)
        .eq('is_archived', false)
        .gt('snoozed_until', new Date().toISOString());
    } else if (status === 'done') {
      // Completed/useful items (marked useful but not archived)
      query = query
        .eq('is_useful', true)
        .eq('is_archived', false);
    } else if (status === 'archived' || archived === 'true') {
      // Archived items
      query = query.eq('is_archived', true);
    } else {
      // Default "open" view: non-dismissed, non-archived, and not currently snoozed
      query = query
        .eq('is_dismissed', false)
        .eq('is_archived', false)
        .or('snoozed_until.is.null,snoozed_until.lte.' + new Date().toISOString());
    }

    if (type) {
      query = query.eq('insight_type', type);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    const { data: insights, error } = await query
      .order('priority', { ascending: true }) // critical, high, medium, low
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching insights:', error);
      return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
    }

    // Thesis interlace: for allowlisted users, enrich thesis-native actions
    // (related_entity_type='thesis', related_entity_ids=[thesisId,pillarId]) with
    // conviction status + one verbatim contradiction cite. Non-allowlisted users
    // get a byte-identical response (map stays empty, no new fields emitted).
    let ctx = new Map<string, ActionThesisContext>();
    const ruleCtx = new Map<string, { ticker: string; status: Conviction }>();
    if (isThesisUser(user.email)) {
      const thesisActions = (insights || [])
        .filter(i => i.related_entity_type === 'thesis' && Array.isArray(i.related_entity_ids))
        .map(i => ({
          id: i.id,
          thesisId: i.related_entity_ids[0],
          pillarId: i.related_entity_ids[1] ?? null,
        }));
      // Conviction is needed both to enrich thesis-native actions and to stamp
      // rule-based actions below. Compute it once and inject it into the former so
      // it isn't queried twice in one request.
      const conviction = await getConvictionByTicker(supabase, user.id);
      ctx = await getThesisContextForActions(supabase, user.id, thesisActions, conviction);

      // Rule-based actions (concentration/TLH) are ticker-scoped via holding ids in
      // related_entity_ids. If that position has a tracked thesis, stamp a conviction-only
      // chip (no cite: the rule did not fire on thesis evidence). Thesis-native actions
      // handled above take precedence.
      if (conviction.size > 0) {
        const ruleRows = (insights || []).filter(
          i =>
            i.related_entity_type !== 'thesis' &&
            (i.insight_type === 'portfolio' || i.insight_type === 'tax') &&
            Array.isArray(i.related_entity_ids) &&
            i.related_entity_ids.length > 0,
        );
        const holdingIds = [...new Set(ruleRows.flatMap(i => i.related_entity_ids as string[]))];
        if (holdingIds.length > 0) {
          const { data: holdingRows } = await supabase
            .from('holdings')
            .select('id, ticker')
            .eq('user_id', user.id)
            .in('id', holdingIds);
          const tickerByHolding = new Map(
            (holdingRows || []).map((h: { id: string; ticker: string }) => [h.id, h.ticker.toUpperCase()]),
          );
          for (const i of ruleRows) {
            for (const hid of i.related_entity_ids as string[]) {
              const ticker = tickerByHolding.get(hid);
              const status = ticker ? conviction.get(ticker) : undefined;
              if (ticker && status) {
                ruleCtx.set(i.id, { ticker, status });
                break;
              }
            }
          }
        }
      }
    }

    // Transform and deduplicate by normalized title (keep the newest)
    const seenNormalized = new Set<string>();
    const transformedInsights = (insights || [])
      .map(insight => {
        const tc = ctx.get(insight.id);
        const rc = ruleCtx.get(insight.id);
        return {
          id: insight.id,
          type: insight.insight_type,
          priority: insight.priority,
          title: insight.title,
          description: insight.description,
          recommended_action: insight.recommended_action,
          estimated_impact: insight.estimated_impact_amount,
          source: insight.source_type,
          created_at: insight.created_at,
          expires_at: insight.expires_at,
          snoozed_until: insight.snoozed_until,
          is_archived: insight.is_archived,
          is_dismissed: insight.is_dismissed,
          is_useful: insight.is_useful,
          ...(tc
            ? { ticker: tc.ticker, thesisStatus: tc.status, thesisCite: tc.cite }
            : rc
              ? { ticker: rc.ticker, thesisStatus: rc.status }
              : {}),
        };
      })
      .filter(insight => {
        const norm = normalizeTitle(insight.title);
        if (seenNormalized.has(norm)) return false;
        seenNormalized.add(norm);
        return true;
      });

    return NextResponse.json({ insights: transformedInsights });
  } catch (error) {
    console.error('Error in insights route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, action, feedback, snooze_days } = body;

    if (!id || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'dismiss':
        updateData = { is_dismissed: true };
        break;
      case 'useful':
        updateData = { is_useful: true };
        break;
      case 'not_useful':
        updateData = { is_useful: false, is_dismissed: true };
        break;
      case 'feedback':
        updateData = { user_feedback: feedback };
        break;
      case 'snooze': {
        if (!snooze_days || snooze_days < 1) {
          return NextResponse.json({ error: 'snooze_days is required and must be >= 1' }, { status: 400 });
        }
        const snoozedUntil = new Date();
        snoozedUntil.setDate(snoozedUntil.getDate() + snooze_days);
        updateData = { snoozed_until: snoozedUntil.toISOString() };
        break;
      }
      case 'archive':
        updateData = { is_archived: true, is_dismissed: true };
        break;
      case 'unarchive':
        updateData = { is_archived: false, is_dismissed: false };
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { error } = await supabase
      .from('insights')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating insight:', error);
      return NextResponse.json({ error: 'Failed to update insight' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in insights PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
