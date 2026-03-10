import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { checkRateLimit, checkPasswordStrength, logAuthEvent } from '@/lib/auth-security';

export async function POST(request: Request) {
  try {
    const { email, password, full_name } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 },
      );
    }

    // Rate limit: max 5 signup attempts per email in 1 hour
    const rateCheck = await checkRateLimit(email, 'signup', 5, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again later.', retryAfterSeconds: rateCheck.retryAfterSeconds },
        { status: 429 },
      );
    }

    // Validate password strength (require score >= 3)
    const strength = checkPasswordStrength(password);
    if (strength.score < 3) {
      const unmet = strength.requirements.filter(r => !r.met).map(r => r.label);
      return NextResponse.json(
        { error: `Password is too weak. Missing: ${unmet.join(', ')}` },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: full_name || null },
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // Create user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: data.user.id,
        email: data.user.email,
        full_name: full_name || null,
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
    }

    // Create default preferences
    const { error: prefsError } = await supabase
      .from('user_preferences')
      .insert({
        user_id: data.user.id,
        theme: 'dark',
        currency: 'USD',
      });

    if (prefsError) {
      console.error('Error creating preferences:', prefsError);
    }

    // Log signup event
    await logAuthEvent({
      userId: data.user.id,
      email: data.user.email || email,
      eventType: 'signup',
    });

    return NextResponse.json({
      user: { id: data.user.id, email: data.user.email },
      message: data.session
        ? 'Account created successfully'
        : 'Check your email to confirm your account',
    });
  } catch (error) {
    console.error('Error in signup route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
