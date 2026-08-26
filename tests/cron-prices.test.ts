import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Prices used to land only when a user loaded a dashboard. The close must
 * arrive on a schedule, through the same sweep the dashboard triggers.
 */
describe('scheduled price sweep', () => {
  beforeAll(() => {
    process.env.CRON_SECRET = 'test-secret';
  });

  it('the cron route rejects a wrong bearer in-process', async () => {
    const { GET } = await import('../app/api/cron/prices/route');
    const res = await GET(new Request('http://cron.internal/api/cron/prices', {
      headers: { Authorization: 'Bearer wrong' },
    }));
    expect(res.status).toBe(401);
  });

  it('is scheduled on weekdays after the bell, before the UTC date rolls', () => {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8'));
    const runs = (cfg.crons as { path: string; schedule: string }[]).filter((c) => c.path.startsWith('/api/cron/prices'));
    expect(runs.length).toBeGreaterThanOrEqual(2);
    for (const r of runs) {
      const [min, hour, , , dow] = r.schedule.split(' ');
      expect(dow).toBe('1-5');
      const utcHour = Number(hour);
      expect(utcHour).toBeGreaterThanOrEqual(20); // >= 16:00 EDT
      expect(utcHour).toBeLessThan(24);           // < 20:00 EDT, snapshot date still today
      expect(Number(min)).toBeGreaterThanOrEqual(0);
    }
  });

  it('the route and the cron share one sweep implementation', () => {
    const route = readFileSync(join(process.cwd(), 'app/api/market/prices/refresh/route.ts'), 'utf8');
    const cron = readFileSync(join(process.cwd(), 'app/api/cron/prices/route.ts'), 'utf8');
    expect(route).toContain("from '@/lib/market/price-sweep'");
    expect(cron).toContain("from '@/lib/market/price-sweep'");
    expect(route).not.toMatch(/async function runGlobalRefresh/);
  });
});
