import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { plaidClient } from '@/lib/plaid';
import { logPlaidSuccess, logPlaidError } from '@/lib/plaid-logger';

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
      .single();

    if (itemError || !plaidItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // 1. Revoke access at Plaid
    try {
      await plaidClient.itemRemove({
        access_token: plaidItem.plaid_access_token,
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

    // 2. Delete holdings for accounts linked to this item
    const { data: linkedAccounts } = await supabase
      .from('linked_accounts')
      .select('id')
      .eq('plaid_access_token', plaidItem.plaid_access_token)
      .eq('user_id', user.id);

    if (linkedAccounts && linkedAccounts.length > 0) {
      const accountIds = linkedAccounts.map(a => a.id);

      // Delete holdings for these accounts
      for (const accountId of accountIds) {
        await supabase
          .from('holdings')
          .delete()
          .eq('account_id', accountId)
          .eq('user_id', user.id);
      }

      // Delete transactions for these accounts
      for (const accountId of accountIds) {
        await supabase
          .from('transactions')
          .delete()
          .eq('account_id', accountId)
          .eq('user_id', user.id);
      }
    }

    // 3. Delete linked accounts
    await supabase
      .from('linked_accounts')
      .delete()
      .eq('plaid_access_token', plaidItem.plaid_access_token)
      .eq('user_id', user.id);

    // 4. Delete the plaid item
    await supabase
      .from('plaid_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', user.id);

    return NextResponse.json({
      success: true,
      institution: plaidItem.institution_name,
    });
  } catch (error) {
    console.error('Error removing plaid item:', error);
    return NextResponse.json({ error: 'Failed to disconnect account' }, { status: 500 });
  }
}
