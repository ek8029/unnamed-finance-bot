import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { plaidClient, getWebhookUrl } from '@/lib/plaid';
import { Products, CountryCode } from 'plaid';
import { rateLimit, getClientIP } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    // Rate limit: 10 requests per IP per hour
    const ip = getClientIP(request);
    const limit = rateLimit(`plaid-link:${ip}`, 10, 3600);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      );
    }

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

    // Determine redirect_uri for OAuth bank support (Chase, Capital One, etc.)
    // Production requires HTTPS; must match the URI configured in Plaid dashboard
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const baseRedirectUri = `${appUrl}/oauth-callback`;

    // If returning from OAuth, use the base URL from the received redirect URI
    let redirectUri = baseRedirectUri;
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
    console.error('Error creating link token:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}
