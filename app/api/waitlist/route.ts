import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
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

    const { data: inserted, error: insertError } = await supabase
      .from('waitlist')
      .insert({
        email: trimmed,
        referral_code: referralCode,
        referred_by: validReferrer,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Waitlist insert error:', JSON.stringify(insertError));
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to join waitlist' }, { status: 500 });
    }

    const { count } = await supabase.from('waitlist').select('*', { count: 'exact', head: true });
    const position = count ?? 1;
    await supabase.from('waitlist').update({ position }).eq('id', inserted.id);

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
