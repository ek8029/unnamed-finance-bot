import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// The pack's service client is lazy, so a bare import never touches Supabase. These three
// modules are the ones that would reach the network on import or on first call.
vi.mock('@/lib/financial-data', () => ({ getQuote: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/vix', () => ({ getVixQuote: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/earnings-edgar', () => ({
  getEdgarEarnings: vi.fn().mockResolvedValue({ nextEstimatedDate: null, lastReportDate: null }),
}));

import { CAT_BONUS, FIRST_LOOK_BONUS, buildDigestContext, firstLookBonus } from '@/lib/digest/pack';

describe('firstLookBonus (spec 3.4: the first brief leads with the first-look choice)', () => {
  it('awards the bonus to a category the reader chose, on the first brief only', () => {
    expect(firstLookBonus('b', ['receipts'], true)).toBe(FIRST_LOOK_BONUS);
    expect(firstLookBonus('b', ['receipts'], false)).toBe(0);
  });

  it('awards nothing to a category outside the chosen set', () => {
    expect(firstLookBonus('e', ['receipts'], true)).toBe(0);
  });

  it('awards nothing when there is no preference (empty, null, or column missing)', () => {
    expect(firstLookBonus('a', [], true)).toBe(0);
    expect(firstLookBonus('a', null, true)).toBe(0);
    expect(firstLookBonus('a', undefined, true)).toBe(0);
  });

  it('maps overlap onto the weight-crossing category', () => {
    expect(firstLookBonus('a', ['overlap'], true)).toBe(FIRST_LOOK_BONUS);
  });

  it('lifts nothing for brief, which asks for the whole brief rather than a category', () => {
    for (const cat of Object.keys(CAT_BONUS) as (keyof typeof CAT_BONUS)[]) {
      expect(firstLookBonus(cat, ['brief'], true), cat).toBe(0);
    }
  });

  it('is larger than the whole category spread, so a chosen item leads regardless of category', () => {
    expect(FIRST_LOOK_BONUS).toBeGreaterThan(Math.max(...Object.values(CAT_BONUS)));
  });
});

// ---------- buildDigestContext through its injectable db ----------

type Row = Record<string, any>;
type Reply = { data: any; error: { code?: string; message?: string } | null };

/** A Supabase-shaped fake: every filter the pack chains (eq/neq/in/gte/lt) is applied, so the two
 * market_prices queries (SPY by ticker, holdings by security_id) get their own rows. select/or/
 * order/range/limit are no-ops; fetchAll stops after any page under 1000 rows. A table given as a
 * Reply instead of rows is returned verbatim, which is how an error is injected. Any table the
 * pack reads that is not listed here throws, so the list below is the complete set it touches. */
function fakeDb(tables: Record<string, Row[] | Reply>): SupabaseClient {
  const from = (table: string) => {
    if (!(table in tables)) throw new Error(`Unexpected table ${table}`);
    const filters: ((r: Row) => boolean)[] = [];
    let single = false;
    const resolve = (): Reply => {
      const t = tables[table];
      if (!Array.isArray(t)) return t;
      const rows = t.filter((r) => filters.every((f) => f(r)));
      return { data: single ? (rows[0] ?? null) : rows, error: null };
    };
    const q: any = {
      select: () => q, or: () => q, order: () => q, range: () => q, limit: () => q,
      eq: (k: string, v: any) => { filters.push((r) => r[k] === v); return q; },
      neq: (k: string, v: any) => { filters.push((r) => r[k] !== v); return q; },
      in: (k: string, vs: any[]) => { filters.push((r) => vs.includes(r[k])); return q; },
      gte: (k: string, v: any) => { filters.push((r) => r[k] >= v); return q; },
      lt: (k: string, v: any) => { filters.push((r) => r[k] < v); return q; },
      maybeSingle: () => { single = true; return q; },
      then: (res: any, rej: any) => Promise.resolve(resolve()).then(res, rej),
    };
    return q;
  };
  return { from } as unknown as SupabaseClient;
}

/** The last weekday strictly before today (UTC), which the pack takes as the last completed session. */
function priorSession(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const USER = 'u1';
const D0 = priorSession();
const equity = (security_name: string, sector = 'Technology') => ({ sector, asset_class: 'equity', security_name });

/** Exactly two items come out of this book, and nothing else can:
 *  - a: prior-close weights were 50/50 (both closed at 100, 10 shares each); now 3000 vs 1000, so
 *       AAPL is 25% of the book and crossed BELOW 35% today. NVDA 50 -> 75 crosses nothing.
 *  - b: one tracked NVDA thesis with a catch created inside the last 24 hours.
 *  Day changes are null (no d/g/h items and zero contribution), there is one session date (no
 *  clean-series or 10-session items), getQuote is null (no live item), EDGAR returns no dates
 *  (no a2/a3). So the scores are exactly the category bonuses: a = 3.0, b = 2.0. */
function bookTables(): Record<string, Row[] | Reply> {
  return {
    holdings: [
      { user_id: USER, ticker: 'NVDA', security_id: 'sec-nvda', shares: 10, total_value: 3000, security: equity('NVIDIA Corporation') },
      { user_id: USER, ticker: 'AAPL', security_id: 'sec-aapl', shares: 10, total_value: 1000, security: equity('Apple Inc') },
    ],
    securities: [],
    market_news: [],
    market_prices: [
      { security_id: 'spy', ticker: 'SPY', price_date: D0, close: 500, open: 498, high: 505, low: 495 },
      { security_id: 'sec-nvda', ticker: 'NVDA', price_date: D0, close: 100 },
      { security_id: 'sec-aapl', ticker: 'AAPL', price_date: D0, close: 100 },
    ],
    theses: [{ id: 't1', user_id: USER, ticker: 'NVDA', tracked: true }],
    thesis_pillars: [
      { id: 'p1', thesis_id: 't1', claim: 'Data center demand holds', status: 'intact', status_override: null, lifecycle: 'active', status_changed_at: null },
    ],
    pillar_evidence: [
      { pillar_id: 'p1', verdict: 'supports', source_title: 'NVIDIA Form 10-Q', source_published_at: D0, created_at: new Date().toISOString() },
    ],
    user_preferences: [],
    brief_digests: [],
  };
}

describe('buildDigestContext: the first-look lead through the real pack', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  const firstLookErrors = () => errorSpy.mock.calls.filter((c: unknown[]) => c[0] === '[digest] first_look read failed');

  beforeEach(() => {
    vi.stubEnv('FINNHUB_API_KEY', ''); // finnhubEarnings returns { rows: null } without a key, no fetch
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    errorSpy.mockRestore();
  });

  it('(a) builds the context when the first_look column is missing (077 unapplied), silently, in the normal order', async () => {
    const tables = bookTables();
    tables.user_preferences = { data: null, error: { code: 'PGRST204', message: "Could not find the 'first_look' column of 'user_preferences' in the schema cache" } };
    const ctx = await buildDigestContext(USER, fakeDb(tables));
    expect(ctx.ranked.map((r) => r.cat)).toEqual(['a', 'b']);
    expect(ctx.ranked.map((r) => r.tickers[0])).toEqual(['AAPL', 'NVDA']);
    expect(firstLookErrors()).toHaveLength(0);
  });

  it('(b) leads with the chosen category on the first brief: receipts puts the b item over the a item', async () => {
    const tables = bookTables();
    tables.user_preferences = [{ user_id: USER, first_look: ['receipts'] }];
    tables.brief_digests = [];
    const ctx = await buildDigestContext(USER, fakeDb(tables));
    expect(ctx.ranked.map((r) => r.cat)).toEqual(['b', 'a']);
    expect(ctx.ranked[0].score).toBe(CAT_BONUS.b + FIRST_LOOK_BONUS);
    expect(ctx.ranked[1].score).toBe(CAT_BONUS.a);
    expect(firstLookErrors()).toHaveLength(0);
  });

  it('(c) uses the normal order once a brief on the reader\'s own positions exists, preference or not', async () => {
    const tables = bookTables();
    tables.user_preferences = [{ user_id: USER, first_look: ['receipts'] }];
    tables.brief_digests = [{ id: 'bd1', user_id: USER, holdings: ['NVDA', 'AAPL'] }];
    const ctx = await buildDigestContext(USER, fakeDb(tables));
    expect(ctx.ranked.map((r) => r.cat)).toEqual(['a', 'b']);
    expect(ctx.ranked[0].score).toBe(CAT_BONUS.a);
    expect(firstLookErrors()).toHaveLength(0);
  });

  it('(d) still leads when the only row is the generic digest (holdings empty): that was not a brief on this book', async () => {
    const tables = bookTables();
    tables.user_preferences = [{ user_id: USER, first_look: ['receipts'] }];
    tables.brief_digests = [{ id: 'bd1', user_id: USER, holdings: [] }];
    const ctx = await buildDigestContext(USER, fakeDb(tables));
    expect(ctx.ranked.map((r) => r.cat)).toEqual(['b', 'a']);
    expect(ctx.ranked[0].score).toBe(CAT_BONUS.b + FIRST_LOOK_BONUS);
    expect(firstLookErrors()).toHaveLength(0);
  });

  it('logs a read error that is not the missing column, and still builds the brief without a lead', async () => {
    const tables = bookTables();
    tables.user_preferences = { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } };
    const ctx = await buildDigestContext(USER, fakeDb(tables));
    expect(ctx.ranked.map((r) => r.cat)).toEqual(['a', 'b']);
    expect(firstLookErrors()).toEqual([
      ['[digest] first_look read failed', { user: USER, code: '57014', message: 'canceling statement due to statement timeout' }],
    ]);
  });

  it('treats a code-less "column does not exist" message as the missing column too (silent)', async () => {
    const tables = bookTables();
    tables.user_preferences = { data: null, error: { message: 'column user_preferences.first_look does not exist' } };
    tables.brief_digests = { data: null, error: { code: '42501', message: 'permission denied for table brief_digests' } };
    const ctx = await buildDigestContext(USER, fakeDb(tables));
    // the preference error is silent; the brief_digests error is real and logged; neither costs the brief
    expect(ctx.ranked.map((r) => r.cat)).toEqual(['a', 'b']);
    expect(firstLookErrors()).toEqual([
      ['[digest] first_look read failed', { user: USER, code: '42501', message: 'permission denied for table brief_digests' }],
    ]);
  });
});
