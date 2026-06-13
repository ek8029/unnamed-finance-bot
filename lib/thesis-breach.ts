// lib/thesis-breach.ts
// Thesis Breach Alert delivery. HARD CONSTRAINT (pre-launch): alerts go ONLY
// to the allowlisted test account. Real users must never receive test alerts.
// TODO(launch): replace allowlist with per-user notification preferences.
import type { SupabaseClient } from '@supabase/supabase-js';
import { resend, FROM_EMAIL } from '@/lib/emails/resend';
import { getThesisBreachTemplate } from '@/lib/emails/templates';

const ALERT_ALLOWLIST = new Set(['evank8029@gmail.com']);

export function isAllowedAlertRecipient(email: string): boolean {
  return ALERT_ALLOWLIST.has(email.trim().toLowerCase());
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
      if (!isAllowedAlertRecipient(email)) {
        log.push(`[breach] ${email.slice(0, 4)}... not allowlisted, skipped (${b.ticker})`);
        continue;
      }
      const tpl = getThesisBreachTemplate(b);
      await resend.emails.send({ from: FROM_EMAIL, to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });
      sent++;
      log.push(`[breach] Alerted ${email.slice(0, 4)}... ${b.ticker}: "${b.claim.slice(0, 40)}"`);
    } catch (err) {
      log.push(`[breach] Send failed for ${b.ticker}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }
  return sent;
}
