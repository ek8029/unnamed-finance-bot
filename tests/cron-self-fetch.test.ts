import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NextRequest } from 'next/server';

/**
 * The daily cron used to reach its own email routes over HTTP:
 *   fetch(`${NEXT_PUBLIC_APP_URL}/api/emails/drip`, { Authorization })
 * With NEXT_PUBLIC_APP_URL set to http://, Vercel answers 308 -> https, the
 * scheme change is cross-origin, Node strips the Authorization header, the
 * route answers 401 and the cron logs "Sent 0 emails". Day 1/3/7 drips and
 * watchlist alerts were silent from 2026-05-21 to 2026-08-25 because of it.
 *
 * Route handlers are plain functions. The cron must call them, never fetch.
 */
describe('daily cron never self-fetches', () => {
  it('has no fetch() against its own base URL', () => {
    const src = readFileSync(join(process.cwd(), 'app/api/cron/daily/route.ts'), 'utf8');
    expect(src).not.toMatch(/fetch\(\s*`\$\{baseUrl\}/);
    expect(src).not.toMatch(/\/api\/emails\/drip\?/);
    expect(src).not.toMatch(/\/api\/cron\/watchlist-alerts\?/);
  });
});

describe('email route handlers are directly invokable', () => {
  beforeAll(() => {
    process.env.CRON_SECRET = 'test-secret';
  });

  it('drip POST rejects a wrong bearer in-process (no network)', async () => {
    const { POST } = await import('../app/api/emails/drip/route');
    const res = await POST(
      new NextRequest('http://cron.internal/api/emails/drip', {
        method: 'POST',
        headers: { Authorization: 'Bearer wrong' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('watchlist GET rejects a wrong bearer in-process (no network)', async () => {
    const { GET } = await import('../app/api/cron/watchlist-alerts/route');
    const res = await GET(
      new NextRequest('http://cron.internal/api/cron/watchlist-alerts', {
        headers: { Authorization: 'Bearer wrong' },
      }),
    );
    expect(res.status).toBe(401);
  });
});
