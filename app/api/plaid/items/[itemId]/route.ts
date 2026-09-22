import { NextResponse } from 'next/server';
import { openToken } from '@/lib/plaid/token-crypto';
import { createClient } from '@/lib/supabase/server';
import { plaidClient } from '@/lib/plaid';
import { logPlaidSuccess, logPlaidError } from '@/lib/plaid-logger';
import { purgePlaidItem, type PurgeClient } from '@/lib/plaid-item-purge';

/**
 * DELETE /api/plaid/items/[itemId]
 * Disconnect a single Plaid item: revokes access at Plaid and deletes from DB.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { itemId } = await params;

    // Fetch the plaid item and verify ownership
    const { data: plaidItem, error: itemError } = await supabase
      .from('plaid_items')
      .select('id, plaid_access_token, plaid_item_id, institution_name')
      .eq('id', itemId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (itemError || !plaidItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // 1. Revoke access at Plaid
    try {
      await plaidClient.itemRemove({
        access_token: openToken(plaidItem.plaid_access_token),
      });
      await logPlaidSuccess(user.id, 'itemRemove', { item_id: itemId });
    } catch (error) {
      // Log but continue - we still want to clean up our DB even if Plaid fails
      console.error('Plaid itemRemove failed:', error);
      await logPlaidError(
        user.id, 'itemRemove',
        'REMOVE_FAILED',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }

    // 2. Delete the item and everything hanging off it. The ordering and the
    // reason it cannot be a bare item delete both live in lib/plaid-item-purge.ts.
    console.warn(`[plaid][disconnect] item ${itemId} removed by user ${user.id} (${plaidItem.institution_name ?? 'unknown'})`);
    // Cast at the boundary: structurally comparing this route's Supabase client
    // against PurgeClient exceeds tsc's instantiation depth (TS2589). The shape
    // is exercised for real in tests/plaid-item-purge.test.ts.
    const purge = await purgePlaidItem(supabase as unknown as PurgeClient, user.id, plaidItem.id);
    for (const f of purge.failures) {
      console.error(`[plaid][disconnect] ${f.table} cleanup failed for item ${itemId}: ${f.message}`);
    }

    return NextResponse.json({
      success: true,
      institution: plaidItem.institution_name,
    });
  } catch (error) {
    console.error('Error removing plaid item:', error);
    return NextResponse.json({ error: 'Failed to disconnect account' }, { status: 500 });
  }
}
