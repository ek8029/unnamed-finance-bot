import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { plaidClient, mapPlaidAccountType } from '@/lib/plaid';
import { logPlaidSuccess, logPlaidError } from '@/lib/plaid-logger';
import { extractPlaidError } from '@/lib/plaid-errors';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { public_token, metadata } = await request.json();

    if (!public_token) {
      return NextResponse.json({ error: 'public_token is required' }, { status: 400 });
    }

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    await logPlaidSuccess(user.id, 'itemPublicTokenExchange', { item_id: itemId });

    // Get item details
    const itemResponse = await plaidClient.itemGet({
      access_token: accessToken,
    });
    const item = itemResponse.data.item;

    // Get accounts from Plaid
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });
    const plaidAccounts = accountsResponse.data.accounts;

    // Find or create institution in our DB
    const plaidInstitutionId = item.institution_id;
    const institutionName = metadata?.institution?.name || 'Unknown Institution';
    const slug = institutionName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // --- Duplicate item detection ---
    // Check if user already has a plaid_item for the same institution
    let duplicateItem: { id: string; institution_name: string | null } | null = null;
    if (plaidInstitutionId) {
      const { data: existing } = await supabase
        .from('plaid_items')
        .select('id, institution_name')
        .eq('user_id', user.id)
        .eq('plaid_institution_id', plaidInstitutionId)
        .limit(1)
        .maybeSingle();

      if (existing) {
        duplicateItem = existing;
        // Defer deleting the old item until the new connection is fully persisted
        // (see below). Deleting first made a transient insert failure permanent:
        // the user lost their working connection and got nothing back, ending at
        // zero items. Insert-then-delete keeps the old connection as a safety net.
      }
    }

    // Try to find existing institution by plaid ID or slug
    let institutionId: string;

    // Look up existing institution by plaid ID first, then fall back to slug
    let existingInstitution: { id: string } | null = null;

    if (plaidInstitutionId) {
      const { data: byPlaidId } = await supabase
        .from('institutions')
        .select('id')
        .eq('plaid_institution_id', plaidInstitutionId)
        .limit(1)
        .maybeSingle();
      existingInstitution = byPlaidId;
    }

    if (!existingInstitution) {
      const { data: bySlug } = await supabase
        .from('institutions')
        .select('id')
        .eq('slug', slug)
        .limit(1)
        .maybeSingle();
      existingInstitution = bySlug;
    }

    if (existingInstitution) {
      institutionId = existingInstitution.id;
      // Keep institution name in sync with what Plaid returns — prevents the
      // seed table's fake plaid_institution_ids (e.g. ins_11 seeded "Vanguard"
      // but Plaid returns ins_11 for Charles Schwab) from mislabeling a real
      // connection. MUST use the service client: `institutions` is a shared
      // table and RLS silently no-ops a user-client update (supabase-js does not
      // throw), which is exactly how every Schwab user ended up showing Vanguard.
      if (institutionName && institutionName !== 'Unknown Institution') {
        const admin = await createServiceClient();
        const { error: nameErr } = await admin.from('institutions').update({ name: institutionName }).eq('id', institutionId);
        if (nameErr) console.error(`[plaid] institution name sync failed for ${institutionId} (${institutionName}):`, nameErr.message);
      }
    } else {
      const uniqueSlug = plaidInstitutionId ? `${slug}-${plaidInstitutionId}` : `${slug}-${Date.now()}`;

      const { data: newInstitution, error: instError } = await supabase
        .from('institutions')
        .insert({
          name: institutionName,
          slug: uniqueSlug,
          plaid_institution_id: plaidInstitutionId || null,
          supports_plaid: true,
          institution_type: 'bank',
        })
        .select('id')
        .maybeSingle();

      if (instError || !newInstitution) {
        console.error('Error creating institution:', instError);
        const { data: retry } = await supabase
          .from('institutions')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();
        if (!retry) {
          return NextResponse.json({ error: 'Failed to create institution' }, { status: 500 });
        }
        institutionId = retry.id;
      } else {
        institutionId = newInstitution.id;
      }
    }

    // Store the Plaid item
    const { error: itemError } = await supabase
      .from('plaid_items')
      .insert({
        user_id: user.id,
        plaid_item_id: itemId,
        plaid_access_token: accessToken,
        institution_id: institutionId,
        plaid_institution_id: plaidInstitutionId,
        institution_name: metadata?.institution?.name || null,
        status: 'active',
        available_products: item.available_products || [],
        billed_products: item.billed_products || [],
        consented_products: item.consented_products || [],
      });

    if (itemError) {
      console.error(`[plaid][CRITICAL] item store failed for user ${user.id} (${institutionName}):`, itemError.message);
      return NextResponse.json({ error: 'Failed to store connection' }, { status: 500 });
    }

    // Create linked_accounts for each Plaid account
    const accountInserts = plaidAccounts.map((account) => ({
      user_id: user.id,
      institution_id: institutionId,
      account_name: account.official_name || account.name,
      account_type: mapPlaidAccountType(account.type, account.subtype),
      account_subtype: account.subtype || null,
      account_number_last4: account.mask || null,
      official_name: account.official_name || null,
      current_balance: account.balances.current ?? 0,
      available_balance: account.balances.available ?? null,
      credit_limit: account.balances.limit ?? null,
      currency: account.balances.iso_currency_code || 'USD',
      plaid_access_token: accessToken,
      plaid_account_id: account.account_id,
      is_active: true,
      sync_status: 'healthy',
      last_synced_at: new Date().toISOString(),
    }));

    const { data: createdAccounts, error: accountsError } = await supabase
      .from('linked_accounts')
      .insert(accountInserts)
      .select('id, account_name, account_type, current_balance');

    if (accountsError) {
      console.error('Error creating accounts:', accountsError);
      return NextResponse.json({ error: 'Failed to create accounts' }, { status: 500 });
    }

    // Tripwire: re-read the item we just inserted. supabase-js .insert() does not throw
    // on a silent RLS/no-row failure, and this exact gap — link "succeeds" client-side
    // but no row survives — is what churned a user undetected. If it's gone, shout and
    // fail loudly rather than report success on a connection that does not exist.
    const { data: persisted } = await supabase
      .from('plaid_items')
      .select('id')
      .eq('plaid_item_id', itemId)
      .maybeSingle();
    if (!persisted) {
      console.error(
        `[plaid][CRITICAL] item ${itemId} not found after insert for user ${user.id} ` +
          `(${institutionName}) — connection did not persist`,
      );
      return NextResponse.json({ error: 'Connection did not save. Please try again.' }, { status: 500 });
    }

    // New connection is verified persisted — now it is safe to remove the superseded
    // item. Linked accounts + holdings cascade-delete via FK. If this delete fails,
    // the user simply keeps a harmless duplicate (far better than zero connections).
    if (duplicateItem) {
      await supabase.from('plaid_items').delete().eq('id', duplicateItem.id);
    }

    // 14-day Pro trial on first connect. Only for free users who have never had
    // a trial (trial_ends_at doubles as the has-trialed marker, so reconnecting
    // never restarts the clock). Non-blocking: a failed grant must not fail the link.
    try {
      const admin = await createServiceClient();
      const { data: sub } = await admin
        .from('user_subscriptions')
        .select('tier, trial_ends_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if ((!sub || sub.tier === 'free') && !sub?.trial_ends_at) {
        const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        const { error: trialError } = await admin
          .from('user_subscriptions')
          .upsert(
            { user_id: user.id, tier: 'pro', trial_ends_at: trialEndsAt, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' },
          );
        if (trialError) {
          console.error(`[plaid][trial] grant failed for user ${user.id}:`, trialError.message);
        } else {
          console.log(`[plaid][trial] 14-day Pro trial started for user ${user.id} (ends ${trialEndsAt})`);
        }
      }
    } catch (trialErr) {
      console.error('[plaid][trial] grant threw:', trialErr instanceof Error ? trialErr.message : trialErr);
    }

    return NextResponse.json({
      success: true,
      item_id: itemId,
      accounts_created: createdAccounts?.length || 0,
      accounts: createdAccounts,
      // Include duplicate info so the frontend can prompt the user
      duplicate_institution: duplicateItem ? {
        existing_item_id: duplicateItem.id,
        institution_name: duplicateItem.institution_name || institutionName,
        message: `You already have a connection to ${duplicateItem.institution_name || institutionName}. You can keep both or disconnect the old one from the Accounts page.`,
      } : null,
    });
  } catch (error: unknown) {
    console.error('Error exchanging public token:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Failed to link account. Please try again.' }, { status: 500 });
  }
}
