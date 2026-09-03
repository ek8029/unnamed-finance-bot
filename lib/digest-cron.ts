import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { generateDigest, generateGenericDigest } from '@/lib/generate-digest';
import { resend, FROM_EMAIL } from '@/lib/emails/resend';
import { unsubUrl } from '@/lib/emails/unsubscribe';
import { getDigestTemplate, materialEventsBlock } from '@/lib/emails/templates';
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
export async function runDigestCron(options: { force?: boolean } = {}): Promise<DigestCronResult> {
  const log: string[] = [];

  const serviceClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const nowET = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false });
  const currentHourET = parseInt(nowET.split(', ')[1].split(':')[0], 10);
  log.push(`[digest] Current hour ET: ${currentHourET}`);

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
        await sendDigestEmails(serviceClient, genericTargets, genericResult.digest, log, emailed);
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
          const ok = await sendDigestEmail(user, result.digest, log, findings.block);
          if (ok) {
            emailed.push(user.id);
            await findings.commit();
          }
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

  return { generated, skipped, log, emailed };
}

/** Picks what this person has not been told, renders it, and hands back a
 *  recorder to call once the email has actually gone out. */
async function findingsFor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  userId: string,
): Promise<{ block: { html: string; text: string } | null; commit: () => Promise<void> }> {
  const none = { block: null, commit: async () => {} };
  try {
    const picked = await pickMaterialEvents(db, userId);
    if (!picked.ok) return none;
    const block = materialEventsBlock(
      picked.events.map((e) => ({ priority: e.priority, title: e.title, description: e.description })),
    );
    if (!block) return none;
    return {
      block,
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
    const briefUrl = 'https://helmterminal.dev/dashboard/brief';
    const unsub = unsubUrl(user.id, 'brief');
    const digestPreview = digest.split('\n\n')[0].slice(0, 200);

    const tpl = getDigestTemplate({
      firstName: user.firstName,
      digestPreview,
      briefUrl,
      unsub,
      material,
    });
    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: tpl.subject,
      headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      html: tpl.html,
      text: tpl.text,
    });
    log.push(`[digest] Emailed ${user.email.slice(0, 4)}...${material ? ' (with findings)' : ''}`);
    return true;
  } catch (emailErr) {
    log.push(`[digest] Email failed ${user.email.slice(0, 4)}...: ${emailErr instanceof Error ? emailErr.message : 'unknown'}`);
    return false;
  }
}

async function sendDigestEmails(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  users: { id: string; email: string; firstName: string }[],
  digest: string,
  log: string[],
  emailed: string[],
) {
  const BATCH_SIZE = 5;
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (user) => {
        const findings = await findingsFor(db, user.id);
        const ok = await sendDigestEmail(user, digest, log, findings.block);
        if (ok) { emailed.push(user.id); await findings.commit(); }
      }),
    );
  }
}
