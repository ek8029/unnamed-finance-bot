import type { SupabaseClient } from '@supabase/supabase-js';

/** Use persisted work, not browser flags or a Plaid-only proxy for activation. */
/** accountCount counts active linked_accounts (Plaid and manual); hasBrief relies on brief_digests UNIQUE(user_id) (033) to mean the user's row exists. */
export async function readActivationState(client: SupabaseClient, userId: string) {
  const [connections, holdings, reasons, accounts, briefs] = await Promise.all([
    client.from('plaid_items').select('id').eq('user_id', userId).limit(1),
    client.from('holdings').select('id').eq('user_id', userId).neq('shares', 0).limit(1),
    client.from('thesis_pillars').select('id').eq('user_id', userId)
      .eq('confirmed', true).neq('lifecycle', 'dismissed').limit(1),
    // A threshold, not a displayed number; the test client only resolves through .limit().
    client.from('linked_accounts').select('id').eq('user_id', userId).eq('is_active', true).limit(100),
    client.from('brief_digests').select('id').eq('user_id', userId).limit(1),
  ]);
  if ([connections, holdings, reasons, accounts, briefs].some(result => result.error)) {
    throw new Error('Could not verify saved portfolio progress');
  }
  const hasConnection = !!connections.data?.length;
  const hasHoldings = !!holdings.data?.length;
  const hasThesis = !!reasons.data?.length;
  return {
    hasConnection, hasHoldings, hasThesis,
    hasSavedWork: hasConnection || hasHoldings || hasThesis,
    accountCount: accounts.data?.length ?? 0,
    hasBrief: !!briefs.data?.length,
  };
}
