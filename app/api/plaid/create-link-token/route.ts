import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { plaidClient, getWebhookUrl } from '@/lib/plaid';
import { Products, CountryCode } from 'plaid';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const webhookUrl = getWebhookUrl();

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'Helm Terminal',
      products: [Products.Transactions],
      optional_products: [Products.Investments],
      country_codes: [CountryCode.Us],
      language: 'en',
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
