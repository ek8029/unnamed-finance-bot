import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { logAuthEvent, parseUserAgent } from '@/lib/auth-security';

/**
 * GET /api/auth/sessions
 * Returns recent login activity for the authenticated user.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch recent login events (RLS ensures user only sees their own)
    const { data: events, error } = await supabase
      .from('auth_events')
      .select('id, event_type, ip_address, user_agent, created_at, metadata')
      .eq('user_id', user.id)
      .in('event_type', ['login_success', 'password_change', 'session_revoke'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching sessions:', error);
      return NextResponse.json({ error: 'Failed to fetch login activity' }, { status: 500 });
    }

    // Parse user agents into readable format
    const activity = (events || []).map(event => {
      const parsed = parseUserAgent(event.user_agent || '');
      return {
        id: event.id,
        eventType: event.event_type,
        browser: parsed.browser,
        os: parsed.os,
        device: parsed.device,
        ipAddress: event.ip_address,
        createdAt: event.created_at,
        metadata: event.metadata,
      };
    });

    return NextResponse.json({ activity });
  } catch (error) {
    console.error('Error in sessions route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/auth/sessions
 * Actions: 'revoke_others' - sign out all other sessions.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await request.json();

    if (action === 'revoke_others') {
      // Use service client for admin sign-out of other sessions
      const serviceClient = await createServiceClient();

      // Sign out all sessions for this user globally
      const { error: signOutError } = await serviceClient.auth.admin.signOut(
        user.id,
        'others',
      );

      if (signOutError) {
        console.error('Error revoking sessions:', signOutError);
        return NextResponse.json({ error: 'Failed to revoke sessions' }, { status: 500 });
      }

      await logAuthEvent({
        userId: user.id,
        email: user.email,
        eventType: 'session_revoke',
        metadata: { scope: 'others' },
      });

      return NextResponse.json({ success: true, message: 'All other sessions have been signed out' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in sessions route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
