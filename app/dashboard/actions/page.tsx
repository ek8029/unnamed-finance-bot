import { createClient } from '@/lib/supabase/server';
import { getUserTier } from '@/lib/tier';
import { ActionsClient, type ActionItem } from './actions-client';

/** Strip volatile dollar amounts and percentages for stable dedup */
function normalizeTitle(title: string): string {
  return title
    .replace(/\$[\d,]+(\.\d+)?/g, '$X')
    .replace(/\d+(\.\d+)?%/g, 'X%');
}

export default async function ActionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialActions: ActionItem[] = [];
  let isPro = false;

  if (user) {
    const tier = await getUserTier(user.id);
    isPro = tier === 'pro';
    // No Plaid connections = no actions
    const { data: plaidItems } = await supabase
      .from('plaid_items')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    if (!plaidItems || plaidItems.length === 0) {
      return <ActionsClient initialActions={[]} isPro={isPro} />;
    }

    const { data: insights } = await supabase
      .from('insights')
      .select('id, insight_type, priority, title, description, recommended_action, estimated_impact_amount, source_type, related_entity_type, created_at, snoozed_until, is_archived, is_dismissed, is_useful')
      .eq('user_id', user.id)
      .eq('is_dismissed', false)
      .eq('is_archived', false)
      .or('snoozed_until.is.null,snoozed_until.lte.' + new Date().toISOString())
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(20);

    // Transform and deduplicate by normalized title (keep the newest)
    const seenNormalized = new Set<string>();
    initialActions = (insights || [])
      .map(insight => ({
        id: insight.id,
        type: insight.insight_type,
        priority: insight.priority,
        title: insight.title,
        description: insight.description,
        recommended_action: insight.recommended_action,
        estimated_impact: insight.estimated_impact_amount,
        source: insight.source_type,
        related_entity_type: insight.related_entity_type,
        created_at: insight.created_at,
      }))
      .filter(insight => {
        const norm = normalizeTitle(insight.title);
        if (seenNormalized.has(norm)) return false;
        seenNormalized.add(norm);
        return true;
      });
  }

  // Strip recommended_action for free users — client-side blur is UX only,
  // server-side stripping prevents data leaks via dev tools
  const safeActions = isPro
    ? initialActions
    : initialActions.map(a => ({ ...a, recommended_action: undefined }));

  return <ActionsClient initialActions={safeActions} isPro={isPro} />;
}
