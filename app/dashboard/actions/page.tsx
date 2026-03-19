import { createClient } from '@/lib/supabase/server';
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

  if (user) {
    const { data: insights } = await supabase
      .from('insights')
      .select('id, insight_type, priority, title, description, recommended_action, estimated_impact_amount, source_type, created_at')
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
        created_at: insight.created_at,
      }))
      .filter(insight => {
        const norm = normalizeTitle(insight.title);
        if (seenNormalized.has(norm)) return false;
        seenNormalized.add(norm);
        return true;
      });
  }

  return <ActionsClient initialActions={initialActions} />;
}
