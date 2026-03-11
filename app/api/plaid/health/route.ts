import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: plaidItems, error } = await supabase
      .from('plaid_items')
      .select('id, institution_name, status, last_balances_sync, last_transactions_sync, last_holdings_sync, error_code, error_message, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching plaid items:', error);
      return NextResponse.json({ error: 'Failed to fetch connection health' }, { status: 500 });
    }

    const items = plaidItems || [];
    const errorCount = items.filter(i => i.status !== 'active').length;

    // Find most recent sync across all items
    const syncDates = items
      .flatMap(i => [i.last_balances_sync, i.last_transactions_sync, i.last_holdings_sync])
      .filter(Boolean)
      .map(d => new Date(d!).getTime());

    const lastSync = syncDates.length > 0
      ? new Date(Math.max(...syncDates)).toISOString()
      : null;

    return NextResponse.json({
      lastSync,
      itemCount: items.length,
      errorCount,
      items: items.map(i => ({
        id: i.id,
        institution_name: i.institution_name,
        status: i.status,
        last_balances_sync: i.last_balances_sync,
        last_transactions_sync: i.last_transactions_sync,
        error_code: i.error_code,
        error_message: i.error_message,
      })),
    });
  } catch (error) {
    console.error('Error in plaid health:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
