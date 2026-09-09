# Watch IO Diet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep every watcher on its current minute-level cadence, make an idle tick cost zero Postgres IO, and give the agent presence surface an honest minute-granularity heartbeat, so the Supabase disk IO budget stops draining while the agent still reads as proactive.

**Architecture:** One new `lib/redis.ts` (the first raw key-value use in the codebase; every existing Upstash use goes through `@upstash/ratelimit`). Every poller checks Redis first and opens Postgres only when there is real work: the judge worker wakes on a flag set at enqueue, the two watchers cache their ticker universe and their seen-item sets, the intraday tick batches its writes and skips unchanged prices, and heartbeats move from a `watch_heartbeats` upsert per tick to a Redis key per tick. Every Redis path degrades to today's behaviour when Redis is unconfigured or throws, so nothing new can take a watcher down. Pure decisions live in lib modules with Vitest tests; the presence lab gets the heartbeat feed last.

**Tech Stack:** Next.js 16 route handlers on Vercel cron, Supabase service client, `@upstash/redis` REST client (`Redis.fromEnv()`, env `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`), Vitest (node, `tests/*.test.ts`).

---

## Measured baseline (2026-09-09, production)

| Cron | Ticks per weekday | Postgres per idle tick today |
|---|---|---|
| judge-worker (`* * * * *`) | 1,440 | `paidSpendSince` + `countToday` + pending select + heartbeat upsert = 4 statements; `judge_jobs` had 0 rows in 24h |
| edgar-watch (`*`, `*/5` off, `*/30` weekend) | ~700 | holdings + theses paged reads, `filing_events` upsert, heartbeat upsert |
| news-watch (`*/5`) | 288 | holdings + theses paged reads, `market_news` re-read, classify ledger insert, heartbeat upsert |
| intraday-prices (`*/5` in session) | 108 | 798-row holdings read, up to 10,000-row `market_prices` prior-close read, 798 holdings updates in chunks of 50, 421 single-row `securities` updates, 1 snapshot insert per user, retention delete |

Tables are small (largest 20k rows). The IO is churn, not size. `coalesce()` is in-process only (`lib/coalesce.ts:15-17`) and does not help across Fluid instances.

## Ground rules

- Read `AGENTS.md` rules 1, 5, 6, 16. Other agents share the tree: `git status --porcelain <file>` before editing; stop on `M`. Stage by name; commit with a pathspec (`git commit -m "..." -- <files>`); never `git add -A`.
- Every Redis call sits behind `getRedis()` returning `null` when unconfigured, and every use is wrapped so a Redis error falls back to the current Postgres path. State this in each commit.
- Cron schedules in `vercel.json` do not change. The feel is the cadence; the diet is what a tick does.
- Copy on any surface: no em dashes, no `!`, no advice words.
- Baseline before Task 1: `npm test` totals, `npx tsc --noEmit`, `git log --oneline -1`. Run the whole suite after every task and report totals.

## File structure

Create:
- `lib/redis.ts`: `getRedis(): Redis | null`, `redisKey(...parts)`, `withRedis<T>(fn, fallback)`; the only place `Redis.fromEnv()` is called for KV.
- `lib/agent/judge-wake.ts`: pure: `shouldWakeJudge(flag: string | null, now: Date): boolean`, `earliestRunAfter(rows)`, key name.
- `lib/watch/universe-cache.ts`: cached watched-ticker universe for edgar/news (Redis, 15 min TTL) over the existing `distinctTickers`.
- `lib/watch/seen-set.ts`: Redis sets of seen accession numbers / article urls with TTL, plus the pure diff.
- `lib/market/tick-diff.ts`: pure: `changedPrices(prev: Map<string, number>, next: Map<string, number>)`, `batchSecuritiesUpsert(rows)` shape.
- `lib/agent/heartbeat-redis.ts`: `beat()` and `readHeartbeats()` on Redis keys `hb:{name}` with the same `WatchName` union, plus `'intraday-prices'`.
- Tests: `tests/redis-helper.test.ts`, `tests/judge-wake.test.ts`, `tests/universe-cache.test.ts`, `tests/seen-set.test.ts`, `tests/tick-diff.test.ts`, `tests/heartbeat-redis.test.ts`.

Modify:
- `lib/agent/judge-queue.ts`: set the wake flag in `enqueueJudgeJobs` and wherever a row returns to `status: 'queued'` with a `run_after`; `runJudgeWorker` reads the flag before `countToday`.
- `lib/edgar-watch.ts`, `lib/news-watch.ts`: universe cache, seen-set diff before the DB upsert / re-read, ledger row only when non-zero.
- `lib/market/intraday-tick.ts`: prior-close cache, unchanged-price skip, batched `securities` upsert, heartbeat.
- `lib/agent/heartbeat.ts`: delegate to Redis, keep the signature, keep the `watch_heartbeats` table untouched (no migration).
- `app/api/testing/presence/route.ts`, `app/testing/app/presence/presence-overview.tsx`: heartbeat feed (lab only).

Not touched: `vercel.json`, any cron route auth, `lib/coalesce.ts`, any migration.

---

### Task 1: `lib/redis.ts`, the one KV client

**Files:** Create `lib/redis.ts`, `tests/redis-helper.test.ts`.

- [ ] **Step 1: Test first** (mock `@upstash/redis` with `vi.mock` returning a class whose instance records calls; stub env with `vi.stubEnv`).
  - `getRedis()` returns `null` when either env var is missing; returns the same instance on repeated calls when both are set.
  - `withRedis(fn, fallback)` returns `fallback` when `getRedis()` is null; returns `fn(redis)`'s value when set; returns `fallback` and calls `console.error('[redis]', ...)` once when `fn` throws.
  - `redisKey('hb', 'edgar-watch')` is `'helm:hb:edgar-watch'` (prefix matches the existing `helm:rl:` convention in `lib/signup-protection.ts:64-66`).
- [ ] **Step 2: Run, expect failure** (`npx vitest run tests/redis-helper.test.ts`).
- [ ] **Step 3: Implement**
```ts
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
```
- [ ] **Step 4: Pass, tsc, whole suite, commit**: `git commit -m "feat(redis): one key-value client with a null fallback for every caller" -- lib/redis.ts tests/redis-helper.test.ts`.

---

### Task 2: Judge worker wakes on a flag, not a poll

Why: 1,440 idle ticks a day each run `countToday` (`lib/agent/judge-queue.ts:171-177`), the pending select (`:202-208`) and a heartbeat upsert (`:348`, `:378`) to learn the queue is empty. Every enqueue goes through `enqueueJudgeJobs` (`:149`, upsert `onConflict: 'kind,user_id,source_key'`), called from `lib/edgar-watch.ts:391`, `lib/news-watch.ts:152`, `lib/market/severe-move.ts:77`. Rows return to `queued` with a future `run_after` on retry; find every write of `status: 'queued'` in `judge-queue.ts` (grep) and list them in the commit.

**Files:** Create `lib/agent/judge-wake.ts`, `tests/judge-wake.test.ts`. Modify `lib/agent/judge-queue.ts`, `tests/judge-queue.test.ts` (mock `@/lib/redis`).

- [ ] **Step 1: Pure module + tests**
```ts
// lib/agent/judge-wake.ts
export const JUDGE_WAKE_KEY = 'agent:judge:wake';   // value: ISO of the earliest run_after among queued rows
/** Wake when the flag is missing (unknown state, poll to be safe) or its time has arrived. */
export function shouldWakeJudge(flag: string | null | undefined, now: Date): boolean {
  if (flag == null) return true;
  const t = Date.parse(flag);
  return Number.isNaN(t) ? true : t <= now.getTime();
}
export function earliestRunAfter(rows: { run_after: string | null }[], now: Date): string {
  const ts = rows.map((r) => (r.run_after ? Date.parse(r.run_after) : now.getTime())).filter((n) => !Number.isNaN(n));
  return new Date(ts.length ? Math.min(...ts) : now.getTime()).toISOString();
}
```
Tests: missing flag wakes; past flag wakes; future flag sleeps; garbage wakes; `earliestRunAfter` picks the min and defaults to now.

- [ ] **Step 2: Wire the flag**
  - In `enqueueJudgeJobs`, after the upsert succeeds: `await withRedis((r) => r.set(redisKey(JUDGE_WAKE_KEY), earliestRunAfter(rows, now)), undefined)`. When the key already holds an earlier time keep the earlier one (read then set, or `SET ... NX` plus a compare; a small pure helper `minIso(a, b)` is fine).
  - At every place a row is written back to `status: 'queued'` with a `run_after`, set the flag to that `run_after` if it is earlier than the current value.
  - In `runJudgeWorker`, after the kill switch (`:337`) and before `paidSpendSince` (`:344`, the first Postgres read): `const flag = await withRedis((r) => r.get<string>(redisKey(JUDGE_WAKE_KEY)), null); if (!shouldWakeJudge(flag, now())) { log.push('idle: no queued work'); return { ...emptySummary, idle: true }; }` (add `idle?: boolean` to `WorkerSummary`). With Redis unconfigured `flag` is null and the worker polls as today.
  - When the pending select returns zero rows, `await withRedis((r) => r.set(key, farFutureIso), undefined)` where far-future is now + 1 day, so the next enqueue lowers it. Never delete the key on an error path.
  - Heartbeat moves to Redis in Task 6; leave the `beat` call in place for now.
- [ ] **Step 3: Tests**: extend `tests/judge-queue.test.ts` with `vi.mock('@/lib/redis', ...)` exposing an in-memory map: future flag → `runJudgeWorker` returns `idle: true` and the fake db records zero `from()` calls; past flag → the existing path runs; `enqueueJudgeJobs` sets the key to the earliest `run_after`.
- [ ] **Step 4: Whole suite, tsc, commit**: message names the three enqueue callers and every requeue site read.

---

### Task 3: Watchers cache their universe and diff against seen sets

Why: each edgar tick pages `holdings` and `theses` (`lib/edgar-watch.ts:151-157`, `lib/news-watch.ts:48-59`, 10 pages of 1000 each) and then upserts every entry into `filing_events` to discover which are new (`edgar-watch.ts:352-358`); news re-reads `market_news` by `created_at` (`news-watch.ts:108-114`) and inserts a classify ledger row every tick (`recordLedgerRow`, `judge-queue.ts:403`, caller `news-watch.ts:97`).

**Files:** Create `lib/watch/universe-cache.ts`, `lib/watch/seen-set.ts`, `tests/universe-cache.test.ts`, `tests/seen-set.test.ts`. Modify `lib/edgar-watch.ts`, `lib/news-watch.ts`, `tests/edgar-watch.test.ts`.

- [ ] **Step 1: `universe-cache.ts`**
```ts
export const UNIVERSE_TTL_S = 15 * 60;
/** Cached union of holdings + tracked theses tickers. Miss or Redis down: read Postgres as today and try to cache. */
export async function cachedUniverse(db: Db, name: 'edgar' | 'news', read: () => Promise<string[]>): Promise<string[]>
```
Key `helm:watch:universe:{name}`, value JSON string[]. Tests with a mocked `@/lib/redis`: hit skips `read`; miss calls `read` once and sets with `ex: UNIVERSE_TTL_S`; Redis null calls `read` every time.
- [ ] **Step 2: `seen-set.ts`**
```ts
export const SEEN_TTL_S = 7 * 24 * 3600;
/** Returns the ids not in the Redis set, and adds them. Redis down: returns all ids (today's behaviour, the DB upsert still dedupes). */
export async function unseen(name: 'edgar' | 'news', ids: string[]): Promise<string[]>
```
Implementation: `SMISMEMBER` (or `smismember` in the client) then `SADD` the new ones and `EXPIRE` the key. Tests: first call returns all and adds; second call returns none; Redis null returns all.
- [ ] **Step 3: Wire edgar**: `buildWatchUniverse` reads through `cachedUniverse(db, 'edgar', ...)`. In `watchOnce`, before `recordFilingEvents`, `const fresh = await unseen('edgar', entries.map((e) => e.accessionNo))`; when `fresh` is empty and dry mode is off, skip this form's upsert with `continue` (the loop at `watchOnce` iterates `WATCH_FORMS`; the adjacent quiet path is `if (hits.length === 0) continue;` at `:284`; a `return` here would starve the later forms that tick). Keep the upsert as the authoritative dedupe for the fresh ones. The in-process `lastRead` map stays.
- [ ] **Step 4: Wire news**: universe through the cache. The ledger row (`news-watch.ts:95`, gated on `ledger.calls > 0`) and the `market_news` re-read (`:107`, gated on `inserted > 0`) are already conditional; verify by reading and leave them.
- [ ] **Step 5: Tests**: `tests/edgar-watch.test.ts` already drives `watchOnce` through injected deps and fixtures; add a case where every fixture accession is already seen (mocked seen-set returns `[]`) and assert the fake db receives no `filing_events` write. For news, add a pure test that the ledger row is skipped at zero (extract the decision into a tiny pure function if needed).
- [ ] **Step 6: Whole suite, tsc, commit.**

---

### Task 4: Intraday tick writes only what changed, in batches

Why: per tick (`lib/market/intraday-tick.ts`): a 798-row holdings read (`:48-51`), a paged prior-close read of up to 10,000 `market_prices` rows (`:71-85`), 798 holdings updates in chunks of 50 (`:102`), 421 single-row `securities` updates in a loop (`:113-117`), a snapshot insert per user (`:175-181`). Readers of `holdings.current_price` are many (overview route `:84`, brief route `:72`, holdings route, portfolio page, monitor component), so the column keeps being written; the diet is skipping unchanged rows and batching.

**Files:** Create `lib/market/tick-diff.ts`, `tests/tick-diff.test.ts`. Modify `lib/market/intraday-tick.ts`, `tests/intraday-tick.test.ts`.

- [ ] **Step 1: Pure module + tests**
```ts
export function changedPrices(prev: Map<string, number>, next: Map<string, number>): Map<string, number>  // tickers whose price differs or were absent
export function securitiesUpsertRows(changed: Map<string, number>, idByTicker: Map<string, string>, now: string): { id: string; current_price: number; last_updated_at: string }[]
```
Tests: unchanged dropped; new ticker kept; float equality exact (no tolerance, a print is a print); rows only for tickers with a known id.
- [ ] **Step 2: Prior close cache**: key `helm:tick:prevclose:{ET day}` holding JSON `{ ticker: close }`, TTL 26 h. On a hit skip the paged read; on a miss read as today and cache. Redis null: read as today.
- [ ] **Step 3: Last-print cache**: key `helm:tick:last:{ET day}` JSON `{ ticker: price }`. After fetching prints, `changed = changedPrices(prev, prices)`; reprice and update only holdings whose ticker is in `changed`; write `securities` with ONE `upsert(rows, { onConflict: 'id' })` instead of the loop; store the merged map back. Redis null: `changed = prices` (today's behaviour). The snapshot insert stays per tick (it is the intraday series). Report the per-tick row counts in the tick result (`updatedHoldings`, `updatedSecurities`, `skipped`) so `scripts/probe-tick-times.ts` can show the saving.
- [ ] **Step 4: Staleness reader**: `app/api/holdings/route.ts:20-36` reads the newest `holdings.last_updated_at` during market hours and fires a background full `/api/market/prices/refresh` sweep when it is 10 minutes old. With unchanged prints no longer stamped, a flat book would trip that on every holdings load and undo the diet. Repoint that check at the intraday heartbeat (`readHeartbeats()` for `'intraday-prices'`, Task 6 makes it a Redis read) so "prices are fresh" means "the tick ran", not "a row was rewritten". Rule 1: it is the only reader that treats the stamp as freshness (grep `last_updated_at` in app/ and hooks/ and list the others in the commit).
- [ ] **Step 5: Heartbeat**: call `beat(db, 'intraday-prices', { updated, skipped })` at the end (the name is added to `WatchName` in Task 6; add it here as a string-literal extension of the union in `lib/agent/heartbeat.ts` and keep the Postgres path until Task 6 swaps it).
- [ ] **Step 6: Tests**: keep the existing pure tests; add the Redis-mocked path: prior-close hit skips the `market_prices` read; unchanged prints produce zero holdings updates and one securities upsert of zero rows (or none).
- [ ] **Step 7: Whole suite, tsc, commit.** Verify after deploy with `scripts/probe-tick-times.ts` (untracked) that every 5-minute slot still lands.

---

### Task 5: Cheap idle ticks for the watchers' remaining reads

Why: after Task 3 an edgar tick still fetches the RSS feeds (fine, external) and news still runs `refreshRssNews` (external plus `market_news` inserts only when new). Confirm with a grep that no other Postgres read remains on the quiet path of `watchOnce` and `runNewsWatch` except the heartbeat. If one remains (for example a `theses` read inside `refreshRssNews`), route it through the universe cache or a 15-minute Redis cache with the same fallback. Document the quiet-path statement count per watcher in the commit message (target: zero).

**Files:** Modify only what the grep finds; tests as in Task 3.

---

### Task 6: Heartbeats on Redis, honest minute-level presence

Why: `lib/agent/heartbeat.ts` `beat()` upserts `watch_heartbeats` on every tick from three watchers (~2,400 writes a day) and the presence lab reads only `daily-scans` from it (`app/api/testing/presence/route.ts:254`). The feel the user wants is "checked at 14:32, nothing new" at minute granularity; that is a Redis key, not a Postgres row.

**Files:** Create `lib/agent/heartbeat-redis.ts`, `tests/heartbeat-redis.test.ts`. Modify `lib/agent/heartbeat.ts` (delegate, keep the signature and the `WatchName` union plus `'intraday-prices'`), `app/api/testing/presence/route.ts`, `app/testing/app/presence/presence-overview.tsx`, `app/testing/app/watch/page.tsx` if it reads `watch_heartbeats`.

- [ ] **Step 1: Module + tests**: `beat(name, detail)` writes `helm:hb:{name}` = JSON `{ at, detail }` with a 48 h TTL and appends `{ at, summary }` to a capped list `helm:hb:{name}:log` (`LPUSH` + `LTRIM 0 59`, the last hour of a minute watcher). `readHeartbeats()` reads all names with one `MGET`; `readHeartbeatLog(name, n)` reads the list. Redis null: `beat` falls back to the existing Postgres upsert (so the table keeps working when Redis is down) and reads return an empty map. Tests with a mocked `@/lib/redis`.
- [ ] **Step 2: Delegate**: `lib/agent/heartbeat.ts` `beat` and `readHeartbeats` call the Redis module first; the Postgres upsert remains only as the fallback. Callers unchanged (`judge-queue.ts:348,378`, `edgar-watch.ts:413`, `news-watch.ts:173`, and the new intraday call). Rule 1: list them in the commit.
- [ ] **Step 3: Presence feed (lab only)**: the presence route adds `heartbeats: Array<{ name, at, detail }>` and `recent: Array<{ name, at, summary }>` (last 20 across watchers, newest first). `presence-overview.tsx` renders a "Watching" block: one line per watcher, "EDGAR checked 14:32, nothing new" or "EDGAR checked 14:32, 2 filings queued", built from `detail`, and a short feed of the last 20 lines. Copy from a small `LAB_COPY` object in the component; no advice words, no em dashes, no `!`. This stays under `/testing/app` per the standing rule; nothing on the real overview.
- [ ] **Step 4: Whole suite, tsc, commit.**

---

### Task 7: Verification and the numbers

- [ ] `npm test` totals before and after the whole plan; `npx tsc --noEmit` exit 0.
- [ ] Idle-tick statement count per cron, from reading the code paths after all tasks (target: judge 0, edgar 0, news 0, intraday: 1 holdings read + only changed writes + 1 snapshot insert per user).
- [ ] After deploy (Evan promotes), 24 hours later: Supabase Reports, Database, Disk IO, compare against the 9/9 baseline; `scripts/probe-tick-times.ts` for slot regularity; `scripts/probe-disk-io-2026-09-09.ts` (untracked) for row churn.
- [ ] `git status --porcelain` shows only other agents' files. Nothing pushed without an explicit go.

## Rollout

Behind nothing: every change degrades to today's behaviour without Redis. Ship as one push after Evan's go, promote manually, watch the Disk IO graph for a day. If the judge queue ever looks stuck, the recovery is `DEL helm:agent:judge:wake` in the Upstash console; the next tick polls.

## Risks

- Redis is a second dependency on the critical path of the judge queue. Mitigation: the flag only decides whether to poll; a missing or unreadable flag means poll.
- Two Fluid instances can both see the wake flag and both claim; the existing compare-and-set claim (`judge-queue.ts:221-229`) already handles that.
- Unchanged-price skip means `holdings.last_updated_at` no longer advances every tick for flat names. The one reader that treats the stamp as price freshness (`app/api/holdings/route.ts:20-36`) is repointed at the tick heartbeat in Task 4 Step 4.
