import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { logAuthEvent } from '@/lib/auth-security';

export async function POST() {
  try {
    const supabase = await createClient();

    // Capture user info before signing out
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.auth.signOut();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log logout event
    if (user) {
      await logAuthEvent({
        userId: user.id,
        email: user.email,
        eventType: 'logout',
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in logout route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
