import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from('user_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('billing_period', 'founding');

    if (error) {
      console.error('[founding-member-count] DB error:', error);
      return NextResponse.json({ count: 0 });
    }

    return NextResponse.json(
      { count: count ?? 0 },
      { headers: { 'Cache-Control': 'public, max-age=60' } },
    );
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
