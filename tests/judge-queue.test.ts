import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
afterEach(() => vi.unstubAllEnvs());
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  readJudgeConfig, etDayStartIso, decideClaims, runJudgeWorker, dominantModel,
  enqueueJudgeJobs, claimJudgeJobs, finishJudgeJob,
  type JudgeJobRow, type JudgeConfig,
} from '@/lib/agent/judge-queue';
import { JUDGE_WAKE_KEY, JUDGE_SLEEP_MS } from '@/lib/agent/judge-wake';
import { emptyLedger, recordUsage } from '@/lib/ai/pricing';

// Keep the auth test independent of provider initialization. The real route
// must reject before constructing a service client or running external work.
const workerBoundary = vi.hoisted(() => ({ db: vi.fn(), judge: vi.fn(), receipts: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: workerBoundary.db }));
vi.mock('@/lib/agent/judge-run', () => ({ runJudgeJob: workerBoundary.judge }));
vi.mock('@/lib/push/send', () => ({ checkPushReceipts: workerBoundary.receipts }));

// An in-memory Redis behind withRedis, so the wake flag is observable per test.
const redisMock = vi.hoisted(() => ({ store: new Map<string, string>() }));
vi.mock('@/lib/redis', () => {
  const r = {
    get: async (k: string) => redisMock.store.get(k) ?? null,
    set: async (k: string, v: string) => { redisMock.store.set(k, String(v)); return 'OK'; },
  };
  return {
    withRedis: async <T,>(fn: (r: unknown) => Promise<T>, fallback: T) => { try { return await fn(r); } catch { return fallback; } },
    redisKey: (...parts: string[]) => ['helm', ...parts].join(':'),
  };
});
const WAKE = `helm:${JUDGE_WAKE_KEY}`;
beforeEach(() => redisMock.store.clear());

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
    expect(tables).toContain('watch_heartbeats');
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

  it('a future flag returns idle with one heartbeat upsert and no judge_jobs statement', async () => {
    redisMock.store.set(WAKE, '2026-09-09T14:30:00.000Z');
    const tables: string[] = [];
    const db = chain({ data: null, error: null }, tables);
    const log: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = await runJudgeWorker(db as any, CFG, async () => { throw new Error('a job ran while idle'); }, log, clock);
    expect(s.idle).toBe(true);
    expect(s.claimed).toBe(0);
    expect(tables).toEqual(['watch_heartbeats']);
    expect(log[0]).toContain('idle');
    expect(log[0]).toContain('2026-09-09T14:30:00.000Z');
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

  it('a running row on another instance keeps the flag at or before now', async () => {
    // Instance B is mid-job; if it defers, its requeue must not sleep an hour
    // behind A's park. The park read sees the running row's old run_after.
    const past = '2026-09-09T13:58:00.000Z';
    const ops: string[] = [];
    const db = chain({ data: [], error: null }, undefined, { data: { run_after: past }, error: null }, ops);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await claimJudgeJobs(db as any, CFG, NOW, null);
    // The stub ignores filters, so pin the one that makes this scenario real.
    expect(ops).toContain('in(["status",["queued","running"]])');
    const set = redisMock.store.get(WAKE) as string;
    expect(Date.parse(set)).toBeLessThanOrEqual(NOW.getTime());
    expect(set).toBe(past);
  });

  it('skips the park when the flag changed since the tick started', async () => {
    // The tick read a future flag; an enqueue lowered it to now during the select.
    redisMock.store.set(WAKE, '2026-09-09T14:00:00.000Z');
    const db = chain({ data: [], error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await claimJudgeJobs(db as any, CFG, NOW, '2026-09-09T15:00:00.000Z');
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
});
