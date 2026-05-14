import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Lightweight endpoint to check if a user's email has been confirmed.
 * Used by the /wrapped inline signup flow to detect cross-device email confirmation.
 *
 * Uses service role (bypasses RLS) to read auth.users.email_confirmed_at.
 * Only returns a boolean — no user data exposed.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId || typeof userId !== 'string' || userId.length < 10) {
    return NextResponse.json({ confirmed: false }, { status: 400 });
  }

  try {
    const supabase = await createServiceClient();
    const { data, error } = await supabase.auth.admin.getUserById(userId);

    if (error || !data.user) {
      return NextResponse.json({ confirmed: false });
    }

    const confirmed = !!data.user.email_confirmed_at;
    return NextResponse.json({ confirmed });
  } catch {
    return NextResponse.json({ confirmed: false }, { status: 500 });
  }
}
