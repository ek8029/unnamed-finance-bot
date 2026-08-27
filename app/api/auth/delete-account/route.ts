import { createClient, createServiceClient } from '@/lib/supabase/server';
import { openToken } from '@/lib/plaid/token-crypto';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { logAuthEvent } from '@/lib/auth-security';
import { plaidClient } from '@/lib/plaid';
import { getStripe } from '@/lib/stripe';

/**
 * The deletion body shared by both verbs: cancel Stripe billing first (hard
 * abort if that fails), disconnect Plaid items, purge every user-owned table,
 * then delete the auth user. Callers are responsible for having authenticated
 * the user -- and, on the password-verified web path, re-verified them.
 */
async function destroyAccount(user: { id: string; email?: string }) {
    const userId = user.id;
    const serviceClient = await createServiceClient();

    // Cancel any active Stripe subscription BEFORE deleting the user.
    // Hard abort: if cancellation fails we leave the account intact rather
    // than orphan a subscription that would keep billing the customer.
    const { data: subData } = await serviceClient
      .from('user_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('user_id', userId)
      .maybeSingle();

    const stripeSubscriptionId = subData?.stripe_subscription_id ?? null;

    if (stripeSubscriptionId) {
      try {
        await getStripe().subscriptions.cancel(stripeSubscriptionId);
      } catch (stripeError) {
        console.error('Failed to cancel Stripe subscription:', stripeError);
        return NextResponse.json(
          { error: 'Failed to cancel subscription. Please try again or contact support.' },
          { status: 500 }
        );
      }
    }

    const { data: plaidItems } = await serviceClient
      .from('plaid_items')
      .select('id, plaid_access_token')
      .eq('user_id', userId);

    if (plaidItems && plaidItems.length > 0) {
      for (const item of plaidItems) {
        try {
          await plaidClient.itemRemove({
            access_token: openToken(item.plaid_access_token),
          });
        } catch (err) {
          console.error('Plaid itemRemove failed during account deletion:', err);
        }
      }
    }

    // Delete user data from all tables (order matters for FK constraints)
    const tables = [
      // auth_events is append-only (migration 067); the auth.users cascade removes it
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
      'user_watchlist',
      'holdings',
      'transactions',
      'account_balances',
      'linked_accounts',
      'plaid_items',
      'liabilities',
      'user_subscriptions',
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
}

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

    // Verify identity — password for email users, skip for OAuth-only users
    const isOAuthOnly = user.app_metadata?.provider !== 'email'
      && !user.app_metadata?.providers?.includes('email');

    if (isOAuthOnly) {
      // OAuth users don't have a password — confirmation text "DELETE" is sufficient
      if (password !== 'CONFIRM') {
        return NextResponse.json({ error: 'Please type CONFIRM as your password to verify' }, { status: 400 });
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password,
      });
      if (signInError) {
        return NextResponse.json({ error: 'Incorrect password' }, { status: 400 });
      }
    }

    return destroyAccount(user);
  } catch (error) {
    console.error('Error in delete-account route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/auth/delete-account
 * The iOS app's deletion path (guideline 5.1.1(v)). Accepts ONLY Bearer-token
 * auth: a cookie session is rejected outright, so a cross-site POST can never
 * delete a signed-in web user, and the web keeps its password-verified DELETE.
 * The app runs its own two-step confirmation before calling, and the token is
 * validated against Supabase by auth.getUser(), not trusted from its claims.
 */
export async function POST() {
  try {
    const authHeader = (await headers()).get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return await destroyAccount(user);
  } catch (error) {
    console.error('Error in delete-account POST route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
