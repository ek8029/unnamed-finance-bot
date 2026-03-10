import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(request: Request) {
  try {
    const { email, referred_by } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const supabase = await createClient();

    // Check if already on waitlist
    const { data: existing, error: selectError } = await supabase
      .from('waitlist')
      .select('position, referral_code')
      .eq('email', trimmed)
      .maybeSingle();

    if (selectError) {
      console.error('Waitlist select error:', selectError);
      return NextResponse.json({ error: selectError.message }, { status: 500 });
    }

    if (existing) {
      // Count their referrals
      const { count: referralCount } = await supabase
        .from('waitlist')
        .select('*', { count: 'exact', head: true })
        .eq('referred_by', existing.referral_code);

      return NextResponse.json({
        position: existing.position,
        referral_code: existing.referral_code,
        referral_count: referralCount ?? 0,
        already_registered: true,
      });
    }

    // Get current count for position
    const { count, error: countError } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Waitlist count error:', countError);
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    const position = (count ?? 0) + 1;

    // Generate unique referral code (retry on collision)
    let referralCode = generateReferralCode();
    let attempts = 0;
    while (attempts < 5) {
      const { data: collision } = await supabase
        .from('waitlist')
        .select('id')
        .eq('referral_code', referralCode)
        .maybeSingle();

      if (!collision) break;
      referralCode = generateReferralCode();
      attempts++;
    }

    // Validate referred_by code if provided
    let validReferrer: string | null = null;
    if (referred_by && typeof referred_by === 'string') {
      const cleaned = referred_by.trim().toUpperCase();
      if (cleaned.length > 0) {
        const { data: referrer } = await supabase
          .from('waitlist')
          .select('referral_code')
          .eq('referral_code', cleaned)
          .maybeSingle();

        if (referrer) {
          validReferrer = referrer.referral_code;
        }
      }
    }

    const { error: insertError } = await supabase
      .from('waitlist')
      .insert({
        email: trimmed,
        referral_code: referralCode,
        referred_by: validReferrer,
        position,
      });

    if (insertError) {
      console.error('Waitlist insert error:', JSON.stringify(insertError));
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      position,
      referral_code: referralCode,
      referral_count: 0,
      referred_by: validReferrer,
      already_registered: false,
    });
  } catch (error) {
    console.error('Waitlist error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
