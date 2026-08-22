// Sends a published This Week at Helm update to every confirmed user who has
// not opted out (notification_weekly_update). Explicitly invoked from the admin
// editor ("Email subscribers"), never automatic on save — and emailed_at makes
// a second send impossible. testTo sends a single preview email and stamps
// nothing.
import { createServiceClient } from '@/lib/supabase/server';
import { resend } from '@/lib/emails/resend';

// Founder-personal sender: real inbox (replies land with Evan) and the Google
// Workspace profile photo gives the Gmail avatar. Transactional stays on hello@.
const NEWSLETTER_FROM = 'Evan from Helm <evan@helmterminal.dev>';
import { buildWeeklyEmailHtml, type WeeklyEmailInput } from '@/lib/emails/weekly-update-html';

export async function sendWeeklyUpdate(
  week_of: string,
  opts: { testTo?: { userId: string; email: string } } = {},
): Promise<{ ok: boolean; sent?: number; error?: string }> {
  if (!resend) return { ok: false, error: 'Resend is not configured' };
  const db = await createServiceClient();

  const { data: u, error } = await db
    .from('weekly_updates')
    .select('week_of, title, intro, body_helm, body_market, status, emailed_at')
    .eq('week_of', week_of)
    .maybeSingle();
  if (error || !u) return { ok: false, error: error?.message ?? 'Update not found' };

  const subject = `This Week at Helm: ${u.title}`;

  // Test path: one email to the requester, no publish/emailed_at requirements.
  if (opts.testTo) {
    const { error: sendErr } = await resend.emails.send({
      from: NEWSLETTER_FROM,
      to: opts.testTo.email,
      subject: `[TEST] ${subject}`,
      html: buildWeeklyEmailHtml(u as WeeklyEmailInput, opts.testTo.userId),
    });
    if (sendErr) return { ok: false, error: sendErr.message };
    return { ok: true, sent: 1 };
  }

  if (u.status !== 'published') return { ok: false, error: 'Publish the update first' };
  if (u.emailed_at) return { ok: false, error: `Already emailed ${String(u.emailed_at).slice(0, 16)}` };

  // Recipients: confirmed users minus opt-outs minus internal.
  const users: { id: string; email: string }[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    for (const usr of data.users) {
      if (usr.email && usr.email_confirmed_at && usr.email !== 'test@helmterminal.dev') {
        users.push({ id: usr.id, email: usr.email });
      }
    }
    if (data.users.length < 200) break;
  }
  // Both switches, not just this sender's own. notification_email is what the
  // "unsubscribe from everything" link sets, and a sender that reads past it is
  // a sender that ignores an opt-out.
  const { data: optedOut } = await db
    .from('user_preferences')
    .select('user_id, notification_weekly_update, notification_email')
    .or('notification_weekly_update.eq.false,notification_email.eq.false');
  const skip = new Set((optedOut ?? []).map((r) => r.user_id as string));
  const recipients = users.filter((r) => !skip.has(r.id));
  if (recipients.length === 0) return { ok: false, error: 'No recipients' };

  let sent = 0;
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100);
    const { error: sendErr } = await resend.batch.send(
      chunk.map((r) => ({
        from: NEWSLETTER_FROM,
        to: r.email,
        subject,
        html: buildWeeklyEmailHtml(u as WeeklyEmailInput, r.id),
      })),
    );
    if (sendErr) return { ok: false, sent, error: sendErr.message };
    sent += chunk.length;
  }

  await db.from('weekly_updates').update({ emailed_at: new Date().toISOString() }).eq('week_of', week_of);
  return { ok: true, sent };
}
