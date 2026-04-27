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

      // Check which drip email matches today
      const matchingDay = DRIP_DAYS.find(d => d === daysSinceSignup);
      if (matchingDay === undefined) {
        skipped++;
        continue;
      }

      // Check if already sent this drip
      const { data: alreadySent } = await supabase
        .from('email_drip_log')
        .select('id')
        .eq('user_id', user.id)
        .eq('drip_day', matchingDay)
        .limit(1);

      if (alreadySent && alreadySent.length > 0) {
        skipped++;
        continue;
      }

      // Get template
      const fullName = user.user_metadata?.full_name;
      const firstName = fullName ? fullName.split(' ')[0] : undefined;
      const template = getTemplate(matchingDay, firstName);
      if (!template) {
        skipped++;
        continue;
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
          drip_day: matchingDay,
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
