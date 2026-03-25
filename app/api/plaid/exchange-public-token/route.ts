import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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
      }
    }

    // Try to find existing institution by plaid ID or slug
    let institutionId: string;

    const safeInstitutionId = plaidInstitutionId?.replace(/[^a-zA-Z0-9_-]/g, '') || '';
    const safeSlug = slug.replace(/[^a-z0-9-]/g, '');

    const { data: existingInstitution } = await supabase
      .from('institutions')
      .select('id')
      .or(
        safeInstitutionId
          ? `plaid_institution_id.eq.${safeInstitutionId},slug.eq.${safeSlug}`
          : `slug.eq.${safeSlug}`
      )
      .limit(1)
      .single();

    if (existingInstitution) {
      institutionId = existingInstitution.id;
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
        .single();

      if (instError || !newInstitution) {
        console.error('Error creating institution:', instError);
        const { data: retry } = await supabase
          .from('institutions')
          .select('id')
          .eq('slug', slug)
          .single();
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
      console.error('Error storing plaid item:', itemError);
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
