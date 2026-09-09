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
/** Runs fn against Redis; any failure or missing config returns fallback and logs once per call. */
export async function withRedis<T>(fn: (r: Redis) => Promise<T>, fallback: T): Promise<T> {
  const r = getRedis();
  if (!r) return fallback;
  try { return await fn(r); } catch (e) { console.error('[redis] call failed', e); return fallback; }
}
