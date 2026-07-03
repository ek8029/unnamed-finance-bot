// GET /api/dashboard/holdings-tickers — distinct held tickers for the caller.
// Tiny helper for surfaces that rank content by ownership (thesis adoption grid).
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase.from('holdings').select('ticker').eq('user_id', user.id);
  const tickers = [...new Set((data ?? []).map((h) => String(h.ticker).toUpperCase()))];
  return NextResponse.json({ tickers }, { headers: { 'Cache-Control': 'private, no-store' } });
}
