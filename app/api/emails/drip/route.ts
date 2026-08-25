import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { resend, FROM_EMAIL } from '@/lib/emails/resend';
import { getTemplate, DRIP_DAYS } from '@/lib/emails/templates';

/**
 * POST /api/emails/drip
 *
 * Called by daily cron. For each user without Plaid connections,
 * checks how many days since signup and sends the appropriate drip email.
 * Tracks sent emails in `email_drip_log` to avoid duplicates.
 *
 * Protected by CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!resend) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 });
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const now = new Date();
  let sent = 0;
  let skipped = 0;
  let deferred = 0;
  const errors: string[] = [];

  try {
    // Get all users
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (usersError) throw usersError;

    // Who said no. `notification_email` on user_preferences is the master
    // switch that one-click unsubscribe sets (lib/notify/preferences.ts); it
    // has never lived on user_profiles. This route sent with no check at all,
    // which was invisible only because the route was not being reached. A
    // failed read is not consent: skip the run and let tomorrow retry.
    const { data: prefRows, error: prefsError } = await supabase
      .from('user_preferences')
      .select('user_id, notification_email')
      .eq('notification_email', false);
    if (prefsError) {
      return NextResponse.json({ error: `Preference read failed: ${prefsError.message}` }, { status: 500 });
    }
    const optedOut = new Set((prefRows ?? []).map((r: { user_id: string }) => r.user_id));

    // The route was silent from 2026-05-21 to 2026-08-25, so the first run
    // after revival owes about 200 people a drip, most of them the day-30
    // note. A cap turns that into a few days of normal volume instead of one
    // burst; listUsers returns newest first, so fresh signups go first.
    const MAX_SENDS_PER_RUN = 40;

    for (const user of users) {
      if (!user.email) continue;
      if (optedOut.has(user.id)) { skipped++; continue; }
      if (sent >= MAX_SENDS_PER_RUN) { deferred++; continue; }

      // Check Plaid connection status and subscription tier
      const { data: plaidItems } = await supabase
        .from('plaid_items')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      const hasPlaid = plaidItems && plaidItems.length > 0;

      const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('tier, trial_ends_at, stripe_subscription_id')
        .eq('user_id', user.id)
        .maybeSingle();

      // Effective tier: an EXPIRED Plaid-connect trial (no Stripe sub) reads as
      // free — trial expiry is lazy and never persisted, so reading the raw
      // column would keep an expired-trial user out of re-engagement drip forever.
      const trialExpired = !!sub?.trial_ends_at && !sub.stripe_subscription_id && new Date(sub.trial_ends_at) < now;
      const isPaid = !!sub && !!sub.tier && sub.tier !== 'free' && !trialExpired;

      // Paid users don't get drip emails
      if (isPaid) {
        skipped++;
        continue;
      }

      // Calculate days since signup
      const signupDate = new Date(user.created_at);
      const daysSinceSignup = Math.floor((now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24));

      // Get all drip days already sent to this user
      const { data: sentRows } = await supabase
        .from('email_drip_log')
        .select('drip_day')
        .eq('user_id', user.id);

      const sentDays = new Set((sentRows ?? []).map(r => r.drip_day));

      // Find latest applicable unsent drip (highest day <= daysSinceSignup)
      // This catches users who missed earlier windows — they get the most
      // relevant email, not a stale "welcome" 20 days late.
      const applicableDays = [...DRIP_DAYS]
        .filter(d => d <= daysSinceSignup && !sentDays.has(d))
        .sort((a, b) => b - a); // descending — latest first

      if (applicableDays.length === 0) {
        skipped++;
        continue;
      }

      const targetDay = applicableDays[0];

      // Connected users: skip connection nudges (days 1,3,7), only send day 14+ emails
      const fullName = user.user_metadata?.full_name;
      const firstName = fullName ? fullName.split(' ')[0] : undefined;

      if (hasPlaid && targetDay <= 7) {
        // Mark early drip days as skipped for connected users
        const earlyDays = [1, 3, 7].filter(d => d <= daysSinceSignup && !sentDays.has(d));
        if (earlyDays.length > 0) {
          await supabase.from('email_drip_log').insert(
            earlyDays.map(d => ({
              user_id: user.id,
              drip_day: d,
              email_subject: `[skipped — user has Plaid connected]`,
              sent_at: now.toISOString(),
            }))
          );
        }
        skipped++;
        continue;
      }

      const template = getTemplate(targetDay, firstName);
      if (!template) {
        skipped++;
        continue;
      }

      // Mark all earlier skipped days so they don't fire in future runs
      const skippedDays = applicableDays.slice(1);
      if (skippedDays.length > 0) {
        await supabase.from('email_drip_log').insert(
          skippedDays.map(d => ({
            user_id: user.id,
            drip_day: d,
            email_subject: `[skipped — user was day ${daysSinceSignup}]`,
            sent_at: now.toISOString(),
          }))
        );
      }

      // Send
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: user.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });

        // Log it
        await supabase.from('email_drip_log').insert({
          user_id: user.id,
          drip_day: targetDay,
          email_subject: template.subject,
          sent_at: now.toISOString(),
        });

        sent++;
      } catch (err) {
        errors.push(`${user.email}: ${err instanceof Error ? err.message : 'Send failed'}`);
      }
    }

    return NextResponse.json({ sent, skipped, deferred, errors: errors.length > 0 ? errors : undefined });
  } catch (err) {
    console.error('Drip email error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
