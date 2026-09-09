// lib/watch/seen-set.ts
// The EDGAR feed repeats its last hundred entries every tick, and the poller
// used to upsert every watched entry into filing_events just to learn which
// were new. A Redis set of the ids already handled answers that without a
// Postgres write; the upsert still runs on the survivors and remains the
// authoritative dedupe. Check and mark are separate so an id is remembered
// only once its database write succeeded: a failed write is retried next tick.

import { redisKey, withRedis } from '@/lib/redis';

export const SEEN_TTL_S = 7 * 24 * 3600;

export type SeenName = 'edgar' | 'news';

/** Returns the ids not in the Redis set. Read-only. Redis down: returns all ids (today's behaviour; the DB upsert still dedupes). */
export async function unseen(name: SeenName, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const key = redisKey('watch', 'seen', name);
  return withRedis(async (r) => {
    const flags = await r.smismember(key, ids);
    return ids.filter((_, i) => flags[i] === 0);
  }, ids);
}

/** Adds the ids to the set and refreshes its TTL. No-op on empty; Redis down is silent. */
export async function markSeen(name: SeenName, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const key = redisKey('watch', 'seen', name);
  await withRedis(async (r) => {
    await r.sadd(key, ids[0], ...ids.slice(1));
    await r.expire(key, SEEN_TTL_S);
  }, undefined);
}
