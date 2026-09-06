// lib/push/send.ts
// One door for every push. Level and toggles, then quiet hours, then the daily
// cap, then the delivery record, then the devices, then Expo, then the record
// of what actually went. A caller never talks to Expo directly.

import type { SupabaseClient } from '@supabase/supabase-js';
import { alreadyDelivered, recordDelivery } from '@/lib/notify/deliver';
import { etDayStartIso } from '@/lib/agent/judge-queue';
import { DAILY_CAP, inQuietHours, legacyAllows, levelAllows, parseLevel, type PushKind } from '@/lib/push/policy';
import { getExpoReceipts, sendExpoPush } from '@/lib/push/expo';
import type { PushMessage } from '@/lib/push/voice';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export interface SendPushResult {
  sent: number;
  /** Why nothing went, in words a log can carry. */
  reason?: string;
}

/** Kinds that wait out the night. A broken reason and the morning brief do not. */
const QUIET_KINDS = new Set<PushKind>(['move', 'filing']);

/** Users with at least one live device, so a poller only does work for phones that exist. */
export async function liveTokenUsers(db: Db): Promise<Set<string>> {
  const { data } = await db.from('push_tokens').select('user_id').is('disabled_at', null).limit(5000);
  return new Set((data ?? []).map((r: { user_id: string }) => r.user_id));
}

export async function sendPush(
  db: Db,
  userId: string,
  kind: PushKind,
  message: PushMessage,
  keys: string[],
  opts: { gateOnRecord?: boolean; now?: Date } = {},
): Promise<SendPushResult> {
  const now = opts.now ?? new Date();

  const { data: pref, error: prefErr } = await db
    .from('user_preferences')
    .select('notification_push_level, notification_daily_brief, notification_market_alerts')
    .eq('user_id', userId)
    .maybeSingle();
  // A failed read is not consent.
  if (prefErr) return { sent: 0, reason: `preference read failed: ${prefErr.message}` };
  const level = parseLevel(pref?.notification_push_level);
  if (!levelAllows(level, kind)) return { sent: 0, reason: `level ${level}` };
  if (!legacyAllows(pref ?? null, kind)) return { sent: 0, reason: 'toggle off' };
  if (QUIET_KINDS.has(kind) && inQuietHours(now)) return { sent: 0, reason: 'quiet hours' };

  const { count } = await db
    .from('notification_deliveries')
    .select('notify_key', { count: 'exact', head: true })
    .eq('user_id', userId)
    .contains('channels', ['push'])
    .gte('last_sent_at', etDayStartIso(now));
  if ((count ?? 0) >= DAILY_CAP) return { sent: 0, reason: 'daily cap' };

  let fresh = keys;
  if (opts.gateOnRecord !== false && keys.length > 0) {
    const seen = await alreadyDelivered(db, userId, keys);
    fresh = keys.filter((k) => !seen.has(k));
    if (fresh.length === 0) return { sent: 0, reason: 'already told them' };
  }

  const { data: tokens } = await db.from('push_tokens').select('token').eq('user_id', userId).is('disabled_at', null).limit(10);
  const to = (tokens ?? []).map((t: { token: string }) => t.token);
  if (to.length === 0) return { sent: 0, reason: 'no device' };

  const tickets = await sendExpoPush(to.map((t) => ({
    to: t, title: message.title, body: message.body, sound: 'default',
    data: { route: message.route, id: message.id ?? null, kind },
  })));

  let sent = 0;
  const ticketRows: { user_id: string; token: string; ticket_id: string; kind: string; notify_key: string | null }[] = [];
  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i];
    if (t.status === 'ok' && t.id) {
      sent++;
      ticketRows.push({ user_id: userId, token: to[i], ticket_id: t.id, kind, notify_key: fresh[0] ?? null });
    } else if (t.details?.error === 'DeviceNotRegistered') {
      await db.from('push_tokens').update({ disabled_at: now.toISOString(), disabled_reason: 'DeviceNotRegistered' }).eq('token', to[i]);
    }
  }
  if (ticketRows.length > 0) await db.from('push_tickets').insert(ticketRows);
  if (sent > 0 && fresh.length > 0) await recordDelivery(db, userId, fresh, 'push');
  return sent > 0 ? { sent } : { sent: 0, reason: tickets[0]?.message ?? 'expo refused' };
}

/** Ask Expo what became of the tickets older than ten minutes; a dead token is disabled. */
export async function checkPushReceipts(db: Db, log: string[]): Promise<number> {
  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: rows } = await db
    .from('push_tickets')
    .select('id, token, ticket_id')
    .is('checked_at', null)
    .lt('created_at', cutoff)
    .limit(300);
  const pending = (rows ?? []) as { id: string; token: string; ticket_id: string }[];
  if (pending.length === 0) return 0;
  const receipts = await getExpoReceipts(pending.map((r) => r.ticket_id));
  const now = new Date().toISOString();
  let checked = 0;
  for (const r of pending) {
    const rc = receipts[r.ticket_id];
    if (!rc) continue;
    checked++;
    await db.from('push_tickets').update({ checked_at: now, status: rc.status, detail: rc.details?.error ?? rc.message ?? null }).eq('id', r.id);
    if (rc.details?.error === 'DeviceNotRegistered') {
      await db.from('push_tokens').update({ disabled_at: now, disabled_reason: 'DeviceNotRegistered' }).eq('token', r.token);
    }
  }
  if (checked > 0) log.push(`[push] ${checked} receipt(s) checked`);
  return checked;
}
