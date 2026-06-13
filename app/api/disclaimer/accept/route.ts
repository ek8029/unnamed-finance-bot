import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { DISCLAIMER_VERSION } from '@/lib/disclaimer';

/**
 * GET — returns whether the authed user has accepted the current disclaimer version.
 * { accepted: true } iff disclaimer_accepted_at is set AND disclaimer_version === current.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('disclaimer_accepted_at, disclaimer_version')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching disclaimer status:', error);
      return NextResponse.json({ error: 'Failed to fetch disclaimer status' }, { status: 500 });
    }

    const accepted = Boolean(
      profile?.disclaimer_accepted_at && profile?.disclaimer_version === DISCLAIMER_VERSION
    );

    return NextResponse.json({ accepted });
  } catch (error) {
    console.error('Error in disclaimer GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST — records the authed user actively agreeing to the current disclaimer version.
 * Scoped to the authed user's own row.
 */
export async function POST() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({
        disclaimer_accepted_at: new Date().toISOString(),
        disclaimer_version: DISCLAIMER_VERSION,
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error recording disclaimer acceptance:', error);
      return NextResponse.json({ error: 'Failed to record acceptance' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in disclaimer POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
