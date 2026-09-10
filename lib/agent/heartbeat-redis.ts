// lib/agent/heartbeat-redis.ts
// Heartbeats on Redis: helm:hb:{name} is the latest tick, and that is all that
// is kept. It expires after 48 h so a retired watcher disappears on its own.
// Every function degrades: null or a throwing client means false,
// null or [] and the caller keeps today's Postgres behaviour.

import { redisKey, withRedis } from '@/lib/redis';

export type WatchName = 'edgar-watch' | 'news-watch' | 'judge-worker' | 'daily-scans' | 'market-morning' | 'intraday-prices';
export const WATCH_NAMES: readonly WatchName[] = ['edgar-watch', 'news-watch', 'judge-worker', 'daily-scans', 'market-morning', 'intraday-prices'];
export const HB_TTL_S = 48 * 3600;

export interface Heartbeat {
  name: WatchName;
  at: string;
  detail: Record<string, unknown>;
}

type Stored = { at: string; detail: Record<string, unknown> };

const key = (name: WatchName) => redisKey('hb', name);

/** Writes helm:hb:{name} = { at, detail } (TTL 48 h). One command: the beat is
 *  the latest tick and nothing else, so there is no list to maintain. Returns
 *  true when Redis took it, false when Redis is null or threw, which is what
 *  sends the caller to its Postgres fallback. */
export async function beatRedis(name: WatchName, at: string, detail: Record<string, unknown>): Promise<boolean> {
  const entry: Stored = { at, detail };
  return withRedis(async (r) => {
    await r.set(key(name), entry, { ex: HB_TTL_S });
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
