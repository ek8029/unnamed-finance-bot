import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncPlaidItem, computeSnapshots } from '@/lib/plaid-sync';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed } = rateLimit(`plaid-sync:${user.id}`, 5, 300);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    // Optionally sync a specific item, otherwise sync all
    let itemId: string | undefined;
    try {
      const body = await request.json();
      itemId = body.item_id;
    } catch {
      // No body - sync all items
    }

    // Get user's plaid items
    let query = supabase
      .from('plaid_items')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (itemId) {
      query = query.eq('id', itemId);
    }

    const { data: plaidItems, error: itemsError } = await query;

    if (itemsError) {
      console.error('Error fetching plaid items:', itemsError);
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
    }

    if (!plaidItems || plaidItems.length === 0) {
      // Still compute snapshots — user may have seeded/test data without Plaid items
      await computeSnapshots(supabase, user.id).catch(() => {});
      return NextResponse.json({
        success: true,
        message: 'No active Plaid connections to sync',
        synced: 0,
      });
    }

    const results = [];

    for (const item of plaidItems) {
      try {
        const result = await syncPlaidItem(supabase, user.id, item);
        results.push(result);
      } catch (error) {
        console.error(`Error syncing item ${item.id}:`, error);
        results.push({
          item_id: item.id,
          institution: item.institution_name,
          success: false,
          error: 'Sync failed for this item',
        });
      }
    }

    // Update last_synced_at on all linked accounts
    const now = new Date().toISOString();
    await supabase
      .from('linked_accounts')
      .update({ last_synced_at: now, sync_status: 'healthy' })
      .eq('user_id', user.id)
      .eq('is_active', true);

    // Compute and write snapshots after sync
    await computeSnapshots(supabase, user.id);

    return NextResponse.json({
      success: true,
      synced_at: now,
      results,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
