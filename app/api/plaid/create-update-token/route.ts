import { NextResponse } from 'next/server';
import { openToken } from '@/lib/plaid/token-crypto';
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
      .maybeSingle();

    if (itemError || !plaidItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const webhookUrl = getWebhookUrl();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    let redirectUri: string | undefined;
    if (appUrl && appUrl.startsWith('https://')) {
      redirectUri = `${appUrl}/oauth-callback`;
    }

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'Helm Terminal',
      access_token: openToken(plaidItem.plaid_access_token),
      country_codes: [CountryCode.Us],
      language: 'en',
      ...(redirectUri && { redirect_uri: redirectUri }),
      ...(webhookUrl && { webhook: webhookUrl }),
    });

    await logPlaidSuccess(user.id, 'linkTokenCreate:update', { item_id });

    return NextResponse.json({
      link_token: response.data.link_token,
      expiration: response.data.expiration,
    });
  } catch (error: unknown) {
    console.error('Error creating update link token:', error instanceof Error ? error.message : 'Unknown error');
    // Provide a user-friendly message for the most common failure case
    const isInvalidToken = (error as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code === 'INVALID_ACCESS_TOKEN';
    const message = isInvalidToken
      ? 'This connection uses an outdated token. Please disconnect and re-link the account.'
      : 'Failed to create update token. Please try again.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
