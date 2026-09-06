import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { generateDigest, generateGenericDigest } from '@/lib/generate-digest';
import { resend } from '@/lib/emails/resend';
import { materialEventsBlock } from '@/lib/emails/templates';
import { isWeekendET, digestEmailPayload, chunk, type DigestRecipient } from '@/lib/emails/digest-send';
import { sendPush } from '@/lib/push/send';
import { briefReady } from '@/lib/push/voice';
import { dayET } from '@/lib/push/policy';
import type { MaterialEvent } from '@/lib/notify/material';
import { pickMaterialEvents, recordDelivery } from '@/lib/notify/deliver';

interface DigestCronResult {
  generated: number;
  skipped: number;
  log: string[];
  /** User ids that actually received a brief email this run. */
  emailed: string[];
}

/**
 * Core digest generation logic — called directly from daily cron.
 * No HTTP, no fetch, no caching issues.
 */
export async function runDigestCron(options: { force?: boolean; weekends?: boolean } = {}): Promise<DigestCronResult> {
  const log: string[] = [];

  const serviceClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const nowET = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false });
  const currentHourET = parseInt(nowET.split(', ')[1].split(':')[0], 10);
  log.push(`[digest] Current hour ET: ${currentHourET}`);

  // No brief on Saturday or Sunday: markets are closed, the prices and the
  // sessions in the prose are Friday's, and nobody asked for a weekend email.
  // Monday's brief covers the gap. `force` skips the preferred-hour check,
  // not this one.
  if (isWeekendET() && !options.weekends) {
    log.push('[digest] Weekend in New York: no brief generated, no email sent');
    return { generated: 0, skipped: 0, log, emailed: [] };
  }

  const { data: { users }, error: usersError } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
  if (usersError) throw usersError;

  const { data: prefs } = await serviceClient
    .from('user_preferences')
    .select('user_id, brief_delivery_time, notification_daily_brief, notification_email');

  const prefMap = new Map<string, string>();
  // Users who turned the daily brief EMAIL off. The in-app brief still generates
  // (that's a page they visit, not a push) — we only skip the resend send below.
  const emailBriefDisabled = new Set<string>();
  for (const p of prefs ?? []) {
    if (p.brief_delivery_time) prefMap.set(p.user_id, p.brief_delivery_time);
    // notification_email is the master switch, and it has to actually be one.
    // The unsubscribe page tells people "you will no longer receive any emails"
    // when they use the all link; a sender that only reads its own specific
    // flag makes that sentence false.
    if (p.notification_daily_brief === false || p.notification_email === false) {
      emailBriefDisabled.add(p.user_id);
    }
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { data: existingDigests } = await serviceClient
    .from('brief_digests')
    .select('user_id, generated_at')
    .gte('generated_at', todayStart.toISOString());

  const alreadyGenerated = new Set((existingDigests ?? []).map(d => d.user_id));

  const { data: allHoldings } = await serviceClient
    .from('holdings')
    .select('user_id, ticker');

  const holdingsMap = new Map<string, string[]>();
  for (const h of allHoldings ?? []) {
    const existing = holdingsMap.get(h.user_id) || [];
    existing.push(h.ticker.toUpperCase());
    holdingsMap.set(h.user_id, existing);
  }

  interface EligibleUser {
    id: string;
    email: string;
    firstName: string;
    tickers: string[];
  }

  const eligible: EligibleUser[] = [];
  let skipped = 0;

  for (const user of users) {
    if (!user.email) continue;
    if (alreadyGenerated.has(user.id)) { skipped++; continue; }

    const deliveryTime = prefMap.get(user.id);
    let preferredHour = 9;
    if (deliveryTime) {
      preferredHour = parseInt(deliveryTime.split(':')[0], 10);
    }
    if (!options.force && currentHourET !== preferredHour) { skipped++; continue; }

    const tickers = [...new Set(holdingsMap.get(user.id) || [])];
    const firstName = user.user_metadata?.full_name?.split(' ')[0] || 'there';
    eligible.push({ id: user.id, email: user.email, firstName, tickers });
  }

  log.push(`[digest] ${eligible.length} eligible, ${skipped} skipped`);

  const usersWithHoldings = eligible.filter(u => u.tickers.length > 0);
  const usersWithoutHoldings = eligible.filter(u => u.tickers.length === 0);

  let generated = 0;
  // Who actually received a brief this run. app/api/cron/daily uses it to skip
  // them in the standalone notifier: they have already been told, inside the
  // email they were expecting.
  const emailed: string[] = [];
  // Every email this run will send, collected first and sent in batches at the
  // end: Resend allows two requests a second and the batch endpoint takes a
  // hundred emails in one, so a morning of 250 briefs is three requests.
  const outgoing: Outgoing[] = [];

  if (usersWithoutHoldings.length > 0) {
    try {
      const genericResult = await generateGenericDigest();
      const now = new Date().toISOString();

      const rows = usersWithoutHoldings.map(u => ({
        user_id: u.id,
        digest: genericResult.digest,
        holdings: genericResult.holdings,
        generated_at: now,
      }));

      await serviceClient
        .from('brief_digests')
        .upsert(rows, { onConflict: 'user_id' });

      generated += usersWithoutHoldings.length;
      log.push(`[digest] Generic digest → ${usersWithoutHoldings.length} users (${genericResult.tokens} tokens)`);

      if (resend) {
        const genericTargets = usersWithoutHoldings.filter(u => !emailBriefDisabled.has(u.id));
        await collectOutgoing(serviceClient, genericTargets, genericResult.digest, outgoing);
      }
    } catch (err) {
      log.push(`[digest] Generic digest failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  const BATCH_SIZE = 5;
  for (let i = 0; i < usersWithHoldings.length; i += BATCH_SIZE) {
    const batch = usersWithHoldings.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (user) => {
        // The user id is what unlocks the ranked pack: it is built per account.
        const result = await generateDigest(user.tickers, user.id);
        await serviceClient
          .from('brief_digests')
          .upsert({
            user_id: user.id,
            digest: result.digest,
            holdings: result.holdings,
            generated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        if (resend && !emailBriefDisabled.has(user.id)) {
          const findings = await findingsFor(serviceClient, user.id);
          outgoing.push({ user, digest: result.digest, material: findings.block, events: findings.events, commit: findings.commit });
        }

        log.push(`[digest] Generated for ${user.email.slice(0, 4)}... via ${result.path} (${result.tokens} tokens, $${result.costUsd.toFixed(5)}, ${user.tickers.length} holdings)`);
        return result;
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') generated++;
      else log.push(`[digest] Batch item failed: ${r.reason instanceof Error ? r.reason.message : 'unknown'}`);
    }
  }

  if (outgoing.length > 0) {
    await sendOutgoing(outgoing, log, emailed);
    await sendBriefPushes(serviceClient, outgoing, log);
  }

  return { generated, skipped, log, emailed };
}

/** One email waiting to go: who, what, the findings block, and what to record once it has gone. */
interface Outgoing {
  user: DigestRecipient;
  digest: string;
  material: { html: string; text: string } | null;
  events: MaterialEvent[];
  commit: () => Promise<void>;
}

/** THE BRIEF ON THE PHONE. The same findings as the email, in the push's own
 *  words, once a day. lib/push/send checks the level, the toggles and the cap;
 *  the delivery record merges the push channel onto the email's row. */
async function sendBriefPushes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  outgoing: Outgoing[],
  log: string[],
) {
  let sent = 0;
  const day = dayET();
  for (const o of outgoing) {
    try {
      const lead = o.digest.split('\n\n').find((p) => p.trim()) ?? '';
      const r = await sendPush(db, o.user.id, 'brief', briefReady(lead, o.events), [`brief:${day}`, ...o.events.map((e) => e.notifyKey)]);
      sent += r.sent;
    } catch (err) {
      log.push(`[push] brief for ${o.user.id.slice(0, 8)} failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }
  if (sent > 0) log.push(`[push] brief to ${sent} device(s)`);
}

/** Queue the same digest for many people, each with their own findings block. */
async function collectOutgoing(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  users: DigestRecipient[],
  digest: string,
  outgoing: Outgoing[],
) {
  for (const group of chunk(users, 5)) {
    const found = await Promise.all(group.map((user) => findingsFor(db, user.id)));
    group.forEach((user, i) => outgoing.push({ user, digest, material: found[i].block, events: found[i].events, commit: found[i].commit }));
  }
}

/** THE MORNING GOES OUT IN BATCHES.
 *
 *  Up to a hundred emails per request through Resend's batch endpoint. A batch
 *  the endpoint refuses falls back to one-at-a-time sends, paced under the two
 *  requests a second the API allows, so a bad address in one email never costs
 *  the other ninety-nine their brief. Delivery is recorded only for emails
 *  that actually went. */
async function sendOutgoing(outgoing: Outgoing[], log: string[], emailed: string[]) {
  if (!resend) return;
  for (const batch of chunk(outgoing)) {
    const payload = batch.map((o) => digestEmailPayload(o.user, o.digest, o.material));
    try {
      const res = await resend.batch.send(payload);
      if (res.error) throw new Error(res.error.message);
      for (const o of batch) {
        emailed.push(o.user.id);
        await o.commit();
      }
      log.push(`[digest] Emailed ${batch.length} in one batch request`);
    } catch (err) {
      log.push(`[digest] Batch of ${batch.length} refused (${err instanceof Error ? err.message : 'unknown'}); sending one at a time`);
      for (const o of batch) {
        const ok = await sendDigestEmail(o.user, o.digest, log, o.material);
        if (ok) {
          emailed.push(o.user.id);
          await o.commit();
        }
        await new Promise((r) => setTimeout(r, 550));
      }
    }
  }
}

/** Picks what this person has not been told, renders it, and hands back a
 *  recorder to call once the email has actually gone out. */
async function findingsFor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  userId: string,
): Promise<{ block: { html: string; text: string } | null; events: MaterialEvent[]; commit: () => Promise<void> }> {
  const none = { block: null, events: [] as MaterialEvent[], commit: async () => {} };
  try {
    const picked = await pickMaterialEvents(db, userId);
    if (!picked.ok) return none;
    const block = materialEventsBlock(
      picked.events.map((e) => ({ priority: e.priority, title: e.title, description: e.description })),
    );
    if (!block) return none;
    return {
      block,
      events: picked.events,
      commit: () => recordDelivery(db, userId, picked.events.map((e) => e.notifyKey), 'email'),
    };
  } catch {
    // The brief is the priority. A findings block that cannot be built must
    // never be the reason somebody's morning email does not arrive.
    return none;
  }
}

/** THE BRIEF CARRIES THE FINDINGS.
 *
 *  Everything material Helm has not yet told this person rides inside the
 *  morning brief rather than arriving as a second email seconds later from the
 *  same cron run. A dry run named ten people; nine of them were already getting
 *  The Current. lib/notify/deliver sends its own email only to the tenth.
 *
 *  Recorded as delivered only once the send has actually succeeded, for the
 *  same reason as everywhere else in this layer: a fact marked as told that
 *  nobody read is a fact suppressed forever. */
async function sendDigestEmail(
  user: { id: string; email: string; firstName: string },
  digest: string,
  log: string[],
  material?: { html: string; text: string } | null,
): Promise<boolean> {
  if (!resend) return false;
  try {
    const res = await resend.emails.send(digestEmailPayload(user, digest, material));
    if (res.error) throw new Error(res.error.message);
    log.push(`[digest] Emailed ${user.email.slice(0, 4)}...${material ? ' (with findings)' : ''}`);
    return true;
  } catch (emailErr) {
    log.push(`[digest] Email failed ${user.email.slice(0, 4)}...: ${emailErr instanceof Error ? emailErr.message : 'unknown'}`);
    return false;
  }
}


