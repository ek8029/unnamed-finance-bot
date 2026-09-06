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
// one-click unsubscribe sets, and it wins over everything. Those preferences
// live on `user_preferences.user_id`, not on `user_profiles`.
import type { SupabaseClient } from '@supabase/supabase-js';
import { resend, FROM_EMAIL } from '@/lib/emails/resend';
import { getThesisBreachTemplate } from '@/lib/emails/templates';
import { unsubUrl } from '@/lib/emails/unsubscribe';
import { alertPreference, wantsAlerts } from '@/lib/notify/preferences';
import { normalizeFact } from '@/lib/notify/material';
import { recordDelivery } from '@/lib/notify/deliver';
import { sendPush } from '@/lib/push/send';
import { reasonBroke } from '@/lib/push/voice';
import { createHash } from 'crypto';

/** The same rule every Helm sender uses. Kept under this name because it is
 *  what this module has always been called from, and what the tests exercise. */
export const wantsBreachAlerts = wantsAlerts;

export interface BreachEvent {
  userId: string;
  ticker: string;
  claim: string;
  excerpt: string;
  sourceTitle: string;
  sourceUrl: string | null;
}

/** Identity of a breach: the ticker and the pillar it broke, with any figures
 *  in the claim normalized out so the same break cannot log twice. */
function breachNotifyKey(b: BreachEvent): string {
  return createHash('sha256')
    .update(['breach', b.ticker, normalizeFact(b.claim)].join('|'))
    .digest('hex')
    .slice(0, 32);
}

export async function sendBreachAlerts(
  serviceClient: SupabaseClient,
  breaches: BreachEvent[],
  log: string[],
): Promise<number> {
  // PUSH FIRST. The phone is the channel this promise was made for ("tells
  // you the moment a reason stops being true"). Edge triggered like the
  // email, so it is never gated on the delivery record; the record is written
  // for the log. lib/push/send applies the level, the toggles and the cap.
  let pushed = 0;
  for (const b of breaches) {
    try {
      const r = await sendPush(
        serviceClient, b.userId, 'breach',
        reasonBroke({ ticker: b.ticker, claim: b.claim, sourceTitle: b.sourceTitle, thesisId: (b as { thesisId?: string }).thesisId }),
        [breachNotifyKey(b)], { gateOnRecord: false },
      );
      pushed += r.sent;
    } catch (err) {
      log.push(`[breach] push failed for ${b.ticker}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }
  if (pushed > 0) log.push(`[breach] pushed to ${pushed} device(s)`);

  // PAUSED 2026-08-24 pre-App-Store-launch: a breach email reached the Apple
  // demo account mid-review-prep. Findings still land in the app and the
  // brief; only the EMAIL channel is off. Delete this block to resume.
  if (true as boolean) {
    log.push(`[breach] email channel paused (pre-launch), ${breaches.length} breach(es) not mailed`);
    return 0;
  }

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
      // The columns are on user_PREFERENCES, keyed by user_id. This module used
      // to read them off user_profiles, which has never had them: the select
      // errored, the row came back null, and a null row reads as "never
      // answered" and therefore opted in. Every opt-out in the table was
      // silently overridden. One shared reader now, so there is one place to
      // get this wrong instead of one per cron.
      const pref = await alertPreference(serviceClient, b.userId);
      if (!pref.ok) {
        log.push(`[breach] Preference read failed for ${b.ticker}, skipped: ${pref.reason}`);
        continue;
      }
      if (!pref.wants) {
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
      // Recorded, but never gated on. A breach is edge triggered: it fires only
      // on a pillar flipping to broken, so it cannot repeat on its own, and a
      // pillar that is repaired and later breaks again has genuinely earned a
      // second alert. The record exists so the delivery log answers "what has
      // Helm told this person" for every channel, not just some of them.
      await recordDelivery(serviceClient, b.userId, [breachNotifyKey(b)], 'email');
      log.push(`[breach] Alerted ${email.slice(0, 4)}... ${b.ticker}: "${b.claim.slice(0, 40)}"`);
    } catch (err) {
      log.push(`[breach] Send failed for ${b.ticker}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }
  return sent;
}
