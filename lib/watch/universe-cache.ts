// lib/watch/universe-cache.ts
// The watchers' ticker universe (every held name plus every tracked thesis)
// changes a few times a day, yet each poller tick paged holdings and theses
// to rebuild it. Cached in Redis for fifteen minutes. A miss, or Redis null or
// down, reads Postgres exactly as before and tries to cache the result.

import { redisKey, withRedis } from '@/lib/redis';

export const UNIVERSE_TTL_S = 15 * 60;

export type UniverseName = 'edgar' | 'news' | 'news-thesis';

/** Cached union of holdings + tracked theses tickers. Miss or Redis down: read Postgres as today and try to cache. */
export async function cachedUniverse(name: UniverseName, read: () => Promise<string[]>): Promise<string[]> {
  const key = redisKey('watch', 'universe', name);
  const hit = await withRedis((r) => r.get<string[]>(key), null);
  if (Array.isArray(hit)) return hit;
  const list = await read();
  // An empty list is what a failed page read produces; caching it would keep
  // the watcher blind for the whole TTL instead of one tick.
  if (list.length > 0) await withRedis((r) => r.set(key, list, { ex: UNIVERSE_TTL_S }), undefined);
  return list;
}
