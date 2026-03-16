import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Admin endpoint to manually set a user's subscription tier.
 *
 * POST /api/admin/upgrade-user
 * Headers: { Authorization: Bearer <CRON_SECRET> }
 * Body:    { email: string, tier: 'free' | 'pro' }
 *
 * Uses the same CRON_SECRET used for the daily cron job.
 */
export async function POST(req: NextRequest) {
  // Auth: require CRON_SECRET
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { email, tier } = body;

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }
  if (!tier || !['free', 'pro'].includes(tier)) {
    return NextResponse.json({ error: 'tier must be "free" or "pro"' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Look up user by email
  const { data: profile, error: lookupError } = await supabase
    .from('user_profiles')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (lookupError || !profile) {
    return NextResponse.json(
      { error: `User not found: ${email}` },
      { status: 404 },
    );
  }

  // Upsert subscription
  const { error: upsertError } = await supabase
    .from('user_subscriptions')
    .upsert(
      { user_id: profile.id, tier, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );

  if (upsertError) {
    console.error('Upgrade failed:', upsertError);
    return NextResponse.json({ error: 'Failed to update tier' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    email: profile.email,
    tier,
    message: `${email} is now on the ${tier} tier.`,
  });
}
