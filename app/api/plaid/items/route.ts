import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/plaid/items
 *
 * The user's brokerage connections, so a client can offer to disconnect one.
 *
 * DELETE /api/plaid/items/[itemId] has existed for a long time and nothing
 * could call it usefully, because there was no way to learn an item's id.
 * /api/accounts returns linked_accounts rows, which carry no plaid_item_id, so
 * the iOS app promised "Disconnect in one tap, any time" and had no tap to
 * offer. This is the missing half.
 *
 * Deliberately returns no tokens. plaid_access_token lives on these rows and
 * has no business leaving the server; the id is all a disconnect needs, and the
 * DELETE route re-verifies ownership from it anyway.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('plaid_items')
    .select('id, institution_name, status, created_at, last_holdings_sync')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to list plaid items:', error);
    return NextResponse.json({ error: 'Failed to load connections' }, { status: 500 });
  }

  // Count the accounts behind each connection so a confirmation can say what is
  // about to be removed rather than asking someone to confirm an abstraction.
  const { data: accounts } = await supabase
    .from('linked_accounts')
    .select('id, plaid_item_ref')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const { data: withTokens } = await supabase
    .from('plaid_items')
    .select('id')
    .eq('user_id', user.id);

  const countByItem = new Map<string, number>();
  for (const item of withTokens ?? []) {
    const n = (accounts ?? []).filter((a) => a.plaid_item_ref === item.id).length;
    countByItem.set(item.id, n);
  }

  return NextResponse.json({
    items: (data ?? []).map((i) => ({
      id: i.id,
      institution: i.institution_name,
      status: i.status ?? 'active',
      connectedAt: i.created_at,
      lastSync: i.last_holdings_sync,
      accountCount: countByItem.get(i.id) ?? 0,
    })),
  });
}
