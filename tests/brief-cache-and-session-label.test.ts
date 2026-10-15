import { afterEach, describe, expect, it, vi } from 'vitest';

// /api/dashboard/brief response contract:
//   - Cache-Control is private, no-store. iOS NSURLCache keys on the URL, not
//     the Authorization header, so max-age=60 let a cached brief reach the
//     next account signed in on the same phone.
//   - changeLabel says 'Last session' on an NYSE holiday, as on a weekend:
//     the day changes then describe the previous session (lib/market-calendar).
// The database is an empty book (no holdings, theses, digest or news): every
// user-owned read is by the signed-in user_id, writes throw.
const USER_ID = 'user_fixture';
vi.mock('@/lib/supabase/server', () => {
  const refuse = () => { throw new Error('Unexpected write'); };
  const from = (table: string) => {
    let byUser = false;
    const done = () => {
      if (table !== 'market_news' && !byUser) throw new Error(`${table} must be read by the signed-in user_id`);
      return { data: table === 'brief_digests' ? null : [], error: null };
    };
    const query = {
      select: () => query, gt: () => query, gte: () => query, order: () => query, limit: () => query,
      eq: (field: string, value: unknown) => { if (field === 'user_id') { if (value !== USER_ID) throw new Error('Read another user'); byUser = true; } return query; },
      maybeSingle: async () => done(),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve().then(done).then(resolve, reject),
      insert: refuse, update: refuse, upsert: refuse, delete: refuse,
    };
    return query;
  };
  return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: USER_ID, email: 'fixture@example.test' } }, error: null }) }, from }) };
});
vi.mock('@/lib/rate-limit', () => ({ rateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }) }));
vi.mock('@/lib/tier', () => ({ getUserTier: async () => 'pro', tierAtLeast: () => true }));
vi.mock('@/lib/thesis-access-server', () => ({ hasThesisAccess: async () => false }));
vi.mock('@/lib/thesis-brief', () => ({ composeThesisBrief: async () => undefined }));
vi.mock('@/lib/financial-data', () => ({ getQuote: async () => null }));
vi.mock('@/lib/vix', () => ({ getVixQuote: async () => null }));

import { GET } from '@/app/api/dashboard/brief/route';

async function briefAt(iso: string) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
  const res = await GET();
  return { res, body: await res.json() };
}

afterEach(() => { vi.useRealTimers(); });

describe('GET /api/dashboard/brief response contract', () => {
  it('is never stored by a shared cache', async () => {
    const { res } = await briefAt('2026-10-15T15:00:00Z');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it.each([
    ['a trading day after the open', '2026-10-15T15:00:00Z', 'Portfolio today'], // Thu 11:00 ET
    ['a trading day before the open', '2026-10-15T12:00:00Z', 'Last session'], // Thu 08:00 ET
    ['a Saturday', '2026-10-17T15:00:00Z', 'Last session'],
    ['Thanksgiving (NYSE closed)', '2026-11-26T15:00:00Z', 'Last session'], // Thu 10:00 ET
    ['Christmas (NYSE closed)', '2026-12-25T16:00:00Z', 'Last session'], // Fri 11:00 ET
  ])('%s (%s) reads "%s"', async (_, iso, label) => {
    const { body } = await briefAt(iso);
    expect(body.portfolio.changeLabel).toBe(label);
  });
});
