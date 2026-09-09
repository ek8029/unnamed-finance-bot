// lib/watch/seen-set.ts
// The EDGAR feed repeats its last hundred entries every tick, and the poller
// used to upsert every watched entry into filing_events just to learn which
// were new. A Redis set of the ids already handled answers that without a
// Postgres write; the upsert still runs on the survivors and remains the
// authoritative dedupe.

import { redisKey, withRedis } from '@/lib/redis';

export const SEEN_TTL_S = 7 * 24 * 3600;

export type SeenName = 'edgar' | 'news';

/** Returns the ids not in the Redis set, and adds them. Redis down: returns all ids (today's behaviour; the DB upsert still dedupes). */
export async function unseen(name: SeenName, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const key = redisKey('watch', 'seen', name);
  return withRedis(async (r) => {
    const flags = await r.smismember(key, ids);
    const fresh = ids.filter((_, i) => flags[i] === 0);
    if (fresh.length > 0) {
      await r.sadd(key, fresh[0], ...fresh.slice(1));
      await r.expire(key, SEEN_TTL_S);
    }
    return fresh;
  }, ids);
}
