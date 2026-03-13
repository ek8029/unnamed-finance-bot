import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Supabase auth callback handler.
 *
 * Handles PKCE code exchange for:
 * - Password reset links
 * - Email confirmation links
 * - Magic link sign-ins
 *
 * Supabase redirects here with ?code=XXX after the user clicks an auth email link.
 * We exchange the code server-side for a session, then redirect to the target page.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error('Auth callback code exchange failed:', error.message);
  }

  // Code exchange failed or no code — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
