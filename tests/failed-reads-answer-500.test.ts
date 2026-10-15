import { beforeEach, describe, expect, it, vi } from 'vitest';

// A failed database read is not "no rows". supabase-js answers a failure with
// { data: null, error } (count null for a head count) and does not throw, so a
// route that reads only `data` turned a statement timeout into an empty answer
// with HTTP 200: "Nothing connected yet", "you do not hold anything yet",
// "No theses tracked yet". The phone caches every 200 as the truth. These
// routes now answer 500 on a failed read, and the phone keeps its last copy.
//
// Fake client, written from the schema rather than from memory:
//   - only the tables each route reads are reachable; any other table throws.
//   - user-owned tables must be filtered by user_id = the signed-in user (RLS);
//     market_events and market_news are shared and need no user filter.
//   - maybeSingle on more than one row is PGRST116, as postgrest-js reports it
//     (theses UNIQUE(user_id, ticker) 040, thesis_clusters PK user_id 042,
//     brief_digests UNIQUE(user_id) 033); .limit(1) narrows first.
//   - a failed read returns data null, count null and an error object.
//   - every write throws: these are read routes.
// It does NOT apply range filters (gt/gte/lte/in): each table returns its
// fixture rows. These tests are about the error path, not about filtering.
const h = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  fail: null as null | ((table: string, columns: string) => boolean),
  pro: true,
}));

const USER_ID = 'user_fixture';
const TIMEOUT = { code: '57014', message: 'canceling statement due to statement timeout' };
const SHARED = new Set(['market_events', 'market_news']);
const USER_OWNED = new Set([
  'plaid_items', 'net_worth_snapshots', 'linked_accounts', 'holdings', 'transactions',
  'cash_flow_snapshots', 'brief_digests', 'theses', 'thesis_pillars', 'pillar_evidence', 'thesis_clusters',
]);

vi.mock('@/lib/supabase/server', () => {
  const refuse = () => { throw new Error('Unexpected write'); };
  const from = (table: string) => {
    if (!USER_OWNED.has(table) && !SHARED.has(table)) throw new Error(`Unexpected table: ${table}`);
    let columns = '';
    let head = false;
    let byUser = false;
    let limit: number | null = null;
    const result = (single: boolean) => {
      if (USER_OWNED.has(table) && !byUser) throw new Error(`${table} must be read by the signed-in user_id`);
      if (h.fail?.(table, columns)) return { data: null, count: null, error: TIMEOUT };
      let rows = h.rows[table] ?? [];
      if (limit != null) rows = rows.slice(0, limit);
      if (head) return { data: null, count: rows.length, error: null };
      if (!single) return { data: rows, count: null, error: null };
      if (rows.length > 1) return { data: null, count: null, error: { code: 'PGRST116', message: 'multiple rows' } };
      return { data: rows[0] ?? null, count: null, error: null };
    };
    const query = {
      select: (value: string, opts?: { head?: boolean }) => { columns = value; head = !!opts?.head; return query; },
      eq: (field: string, value: unknown) => {
        if (field === 'user_id') {
          if (value !== USER_ID) throw new Error('Read another user');
          byUser = true;
        }
        return query;
      },
      gt: () => query, gte: () => query, lte: () => query, in: () => query,
      order: () => query,
      limit: (n: number) => { limit = n; return query; },
      maybeSingle: async () => result(true),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve().then(() => result(false)).then(resolve, reject),
      insert: refuse, update: refuse, upsert: refuse, delete: refuse,
    };
    return query;
  };
  return {
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: USER_ID, email: 'fixture@example.test' } }, error: null }) },
      from,
    }),
  };
});

// Everything below is outside the database boundary under test.
vi.mock('@/lib/plaid-sync', () => ({ syncAllItems: vi.fn(async () => []) }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }) }));
vi.mock('@/lib/tier', () => ({
  getUserTier: async () => (h.pro ? 'pro' : 'free'),
  tierAtLeast: (tier: string, min: string) => tier === 'pro' || min === 'free',
  requirePro: async () => ({ allowed: h.pro }),
}));
vi.mock('@/lib/thesis-access-server', () => ({ hasThesisAccess: async () => true }));
vi.mock('@/lib/thesis-conviction', () => ({
  getThesisEarningsContext: async () => new Map(),
  getConvictionByTicker: async () => new Map(),
  getContradictionCitesByTicker: async () => new Map(),
}));
vi.mock('@/lib/thesis-brief', () => ({ composeThesisBrief: async () => undefined }));
vi.mock('@/lib/financial-data', () => ({ getQuote: async () => null, getCompanyProfile: async () => null }));
vi.mock('@/lib/vix', () => ({ getVixQuote: async () => null }));
vi.mock('@/lib/edgar', () => ({ getQuarterlyEps: async () => null }));
vi.mock('@/lib/earnings-edgar', () => ({ getEdgarEarnings: async () => ({ nextEstimatedDate: null, lastReportDate: null }) }));
vi.mock('@/lib/content/scoring-thesis', () => ({
  getScoringThesisData: async (ticker: string) => ({
    ticker, company: null, hasHouseThesis: false, pillars: [], rawRows: 0, dedupedRows: 0,
    contributingUsers: 0, lastScan: null, publicRows: 0,
  }),
}));
vi.mock('@/lib/tax-analysis', () => ({
  generateTaxReport: async () => ({
    opportunities: [], retirementPositions: [], totalHarvestableLoss: 0, totalEstimatedSavings: 0,
    opportunityCount: 0, disclaimer: 'Not tax advice.',
  }),
}));

import { GET as overviewGET } from '@/app/api/dashboard/overview/route';
import { GET as briefGET } from '@/app/api/dashboard/brief/route';
import { GET as boardGET } from '@/app/api/thesis/board/route';
import { GET as taxGET } from '@/app/api/dashboard/tax-opportunities/route';
import { GET as earningsGET } from '@/app/api/dashboard/earnings/route';
import { generateEarningsReport } from '@/lib/earnings-analysis';

type Fail = (table: string, columns: string) => boolean;
const onTable = (name: string): Fail => (table) => table === name;

beforeEach(() => {
  h.fail = null;
  h.pro = true;
  h.rows = {
    plaid_items: [{
      id: 'item_fixture', institution_name: 'Fixture Brokerage', status: 'active', error_code: null,
      error_message: null, last_balances_sync: new Date().toISOString(),
    }],
    net_worth_snapshots: [{
      total_assets: 600, total_liabilities: 0, net_worth: 600, cash_balance: 100, investment_balance: 500,
      snapshot_date: '2026-10-14',
    }],
    linked_accounts: [{
      id: 'acct_fixture', account_name: 'Brokerage', account_type: 'brokerage', account_subtype: 'brokerage',
      current_balance: 500, available_balance: null, institution_id: 'ins_fixture',
    }],
    holdings: [{
      id: 'holding_fixture', ticker: 'AAPL', shares: 2, current_price: 250, total_value: 500,
      unrealised_gain_loss: 50, unrealised_gain_loss_pct: 11.1, day_change_pct: 0.01, portfolio_allocation_pct: 100,
      security: { security_name: 'Apple Inc.', sector: 'Technology' },
    }],
    transactions: [{
      id: 'tx_fixture', description: 'Deposit', amount: 100, transaction_date: '2026-10-10',
      merchant_name: null, category_name: 'Transfer',
    }],
    cash_flow_snapshots: [{ total_income: 100, total_expenses: 50, net_flow: 50, savings_rate: 0.5, snapshot_month: '2026-10-01' }],
    market_events: [{ ticker: 'AAPL', event_date: '2026-10-16', metadata: { cash_amount: 0.26, pay_date: '2026-10-20' } }],
    brief_digests: [{ digest: 'Fixture digest.', generated_at: '2026-10-15T13:15:00Z' }],
    theses: [{ id: 'thesis_fixture', ticker: 'AAPL', tracked: true, notes: null, last_scanned_at: '2026-10-15T13:00:00Z' }],
    thesis_pillars: [{
      id: 'pillar_fixture', thesis_id: 'thesis_fixture', claim: 'Services keep growing.', status: 'intact',
      status_override: null, status_changed_at: null,
    }],
    pillar_evidence: [],
    market_news: [],
    thesis_clusters: [],
  };
});

describe('GET /api/dashboard/overview', () => {
  it('answers the book when every read succeeds', async () => {
    const res = await overviewGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accounts.count).toBe(1);
    expect(body.portfolio.value).toBe(500);
  });

  it.each<[string, Fail]>([
    ['plaid_items sync check', (t, c) => t === 'plaid_items' && c === 'last_balances_sync'],
    ['net_worth_snapshots', onTable('net_worth_snapshots')],
    ['linked_accounts', onTable('linked_accounts')],
    ['holdings', onTable('holdings')],
    ['transactions', onTable('transactions')],
    ['cash_flow_snapshots', onTable('cash_flow_snapshots')],
    ['plaid_items connection health', (t, c) => t === 'plaid_items' && c.includes('institution_name')],
  ])('a failed %s read answers 500, not an empty book', async (_, fail) => {
    h.fail = fail;
    const res = await overviewGET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Failed to load dashboard data' });
  });
});

describe('GET /api/dashboard/brief', () => {
  it('answers the brief when every read succeeds', async () => {
    const res = await briefGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allHoldings).toHaveLength(1);
    expect(body.pillarSummary.positions).toBe(1);
  });

  it.each<[string, Fail]>([
    ['holdings', onTable('holdings')],
    ['earnings calendar', (t, c) => t === 'market_events' && !c.includes('metadata')],
    ['dividend calendar', (t, c) => t === 'market_events' && c.includes('metadata')],
    ['brief_digests', onTable('brief_digests')],
    ['theses', onTable('theses')],
    ['thesis_pillars', onTable('thesis_pillars')],
    ['pillar_evidence', onTable('pillar_evidence')],
    ['market_news', onTable('market_news')],
  ])('a failed %s read answers 500, not an empty brief', async (_, fail) => {
    h.fail = fail;
    const res = await briefGET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to generate daily brief' });
  });
});

describe('GET /api/thesis/board', () => {
  const board = (q = '') => boardGET(new Request(`http://localhost/api/thesis/board${q}`));

  it('answers the board when every read succeeds', async () => {
    const res = await board();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(1);
    expect(body.summary.bookTotal).toBe(500);
  });

  it('still answers an empty board for a real empty theses table', async () => {
    h.rows.theses = [];
    const res = await board();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ summary: null, forces: [], rows: [] });
  });

  it.each<[string, Fail]>([
    ['theses', onTable('theses')],
    ['holdings', onTable('holdings')],
    ['thesis_clusters', onTable('thesis_clusters')],
  ])('a failed %s read answers 500, not "No theses tracked yet"', async (_, fail) => {
    h.fail = fail;
    expect((await board()).status).toBe(500);
  });

  it('a failed ownership read for one row answers 500, not 404', async () => {
    h.fail = onTable('theses');
    expect((await board('?ticker=AAPL')).status).toBe(500);
  });

  it('a thesis the user does not own is still 404', async () => {
    h.rows.theses = [];
    expect((await board('?ticker=AAPL')).status).toBe(404);
  });
});

describe('GET /api/dashboard/tax-opportunities', () => {
  it('reports holdings when the count succeeds', async () => {
    h.pro = false;
    const res = await taxGET();
    expect(res.status).toBe(200);
    expect((await res.json()).hasHoldings).toBe(true);
  });

  it.each([false, true])('a failed holdings count answers 500, not "Nothing connected yet" (pro=%s)', async (pro) => {
    h.pro = pro;
    h.fail = onTable('holdings');
    const res = await taxGET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to generate tax report' });
  });
});

describe('earnings report holdings read', () => {
  it('an empty book is still an empty report', async () => {
    h.rows.holdings = [];
    expect(await generateEarningsReport(USER_ID)).toEqual({ upcoming: [], recent: [], totalUpcomingExposure: 0, recentNetImpact: 0 });
  });

  it('a failed read throws instead of reading as an empty book', async () => {
    h.fail = onTable('holdings');
    await expect(generateEarningsReport(USER_ID)).rejects.toThrow(/earnings holdings read failed/);
  });

  it('/api/dashboard/earnings answers 500, not "No earnings scheduled"', async () => {
    expect((await earningsGET()).status).toBe(200);
    h.fail = onTable('holdings');
    const res = await earningsGET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to generate earnings report' });
  });
});
