import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { plaidClient, getWebhookUrl } from '@/lib/plaid';
import { CountryCode } from 'plaid';
import { logPlaidSuccess, logPlaidError } from '@/lib/plaid-logger';

/**
 * Create a link token in UPDATE mode for reconnecting a broken bank connection.
 * Requires the plaid_item ID in the request body.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { item_id } = await request.json();

    if (!item_id) {
      return NextResponse.json({ error: 'item_id is required' }, { status: 400 });
    }

    // Fetch the plaid item and verify ownership
    const { data: plaidItem, error: itemError } = await supabase
      .from('plaid_items')
      .select('plaid_access_token, institution_name')
      .eq('id', item_id)
      .eq('user_id', user.id)
      .single();

    if (itemError || !plaidItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const webhookUrl = getWebhookUrl();
    const isProduction = process.env.PLAID_ENV === 'production';
    const redirectUri = isProduction
      ? 'https://helmterminal.dev/oauth-callback'
      : 'http://localhost:3000/oauth-callback';

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'Helm Terminal',
      access_token: plaidItem.plaid_access_token,
      country_codes: [CountryCode.Us],
      language: 'en',
      redirect_uri: redirectUri,
      ...(webhookUrl && { webhook: webhookUrl }),
    });

    await logPlaidSuccess(user.id, 'linkTokenCreate:update', { item_id });

    return NextResponse.json({
      link_token: response.data.link_token,
      expiration: response.data.expiration,
    });
  } catch (error: unknown) {
    const plaidError = (error as { response?: { data?: { error_message?: string; error_code?: string } } })?.response?.data;
    if (plaidError) {
      console.error('Plaid API error (update token):', JSON.stringify(plaidError, null, 2));
      const message = plaidError.error_code === 'INVALID_ACCESS_TOKEN'
        ? 'This connection uses an outdated token. Please disconnect and re-link the account.'
        : plaidError.error_message || 'Plaid error';
      return NextResponse.json({ error: message, error_code: plaidError.error_code }, { status: 500 });
    }
    console.error('Error creating update link token:', error);
    const message = error instanceof Error ? error.message : 'Failed to create update token';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
