import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ActionsPage from '@/app/dashboard/actions/page';
import { GET } from '@/app/api/insights/route';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), getUserTier: vi.fn(), access: vi.fn(),
  conviction: vi.fn(), thesisContext: vi.fn(), previewTier: 'pro' as 'free' | 'pro',
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/tier', async () => ({
  getUserTier: mocks.getUserTier,
  tierAtLeast: (await import('@/lib/tier-shared')).tierAtLeast,
}));
vi.mock('@/lib/thesis-access-server', () => ({ hasThesisAccess: mocks.access }));
vi.mock('@/lib/thesis-conviction', () => ({
  getConvictionByTicker: mocks.conviction, getThesisContextForActions: mocks.thesisContext,
}));
vi.mock('@/hooks/use-format', () => ({ useFormat: () => ({ formatCurrency: (n: number) => `$${n}` }) }));
vi.mock('@/lib/preview-context', () => ({ usePreview: () => ({ tier: mocks.previewTier }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const USER = uuid(1), OTHER_USER = uuid(2), HOLDING = uuid(3);
const NOW = '2026-09-08T12:00:00.000Z';
const CURRENT_USER = { id: USER, email: 'actions-fixture@example.invalid' };
type Row = Record<string, unknown>;
type QueryLog = { table: string; filters: [string, string, unknown][] };
let rows: Row[], holdings: Row[], linkedAccounts: Row[], user: typeof CURRENT_USER | null;
let readError: boolean, authError: boolean;
let log: QueryLog[];

function insight(n: number, changes: Row = {}): Row {
  return {
    id: uuid(n), user_id: USER, insight_type: 'portfolio', priority: 'high',
    title: `Saved portfolio action ${n}`, description: 'A stored investment observation.',
    recommended_action: `Private recommendation ${n}`, explanation: null,
    estimated_impact_amount: 150.25, confidence_score: null, source_type: 'rule_based', rule_id: null,
    related_entity_type: 'holding', related_entity_ids: [HOLDING],
    is_dismissed: false, is_useful: null, user_feedback: null,
    created_at: '2026-09-08T11:00:00.000Z', expires_at: null,
    snoozed_until: null, is_archived: false, ...changes,
  };
}

// Fixtures follow 009 + 015 + 029: UUID PK/FK, required content, classification
// and source enums, nullable booleans/timestamps/text[], NUMERIC(15,2) impact.
// Reads enforce projection, filters, ordering, limit and own-user RLS (012).
// No writes are allowed. This does not emulate a complete PostgreSQL database.
function validateInsights() {
  const ids = new Set();
  const types = ['portfolio', 'market', 'tax', 'spending', 'credit', 'subscription', 'cash_flow', 'performance', 'concentration'];
  for (const row of rows) {
    expect(row.id).toMatch(/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i);
    expect(ids.has(row.id)).toBe(false); ids.add(row.id);
    expect([USER, OTHER_USER]).toContain(row.user_id);
    expect(typeof row.title).toBe('string'); expect(typeof row.description).toBe('string');
    expect(types).toContain(row.insight_type);
    if (row.priority !== null) expect(['critical', 'high', 'medium', 'low']).toContain(row.priority);
    if (row.source_type !== null) expect(['rule_based', 'ai_generated', 'external']).toContain(row.source_type);
    for (const key of ['is_dismissed', 'is_archived', 'is_useful']) {
      expect(row[key] === null || typeof row[key] === 'boolean').toBe(true);
    }
    for (const key of ['created_at', 'expires_at', 'snoozed_until']) {
      if (row[key] !== null) expect(Number.isFinite(Date.parse(String(row[key])))).toBe(true);
    }
    if (row.related_entity_ids !== null) {
      expect(Array.isArray(row.related_entity_ids)).toBe(true);
      expect((row.related_entity_ids as unknown[]).every(value => typeof value === 'string')).toBe(true);
    }
    if (row.estimated_impact_amount !== null) {
      const amount = Number(row.estimated_impact_amount);
      expect(Number.isFinite(amount) && Math.abs(amount) < 1e13).toBe(true);
      expect(amount * 100).toBeCloseTo(Math.round(amount * 100), 6);
    }
  }
}

function query(table: string) {
  if (table !== 'insights' && table !== 'holdings' && table !== 'linked_accounts') throw new Error(`Unexpected table read: ${table}`);
  const entry: QueryLog = { table, filters: [] }; log.push(entry);
  const predicates: ((row: Row) => boolean)[] = [];
  const orders: { key: string; ascending: boolean }[] = [];
  let columns: string[] = [], max = Infinity;
  function filter(op: string, key: string, value: unknown, predicate: (row: Row) => boolean) {
    entry.filters.push([op, key, value]); predicates.push(predicate); return builder;
  }
  const builder = {
    select: (value: string) => { columns = value.split(',').map(v => v.trim()); return builder; },
    eq: (key: string, value: unknown) => filter('eq', key, value, row => row[key] === value),
    in: (key: string, value: unknown[]) => filter('in', key, value, row => value.includes(row[key])),
    gt: (key: string, value: string) => filter('gt', key, value, row => row[key] !== null && String(row[key]) > value),
    or: (expression: string) => {
      const prefix = 'snoozed_until.is.null,snoozed_until.lte.';
      if (!expression.startsWith(prefix)) throw new Error(`Unsupported OR: ${expression}`);
      const until = expression.slice(prefix.length);
      return filter('or', 'snoozed_until', until, row => row.snoozed_until === null || String(row.snoozed_until) <= until);
    },
    order: (key: string, options: { ascending: boolean }) => { orders.push({ key, ...options }); return builder; },
    limit: (value: number) => { max = value; return builder; },
    then: (resolve: (value: unknown) => unknown) => {
      if (table === 'insights') validateInsights();
      if (readError && table === 'insights') return Promise.resolve(resolve({ data: null, error: { code: '57014', message: 'Fixture read failed' } }));
      const input = table === 'insights' ? rows : table === 'holdings' ? holdings : linkedAccounts;
      let data = input.filter(row => row.user_id === user?.id && predicates.every(fn => fn(row)));
      data = [...data].sort((a, b) => {
        for (const order of orders) {
          const comparison = String(a[order.key]).localeCompare(String(b[order.key]));
          if (comparison) return order.ascending ? comparison : -comparison;
        }
        return 0;
      });
      const projected = data.slice(0, max).map(row => Object.fromEntries(columns.map(key => {
        if (!(key in row)) throw new Error(`Unknown selected ${table} column: ${key}`);
        return [key, row[key]];
      })));
      return Promise.resolve(resolve({ data: projected, error: null }));
    },
    insert: () => { throw new Error('Unexpected insert'); },
    update: () => { throw new Error('Unexpected update'); },
    upsert: () => { throw new Error('Unexpected upsert'); },
    delete: () => { throw new Error('Unexpected delete'); },
  };
  return builder;
}

async function api(search = '') {
  const response = await GET(new Request(`http://localhost/api/insights${search}`));
  return { response, body: await response.json() };
}
const serializable = (value: unknown) => JSON.parse(JSON.stringify(value));

beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(NOW); vi.stubGlobal('React', React);
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request'); }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  rows = []; holdings = [{ id: HOLDING, user_id: USER, ticker: 'NVDA' }];
  // Two active accounts by default (not one) so the Task 13 standing "add your
  // second account" item never appears here — this file is testing saved-insight
  // rows, not the standing item, which has its own coverage in
  // tests/insights-standing-item.test.ts.
  linkedAccounts = [
    { id: uuid(90), user_id: USER, is_active: true, plaid_item_ref: uuid(80), institution_id: uuid(70), source: 'plaid' },
    { id: uuid(91), user_id: USER, is_active: true, plaid_item_ref: uuid(81), institution_id: uuid(71), source: 'plaid' },
  ];
  log = []; user = CURRENT_USER; readError = false; authError = false;
  mocks.previewTier = 'pro'; mocks.getUserTier.mockResolvedValue('pro'); mocks.access.mockResolvedValue(false);
  mocks.conviction.mockResolvedValue(new Map()); mocks.thesisContext.mockResolvedValue(new Map());
  mocks.createClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user }, error: authError ? new Error('Invalid session') : null }) }, from: query,
  });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('saved Actions inbox: real server page, API and shared reader', () => {
  it('shows a manual-only investor’s saved actions on first render and repeat, with matching API scope', async () => {
    rows = [
      insight(10, { title: 'Portfolio concentration needs a look' }),
      insight(11, { insight_type: 'tax', title: 'A saved tax-loss opportunity' }),
      insight(12, { insight_type: 'market', title: 'An upcoming market event', snoozed_until: '2026-09-07T00:00:00.000Z' }),
      insight(13, { insight_type: 'concentration', title: 'Shared portfolio concentration' }),
      insight(14, { insight_type: 'performance', title: 'Portfolio performance to review' }),
      insight(20, { user_id: OTHER_USER }), insight(21, { is_dismissed: true }),
      insight(22, { is_archived: true }), insight(23, { snoozed_until: '2026-09-09T00:00:00.000Z' }),
      ...['spending', 'credit', 'subscription', 'cash_flow'].map((type, i) => insight(30 + i, { insight_type: type })),
    ];
    const first = await ActionsPage(), again = await ActionsPage(), refreshed = await api();
    expect(refreshed.response.status).toBe(200);
    expect(first.props.initialActions.map((a: { id: string }) => a.id)).toEqual([uuid(10), uuid(11), uuid(12), uuid(13), uuid(14)]);
    expect(serializable(first.props.initialActions)).toEqual(refreshed.body.insights);
    expect(again.props.initialActions).toEqual(first.props.initialActions);
    const html = renderToStaticMarkup(first);
    for (const row of rows.slice(0, 5)) expect(html).toContain(row.title);
    for (const row of rows.slice(5)) expect(html).not.toContain(row.title);
    expect(log.filter(q => q.table === 'insights')).toHaveLength(3);
    expect(log.every(q => q.filters.some(([op, column, value]) => op === 'eq' && column === 'user_id' && value === USER))).toBe(true);
    expect(log.some(q => q.table.startsWith('plaid'))).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('preserves native-thesis citations, holding conviction, entity gating and newest normalized-title deduplication', async () => {
    rows = [
      insight(10, { title: 'Portfolio risk $100 at 20%', related_entity_type: 'thesis', related_entity_ids: [uuid(70), uuid(71)] }),
      insight(11, { title: 'Portfolio risk $90 at 18%', created_at: '2026-09-07T11:00:00.000Z' }),
      insight(12, { insight_type: 'tax', title: 'Tax opportunity for a tracked holding' }),
      insight(13, { title: 'Cross-position risk', related_entity_type: 'thesis_risk', related_entity_ids: [] }),
    ];
    const conviction = new Map([['NVDA', 'weakening']]);
    const cite = { excerpt: 'Fixture primary-source sentence.', sourceTitle: 'Fixture filing', sourceUrl: 'https://example.invalid/filing', publishedAt: '2026-09-07', whatItMeans: null };
    mocks.access.mockResolvedValue(true); mocks.conviction.mockResolvedValue(conviction);
    mocks.thesisContext.mockResolvedValue(new Map([[uuid(10), { ticker: 'NVDA', status: 'weakening', cite }]]));
    const page = await ActionsPage(), refreshed = await api();
    expect(serializable(page.props.initialActions)).toEqual(refreshed.body.insights);
    expect(refreshed.body.insights.map((a: { id: string }) => a.id)).toEqual([uuid(10), uuid(12), uuid(13)]);
    expect(refreshed.body.insights[0]).toMatchObject({ ticker: 'NVDA', thesisStatus: 'weakening', thesisCite: cite, related_entity_type: 'thesis' });
    expect(refreshed.body.insights[1]).toMatchObject({ ticker: 'NVDA', thesisStatus: 'weakening', related_entity_type: 'holding' });
    expect(refreshed.body.insights[1]).not.toHaveProperty('thesisCite');
    expect(refreshed.body.insights[2].related_entity_type).toBe('thesis_risk');
    expect(mocks.thesisContext).toHaveBeenCalledWith(expect.anything(), USER, [{ id: uuid(10), thesisId: uuid(70), pillarId: uuid(71) }], conviction);
    expect(log.filter(q => q.table === 'holdings')).toHaveLength(2);
    expect(log.filter(q => q.table === 'holdings').every(q => q.filters.some(([op, key, value]) => op === 'eq' && key === 'user_id' && value === USER))).toBe(true);
  });

  it('strips free-tier recommendations on both server payloads rather than relying on visual blur', async () => {
    rows = [insight(10), insight(11, { related_entity_type: 'investigation' })];
    mocks.getUserTier.mockResolvedValue('free'); mocks.previewTier = 'free';
    const page = await ActionsPage(), refreshed = await api();
    expect(page.props.isPro).toBe(false);
    expect(serializable(page.props.initialActions)).toEqual(refreshed.body.insights);
    for (const action of page.props.initialActions) expect(action.recommended_action).toBeUndefined();
    for (const action of refreshed.body.insights) expect(action).not.toHaveProperty('recommended_action');
    expect(JSON.stringify(refreshed.body)).not.toContain('Private recommendation');
    expect(renderToStaticMarkup(page)).not.toContain('Private recommendation');
  });

  it('keeps explicit snoozed/done/archive and type/priority query views scoped to eligible investment rows', async () => {
    rows = [
      insight(10), insight(11, { insight_type: 'tax', priority: 'medium' }),
      insight(12, { snoozed_until: '2026-09-09T00:00:00.000Z' }),
      insight(13, { is_useful: true, is_dismissed: true }), insight(14, { is_archived: true }),
      insight(15, { user_id: OTHER_USER, is_archived: true }),
      insight(16, { insight_type: 'subscription', snoozed_until: '2026-09-09T00:00:00.000Z' }),
    ];
    for (const [search, expected] of [
      ['?status=snoozed', 12], ['?status=done', 13], ['?status=archived', 14],
      ['?archived=true', 14], ['?type=tax&priority=medium', 11],
    ] as const) {
      const { response, body } = await api(search);
      expect(response.status).toBe(200); expect(body.insights.map((a: { id: string }) => a.id)).toEqual([uuid(expected)]);
    }
    expect((await api('?type=subscription')).body.insights).toEqual([]);
  });

  it('presents a read failure as an error on the first render and a failed API response, not a successful empty inbox', async () => {
    rows = [insight(10)]; readError = true;
    const page = await ActionsPage(), refreshed = await api();
    expect(page.props.initialError).toBe('Your saved actions could not be loaded. Try refreshing the page.');
    const html = renderToStaticMarkup(page);
    expect(html).toContain('Your saved actions could not be loaded. Try refreshing the page.');
    expect(html).not.toContain('Nothing waiting for your review.');
    expect(refreshed.response.status).toBe(500); expect(refreshed.body.error).toEqual(expect.any(String));
    expect(refreshed.body).not.toHaveProperty('insights');
  });

  it('requires authentication before reading saved actions or their tier', async () => {
    rows = [insight(10)]; user = null;
    const page = await ActionsPage(), refreshed = await api();
    expect(page.props.initialActions).toEqual([]); expect(refreshed.response.status).toBe(401);
    expect(log).toEqual([]); expect(mocks.getUserTier).not.toHaveBeenCalled();
    user = CURRENT_USER; authError = true;
    expect((await api()).response.status).toBe(401); expect(log).toEqual([]);
  });
});
