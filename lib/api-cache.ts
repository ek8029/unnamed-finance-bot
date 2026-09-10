// Browser-side GET cache for the endpoints several components each ask for on
// one page. One load of /dashboard fired 50 API calls: /api/thesis seven times,
// /api/user/tier six, /api/user/profile four. Every one of those routes calls
// Supabase auth.getUser(), a network round trip, so each duplicate cost real
// latency.
//
// Two rules keep this safe for tier and entitlement code:
//   - only a 2xx is ever stored, so a 401 during cookie propagation cannot be
//     replayed to a later caller (use-tier's retry depends on that), and
//   - the parsed body is handed back, never a shared Response, because a body
//     can only be read once.
//
// No window access at module scope, so a file that also renders on the server
// can import this.

export interface CachedResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
}

const DEFAULT_TTL_MS = 30_000;

interface Entry {
  expiresAt: number;
  result: CachedResult<unknown>;
}

const stored = new Map<string, Entry>();
const inFlight = new Map<string, Promise<CachedResult<unknown>>>();

/** One in-flight request per URL, shared by every caller. Successful responses are
 *  reused for ttlMs. Non-2xx is never cached and never reused. */
export async function cachedGet<T>(url: string, ttlMs: number = DEFAULT_TTL_MS): Promise<CachedResult<T>> {
  const hit = stored.get(url);
  if (hit) {
    if (hit.expiresAt > Date.now()) return hit.result as CachedResult<T>;
    stored.delete(url);
  }

  const pending = inFlight.get(url);
  if (pending) return pending as Promise<CachedResult<T>>;

  const request = (async (): Promise<CachedResult<unknown>> => {
    try {
      const res = await fetch(url);
      if (!res.ok) return { ok: false, status: res.status, data: null };
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        // A 2xx we cannot read is a failure, not a cacheable answer.
        return { ok: false, status: res.status, data: null };
      }
      const result: CachedResult<unknown> = { ok: true, status: res.status, data };
      stored.set(url, { expiresAt: Date.now() + ttlMs, result });
      return result;
    } catch {
      // Network error. Surfaced, not cached, so the next attempt really tries.
      return { ok: false, status: 0, data: null };
    } finally {
      inFlight.delete(url);
    }
  })();

  inFlight.set(url, request);
  return request as Promise<CachedResult<T>>;
}

/** Drop a cached entry after a mutation. */
export function invalidate(url: string): void {
  stored.delete(url);
}

export function __resetApiCache(): void {
  stored.clear();
  inFlight.clear();
}
