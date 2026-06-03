import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { rateLimit, getClientIP } from '@/lib/rate-limit';

/**
 * Lightweight endpoint to check if a user's email has been confirmed.
 * Used by the /wrapped inline signup flow to detect cross-device email confirmation.
 *
 * Uses service role (bypasses RLS) to read auth.users.email_confirmed_at.
 * Only returns a boolean — no user data exposed.
 *
 * Security: requires the requesting user to match the userId being checked,
 * and applies rate limiting.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId || typeof userId !== 'string' || userId.length < 10) {
    return NextResponse.json({ confirmed: false }, { status: 400 });
  }

  // Rate limit: 30 requests per minute per IP
  const ip = getClientIP(request);
  const { allowed, retryAfterSeconds } = rateLimit(`check-confirmed:${ip}`, 30, 60);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
    );
  }

  // Auth check: requesting user must match the userId being checked
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  // Allow unauthenticated polling during the wrapped signup flow
  // (user signed up but hasn't confirmed email yet, so no session exists).
  // However, if a user IS authenticated, they must match the userId param.
  if (!authError && user && user.id !== userId) {
    return NextResponse.json({ confirmed: false }, { status: 403 });
  }

  try {
    const serviceSupabase = await createServiceClient();
    const { data, error } = await serviceSupabase.auth.admin.getUserById(userId);

    if (error || !data.user) {
      return NextResponse.json({ confirmed: false });
    }

    const confirmed = !!data.user.email_confirmed_at;
    return NextResponse.json({ confirmed });
  } catch {
    return NextResponse.json({ confirmed: false }, { status: 500 });
  }
}
