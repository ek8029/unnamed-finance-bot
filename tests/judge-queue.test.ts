import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
afterEach(() => vi.unstubAllEnvs());
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  readJudgeConfig, etDayStartIso, decideClaims, runJudgeWorker, dominantModel,
  enqueueJudgeJobs, claimJudgeJobs, finishJudgeJob,
  type JudgeJobRow, type JudgeConfig,
} from '@/lib/agent/judge-queue';
import { JUDGE_WAKE_KEY, JUDGE_SLEEP_MS, RUNNING_GRACE_MS } from '@/lib/agent/judge-wake';
import { emptyLedger, recordUsage } from '@/lib/ai/pricing';
import { __resetCoalesce } from '@/lib/coalesce';

// Keep the auth test independent of provider initialization. The real route
// must reject before constructing a service client or running external work.
const workerBoundary = vi.hoisted(() => ({ db: vi.fn(), judge: vi.fn(), receipts: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: workerBoundary.db }));
vi.mock('@/lib/agent/judge-run', () => ({ runJudgeJob: workerBoundary.judge }));
vi.mock('@/lib/push/send', () => ({ checkPushReceipts: workerBoundary.receipts }));

// An in-memory Redis behind withRedis, so the wake flag and the heartbeat are
// observable per test. Values are JSON round-tripped the way the real client
// serializes them. beat() writes through multi().exec(); `execThrows` fails
// that as a unit so beat() falls back to Postgres.
// `getCalls` and `readKeysCalls` record the reads, so a test can pin that the
// minute tick asks for its two keys in one call instead of two.
const redisMock = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  lists: new Map<string, unknown[]>(),
  ttl: new Map<string, number>(),
  execThrows: false,
  nullClient: false,
  getCalls: [] as string[],
  readKeysCalls: [] as string[][],
}));
vi.mock('@/lib/redis', () => {
  const wire = (v: unknown) => JSON.parse(JSON.stringify(v));
  const r = {
    get: async (k: string) => { redisMock.getCalls.push(k); return redisMock.store.get(k) ?? null; },
    set: async (k: string, v: unknown) => { redisMock.store.set(k, wire(v)); return 'OK'; },
    lpush: async (k: string, ...vals: unknown[]) => {
      const l = redisMock.lists.get(k) ?? [];
      l.unshift(...vals.map(wire).reverse());
      redisMock.lists.set(k, l);
      return l.length; // the real LPUSH answers with the list's new length
    },
    ltrim: async (k: string, start: number, stop: number) => {
      const l = redisMock.lists.get(k) ?? [];
      redisMock.lists.set(k, l.slice(start, stop + 1));
      return 'OK';
    },
    expire: async (k: string, s: number) => { redisMock.ttl.set(k, s); return 1; },
    multi: () => {
      const queued: (() => Promise<unknown>)[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p: any = {
        set: (k: string, v: unknown) => { queued.push(() => r.set(k, v)); return p; },
        lpush: (k: string, ...vals: unknown[]) => { queued.push(() => r.lpush(k, ...vals)); return p; },
        ltrim: (k: string, a: number, b: number) => { queued.push(() => r.ltrim(k, a, b)); return p; },
        expire: (k: string, s: number) => { queued.push(() => r.expire(k, s)); return p; },
        // One entry per queued command, in order, the way the real exec
        // answers: a mock returning [] would hide the length beat() reads.
        exec: async () => { if (redisMock.execThrows) throw new Error('redis down'); const out: unknown[] = []; for (const q of queued) out.push(await q()); return out; },
      };
      return p;
    },
  };
  return {
    withRedis: async <T,>(fn: (r: unknown) => Promise<T>, fallback: T) => { if (redisMock.nullClient) return fallback; try { return await fn(r); } catch { return fallback; } },
    // One MGET over the list. Redis null: nulls of the same length, so the
    // caller cannot tell "no flag" from "no Redis".
    readKeys: async (keys: string[]) => {
      redisMock.readKeysCalls.push(keys);
      if (redisMock.nullClient) return keys.map(() => null);
      return keys.map((k) => (redisMock.store.get(k) ?? null) as string | null);
    },
    redisKey: (...parts: string[]) => ['helm', ...parts].join(':'),
  };
});
const WAKE = `helm:${JUDGE_WAKE_KEY}`;
beforeEach(() => {
  redisMock.store.clear();
  redisMock.lists.clear();
  redisMock.ttl.clear();
  redisMock.execThrows = false;
  redisMock.nullClient = false;
  redisMock.getCalls.length = 0;
  redisMock.readKeysCalls.length = 0;
});

const CFG: JudgeConfig = { enabled: true, dailyCap: 200, userCap: 25, batch: 10, dailyUsd: 5 };

function job(id: string, user: string, createdAt: string, extra: Partial<JudgeJobRow> = {}): JudgeJobRow {
  return {
    id, kind: 'news', user_id: user, thesis_id: `t-${id}`, pillar_id: null, ticker: 'NVDA',
    source_key: `src-${id}`, payload: {}, status: 'queued', attempts: 0,
    run_after: createdAt, created_at: createdAt, ...extra,
  };
}

describe('readJudgeConfig', () => {
  it('is OFF unless JUDGE_ENABLED is exactly "true"', () => {
    expect(readJudgeConfig({}).enabled).toBe(false);
    expect(readJudgeConfig({ JUDGE_ENABLED: '1' }).enabled).toBe(false);
    expect(readJudgeConfig({ JUDGE_ENABLED: 'TRUE' }).enabled).toBe(false);
    expect(readJudgeConfig({ JUDGE_ENABLED: 'true' }).enabled).toBe(true);
  });
  it('defaults the caps to 200 / 25 / 10 and ignores garbage', () => {
    expect(readJudgeConfig({})).toEqual({ enabled: false, dailyCap: 200, userCap: 25, batch: 10, dailyUsd: 5 });
    expect(readJudgeConfig({ JUDGE_DAILY_CAP: 'lots', JUDGE_USER_CAP: '-3', JUDGE_BATCH: '0', JUDGE_DAILY_USD: 'free' }))
      .toEqual({ enabled: false, dailyCap: 200, userCap: 25, batch: 10, dailyUsd: 5 });
    expect(readJudgeConfig({ JUDGE_DAILY_CAP: '50', JUDGE_USER_CAP: '5', JUDGE_BATCH: '2', JUDGE_DAILY_USD: '2.5' }))
      .toEqual({ enabled: false, dailyCap: 50, userCap: 5, batch: 2, dailyUsd: 2.5 });
  });
});

describe('etDayStartIso', () => {
  it('is 04:00Z in daylight time and 05:00Z in standard time', () => {
    expect(etDayStartIso(new Date('2026-09-08T14:30:00Z'))).toBe('2026-09-08T04:00:00.000Z');
    expect(etDayStartIso(new Date('2026-12-08T14:30:00Z'))).toBe('2026-12-08T05:00:00.000Z');
  });
  it('keeps the previous ET day for an instant after UTC midnight but before ET midnight', () => {
    // 02:30Z on the 9th is 10:30pm ET on the 8th.
    expect(etDayStartIso(new Date('2026-09-09T02:30:00Z'))).toBe('2026-09-08T04:00:00.000Z');
  });
});

describe('decideClaims', () => {
  it('claims oldest first, up to the batch', () => {
    const q = [job('c', 'u1', '2026-09-08T14:03:00Z'), job('a', 'u1', '2026-09-08T14:01:00Z'), job('b', 'u2', '2026-09-08T14:02:00Z')];
    const { claim, capped } = decideClaims(q, { total: 0, byUser: new Map() }, { ...CFG, batch: 2 });
    expect(claim.map((j) => j.id)).toEqual(['a', 'b']);
    expect(capped).toEqual([]);
  });

  it('marks everything capped once the daily cap is reached, counting today\'s runs', () => {
    const q = [job('a', 'u1', '2026-09-08T14:01:00Z'), job('b', 'u2', '2026-09-08T14:02:00Z')];
    const { claim, capped } = decideClaims(q, { total: 199, byUser: new Map() }, CFG);
    expect(claim.map((j) => j.id)).toEqual(['a']);
    expect(capped.map((c) => [c.job.id, c.reason])).toEqual([['b', 'daily cap 200']]);
  });

  it('caps one user without starving the others', () => {
    const q = [
      job('a', 'big', '2026-09-08T14:01:00Z'),
      job('b', 'big', '2026-09-08T14:02:00Z'),
      job('c', 'small', '2026-09-08T14:03:00Z'),
    ];
    const { claim, capped } = decideClaims(q, { total: 30, byUser: new Map([['big', 24]]) }, CFG);
    expect(claim.map((j) => j.id)).toEqual(['a', 'c']);
    expect(capped.map((c) => [c.job.id, c.reason])).toEqual([['b', 'user cap 25']]);
  });
});

describe('runJudgeWorker', () => {
  it('touches nothing when the switch is off', async () => {
    const db = { from: () => { throw new Error('database touched while disabled'); } };
    const log: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = await runJudgeWorker(db as any, { ...CFG, enabled: false }, async () => ({ status: 'done' }), log);
    expect(s.enabled).toBe(false);
    expect(s.claimed).toBe(0);
    expect(log[0]).toContain('disabled');
  });

  it('claims nothing once the day\'s dollars are spent', async () => {
    const tables: string[] = [];
    // Every chained call returns the same thenable, which resolves to the rows.
    const stub = (rows: unknown[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p: any = new Proxy({}, {
        get: (_t, prop) => (prop === 'then' ? (res: (v: unknown) => unknown) => res({ data: rows, error: null }) : () => p),
      });
      return p;
    };
    const db = { from: (t: string) => { tables.push(t); return stub(t === 'judge_jobs' ? [{ cost_usd: '3.25' }, { cost_usd: '1.75' }] : []); } };
    const log: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = await runJudgeWorker(db as any, { ...CFG, dailyUsd: 5 }, async () => { throw new Error('a job ran past the cap'); }, log);
    expect(s.spentTodayUsd).toBe(5);
    expect(s.claimed).toBe(0);
    expect(log.some((l) => l.includes('daily spend cap reached'))).toBe(true);
    // The heartbeat lands on Redis, not the table.
    expect(tables).not.toContain('watch_heartbeats');
    expect(redisMock.store.get('helm:hb:judge-worker')).toMatchObject({ detail: { spendCapReached: true, claimed: 0 } });
  });
});

// Every chained call on one statement returns the same thenable, which
// resolves to `result`; a statement ending in maybeSingle() resolves to
// `single` instead, shaped as the real client shapes it (data: row | null).
// `ops` records each call as `name(args)` so a test can pin a filter.
function chain(
  result: { data: unknown; error: unknown },
  tables?: string[],
  single: { data: unknown; error: unknown } = { data: null, error: null },
  ops?: string[],
) {
  return {
    from: (t: string) => {
      tables?.push(t);
      let sawSingle = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p: any = new Proxy({}, {
        get: (_t, prop) => {
          if (prop === 'then') return (res: (v: unknown) => unknown) => res(sawSingle ? single : result);
          return (...args: unknown[]) => {
            ops?.push(`${String(prop)}(${JSON.stringify(args)})`);
            if (prop === 'maybeSingle') sawSingle = true;
            return p;
          };
        },
      });
      return p;
    },
  };
}

describe('judge wake flag', () => {
  const NOW = new Date('2026-09-09T14:00:00.000Z');
  const HOUR_AHEAD = new Date(NOW.getTime() + JUDGE_SLEEP_MS).toISOString();
  const clock = () => NOW;
  const newJob = { kind: 'news' as const, user_id: 'u', thesis_id: 't', ticker: 'NVDA', source_key: 'k' };

  it('a future flag returns idle with zero Postgres statements and a Redis heartbeat', async () => {
    redisMock.store.set(WAKE, '2026-09-09T14:30:00.000Z');
    const tables: string[] = [];
    const db = chain({ data: null, error: null }, tables);
    const log: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = await runJudgeWorker(db as any, CFG, async () => { throw new Error('a job ran while idle'); }, log, clock);
    expect(s.idle).toBe(true);
    expect(s.claimed).toBe(0);
    expect(tables).toEqual([]);
    expect(redisMock.store.get('helm:hb:judge-worker')).toMatchObject({ detail: { idle: true, wakeAt: '2026-09-09T14:30:00.000Z' } });
    expect(log[0]).toContain('idle');
    expect(log[0]).toContain('2026-09-09T14:30:00.000Z');
  });

  it('an idle tick falls back to the watch_heartbeats upsert when the Redis MULTI throws', async () => {
    redisMock.store.set(WAKE, '2026-09-09T14:30:00.000Z');
    redisMock.execThrows = true;
    const tables: string[] = [];
    const db = chain({ data: null, error: null }, tables);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = await runJudgeWorker(db as any, CFG, async () => { throw new Error('a job ran while idle'); }, [], clock);
    expect(s.idle).toBe(true);
    expect(tables).toEqual(['watch_heartbeats']);
    expect(redisMock.store.has('helm:hb:judge-worker')).toBe(false);
  });

  it('a past flag polls through to the claim path as before', async () => {
    redisMock.store.set(WAKE, '2026-09-09T13:59:00.000Z');
    const tables: string[] = [];
    const db = chain({ data: [], error: null }, tables); // zero spend, zero queued
    const log: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = await runJudgeWorker(db as any, CFG, async () => ({ status: 'done' }), log, clock);
    expect(s.idle).toBeUndefined();
    expect(tables).toContain('judge_jobs');
    // Only claimJudgeJobs parks the flag, so this proves the claim path ran.
    expect(redisMock.store.get(WAKE)).toBe(HOUR_AHEAD);
  });

  it('a missing flag polls through to the claim path as before', async () => {
    const tables: string[] = [];
    const db = chain({ data: [], error: null }, tables);
    const log: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = await runJudgeWorker(db as any, CFG, async () => ({ status: 'done' }), log, clock);
    expect(s.idle).toBeUndefined();
    expect(tables).toContain('judge_jobs');
    expect(redisMock.store.get(WAKE)).toBe(HOUR_AHEAD);
  });

  it('with no flag handed in the worker reads the key itself, the way the script calls it', async () => {
    redisMock.store.set(WAKE, '2026-09-09T14:30:00.000Z');
    const db = chain({ data: null, error: null }, []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = await runJudgeWorker(db as any, CFG, async () => { throw new Error('a job ran while idle'); }, [], clock);
    expect(s.idle).toBe(true);
    expect(redisMock.getCalls).toEqual([WAKE]);
    // The beat rode the same tick: one log entry, and the log key armed with
    // a TTL off the length the exec reply carried. If exec answered with a
    // shape the real client never sends, the length would be unreadable and
    // this TTL would be missing.
    expect(redisMock.lists.get('helm:hb:judge-worker:log')).toHaveLength(1);
    expect(redisMock.ttl.get('helm:hb:judge-worker:log')).toBe(48 * 3600);
  });

  it('a handed-in future flag is used and the key is never read', async () => {
    const tables: string[] = [];
    const db = chain({ data: null, error: null }, tables);
    const log: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = await runJudgeWorker(db as any, CFG, async () => { throw new Error('a job ran while idle'); }, log, clock, '2026-09-09T14:30:00.000Z');
    expect(s.idle).toBe(true);
    expect(tables).toEqual([]);
    expect(log[0]).toContain('2026-09-09T14:30:00.000Z');
    expect(redisMock.getCalls).toEqual([]);
  });

  it('a handed-in null polls as before and beats the stored value', async () => {
    // The stored flag is in the future. Passing null means the caller read the
    // key and found nothing, so the worker must poll, not trust the store.
    redisMock.store.set(WAKE, '2099-01-01T00:00:00.000Z');
    const tables: string[] = [];
    const db = chain({ data: [], error: null }, tables);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = await runJudgeWorker(db as any, CFG, async () => ({ status: 'done' }), [], clock, null);
    expect(s.idle).toBeUndefined();
    expect(tables).toContain('judge_jobs');
    // Only the park inside claimJudgeJobs read the key, never the wake gate.
    expect(redisMock.getCalls).toEqual([WAKE]);
    // The park's compare-before-set saw a different value and left it alone.
    expect(redisMock.store.get(WAKE)).toBe('2099-01-01T00:00:00.000Z');
  });

  it('enqueue always writes now, over a past flag and over a parked one', async () => {
    const db = chain({ data: [{ id: '1' }], error: null });
    for (const existing of [undefined, '2020-01-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z']) {
      redisMock.store.clear();
      if (existing) redisMock.store.set(WAKE, existing);
      const before = Date.now();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await enqueueJudgeJobs(db as any, [newJob]);
      expect(r).toEqual({ inserted: 1, error: null });
      const set = Date.parse(redisMock.store.get(WAKE) as string);
      expect(set).toBeGreaterThanOrEqual(before);
      expect(set).toBeLessThanOrEqual(Date.now());
    }
  });

  it('a failed upsert leaves the flag alone', async () => {
    const db = chain({ data: null, error: { message: 'boom' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await enqueueJudgeJobs(db as any, [newJob]);
    expect(r.error).toBe('boom');
    expect(redisMock.store.has(WAKE)).toBe(false);
  });

  it('an empty queue parks the flag one hour ahead', async () => {
    const db = chain({ data: [], error: null }); // maybeSingle resolves data: null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = await claimJudgeJobs(db as any, CFG, NOW, null);
    expect(c.claimed).toEqual([]);
    expect(redisMock.store.get(WAKE)).toBe(HOUR_AHEAD);
  });

  it('parks no later than the earliest queued run_after when nothing is due yet', async () => {
    // A deferred job sits 3 minutes out: the due select is empty, but the
    // flag must land at its run_after, not an hour ahead.
    const due = new Date(NOW.getTime() + 180_000).toISOString();
    const db = chain({ data: [], error: null }, undefined, { data: { run_after: due }, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = await claimJudgeJobs(db as any, CFG, NOW, null);
    expect(c.claimed).toEqual([]);
    expect(redisMock.store.get(WAKE)).toBe(due);
  });

  it('a live running row on another instance keeps the flag at or before now', async () => {
    // Instance B claimed a job a minute ago (started_at stamped on claim); if
    // it defers, its requeue must not sleep an hour behind A's park. The park
    // read sees the running row's old run_after.
    const past = '2026-09-09T13:58:00.000Z';
    const ops: string[] = [];
    const db = chain({ data: [], error: null }, undefined, { data: { run_after: past }, error: null }, ops);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await claimJudgeJobs(db as any, CFG, NOW, null);
    // The stub cannot apply a filter, so pin the one that makes this scenario
    // real: a running row counts only while started_at is inside the grace
    // window, so a row left behind by a killed instance cannot pin the flag.
    const aliveSince = new Date(NOW.getTime() - RUNNING_GRACE_MS).toISOString();
    const orArg = `status.eq.queued,and(status.eq.running,started_at.gte.${aliveSince})`;
    expect(ops).toContain(`or(${JSON.stringify([orArg])})`);
    expect(ops.some((o) => o.startsWith('or(') && o.includes(`started_at.gte.${aliveSince}`))).toBe(true);
    expect(ops).not.toContain('in(["status",["queued","running"]])'); // the unbounded filter this replaced
    const set = redisMock.store.get(WAKE) as string;
    expect(Date.parse(set)).toBeLessThanOrEqual(NOW.getTime());
    expect(set).toBe(past);
  });

  it('skips the park when the flag changed since the tick started', async () => {
    // What runJudgeWorker actually hands in: the past flag that woke this
    // tick. An enqueue wrote now during the empty select, so the key differs.
    redisMock.store.set(WAKE, '2026-09-09T14:00:00.000Z');
    const db = chain({ data: [], error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await claimJudgeJobs(db as any, CFG, NOW, '2026-09-09T13:59:00.000Z');
    expect(redisMock.store.get(WAKE)).toBe('2026-09-09T14:00:00.000Z');
  });

  it('a deferred requeue lowers the flag to the run_after it wrote and never raises it', async () => {
    redisMock.store.set(WAKE, '2026-09-10T14:00:00.000Z');
    const db = chain({ data: null, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await finishJudgeJob(db as any, job('a', 'u1', '2026-09-09T13:00:00Z'), { status: 'deferred', deferMs: 120_000 }, NOW);
    expect(redisMock.store.get(WAKE)).toBe('2026-09-09T14:02:00.000Z');

    redisMock.store.set(WAKE, '2026-09-09T14:01:00.000Z');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await finishJudgeJob(db as any, job('b', 'u1', '2026-09-09T13:00:00Z'), { status: 'deferred', deferMs: 120_000 }, NOW);
    expect(redisMock.store.get(WAKE)).toBe('2026-09-09T14:01:00.000Z');
  });
});

describe('dominantModel', () => {
  it('names the model that cost the most, and null for an empty ledger', () => {
    const l = emptyLedger();
    recordUsage(l, 'gpt-4o-mini', { input: 100_000, output: 0, cacheRead: 0, cacheWrite: 0 }); // $0.015
    recordUsage(l, 'claude-sonnet-5', { input: 10_000, output: 0, cacheRead: 0, cacheWrite: 0 }); // $0.02
    expect(dominantModel(l)).toBe('claude-sonnet-5');
    expect(dominantModel(emptyLedger())).toBeNull();
    expect(dominantModel(undefined)).toBeNull();
  });
});

describe('judge worker cron', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'test-secret');
  });

  it('rejects a wrong bearer in-process', async () => {
    const { GET } = await import('../app/api/cron/judge-worker/route');
    const res = await GET(new Request('http://cron.internal/api/cron/judge-worker', {
      headers: { Authorization: 'Bearer wrong' },
    }));
    expect(res.status).toBe(401);
    expect(workerBoundary.db).not.toHaveBeenCalled();
    expect(workerBoundary.judge).not.toHaveBeenCalled();
    expect(workerBoundary.receipts).not.toHaveBeenCalled();
  });

  it('is scheduled every minute', () => {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8'));
    const run = (cfg.crons as { path: string; schedule: string }[]).find((c) => c.path === '/api/cron/judge-worker');
    expect(run?.schedule).toBe('* * * * *');
  });

  // Push receipts ride this minute cron. After an empty check the route parks a
  // quiet key for ten minutes so the idle push_tickets read is not opened 1,440
  // times a day. The judge is off here (JUDGE_ENABLED unset), so `tables` is the
  // full list of Postgres statements the route opened on the tick.
  describe('push receipts quiet key', () => {
    const QUIET = 'helm:push:receipts-quiet';
    let tables: string[];
    const tick = async () => {
      __resetCoalesce();
      const { GET } = await import('../app/api/cron/judge-worker/route');
      const res = await GET(new Request('http://cron.internal/api/cron/judge-worker', { headers: { Authorization: 'Bearer test-secret' } }));
      expect(res.status).toBe(200);
    };
    beforeEach(() => {
      vi.stubEnv('JUDGE_ENABLED', '');
      tables = [];
      workerBoundary.db.mockReset().mockResolvedValue(chain({ data: [], error: null }, tables));
      workerBoundary.receipts.mockReset();
      vi.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => { vi.restoreAllMocks(); });

    it('reads the wake flag and the quiet key in one call, not two', async () => {
      redisMock.store.set(WAKE, '2026-09-09T14:30:00.000Z');
      redisMock.store.set(QUIET, '2026-09-09T14:10:00.000Z');
      await tick();
      expect(redisMock.readKeysCalls).toEqual([[WAKE, QUIET]]);
      expect(redisMock.getCalls).toEqual([]);
    });

    it('a present key skips the check and logs how long the quiet lasts', async () => {
      redisMock.store.set(QUIET, '2026-09-09T14:10:00.000Z');
      await tick();
      expect(workerBoundary.receipts).not.toHaveBeenCalled();
      expect(tables).toEqual([]);
      const lines = (console.log as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => String(c[0]));
      expect(lines).toContain('[cron/judge-worker] [push] receipts: quiet until 2026-09-09T14:10:00.000Z');
    });

    it('no key and nothing pending: the check runs and parks a key about ten minutes ahead', async () => {
      workerBoundary.receipts.mockResolvedValue(0);
      const before = Date.now();
      await tick();
      expect(workerBoundary.receipts).toHaveBeenCalledTimes(1);
      const until = Date.parse(redisMock.store.get(QUIET) as string);
      expect(until - before).toBeGreaterThanOrEqual(10 * 60_000 - 1_000);
      expect(until - before).toBeLessThanOrEqual(10 * 60_000 + 5_000);
    });

    it('no key and receipts checked: no key is parked, so the next minute checks again', async () => {
      workerBoundary.receipts.mockResolvedValue(3);
      await tick();
      expect(workerBoundary.receipts).toHaveBeenCalledTimes(1);
      expect(redisMock.store.has(QUIET)).toBe(false);
    });

    it('Redis null: the check runs every minute as before and no key is ever written', async () => {
      redisMock.nullClient = true;
      workerBoundary.receipts.mockResolvedValue(0);
      await tick();
      await tick();
      expect(workerBoundary.receipts).toHaveBeenCalledTimes(2);
      expect(redisMock.store.has(QUIET)).toBe(false);
    });
  });
});
