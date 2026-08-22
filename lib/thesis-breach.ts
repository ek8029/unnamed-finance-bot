// lib/thesis-breach.ts
//
// Thesis Breach Alert delivery — the alert the whole product argues for.
//
// This used to carry a one-address allowlist and a TODO(launch). The effect was
// that "Helm rechecks the filings every hour and tells you the moment a reason
// stops being true" — the sentence the signup screen uses to justify asking for
// an account, and the sentence the paywall sells — was true for exactly one
// mailbox. Every other recipient was skipped with a log line nobody read.
//
// Now it honours the preference the user was actually asked for. The mobile
// Tune screen's "Only when something breaks / A quote lands that contradicts a
// reason you hold something" writes `notification_market_alerts`, which is this
// alert, so choosing it now does what it says.
//
// Absent preferences count as opted in, matching the defaults in
// app/api/user/preferences. `notification_email` is the master switch that
// one-click unsubscribe sets, and it wins over everything.
import type { SupabaseClient } from '@supabase/supabase-js';
import { resend, FROM_EMAIL } from '@/lib/emails/resend';
import { getThesisBreachTemplate } from '@/lib/emails/templates';
import { unsubUrl } from '@/lib/emails/unsubscribe';

/** A missing row or a null column means never answered, which is not the same
 *  as declined — the defaults route treats these as on, and so does this. */
export function wantsBreachAlerts(
  prefs: { notification_email?: boolean | null; notification_market_alerts?: boolean | null } | null,
): boolean {
  if (!prefs) return true;
  if (prefs.notification_email === false) return false;
  return prefs.notification_market_alerts !== false;
}

export interface BreachEvent {
  userId: string;
  ticker: string;
  claim: string;
  excerpt: string;
  sourceTitle: string;
  sourceUrl: string | null;
}

export async function sendBreachAlerts(
  serviceClient: SupabaseClient,
  breaches: BreachEvent[],
  log: string[],
): Promise<number> {
  if (!resend || breaches.length === 0) return 0;
  let sent = 0;
  for (const b of breaches) {
    try {
      const { data, error } = await serviceClient.auth.admin.getUserById(b.userId);
      const email = data?.user?.email;
      if (error || !email) {
        log.push(`[breach] No email for user ${b.userId.slice(0, 8)}, skipped`);
        continue;
      }
      const { data: prefs } = await serviceClient
        .from('user_profiles')
        .select('notification_email, notification_market_alerts')
        .eq('id', b.userId)
        .maybeSingle();
      if (!wantsBreachAlerts(prefs)) {
        log.push(`[breach] ${email.slice(0, 4)}... opted out, skipped (${b.ticker})`);
        continue;
      }
      const tpl = getThesisBreachTemplate(b);
      // One-click opt-out, and the List-Unsubscribe header bulk senders are
      // judged on. An alert people cannot turn off is a complaint, not a
      // feature.
      const unsub = unsubUrl(b.userId, 'market');
      await resend.emails.send({
        from: FROM_EMAIL, to: email, subject: tpl.subject, html: tpl.html, text: tpl.text,
        headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      });
      sent++;
      log.push(`[breach] Alerted ${email.slice(0, 4)}... ${b.ticker}: "${b.claim.slice(0, 40)}"`);
    } catch (err) {
      log.push(`[breach] Send failed for ${b.ticker}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }
  return sent;
}
