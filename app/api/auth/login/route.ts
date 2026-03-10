import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { checkRateLimit, logAuthEvent } from '@/lib/auth-security';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 },
      );
    }

    // Rate limit: max 5 failed attempts per email in 15 minutes
    const rateCheck = await checkRateLimit(email, 'login_failed', 5, 15);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Too many login attempts. Please try again later.',
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        },
        { status: 429 },
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Log failed attempt
      await logAuthEvent({ email, eventType: 'login_failed', metadata: { reason: error.message } });

      return NextResponse.json(
        { error: error.message },
        { status: 401 },
      );
    }

    // Log successful login
    await logAuthEvent({
      userId: data.user.id,
      email: data.user.email || email,
      eventType: 'login_success',
    });

    // Check if user has MFA factors enrolled
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const verifiedFactors = factorsData?.totp?.filter(f => f.status === 'verified') || [];

    if (verifiedFactors.length > 0) {
      // MFA required - session is at AAL1, client must complete TOTP challenge
      return NextResponse.json({
        mfa_required: true,
        factor_id: verifiedFactors[0].id,
        user: {
          id: data.user.id,
          email: data.user.email,
        },
      });
    }

    return NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      session: {
        access_token: data.session.access_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (error) {
    console.error('Error in login route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
