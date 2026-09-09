// lib/agent/judge-wake.ts
// The judge worker's wake flag. Pure functions over strings and dates so the
// queue tests can pin them without Redis.
//
// The minute cron used to open four Postgres statements per tick to learn the
// queue was empty. Now every enqueue (and every deferred requeue) lowers one
// Redis key to the earliest run_after it knows about, and a tick that finds
// the key in the future returns before its first database read. A missing or
// unreadable key means "unknown", and unknown polls exactly as before.

/** Redis key (under the helm: prefix) holding the ISO of the earliest run_after among queued rows. */
export const JUDGE_WAKE_KEY = 'agent:judge:wake';

/** How far ahead an empty pending select parks the flag. Bounds how long a
 *  job can sleep if an enqueue races the empty select: one hour, not a day. */
export const JUDGE_SLEEP_MS = 60 * 60 * 1000;

/** How long a `running` row counts as alive for the park read. A job cannot
 *  outlive the 300 s worker function; a row older than this was left behind by
 *  a killed instance and must not pin the flag in the past. */
export const RUNNING_GRACE_MS = 10 * 60 * 1000;

/** Wake when the flag is missing (unknown state, poll to be safe) or its time has arrived. */
export function shouldWakeJudge(flag: string | null | undefined, now: Date): boolean {
  if (flag == null) return true;
  const t = Date.parse(flag);
  return Number.isNaN(t) ? true : t <= now.getTime();
}

/** The earlier of two ISO strings; a missing or unparsable side loses. */
export function minIso(a: string | null | undefined, b: string): string {
  if (a == null) return b;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta)) return b;
  if (Number.isNaN(tb)) return a;
  return ta <= tb ? a : b;
}
