// lib/agent/heartbeat-redis.ts
// Heartbeats on Redis: helm:hb:{name} is the latest tick, helm:hb:{name}:log
// the last sixty, trimmed lazily so it can run a little longer between
// trims. Both expire after 48 h so a retired watcher disappears on
// its own. Every function degrades: null or a throwing client means false,
// null or [] and the caller keeps today's Postgres behaviour.

import { redisKey, withRedis } from '@/lib/redis';

export type WatchName = 'edgar-watch' | 'news-watch' | 'judge-worker' | 'daily-scans' | 'market-morning' | 'intraday-prices';
export const WATCH_NAMES: readonly WatchName[] = ['edgar-watch', 'news-watch', 'judge-worker', 'daily-scans', 'market-morning', 'intraday-prices'];
export const HB_TTL_S = 48 * 3600;
export const HB_LOG_LEN = 60;

export interface Heartbeat {
  name: WatchName;
  at: string;
  detail: Record<string, unknown>;
}

type Stored = { at: string; detail: Record<string, unknown> };

const key = (name: WatchName) => redisKey('hb', name);
const logKey = (name: WatchName) => redisKey('hb', name, 'log');

/** How far past HB_LOG_LEN the log is allowed to run before it is trimmed.
 *  Trimming on a threshold instead of on every beat is what makes the common
 *  beat cost two commands: the LTRIM then runs about once every 21 beats. */
export const HB_LOG_SLACK = 20;

/** Writes helm:hb:{name} = { at, detail } (TTL 48 h) and pushes { at, detail } onto
 *  helm:hb:{name}:log. Returns true when Redis took it, false when Redis is
 *  null or threw. */
export async function beatRedis(name: WatchName, at: string, detail: Record<string, unknown>): Promise<boolean> {
  const entry: Stored = { at, detail };
  // The beat itself is two commands in one MULTI round-trip: they land
  // together or not at all, so a partial write can never be followed by the
  // Postgres fallback as well. The list maintenance below is deliberately
  // outside the transaction and conditional, because paying for it on every
  // beat doubled the command count for no reader-visible gain.
  const res = await withRedis<[unknown, number] | null>((r) => r.multi()
    .set(key(name), entry, { ex: HB_TTL_S })
    .lpush(logKey(name), entry)
    .exec<[unknown, number]>(), null);
  if (!res) return false;
  // LPUSH answers with the list's new length.
  const len = res[1];
  if (len === 1) {
    // The log key was just created. This EXPIRE is the only thing that ever
    // gives it a TTL, so it must not be skipped: a watcher that beats rarely,
    // daily-scans once a day, never reaches the trim threshold and this is
    // its only source of one. If this call itself fails the key simply keeps
    // no TTL until the next time it is recreated.
    await withRedis((r) => r.expire(logKey(name), HB_TTL_S), null);
  } else if (len > HB_LOG_LEN + HB_LOG_SLACK) {
    // A threshold above the cap, not a trim on every beat: the list sits
    // between 60 and 81 entries and readHeartbeatLog slices to n, so the
    // slack is invisible to every reader.
    await withRedis((r) => r.ltrim(logKey(name), 0, HB_LOG_LEN - 1), null);
  }
  // Both follow-ups are best effort and must not change the answer: the beat
  // already landed on Redis, so a failed EXPIRE or LTRIM still reports true
  // and the caller must not also write the Postgres row.
  return true;
}

/** One MGET over every name. Redis null or throw: null (caller falls back).
 *  Missing names are absent from the map. */
export async function readHeartbeatsRedis(): Promise<Map<WatchName, Heartbeat> | null> {
  return withRedis(async (r) => {
    const rows = await r.mget<(Stored | null)[]>(...WATCH_NAMES.map(key));
    const out = new Map<WatchName, Heartbeat>();
    WATCH_NAMES.forEach((name, i) => {
      const row = rows[i];
      if (row && typeof row.at === 'string') out.set(name, { name, at: row.at, detail: row.detail ?? {} });
    });
    return out;
  }, null);
}

/** Newest first, at most n. Redis null or throw: [].
 *  No caller yet: the lab feed step of the IO diet plan consumes it next. */
export async function readHeartbeatLog(name: WatchName, n = HB_LOG_LEN): Promise<Heartbeat[]> {
  return withRedis(async (r) => {
    const rows = await r.lrange<Stored>(logKey(name), 0, n - 1);
    return rows.map((row) => ({ name, at: row.at, detail: row.detail ?? {} }));
  }, []);
}
