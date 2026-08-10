/**
 * Durable rate limits for the two expensive thesis operations.
 *
 * Both were guarded by lib/rate-limit.ts, which is a module-level Map and
 * therefore per-lambda-instance, as its own comment admits. On Vercel that is
 * not a per-user limit at all: fire enough concurrent requests and they fan out
 * across cold instances, each starting with an empty store. Backfill has
 * maxDuration 300, which actively encourages new instances.
 *
 * What a single backfill costs: up to 40 SEC EDGAR document fetches, one
 * gpt-4o-mini completion carrying up to ~25k input tokens, and a gpt-4o
 * escalation review of up to 20 findings. Since /api/thesis/backfill is now
 * reachable by free accounts, the old limiter was the only thing between a free
 * signup and that bill.
 *
 * The EDGAR side is the sharper risk. SEC fair-access throttling is applied per
 * source IP, so sustained abuse from one free account gets the shared Vercel
 * egress IP blocked, which takes filings ingest down for every paying user.
 *
 * Backed by Upstash Redis, shared across instances, mirroring
 * lib/analyze-rate-limit.ts. Falls back to the in-memory limiter when Upstash
 * is unconfigured (local dev) rather than allowing freely, so dev still gets a
 * bound. Fails OPEN on a Redis error: a transient blip should not break a
 * legitimate backfill.
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { rateLimit } from '@/lib/rate-limit';

const hasUpstashConfig =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasUpstashConfig ? Redis.fromEnv() : null;

const backfillLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 h'),
      analytics: true,
      prefix: 'helm:rl:thesis:backfill',
    })
  : null;

const seedLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 h'),
      analytics: true,
      prefix: 'helm:rl:thesis:seed',
    })
  : null;

// A second bound that no amount of account creation gets around. Backfill is
// the EDGAR-heavy path and the shared egress IP is the thing worth protecting.
const backfillGlobalLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(120, '1 h'),
      analytics: true,
      prefix: 'helm:rl:thesis:backfill:global',
    })
  : null;

export interface LimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

async function check(
  limiter: Ratelimit | null,
  global: Ratelimit | null,
  key: string,
  fallbackKey: string,
  fallbackMax: number,
): Promise<LimitResult> {
  if (!limiter) {
    // Dev, or Upstash not configured. Per-instance, but better than nothing.
    const r = rateLimit(fallbackKey, fallbackMax, 3600);
    return { allowed: r.allowed, retryAfterSeconds: r.retryAfterSeconds };
  }
  try {
    const results = await Promise.all([
      limiter.limit(key),
      ...(global ? [global.limit('all')] : []),
    ]);
    const blocked = results.find((r) => !r.success);
    if (!blocked) return { allowed: true };
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((blocked.reset - Date.now()) / 1000)),
    };
  } catch (error) {
    console.error('[thesis-rate-limit] check failed (allowing):', error);
    return { allowed: true };
  }
}

/** Up to 40 EDGAR fetches plus two model calls. The expensive one. */
export function canBackfill(userId: string): Promise<LimitResult> {
  return check(backfillLimiter, backfillGlobalLimiter, userId, `thesis-backfill:${userId}`, 5);
}

/** One gpt-4o-mini draft. Cheap per call, still worth a durable bound. */
export function canSeed(userId: string, resuggest: boolean): Promise<LimitResult> {
  const max = resuggest ? 5 : 10;
  return check(
    seedLimiter,
    null,
    `${resuggest ? 'resuggest' : 'draft'}:${userId}`,
    `thesis-seed${resuggest ? '-resuggest' : ''}:${userId}`,
    max,
  );
}
