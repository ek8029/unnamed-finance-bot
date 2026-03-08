import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: accounts, error } = await supabase
      .from('linked_accounts')
      .select(`
        *,
        institution:institutions(name, slug, logo_url)
      `)
      .eq('user_id', user.id)
      .order('current_balance', { ascending: false });

    if (error) {
      console.error('Error fetching accounts:', error);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    // Transform data to match frontend expectations
    const transformedAccounts = accounts?.map(account => ({
      id: account.id,
      user_id: account.user_id,
      institution: account.institution?.name || account.account_name,
      account_type: account.account_type,
      balance: account.current_balance,
      account_name: account.account_name,
      sync_status: account.sync_status,
      last_synced_at: account.last_synced_at,
    }));

    return NextResponse.json({ accounts: transformedAccounts });
  } catch (error) {
    console.error('Error in accounts route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
