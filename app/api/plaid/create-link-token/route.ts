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

    // Only include redirect_uri when a real app URL is configured (production/preview).
    // Plaid rejects unregistered redirect URIs, and localhost isn't registered by default.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    let redirectUri: string | undefined;

    if (receivedRedirectUri) {
      try {
        const parsed = new URL(receivedRedirectUri);
        const appUrlObj = new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://helmterminal.dev');
        if (parsed.origin === appUrlObj.origin) {
          redirectUri = `${parsed.origin}/oauth-callback`;
        }
      } catch {
      }
    } else if (appUrl && appUrl.startsWith('https://')) {
      // Production/preview with HTTPS — safe to include
      redirectUri = `${appUrl}/oauth-callback`;
    }

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'Helm Terminal',
      // INVESTMENTS IS THE REQUIRED PRODUCT, NOT TRANSACTIONS.
      //
      // Correct config for a product whose job is reading holdings: it
      // guarantees the institution supports Investments, and
      // `required_if_supported_products` still picks up Transactions wherever
      // the institution offers it, without narrowing the picker.
      //
      // ⚠️ It does NOT fix what it was originally believed to fix. This comment
      // used to claim that requiring Transactions hid Fidelity and Webull from
      // the picker. Checked against Plaid PRODUCTION on 2026-08-21, both halves
      // are false:
      //
      //   Fidelity, Schwab, Vanguard, Edward Jones and Robinhood all support
      //   `transactions` as well as `investments`, so the old config rejected
      //   none of them.
      //
      //   Webull was not in Plaid's institution catalogue AT ALL on 2026-08-21,
      //   under any product filter; neither was Public.com. No link token config
      //   could have surfaced them. (2026-08-28: Webull Financial has since
      //   appeared, ins_138410, investments + OAuth. Public.com still absent.)
      //
      // So the ~9 `institution_not_found` exits were people looking for
      // brokerages Plaid does not cover, and the answer to those is the import
      // path, not a Link setting. Reproduce with
      // scripts/probe-plaid-institutions.ts.
      products: [Products.Investments],
      required_if_supported_products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
      ...(redirectUri && { redirect_uri: redirectUri }),
      ...(webhookUrl && { webhook: webhookUrl }),
    });

    return NextResponse.json({
      link_token: response.data.link_token,
      expiration: response.data.expiration,
    });
  } catch (error: unknown) {
    // Plaid errors include response.data with error_type, error_code, error_message
    const plaidError = (error as { response?: { data?: { error_type?: string; error_code?: string; error_message?: string } } })?.response?.data;
    if (plaidError?.error_code) {
      console.error('Plaid link token error:', plaidError.error_type, plaidError.error_code, plaidError.error_message);
      return NextResponse.json({ error: 'Failed to create link token. Please try again.' }, { status: 500 });
    }
    console.error('Error creating link token:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}
