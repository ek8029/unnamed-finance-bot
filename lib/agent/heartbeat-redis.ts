// lib/agent/heartbeat-redis.ts
// Heartbeats on Redis: helm:hb:{name} is the latest tick, helm:hb:{name}:log
// the last sixty. Both expire after 48 h so a retired watcher disappears on
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

/** Writes helm:hb:{name} = { at, detail } (TTL 48 h) and pushes { at, detail } onto
 *  helm:hb:{name}:log capped at 60. Returns true when Redis took it, false when
 *  Redis is null or threw. */
export async function beatRedis(name: WatchName, at: string, detail: Record<string, unknown>): Promise<boolean> {
  const entry: Stored = { at, detail };
  // One MULTI round-trip: the four commands land together or not at all, so
  // a partial write can never be followed by the Postgres fallback as well.
  return withRedis(async (r) => {
    await r.multi()
      .set(key(name), entry, { ex: HB_TTL_S })
      .lpush(logKey(name), entry)
      .ltrim(logKey(name), 0, HB_LOG_LEN - 1)
      .expire(logKey(name), HB_TTL_S)
      .exec();
    return true;
  }, false);
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
