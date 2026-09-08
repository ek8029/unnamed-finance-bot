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

    // Invalid scope must not silently refresh every connection.
    let itemId: string | undefined;
    try {
      const raw = await request.text();
      if (raw.trim()) {
        const body = JSON.parse(raw);
        if (!body || typeof body !== 'object' || Array.isArray(body) || (body.item_id !== undefined && (typeof body.item_id !== 'string' || !body.item_id.trim()))) {
          return NextResponse.json({ error: 'Invalid connection ID' }, { status: 400 });
        }
        itemId = body.item_id;
      }
    } catch {
      return NextResponse.json({ error: 'Invalid sync request' }, { status: 400 });
    }

    // Get user's plaid items
    let query = supabase
      .from('plaid_items')
      .select('*')
      .eq('user_id', user.id)
      // Transient errors can recover. After update-mode Link, the requested
      // item may remain login_required until its repair webhook arrives.
      .in('status', itemId ? ['active', 'error', 'login_required'] : ['active', 'error']);

    if (itemId) {
      query = query.eq('id', itemId);
    }

    const { data: plaidItems, error: itemsError } = await query;

    if (itemsError) {
      console.error('Error fetching plaid items:', itemsError);
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
    }

    if (!plaidItems || plaidItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: itemId ? 'This connection is unavailable. Reconnect it from Accounts.' : 'No connections available to refresh. Add or reconnect an account.',
        synced: 0,
        failed: 0,
        synced_at: null,
        results: [],
      });
    }

    const results = [];

    for (const item of plaidItems) {
      if (['INVALID_ACCESS_TOKEN', 'ITEM_NOT_FOUND', 'USER_PERMISSION_REVOKED', 'ACCESS_NOT_GRANTED', 'ITEM_ACCESS_NOT_GRANTED'].includes(item.error_code)) {
        results.push({ item_id: item.id, institution: item.institution_name, success: false, error: 'This connection needs to be linked again.' });
        continue;
      }
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

    // syncPlaidItem stamps each account after fetching its balances. A bulk
    // update here would mark failed, manual, and unrequested accounts fresh.
    const synced = results.filter(result => result.success).length;
    const failed = results.length - synced;
    const productWarnings = results.flatMap(result => 'warnings' in result ? result.warnings ?? [] : []);

    // Do not erase imported balances/results if the snapshot needs a retry.
    let warning: string | undefined;
    if (synced > 0) {
      try {
        if (await computeSnapshots(supabase, user.id) === false) warning = 'Balances refreshed, but the portfolio snapshot could not update yet.';
      }
      catch { warning = 'Balances refreshed, but the portfolio snapshot could not update yet.'; }
    }

    return NextResponse.json({
      success: failed === 0 && productWarnings.length === 0 && !warning,
      synced,
      failed,
      synced_at: synced > 0 ? new Date().toISOString() : null,
      results,
      ...((warning || productWarnings.length > 0) ? { warning: [...new Set(productWarnings), ...(warning ? [warning] : [])].join(' ') } : {}),
      ...(failed > 0 ? {
        error: synced > 0
          ? `${synced} connection${synced === 1 ? '' : 's'} refreshed; ${failed} could not refresh. Please try again.`
          : 'Your connections could not refresh. Please try again.',
      } : {}),
    }, { status: failed > 0 || productWarnings.length > 0 || warning ? (synced > 0 ? 207 : 502) : 200 });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
