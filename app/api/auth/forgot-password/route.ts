import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { checkRateLimit, logAuthEvent } from '@/lib/auth-security';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Rate limit: max 3 reset requests per email in 1 hour
    const rateCheck = await checkRateLimit(email, 'password_reset_request', 3, 60);
    if (!rateCheck.allowed) {
      // Still return success to avoid revealing account existence
      return NextResponse.json({ success: true });
    }

    const supabase = await createClient();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/auth/callback?next=/reset-password`,
    });

    if (error) {
      console.error('Password reset error:', error);
    }

    // Log the request regardless
    await logAuthEvent({
      email,
      eventType: 'password_reset_request',
    });

    // Always return success - don't reveal whether the email exists
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in forgot-password route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
