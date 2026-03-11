import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { plaidClient, getWebhookUrl } from '@/lib/plaid';
import { Products, CountryCode } from 'plaid';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse optional body for OAuth redirect flow
    let receivedRedirectUri: string | undefined;
    try {
      const body = await request.json();
      receivedRedirectUri = body.receivedRedirectUri;
    } catch {
      // No body - normal (non-OAuth) flow
    }

    const webhookUrl = getWebhookUrl();

    // Always include redirect_uri for OAuth bank support (Chase, Capital One, etc.)
    // Uses the base callback URL (no query params) matching Plaid dashboard config
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    let redirectUri = `${appUrl}/oauth-callback`;

    // If returning from OAuth, extract the base URL from the full redirect URI
    if (receivedRedirectUri) {
      try {
        const parsed = new URL(receivedRedirectUri);
        redirectUri = `${parsed.origin}${parsed.pathname}`;
      } catch {
        // Malformed URL - fall back to default
      }
    }

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'Helm Terminal',
      products: [Products.Transactions],
      optional_products: [Products.Investments],
      country_codes: [CountryCode.Us],
      language: 'en',
      redirect_uri: redirectUri,
      ...(webhookUrl && { webhook: webhookUrl }),
    });

    return NextResponse.json({
      link_token: response.data.link_token,
      expiration: response.data.expiration,
    });
  } catch (error: unknown) {
    const plaidError = (error as { response?: { data?: unknown } })?.response?.data;
    if (plaidError) {
      console.error('Plaid API error:', JSON.stringify(plaidError, null, 2));
    } else {
      console.error('Error creating link token:', error);
    }
    const message = error instanceof Error ? error.message : 'Failed to create link token';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
