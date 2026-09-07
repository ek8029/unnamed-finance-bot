// lib/plaid/nudge-reconnect.ts
// A Plaid connection only its owner can fix gets one push a week saying so, with
// a tap that opens the reconnect flow. Two callers: the webhook the moment Plaid
// reports the error, and the daily cron for the weekly reminder while it stays
// broken. Push only, by Evan's call (9/6): no email. Until today nobody was told
// at all; a Robinhood connection sat dead for seven weeks.

import type { SupabaseClient } from '@supabase/supabase-js';
import { needsReconnect, reconnectKey } from '@/lib/push/policy';
import { liveTokenUsers, sendPush, type SendPushResult } from '@/lib/push/send';
import { connectionNeedsLogin } from '@/lib/push/voice';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export interface ReconnectItem {
  id: string;
  user_id: string;
  institution_name: string | null;
  status: string | null;
  error_code: string | null;
  last_holdings_sync: string | null;
}
const COLS = 'id, user_id, institution_name, status, error_code, last_holdings_sync';

async function nudgeItem(db: Db, item: ReconnectItem, now: Date): Promise<SendPushResult> {
  if (!needsReconnect(item)) return { sent: 0, reason: 'not a reconnect case' };
  const message = connectionNeedsLogin({
    itemId: item.id,
    institution: item.institution_name,
    since: item.last_holdings_sync ? item.last_holdings_sync.slice(0, 10) : null,
  });
  return sendPush(db, item.user_id, 'reconnect', message, [reconnectKey(item.id, now)], { now });
}

/** One item, right now: the webhook's call when Plaid reports the error. */
export async function nudgeReconnect(db: Db, itemId: string, now: Date = new Date()): Promise<SendPushResult> {
  const { data } = await db.from('plaid_items').select(COLS).eq('id', itemId).maybeSingle();
  const item = (data ?? null) as ReconnectItem | null;
  if (!item) return { sent: 0, reason: 'no item' };
  return nudgeItem(db, item, now);
}

/** The daily pass: every broken item whose owner has a phone, once a week each. */
export async function nudgeReconnects(db: Db, log: string[], now: Date = new Date()): Promise<number> {
  const { data } = await db.from('plaid_items').select(COLS).neq('status', 'active').not('error_code', 'is', null);
  const items = ((data ?? []) as ReconnectItem[]).filter(needsReconnect);
  if (items.length === 0) return 0;
  const phones = await liveTokenUsers(db);
  let sent = 0;
  for (const item of items) {
    if (!phones.has(item.user_id)) continue;
    const r = await nudgeItem(db, item, now);
    log.push(`[reconnect] ${item.institution_name ?? item.id}: ${r.sent ? 'pushed' : r.reason}`);
    sent += r.sent;
  }
  return sent;
}
