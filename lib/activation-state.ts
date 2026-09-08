import type { SupabaseClient } from '@supabase/supabase-js';

/** Use persisted work, not browser flags or a Plaid-only proxy for activation. */
export async function readActivationState(client: SupabaseClient, userId: string) {
  const [connections, holdings, reasons] = await Promise.all([
    client.from('plaid_items').select('id').eq('user_id', userId).limit(1),
    client.from('holdings').select('id').eq('user_id', userId).neq('shares', 0).limit(1),
    client.from('thesis_pillars').select('id').eq('user_id', userId)
      .eq('confirmed', true).neq('lifecycle', 'dismissed').limit(1),
  ]);
  if ([connections, holdings, reasons].some(result => result.error)) {
    throw new Error('Could not verify saved portfolio progress');
  }
  const hasConnection = !!connections.data?.length;
  const hasHoldings = !!holdings.data?.length;
  const hasThesis = !!reasons.data?.length;
  return { hasConnection, hasHoldings, hasThesis, hasSavedWork: hasConnection || hasHoldings || hasThesis };
}
