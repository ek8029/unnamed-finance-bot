// tests/cron-daily-split.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
afterEach(() => vi.unstubAllEnvs());
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The 9:15 run used to do six jobs inside one 300-second window, and the
 * vendor-paced market refresh at the end decided whether the scans ran. On
 * 2026-09-06 Finazon rate-limited the refresh 78 times, Vercel killed the run
 * at 300 seconds, and nothing after the market block happened. The market
 * refresh now has its own cron and its own clock.
 */
describe('the morning is two runs', () => {
  const daily = readFileSync(join(process.cwd(), 'app/api/cron/daily/route.ts'), 'utf8');
  const morning = readFileSync(join(process.cwd(), 'app/api/cron/market-morning/route.ts'), 'utf8');
  const cfg = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as { crons: { path: string; schedule: string }[] };

  it('the people run no longer calls the vendor-paced market refresh', () => {
    expect(daily).not.toMatch(/refreshMarketPrices|enrichMarketData|refreshMarketNews/);
    expect(morning).toContain('refreshMarketPrices');
    expect(morning).toContain('enrichMarketData');
  });

  it('the market refresh runs on weekdays before the 9:15 people run, with the long clock', () => {
    const run = cfg.crons.find((c) => c.path === '/api/cron/market-morning');
    expect(run).toBeDefined();
    const [min, hour, , , dow] = run!.schedule.split(' ');
    expect(dow).toBe('1-5');
    expect(Number(hour) * 60 + Number(min)).toBeLessThan(13 * 60 + 15);
    expect(morning).toMatch(/export const maxDuration = 800/);
  });

});

/**
 * The second split. With the market refresh gone, the digest still ran first
 * and on 2026-09-22 took 3.8 of the 300 seconds; the Plaid loop started at
 * 13:19:34 and Vercel killed the function at 13:20:44 with 11 of 24 active
 * items never synced and no snapshots written for anyone. The book run now has
 * its own cron and its own clock, and runs BEFORE the briefs so they read a
 * book refreshed this morning.
 */
describe('the morning is three runs', () => {
  const daily = readFileSync(join(process.cwd(), 'app/api/cron/daily/route.ts'), 'utf8');
  const book = readFileSync(join(process.cwd(), 'app/api/cron/plaid-sync/route.ts'), 'utf8');
  const cfg = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as { crons: { path: string; schedule: string }[] };

  it('the people run no longer syncs Plaid, writes snapshots or runs the scans', () => {
    expect(daily).not.toMatch(/syncPlaidItem|computeSnapshots|updatePortfolioPerformance|generateInsights|composeWeeklyNote/);
    expect(daily).toContain('runDigestCron');
    expect(daily).toContain('runDripEmails');
  });

  it('the book run owns the Plaid loop, the scans and the Friday note', () => {
    expect(book).toContain('syncPlaidItem(');
    expect(book).toContain('computeSnapshots(');
    expect(book).toContain('generateInsights(');
    expect(book).toContain('composeWeeklyNote(');
  });

  it('the book run stamps the scans under the name the worklog reads', () => {
    expect(daily).not.toContain("'daily-scans'");
    expect(book).toContain("beat(serviceClient, 'daily-scans'");
  });

  it('the book run is scheduled every day before the 9:15 people run, forced, with the long clock', () => {
    const run = cfg.crons.find((c) => c.path.startsWith('/api/cron/plaid-sync'));
    expect(run).toBeDefined();
    expect(run!.path).toContain('force=true');
    const [min, hour, , , dow] = run!.schedule.split(' ');
    expect(dow).toBe('*');
    expect(Number(hour) * 60 + Number(min)).toBeLessThan(13 * 60 + 15);
    expect(book).toMatch(/export const maxDuration = 800/);
  });

  it('the people run schedule did not move', () => {
    const run = cfg.crons.find((c) => c.path.startsWith('/api/cron/daily'));
    expect(run?.schedule).toBe('15 13 * * *');
  });
});

describe('plaid-sync route', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'test-secret');
  });

  // The route pulls in the sync, insights and analyst-note graph on import,
  // which under full-suite load can exceed the default 5-second budget even
  // though the test itself only exercises the bearer check.
  it('rejects a wrong bearer in-process', async () => {
    const { GET } = await import('../app/api/cron/plaid-sync/route');
    const res = await GET(new Request('http://cron.internal/api/cron/plaid-sync', {
      headers: { Authorization: 'Bearer wrong' },
    }));
    expect(res.status).toBe(401);
  }, 30_000);
});

describe('market-morning route', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'test-secret');
  });

  it('rejects a wrong bearer in-process', async () => {
    const { GET } = await import('../app/api/cron/market-morning/route');
    const res = await GET(new Request('http://cron.internal/api/cron/market-morning', {
      headers: { Authorization: 'Bearer wrong' },
    }));
    expect(res.status).toBe(401);
  });
});
