// lib/redis.ts
// The only raw key-value Redis client in the codebase. Every caller must survive null.
import { Redis } from '@upstash/redis';
let client: Redis | null | undefined;
export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const ok = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
  client = ok ? Redis.fromEnv() : null;
  return client;
}
export function __resetRedis(): void { client = undefined; }
export const redisKey = (...parts: string[]) => ['helm', ...parts].join(':');
/** Runs fn against Redis; any failure or missing config returns fallback and logs once per call.
 *  Note for callers: the client deserializes JSON on get() by default, so set(key, object)
 *  comes back as an object and a plain string that happens to be valid JSON comes back parsed. */
export async function withRedis<T>(fn: (r: Redis) => Promise<T>, fallback: T): Promise<T> {
  try {
    const r = getRedis();
    if (!r) return fallback;
    return await fn(r);
  } catch (e) {
    console.error('[redis] call failed', e);
    return fallback;
  }
}

/** Several keys for one command. Answers in key order, null for a key that is
 *  not set. Redis null or throwing: nulls of the same length, so a caller
 *  cannot tell "not set" from "no Redis" and both degrade the same way.
 *  The client deserializes JSON on read, so a key holding a plain ISO string
 *  comes back as that string. */
export async function readKeys(keys: string[]): Promise<(string | null)[]> {
  if (keys.length === 0) return [];
  return withRedis((r) => r.mget<(string | null)[]>(...keys), keys.map(() => null));
}
