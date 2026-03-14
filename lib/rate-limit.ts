/**
 * Simple in-memory rate limiter for API routes.
 * Uses a Map with periodic cleanup. Not shared across Vercel instances,
 * but sufficient for basic abuse prevention.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

/**
 * Check if a request is within the rate limit.
 * @param key - Unique identifier (e.g., IP address or user ID)
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowSeconds - Time window in seconds
 * @returns { allowed, remaining, retryAfterSeconds }
 */
export function rateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  cleanup();

  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, retryAfterSeconds: 0 };
  }

  if (entry.count >= maxRequests) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, retryAfterSeconds: 0 };
}

/**
 * Extract client IP from request headers (works behind Vercel/Cloudflare proxies).
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real;
  return '127.0.0.1';
}
