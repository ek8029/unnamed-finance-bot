import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { logAuthEvent } from '@/lib/auth-security';
import { plaidClient } from '@/lib/plaid';

/**
 * DELETE /api/auth/delete-account
 * Permanently deletes the user's account and all associated data.
 * Requires password confirmation.
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { password, confirmation } = await request.json();

    if (!password) {
      return NextResponse.json({ error: 'Password is required to delete your account' }, { status: 400 });
    }

    if (confirmation !== 'DELETE') {
      return NextResponse.json({ error: 'Please type DELETE to confirm' }, { status: 400 });
    }

    // Verify password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password,
    });

    if (signInError) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 400 });
    }

    const userId = user.id;
    const serviceClient = await createServiceClient();

    const { data: plaidItems } = await serviceClient
      .from('plaid_items')
      .select('plaid_access_token')
      .eq('user_id', userId);

    if (plaidItems && plaidItems.length > 0) {
      for (const item of plaidItems) {
        try {
          await plaidClient.itemRemove({
            access_token: item.plaid_access_token,
          });
        } catch (err) {
          console.error('Plaid itemRemove failed during account deletion:', err);
        }
      }
    }

    // Delete user data from all tables (order matters for FK constraints)
    const tables = [
      'auth_events',
      'insight_sources',
      'insights',
      'recurring_transactions',
      'capital_gains',
      'tax_optimization_tasks',
      'tax_estimates',
      'financial_health_scores',
      'net_worth_snapshots',
      'cash_flow_snapshots',
      'portfolio_performance',
      'portfolio_snapshots',
      'holdings',
      'transactions',
      'account_balances',
      'linked_accounts',
      'plaid_items',
      'liabilities',
      'user_preferences',
      'user_profiles',
    ];

    for (const table of tables) {
      const col = table === 'user_profiles' ? 'id' : 'user_id';
      const { error } = await serviceClient.from(table).delete().eq(col, userId);
      if (error) {
        console.error(`Error deleting from ${table}:`, error.message);
        // Continue - best-effort cleanup
      }
    }

    // Log deletion event before removing auth user
    await logAuthEvent({
      userId,
      email: user.email,
      eventType: 'account_delete',
    });

    // Delete the auth user (this is irreversible)
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Error deleting auth user:', deleteError);
      return NextResponse.json({ error: 'Failed to delete account. Please contact support.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Your account has been permanently deleted' });
  } catch (error) {
    console.error('Error in delete-account route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
