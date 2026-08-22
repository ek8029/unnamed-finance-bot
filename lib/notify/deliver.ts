// lib/notify/deliver.ts
//
// The fan-out. One decision, then however many transports are switched on.
//
// Email ships first because it needs no new native build. Push is the same
// decision carried by a different pipe, and when it arrives it plugs in HERE,
// under the same threshold and the same delivery record, rather than becoming a
// fourth sender with a fourth opinion about what deserves an interruption.
//
// THE ORDER OF THE CHECKS MATTERS.
//   1. preference  (never mail somebody who said no, and a failed read is not a yes)
//   2. threshold   (lib/notify/material.ts, the only definition of material)
//   3. delivery    (never say the same thing twice)
//   4. send
//   5. record, and only what was actually named in the message that went out
//
// Step 5 is the one that is easy to get wrong. Recording a key that was
// computed but never printed makes the fact invisible forever: suppressed as
// "already told you" when nobody was ever told.

import type { SupabaseClient } from '@supabase/supabase-js';
import { resend, FROM_EMAIL } from '@/lib/emails/resend';
import { getMaterialEventsTemplate } from '@/lib/emails/templates';
import { unsubUrl } from '@/lib/emails/unsubscribe';
import { alertPreference } from '@/lib/notify/preferences';
import { selectMaterial, type NotifiableInsight, type MaterialEvent } from '@/lib/notify/material';

/** How many findings one message may carry. Anything past this waits for the
 *  next run rather than being recorded as delivered, because a fact nobody read
 *  is not a fact anybody was told. The live maximum per user is 6, so this
 *  rarely bites; it exists so a bad day cannot produce a wall of text. */
const MAX_PER_MESSAGE = 5;

export type NotifyOutcome =
  | { sent: false; reason: string }
  | { sent: true; count: number; keys: string[] };

/** Keys this user has already been told about, of the ones offered. */
export async function alreadyDelivered(
  db: SupabaseClient,
  userId: string,
  keys: string[],
): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const { data, error } = await db
    .from('notification_deliveries')
    .select('notify_key')
    .eq('user_id', userId)
    .in('notify_key', keys);
  // A failed read must not be treated as "nothing delivered yet", which would
  // re-announce everything the person has already seen. Report everything as
  // delivered so this run stays silent and the next one tries again.
  if (error) return new Set(keys);
  return new Set((data ?? []).map((r) => r.notify_key as string));
}

/** Marks facts as announced. Idempotent: a repeat delivery of the same key
 *  (a pillar that broke, was repaired, and broke again) updates the timestamp
 *  and adds the channel rather than erroring on the unique constraint. */
export async function recordDelivery(
  db: SupabaseClient,
  userId: string,
  keys: string[],
  channel: 'email' | 'push',
): Promise<void> {
  if (keys.length === 0) return;
  const now = new Date().toISOString();
  const { error } = await db
    .from('notification_deliveries')
    .upsert(
      keys.map((notify_key) => ({
        user_id: userId,
        notify_key,
        channels: [channel],
        first_sent_at: now,
        last_sent_at: now,
      })),
      { onConflict: 'user_id,notify_key' },
    );
  // supabase-js does not throw on a failed write, it returns one. Swallowing it
  // silently would mean the same alert goes out again tomorrow.
  if (error) console.error('[notify] Could not record delivery:', error.message);
}

/**
 * Decide and send this user's material portfolio events.
 *
 * Returns why it stayed quiet when it did. Callers log it: a notifier that
 * reports nothing is indistinguishable from a notifier that is broken, which
 * is exactly how a one-address allowlist survived months inside score-theses.
 */
export type PickResult =
  | { ok: false; reason: string }
  | { ok: true; events: MaterialEvent[] };

/**
 * THE DECISION, with no transport attached.
 *
 * Preference, then threshold, then delivery record. Whatever carries the result
 * afterwards, an email of its own or a section inside the morning brief, asks
 * this one function, so there is a single answer to "does this person need to
 * be told something" rather than one per sender.
 */
export async function pickMaterialEvents(
  db: SupabaseClient,
  userId: string,
): Promise<PickResult> {
  const pref = await alertPreference(db, userId);
  if (!pref.ok) return { ok: false, reason: `preference read failed: ${pref.reason}` };
  if (!pref.wants) return { ok: false, reason: 'opted out' };

  const { data: rows, error } = await db
    .from('insights')
    .select('id, user_id, created_at, insight_type, priority, title, description, estimated_impact_amount, related_entity_type, related_entity_ids, is_dismissed, is_archived, snoozed_until, expires_at')
    .eq('user_id', userId)
    .eq('is_dismissed', false)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return { ok: false, reason: `insight read failed: ${error.message}` };

  const material: MaterialEvent[] = selectMaterial((rows ?? []) as NotifiableInsight[]);
  if (material.length === 0) return { ok: false, reason: 'nothing material' };

  const seen = await alreadyDelivered(db, userId, material.map((m) => m.notifyKey));
  const fresh = material.filter((m) => !seen.has(m.notifyKey)).slice(0, MAX_PER_MESSAGE);
  if (fresh.length === 0) return { ok: false, reason: 'already told them' };
  return { ok: true, events: fresh };
}

/**
 * Send it as its own email.
 *
 * ONLY for people who are not getting the morning brief today. Nine of the ten
 * people the first dry run named were already receiving The Current from the
 * same cron run, seconds apart, and two Helm emails landing in the same minute
 * is worse than either of them. lib/digest-cron carries the same events inside
 * the brief for everybody else.
 */
export async function notifyMaterialEvents(
  db: SupabaseClient,
  userId: string,
): Promise<NotifyOutcome> {
  if (!resend) return { sent: false, reason: 'no email transport configured' };

  const picked = await pickMaterialEvents(db, userId);
  if (!picked.ok) return { sent: false, reason: picked.reason };
  const fresh = picked.events;

  const { data: userRes, error: userErr } = await db.auth.admin.getUserById(userId);
  const email = userRes?.user?.email;
  if (userErr || !email) return { sent: false, reason: 'no email address' };

  const unsub = unsubUrl(userId, 'market');
  const tpl = getMaterialEventsTemplate(
    fresh.map((m) => ({ priority: m.priority, title: m.title, description: m.description })),
    { unsubUrl: unsub },
  );
  if (!tpl) return { sent: false, reason: 'nothing material' };

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      // The header bulk senders are judged on. An alert people cannot turn off
      // is a complaint, not a feature.
      headers: {
        'List-Unsubscribe': `<${unsub}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
  } catch (err) {
    return { sent: false, reason: `send failed: ${err instanceof Error ? err.message : 'unknown'}` };
  }

  // Only now, and only the ones that were in the message.
  const keys = fresh.map((m) => m.notifyKey);
  await recordDelivery(db, userId, keys, 'email');
  return { sent: true, count: fresh.length, keys };
}
