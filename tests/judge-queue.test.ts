import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  readJudgeConfig, etDayStartIso, decideClaims, runJudgeWorker, dominantModel,
  type JudgeJobRow, type JudgeConfig,
} from '@/lib/agent/judge-queue';
import { emptyLedger, recordUsage } from '@/lib/ai/pricing';

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
  beforeAll(() => {
    process.env.CRON_SECRET = 'test-secret';
    // The route imports the scorer, which builds an OpenAI client at import time.
    process.env.OPENAI_API_KEY ||= 'test-key-never-used';
  });

  it('rejects a wrong bearer in-process', async () => {
    const { GET } = await import('../app/api/cron/judge-worker/route');
    const res = await GET(new Request('http://cron.internal/api/cron/judge-worker', {
      headers: { Authorization: 'Bearer wrong' },
    }));
    expect(res.status).toBe(401);
  });

  it('is scheduled every minute', () => {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8'));
    const run = (cfg.crons as { path: string; schedule: string }[]).find((c) => c.path === '/api/cron/judge-worker');
    expect(run?.schedule).toBe('* * * * *');
  });
});
