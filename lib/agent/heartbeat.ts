// lib/agent/heartbeat.ts
// One key per poller, stamped every tick (helm:hb:{name} in Redis; the
// watch_heartbeats row from migration 072 is the fallback when Redis is
// unconfigured or down).
//
// "Checked 1 min ago" has to be the time the poller last LOOKED, not the time
// something last happened: on a quiet afternoon the last filing on a book can
// be hours old while the feed was read sixty seconds ago. The beat is written
// even when a tick found nothing, and read by the worklog and the lab.

import type { SupabaseClient } from '@supabase/supabase-js';
import { beatRedis, readHeartbeatsRedis, type Heartbeat, type WatchName } from '@/lib/agent/heartbeat-redis';

export type { Heartbeat, WatchName } from '@/lib/agent/heartbeat-redis';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

/** Best effort: a missing table or a blip never fails the tick that called it. */
export async function beat(db: Db, name: WatchName, detail: Record<string, unknown> = {}): Promise<void> {
  const at = new Date().toISOString();
  if (await beatRedis(name, at, detail)) return;
  // Postgres fallback. The table's CHECK (migration 072) only admits
  // edgar-watch, news-watch and judge-worker, so daily-scans, market-morning
  // and intraday-prices are Redis-only: here they are rejected and dropped.
  try {
    await db.from('watch_heartbeats').upsert({ name, at, detail }, { onConflict: 'name' });
  } catch {
    // nothing: the poller's own log line is the record
  }
}

/** Redis first. Postgres is read only when Redis is unconfigured or down; a
 *  Redis answer is returned as is, even with names missing (a fresh deploy
 *  shows a name within one tick, and merging would put a read on every caller). */
export async function readHeartbeats(db: Db): Promise<Map<WatchName, Heartbeat>> {
  const fromRedis = await readHeartbeatsRedis();
  if (fromRedis) return fromRedis;
  const out = new Map<WatchName, Heartbeat>();
  const { data } = await db.from('watch_heartbeats').select('name, at, detail').limit(10);
  for (const r of data ?? []) out.set(r.name as WatchName, { name: r.name as WatchName, at: String(r.at), detail: (r.detail as Record<string, unknown>) ?? {} });
  return out;
}
