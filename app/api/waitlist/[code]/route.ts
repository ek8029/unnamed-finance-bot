import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Referral code is required' }, { status: 400 });
    }

    const trimmed = code.trim().toUpperCase();
    const supabase = await createClient();

    // Look up the referrer
    const { data: referrer } = await supabase
      .from('waitlist')
      .select('position, referral_code, created_at')
      .eq('referral_code', trimmed)
      .maybeSingle();

    if (!referrer) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 });
    }

    // Count how many people this code referred
    const { count } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true })
      .eq('referred_by', trimmed);

    return NextResponse.json({
      referral_code: referrer.referral_code,
      position: referrer.position,
      referral_count: count ?? 0,
    });
  } catch (error) {
    console.error('Waitlist lookup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
