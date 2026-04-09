/**
 * Upstash-backed rate limiting for the signup endpoint.
 *
 * Three tiers, checked in order from cheapest to most-expensive-to-hit:
 *   1. IP:      3 signups per IP per hour
 *   2. Domain:  5 signups per email domain per day
 *   3. Global:  30 signups site-wide per 10 minutes
 *
 * This is a NEW module separate from lib/rate-limit.ts (which provides a
 * simple in-memory limiter for non-security-critical routes). Do not merge
 * the two — the in-memory limiter is not shared across Vercel instances,
 * which is fine for "don't hammer the polygon API" but unacceptable for
 * stopping a coordinated signup attack.
 *
 * Missing env var behavior:
 *   - development: log warning, fail OPEN (return allowed=true)
 *   - production:  fail CLOSED (throw MissingRateLimitConfigError)
 *
 * The signup route catches MissingRateLimitConfigError and returns 503
 * with a generic message, then logs signup_misconfigured to auth_events
 * so the operator is notified without leaking configuration state.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/** Thrown when Upstash env vars are missing in production. */
export class MissingRateLimitConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingRateLimitConfigError';
  }
}

const isProduction = process.env.NODE_ENV === 'production';
const hasUpstashConfig =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * Lazy Redis client — only constructed if env vars are present. Avoids
 * module-load crashes in development when the user hasn't provisioned
 * Upstash yet.
 */
const redis = hasUpstashConfig ? Redis.fromEnv() : null;

/**
 * Lazy limiter factory. Returns null if Upstash is not configured.
 * Check the null-case in the caller.
 */
function makeLimiter(
  limit: number,
  window: `${number} ${'s' | 'm' | 'h' | 'd'}`,
  prefix: string,
): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: true,
    prefix,
  });
}

export const signupIpLimiter = makeLimiter(3, '1 h', 'helm:rl:signup:ip');
export const signupEmailDomainLimiter = makeLimiter(5, '1 d', 'helm:rl:signup:domain');
export const signupGlobalLimiter = makeLimiter(30, '10 m', 'helm:rl:signup:global');

/**
 * Canonical result shape returned by checkSignupRateLimits.
 * When allowed=false, `reason` identifies which tier rejected (for logging
 * to auth_events — NOT for displaying to the user).
 */
export interface SignupRateLimitResult {
  allowed: boolean;
  reason?: 'rl_ip' | 'rl_domain' | 'rl_global';
  retryAfterSeconds?: number;
}

/**
 * Assert that signup rate limiting is configured. Called at the top of the
 * signup handler. Fail-open in development, fail-closed in production.
 * @throws MissingRateLimitConfigError in production if Upstash is missing
 */
export function assertSignupRateLimitConfigured(): void {
  if (hasUpstashConfig) return;
  if (isProduction) {
    throw new MissingRateLimitConfigError(
      'Upstash Redis is not configured. Signup is disabled until UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.',
    );
  }
  // Dev-only warning — don't flood logs, just once per cold start per tier
  console.warn(
    '[signup-protection] Upstash not configured in development — rate limiting disabled. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN before deploying to production.',
  );
}

/**
 * Run all three signup rate-limit tiers in order. Returns the first failure
 * or {allowed:true} if all pass.
 *
 * Important: checks are sequential, not parallel — this lets the cheapest
 * failure short-circuit and saves Redis calls. IP check is almost always the
 * first to trip under a real attack.
 */
export async function checkSignupRateLimits(params: {
  ip: string;
  emailDomain: string;
}): Promise<SignupRateLimitResult> {
  // If limiters are null (dev, no Upstash), fail open
  if (!signupIpLimiter || !signupEmailDomainLimiter || !signupGlobalLimiter) {
    return { allowed: true };
  }

  // 1. Per-IP check — cheapest and most likely to trip
  const ipResult = await signupIpLimiter.limit(`ip:${params.ip}`);
  if (!ipResult.success) {
    return {
      allowed: false,
      reason: 'rl_ip',
      retryAfterSeconds: Math.max(1, Math.ceil((ipResult.reset - Date.now()) / 1000)),
    };
  }

  // 2. Per-domain check — catches distributed bot rings on one domain
  const domainResult = await signupEmailDomainLimiter.limit(`domain:${params.emailDomain}`);
  if (!domainResult.success) {
    return {
      allowed: false,
      reason: 'rl_domain',
      retryAfterSeconds: Math.max(1, Math.ceil((domainResult.reset - Date.now()) / 1000)),
    };
  }

  // 3. Global site-wide check — catches coordinated attacks across many IPs
  const globalResult = await signupGlobalLimiter.limit('global');
  if (!globalResult.success) {
    return {
      allowed: false,
      reason: 'rl_global',
      retryAfterSeconds: Math.max(1, Math.ceil((globalResult.reset - Date.now()) / 1000)),
    };
  }

  return { allowed: true };
}
