import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { repriceHolding, toHoldingUpdate } from '../lib/market/last-trade';

describe('repriceHolding', () => {
  it('values the position at the last trade and stores the day change as a fraction', () => {
    const r = repriceHolding({ shares: 100, total_cost_basis: 11466 }, 479.09, 456.745);
    expect(r.current_price).toBe(479.09);
    expect(r.total_value).toBeCloseTo(47909, 2);
    expect(r.unrealised_gain_loss).toBeCloseTo(36443, 2);
    expect(r.unrealised_gain_loss_pct).toBeCloseTo(3.1784, 3);
    expect(r.day_change_pct).toBeCloseTo(0.04892, 4);
  });

  it('leaves gain and day change null when cost basis or prior close is unknown', () => {
    const r = repriceHolding({ shares: 5, total_cost_basis: null }, 100, null);
    expect(r.total_value).toBe(500);
    expect(r.unrealised_gain_loss).toBeNull();
    expect(r.unrealised_gain_loss_pct).toBeNull();
    expect(r.day_change_pct).toBeNull();
  });

  it('treats a zero prior close as unknown rather than dividing by it', () => {
    expect(repriceHolding({ shares: 1, total_cost_basis: 1 }, 10, 0).day_change_pct).toBeNull();
  });

  it('does not overwrite a stored day change with null when the prior close is unknown', () => {
    const known = toHoldingUpdate(repriceHolding({ shares: 1, total_cost_basis: 1 }, 10, 8), 'now');
    expect(known.day_change_pct).toBeCloseTo(0.25, 6);
    const unknown = toHoldingUpdate(repriceHolding({ shares: 1, total_cost_basis: 1 }, 10, null), 'now');
    expect('day_change_pct' in unknown).toBe(false);
    expect(unknown.current_price).toBe(10);
    expect(unknown.last_updated_at).toBe('now');
  });
});

describe('intraday tick cron', () => {
  beforeAll(() => {
    process.env.CRON_SECRET = 'test-secret';
  });

  it('rejects a wrong bearer in-process', async () => {
    const { GET } = await import('../app/api/cron/intraday-prices/route');
    const res = await GET(new Request('http://cron.internal/api/cron/intraday-prices', {
      headers: { Authorization: 'Bearer wrong' },
    }));
    expect(res.status).toBe(401);
  });

  it('is scheduled every five minutes across the session in both DST regimes', () => {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8'));
    const run = (cfg.crons as { path: string; schedule: string }[]).find((c) => c.path === '/api/cron/intraday-prices');
    expect(run).toBeTruthy();
    const [min, hour, , , dow] = run!.schedule.split(' ');
    expect(min).toBe('*/5');
    expect(dow).toBe('1-5');
    const [from, to] = hour.split('-').map(Number);
    expect(from).toBeLessThanOrEqual(13); // 9:30 EDT = 13:30 UTC
    expect(to).toBeGreaterThanOrEqual(21); // 16:00 EST = 21:00 UTC
  });
});
