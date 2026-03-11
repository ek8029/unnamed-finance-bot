import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { plaidClient } from '@/lib/plaid';
import * as jose from 'jose';
import { createHash } from 'crypto';

type WebhookType =
  | 'TRANSACTIONS'
  | 'ITEM'
  | 'HOLDINGS'
  | 'INVESTMENTS_TRANSACTIONS'
  | 'LIABILITIES';

interface PlaidWebhook {
  webhook_type: WebhookType;
  webhook_code: string;
  item_id: string;
  error?: {
    error_type: string;
    error_code: string;
    error_message: string;
  };
  new_transactions?: number;
  removed_transactions?: string[];
}

// Cache for Plaid webhook verification JWKs (kid -> key)
const keyCache = new Map<string, { key: CryptoKey; fetchedAt: number }>();
const KEY_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Verify the Plaid-Verification header JWT.
 * Returns true if valid, false if verification fails.
 */
async function verifyWebhookSignature(
  request: Request,
  rawBody: string
): Promise<boolean> {
  const verificationHeader = request.headers.get('plaid-verification');
  if (!verificationHeader) {
    console.warn('Webhook missing Plaid-Verification header');
    return false;
  }

  try {
    // 1. Decode the JWT header to get the kid
    const decoded = jose.decodeProtectedHeader(verificationHeader);
    const kid = decoded.kid;

    if (!kid) {
      console.warn('Webhook JWT missing kid');
      return false;
    }

    // 2. Get the JWK (from cache or Plaid API)
    let keyLike: CryptoKey;
    const cached = keyCache.get(kid);

    if (cached && Date.now() - cached.fetchedAt < KEY_CACHE_TTL) {
      keyLike = cached.key;
    } else {
      const keyResponse = await plaidClient.webhookVerificationKeyGet({
        key_id: kid,
      });

      const jwk = keyResponse.data.key;
      keyLike = await jose.importJWK(jwk as jose.JWK, decoded.alg || 'ES256') as CryptoKey;
      keyCache.set(kid, { key: keyLike, fetchedAt: Date.now() });
    }

    // 3. Verify the JWT
    const { payload } = await jose.jwtVerify(verificationHeader, keyLike, {
      maxTokenAge: '5 min',
    });

    // 4. Verify the request body hash
    const expectedHash = payload.request_body_sha256 as string;
    if (!expectedHash) {
      console.warn('Webhook JWT missing request_body_sha256');
      return false;
    }

    const actualHash = createHash('sha256').update(rawBody).digest('hex');
    if (actualHash !== expectedHash) {
      console.warn('Webhook body hash mismatch');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Webhook verification failed:', error);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    // Read body once for both verification and parsing
    const rawBody = await request.text();

    // Verify webhook signature in production
    const isProduction = process.env.PLAID_ENV === 'production';
    if (isProduction) {
      const isValid = await verifyWebhookSignature(request, rawBody);
      if (!isValid) {
        console.error('Webhook signature verification failed - rejecting');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const body: PlaidWebhook = JSON.parse(rawBody);
    const { webhook_type, webhook_code, item_id } = body;

    const supabase = await createServiceClient();

    // Look up the plaid item
    const { data: plaidItem, error: itemError } = await supabase
      .from('plaid_items')
      .select('id, user_id, plaid_access_token')
      .eq('plaid_item_id', item_id)
      .single();

    if (itemError || !plaidItem) {
      console.error('Webhook: unknown item_id', item_id);
      return NextResponse.json({ received: true });
    }

    console.log(`Webhook received: ${webhook_type}.${webhook_code} for item ${item_id}`);

    // Log the webhook event
    await supabase.from('audit_logs').insert({
      user_id: plaidItem.user_id,
      action: `plaid.webhook.${webhook_type}.${webhook_code}`.toLowerCase(),
      entity_type: 'plaid_item',
      entity_id: plaidItem.id,
      metadata: {
        webhook_type,
        webhook_code,
        item_id,
        error: body.error || null,
        new_transactions: body.new_transactions,
      },
    });

    switch (webhook_type) {
      case 'TRANSACTIONS': {
        await handleTransactionsWebhook(supabase, plaidItem, webhook_code, body);
        break;
      }
      case 'ITEM': {
        await handleItemWebhook(supabase, plaidItem, webhook_code, body);
        break;
      }
      case 'HOLDINGS':
      case 'INVESTMENTS_TRANSACTIONS': {
        await supabase
          .from('plaid_items')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', plaidItem.id);
        break;
      }
      default:
        console.log(`Unhandled webhook type: ${webhook_type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ received: true });
  }
}

async function handleTransactionsWebhook(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  plaidItem: { id: string; user_id: string; plaid_access_token: string },
  webhookCode: string,
  body: PlaidWebhook
) {
  switch (webhookCode) {
    case 'SYNC_UPDATES_AVAILABLE':
    case 'INITIAL_UPDATE':
    case 'HISTORICAL_UPDATE':
    case 'DEFAULT_UPDATE': {
      await supabase
        .from('plaid_items')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', plaidItem.id);
      break;
    }
  }
}

async function handleItemWebhook(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  plaidItem: { id: string; user_id: string; plaid_access_token: string },
  webhookCode: string,
  body: PlaidWebhook
) {
  switch (webhookCode) {
    case 'ERROR': {
      const errorCode = body.error?.error_code || null;

      // ITEM_LOGIN_REQUIRED is a specific error that means the user
      // needs to re-authenticate, not a permanent failure
      const status = errorCode === 'ITEM_LOGIN_REQUIRED' ? 'login_required' : 'error';

      await supabase
        .from('plaid_items')
        .update({
          status,
          error_code: errorCode,
          error_message: body.error?.error_message || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', plaidItem.id);

      await supabase
        .from('linked_accounts')
        .update({
          sync_status: 'error',
          sync_error: body.error?.error_message || 'Connection error',
        })
        .eq('plaid_access_token', plaidItem.plaid_access_token);
      break;
    }
    case 'LOGIN_REPAIRED': {
      await supabase
        .from('plaid_items')
        .update({
          status: 'active',
          error_code: null,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', plaidItem.id);

      await supabase
        .from('linked_accounts')
        .update({
          sync_status: 'healthy',
          sync_error: null,
        })
        .eq('plaid_access_token', plaidItem.plaid_access_token);
      break;
    }
    case 'PENDING_EXPIRATION': {
      await supabase
        .from('plaid_items')
        .update({
          status: 'login_required',
          error_message: 'Credentials will expire soon - please re-authenticate',
          updated_at: new Date().toISOString(),
        })
        .eq('id', plaidItem.id);
      break;
    }
  }
}
