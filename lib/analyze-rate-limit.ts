/**
 * Rate limit for ANONYMOUS on-demand analysis generation on the public
 * /analyze/[ticker] page. Only consulted on a cache MISS for a valid ticker,
 * i.e. right before spending Finazon + OpenAI. Cached serves never touch this,
 * so normal traffic (popular, already-cached tickers) is unaffected.
 *
 * Two layers, both must pass:
 *   - per-IP:  stops one client iterating many tickers to burn budget
 *   - global:  caps total anon generations regardless of IP distribution
 *              (a botnet spread across many IPs still cannot exceed this)
 *
 * Backed by Upstash Redis (shared across Vercel instances). Mirrors the
 * signup-protection limiter. If Upstash is not configured (local dev), the
 * limiter is null and generation is allowed — never block dev.
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const hasUpstashConfig =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasUpstashConfig ? Redis.fromEnv() : null;

const ipLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
      prefix: 'helm:rl:analyze:ip',
    })
  : null;

const globalLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '10 m'),
      analytics: true,
      prefix: 'helm:rl:analyze:global',
    })
  : null;

/**
 * Returns true if an anonymous generation for this IP is allowed right now.
 * Allows freely when Upstash is unconfigured (dev). On Redis error, fails OPEN
 * (allow) — a transient Redis blip should not 404 a real ticker.
 */
export async function canGenerateAnon(ip: string): Promise<boolean> {
  if (!ipLimiter || !globalLimiter) return true;
  try {
    const [globalRes, ipRes] = await Promise.all([
      globalLimiter.limit('all'),
      ipLimiter.limit(ip || 'unknown'),
    ]);
    return globalRes.success && ipRes.success;
  } catch (error) {
    console.error('analyze rate-limit check failed (allowing):', error);
    return true;
  }
}
