// tests/cron-daily-split.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
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

  it('the people run stamps the scans so the worklog can say they ran', () => {
    expect(daily).toContain("beat(serviceClient, 'daily-scans'");
  });
});

describe('market-morning route', () => {
  beforeAll(() => {
    process.env.CRON_SECRET = 'test-secret';
  });

  it('rejects a wrong bearer in-process', async () => {
    const { GET } = await import('../app/api/cron/market-morning/route');
    const res = await GET(new Request('http://cron.internal/api/cron/market-morning', {
      headers: { Authorization: 'Bearer wrong' },
    }));
    expect(res.status).toBe(401);
  });
});
