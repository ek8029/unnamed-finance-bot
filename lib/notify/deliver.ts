// lib/notify/deliver.ts
//
// The decision. Not a sender.
//
// EMAIL HAS EXACTLY ONE ENVELOPE, and it is the morning brief. Helm sends one
// email a day and this module does not add a second one. It works out what a
// person has not yet been told; lib/digest-cron puts that inside The Current,
// which was going to arrive anyway. There was briefly a standalone alert email
// here and it was wrong: a dry run named ten recipients and nine of them were
// already getting the brief from the same cron run, seconds apart.
//
// Push, when helm-mobile has a build that can carry it, is a different medium
// and gets its own voice rather than an email read out on a lock screen. What
// it shares with the brief is this file: the same threshold, and the same
// record of what has already been said, so the two channels can never announce
// the same finding twice.
//
// THE ORDER OF THE CHECKS MATTERS.
//   1. preference  (never tell somebody who said no, and a failed read is not a yes)
//   2. threshold   (lib/notify/material.ts, the only definition of material)
//   3. delivery    (never say the same thing twice)
//   4. the caller sends
//   5. the caller records, and only what actually went out
//
// Step 5 is the one that is easy to get wrong. Recording a key that was
// computed but never printed makes the fact invisible forever: suppressed as
// "already told you" when nobody was ever told.

import type { SupabaseClient } from '@supabase/supabase-js';
import { alertPreference } from '@/lib/notify/preferences';
import { selectMaterial, type NotifiableInsight, type MaterialEvent } from '@/lib/notify/material';

/** How many findings one message may carry. Anything past this waits for the
 *  next run rather than being recorded as delivered, because a fact nobody read
 *  is not a fact anybody was told. The live maximum per user is 6, so this
 *  rarely bites; it exists so a bad day cannot produce a wall of text. */
const MAX_PER_MESSAGE = 5;

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
  // A key told by email in the morning and by push a minute later is one fact
  // told on two channels, not two facts: merge the channels, never overwrite.
  const { data: existing } = await db
    .from('notification_deliveries')
    .select('notify_key, channels, first_sent_at')
    .eq('user_id', userId)
    .in('notify_key', keys);
  const prior = new Map((existing ?? []).map((r) => [String(r.notify_key), r]));
  const { error } = await db
    .from('notification_deliveries')
    .upsert(
      keys.map((notify_key) => {
        const p = prior.get(notify_key);
        const channels = [...new Set([...(((p?.channels as string[] | null) ?? [])), channel])];
        return {
          user_id: userId,
          notify_key,
          channels,
          first_sent_at: (p?.first_sent_at as string | undefined) ?? now,
          last_sent_at: now,
        };
      }),
      { onConflict: 'user_id,notify_key' },
    );
  // supabase-js does not throw on a failed write, it returns one. Swallowing it
  // silently would mean the same alert goes out again tomorrow.
  if (error) console.error('[notify] Could not record delivery:', error.message);
}

export type PickResult =
  | { ok: false; reason: string }
  | { ok: true; events: MaterialEvent[] };

/**
 * THE DECISION, with no transport attached.
 *
 * Preference, then threshold, then delivery record. Every channel asks this one
 * function, so there is a single answer to "does this person need to be told
 * something" rather than one answer per sender. It returns why it said no, and
 * callers log it: a notifier that reports nothing looks identical whether it
 * decided there was nothing to say or silently broke, which is exactly how a
 * one-address allowlist survived months inside score-theses.
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
