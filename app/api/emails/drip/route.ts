import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
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
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!resend) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 });
  }

  const supabase = await createServiceClient();
  const now = new Date();
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    // Get all users
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (usersError) throw usersError;

    for (const user of users) {
      if (!user.email) continue;

      // Skip users who have Plaid connections
      const { data: plaidItems } = await supabase
        .from('plaid_items')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (plaidItems && plaidItems.length > 0) {
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

      // Get template
      const fullName = user.user_metadata?.full_name;
      const firstName = fullName ? fullName.split(' ')[0] : undefined;
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

    return NextResponse.json({ sent, skipped, errors: errors.length > 0 ? errors : undefined });
  } catch (err) {
    console.error('Drip email error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
