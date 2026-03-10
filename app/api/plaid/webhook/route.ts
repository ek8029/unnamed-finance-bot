import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// Plaid webhook types we handle
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

export async function POST(request: Request) {
  try {
    const body: PlaidWebhook = await request.json();
    const { webhook_type, webhook_code, item_id } = body;

    // Use service client since webhooks don't have user auth
    const supabase = await createServiceClient();

    // Look up the plaid item
    const { data: plaidItem, error: itemError } = await supabase
      .from('plaid_items')
      .select('id, user_id, plaid_access_token')
      .eq('plaid_item_id', item_id)
      .single();

    if (itemError || !plaidItem) {
      console.error('Webhook: unknown item_id', item_id);
      // Return 200 so Plaid doesn't retry
      return NextResponse.json({ received: true });
    }

    console.log(`Webhook received: ${webhook_type}.${webhook_code} for item ${item_id}`);

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
        // Mark that holdings need refresh
        await supabase
          .from('plaid_items')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', plaidItem.id);
        break;
      }
      default:
        console.log(`Unhandled webhook type: ${webhook_type}`);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    // Return 200 even on error to prevent Plaid retries
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
      // Flag the item as needing a transaction sync
      // The actual sync happens when we call /api/plaid/sync
      await supabase
        .from('plaid_items')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', plaidItem.id);

      // Log the sync event
      await supabase.from('audit_logs').insert({
        user_id: plaidItem.user_id,
        action: 'plaid.transactions.update',
        entity_type: 'plaid_item',
        entity_id: plaidItem.id,
        metadata: {
          webhook_code: webhookCode,
          new_transactions: body.new_transactions,
        },
      });
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
      // Update item status to reflect the error
      await supabase
        .from('plaid_items')
        .update({
          status: 'error',
          error_code: body.error?.error_code || null,
          error_message: body.error?.error_message || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', plaidItem.id);

      // Update all linked accounts for this item
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
