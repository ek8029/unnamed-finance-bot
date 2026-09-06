// lib/agent/heartbeat.ts
// One row per poller, stamped every tick (migration 072, watch_heartbeats).
//
// "Checked 1 min ago" has to be the time the poller last LOOKED, not the time
// something last happened: on a quiet afternoon the last filing on a book can
// be hours old while the feed was read sixty seconds ago. The row is written
// even when a tick found nothing, and read by the worklog and the lab.

import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export type WatchName = 'edgar-watch' | 'news-watch' | 'judge-worker';

/** Best effort: a missing table or a blip never fails the tick that called it. */
export async function beat(db: Db, name: WatchName, detail: Record<string, unknown> = {}): Promise<void> {
  try {
    await db.from('watch_heartbeats').upsert({ name, at: new Date().toISOString(), detail }, { onConflict: 'name' });
  } catch {
    // nothing: the poller's own log line is the record
  }
}

export interface Heartbeat {
  name: WatchName;
  at: string;
  detail: Record<string, unknown>;
}

export async function readHeartbeats(db: Db): Promise<Map<WatchName, Heartbeat>> {
  const out = new Map<WatchName, Heartbeat>();
  const { data } = await db.from('watch_heartbeats').select('name, at, detail').limit(10);
  for (const r of data ?? []) out.set(r.name as WatchName, { name: r.name as WatchName, at: String(r.at), detail: (r.detail as Record<string, unknown>) ?? {} });
  return out;
}
