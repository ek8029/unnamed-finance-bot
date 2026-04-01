import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker');
    if (!ticker) {
      return NextResponse.json({ error: 'Ticker required' }, { status: 400 });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: prices } = await supabase
      .from('market_prices')
      .select('price_date, close')
      .eq('ticker', ticker.toUpperCase())
      .gte('price_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('price_date', { ascending: true })
      .limit(30);

    return NextResponse.json({ prices: prices || [] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
