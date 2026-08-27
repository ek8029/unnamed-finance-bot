import { NextResponse } from 'next/server';
import { openToken } from '@/lib/plaid/token-crypto';
import { createClient } from '@/lib/supabase/server';
import { plaidClient } from '@/lib/plaid';
import { logPlaidSuccess, logPlaidError } from '@/lib/plaid-logger';

/**
 * DELETE /api/plaid/account
 * Full account deletion: disconnects ALL Plaid items and deletes all user financial data.
 * Supports the data-deletion page / GDPR right-to-erasure.
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Get all user's plaid items
    const { data: plaidItems } = await supabase
      .from('plaid_items')
      .select('id, plaid_access_token, institution_name')
      .eq('user_id', user.id);

    const removedItems: string[] = [];

    // 2. Revoke access at Plaid for each item
    for (const item of plaidItems || []) {
      try {
        await plaidClient.itemRemove({
          access_token: openToken(item.plaid_access_token),
        });
        removedItems.push(item.institution_name || item.id);
        await logPlaidSuccess(user.id, 'itemRemove:fullDeletion', { item_id: item.id });
      } catch (error) {
        console.error(`Failed to remove item ${item.id} from Plaid:`, error);
        await logPlaidError(
          user.id, 'itemRemove:fullDeletion',
          'REMOVE_FAILED',
          error instanceof Error ? error.message : 'Unknown error',
          { item_id: item.id },
        );
        // Continue - still clean up our DB
      }
    }

    // Leave a surviving trail BEFORE the wipe — this endpoint deletes plaid_logs too,
    // so without this an unexplained data loss has no evidence (exactly the situation
    // that made a churned user's connection loss impossible to diagnose after the fact).
    console.warn(`[plaid][reset] FULL account data wipe requested by user ${user.id} — removing all items, holdings, accounts, snapshots`);

    // 3. Delete all user financial data (order matters for FK constraints)
    await supabase.from('holdings').delete().eq('user_id', user.id);
    await supabase.from('transactions').delete().eq('user_id', user.id);
    await supabase.from('linked_accounts').delete().eq('user_id', user.id);
    await supabase.from('plaid_items').delete().eq('user_id', user.id);
    await supabase.from('net_worth_snapshots').delete().eq('user_id', user.id);
    await supabase.from('cash_flow_snapshots').delete().eq('user_id', user.id);
    await supabase.from('financial_health_scores').delete().eq('user_id', user.id);
    await supabase.from('plaid_logs').delete().eq('user_id', user.id);

    return NextResponse.json({
      success: true,
      removed_items: removedItems.length,
      institutions: removedItems,
    });
  } catch (error) {
    console.error('Error in full account deletion:', error);
    return NextResponse.json({ error: 'Failed to delete account data' }, { status: 500 });
  }
}
