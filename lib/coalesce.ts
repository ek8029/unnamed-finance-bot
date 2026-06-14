/**
 * Single-flight + short-lived result coalescing, keyed by string.
 *
 * Concurrent callers with the same key share ONE in-flight execution.
 * Callers within `freshMs` of the last SUCCESSFUL result reuse it
 * instead of re-running `fn`. Failures are never cached, so the next
 * call after an error retries.
 *
 * Used to collapse stampedes of identical expensive work into a single
 * upstream pass. The global price refresh is fired by two dashboard
 * hooks, every open tab, and (in dev) React Strict Mode's double effect
 * invocation — without coalescing those all run a full Finazon
 * /time_series sweep at once and rate-limit each other.
 *
 * State is module-level, so it is shared across requests on a warm
 * Fluid Compute instance (same pattern as the lib/live-quotes caches).
 */

interface Fresh<T> {
  at: number;
  value: T;
}

const inFlight = new Map<string, Promise<unknown>>();
const lastFresh = new Map<string, Fresh<unknown>>();

export async function coalesce<T>(
  key: string,
  freshMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const fresh = lastFresh.get(key) as Fresh<T> | undefined;
  if (fresh && Date.now() - fresh.at < freshMs) {
    return fresh.value;
  }

  const running = inFlight.get(key) as Promise<T> | undefined;
  if (running) return running;

  const run = (async () => {
    try {
      const value = await fn();
      lastFresh.set(key, { at: Date.now(), value });
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, run);
  return run;
}

/** Test hook — clears all coalescing state. */
export function __resetCoalesce(): void {
  inFlight.clear();
  lastFresh.clear();
}
