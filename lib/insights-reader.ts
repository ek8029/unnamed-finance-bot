import type { SupabaseClient } from '@supabase/supabase-js';
import { hasThesisAccess } from '@/lib/thesis-access-server';
import { getThesisContextForActions, getConvictionByTicker, type ActionThesisContext, type Conviction } from '@/lib/thesis-conviction';
import { V3_COPY } from '@/lib/onboarding/v3-copy';

export interface InsightReadOptions {
  type?: string | null;
  priority?: string | null;
  status?: string | null;
  archived?: string | null;
}

/** Strip volatile dollar amounts and percentages for stable dedup */
function normalizeTitle(title: string): string {
  return title
    .replace(/\$[\d,]+(\.\d+)?/g, '$X')
    .replace(/\d+(\.\d+)?%/g, 'X%');
}

/** Shared by the initial Actions page and its refresh endpoint. Saved insights
 * belong to the user, regardless of whether holdings came from Plaid or manual entry. */
export async function readInsights(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
  options: InsightReadOptions = {},
  isPro = false,
) {
  const { type, priority, status, archived } = options;
  // Set inside the matching branch below (single source for "default open view",
  // reused by the standing-item check further down instead of being recomputed).
  let isDefaultOpenView = false;
  let query = supabase
    .from('insights')
    .select('id, insight_type, priority, title, description, recommended_action, estimated_impact_amount, source_type, created_at, expires_at, snoozed_until, is_archived, is_dismissed, is_useful, related_entity_type, related_entity_ids')
    .eq('user_id', user.id)
    // Helm is an intelligence layer, not a budgeting app (2026-07-24):
    // recurring-charge / spending / credit detections never reach a surface.
    // Concentration is also emitted by the shared thesis-risk pipeline.
    .in('insight_type', ['portfolio', 'market', 'tax', 'concentration', 'performance']);

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
    isDefaultOpenView = true;
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
    .order('priority', { ascending: true }) // Existing API order; the client ranks priorities for display.
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching insights:', error);
    throw new Error('Failed to fetch insights');
  }

  // Thesis interlace: for entitled users, enrich thesis-native actions
  // (related_entity_type='thesis', related_entity_ids=[thesisId,pillarId]) with
  // conviction status + one verbatim contradiction cite.
  let ctx = new Map<string, ActionThesisContext>();
  const ruleCtx = new Map<string, { ticker: string; status: Conviction }>();
  if (await hasThesisAccess(user.id, user.email)) {
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
        recommended_action: isPro ? insight.recommended_action : undefined,
        estimated_impact: insight.estimated_impact_amount,
        source: insight.source_type,
        related_entity_type: insight.related_entity_type,
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

  // Standing item (Task 13): not an insights row, so it carries no PATCH-able id
  // and the client must not render dismiss/snooze/archive for it. Shown only in
  // the default open view (isDefaultOpenView, set above alongside the branch it
  // describes) while exactly one account is active.
  if (isDefaultOpenView) {
    const { data: accts } = await supabase.from('linked_accounts').select('id').eq('user_id', user.id).eq('is_active', true).limit(2);
    if ((accts?.length ?? 0) === 1) {
      transformedInsights.push({
        id: 'standing-second-account', type: 'portfolio', priority: 'low',
        title: V3_COPY.inbox.secondAccountTitle, description: V3_COPY.inbox.secondAccountBody,
        recommended_action: undefined, estimated_impact: null,
        source: 'standing', related_entity_type: null, created_at: new Date(0).toISOString(), expires_at: null,
        snoozed_until: null, is_archived: false, is_dismissed: false, is_useful: null,
      });
    }
  }

  return transformedInsights;
}
