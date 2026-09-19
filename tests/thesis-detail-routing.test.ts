import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import ThesisDetailPage from '@/app/dashboard/theses/[id]/page';
import { GET as readThesis } from '@/app/api/thesis/[ticker]/route';

const h = vi.hoisted(() => ({
  user: { id: '00000000-0000-0000-0000-000000000001', email: 'owner@example.test' } as { id: string; email: string } | null,
  pro: false,
  rows: {} as Record<string, Record<string, any>[]>,
  queries: [] as { table: string; filters: Map<string, unknown> }[],
  requirePro: vi.fn(), investigation: vi.fn(), storyNotes: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  redirect: (location: string) => { throw Object.assign(new Error('NEXT_REDIRECT'), { location }); },
  notFound: () => { throw new Error('NEXT_HTTP_ERROR_FALLBACK;404'); },
}));
vi.mock('next/link', () => ({ default: 'a' }));
vi.mock('@/lib/tier', () => ({ requirePro: h.requirePro }));
vi.mock('@/lib/thesis-investigation', () => ({ investigationForThesis: h.investigation }));
vi.mock('@/lib/content/mechanism-graft', () => ({ getStoryNotes: h.storyNotes }));
vi.mock('@/components/company-logo', () => ({ CompanyLogo: 'span' }));
vi.mock('@/components/thesis/reassessment', () => ({ Reassessment: 'section' }));

// Read-only double of 040/041: primary IDs and UNIQUE(user_id,ticker),
// pillar/evidence foreign keys, and auth.uid() = user_id RLS are enforced.
// Mutation methods are deliberately absent, including for the actual GET route.
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: h.user }, error: null }) },
  from: (table: string) => {
    if (!(table in h.rows)) throw new Error(`Unexpected query: ${table}`);
    const filters = new Map<string, unknown>();
    const excluded = new Map<string, unknown>();
    const sets = new Map<string, unknown[]>();
    h.queries.push({ table, filters });
    const result = () => {
      for (const rows of Object.values(h.rows)) {
        if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('PRIMARY KEY(id)');
      }
      const theses = h.rows.theses;
      if (new Set(theses.map(row => `${row.user_id}:${row.ticker}`)).size !== theses.length) throw new Error('UNIQUE(user_id,ticker)');
      if (h.rows.thesis_pillars.some(row => !theses.some(thesis => thesis.id === row.thesis_id))) throw new Error('FK(thesis_id)');
      if (h.rows.pillar_evidence.some(row => !h.rows.thesis_pillars.some(pillar => pillar.id === row.pillar_id))) throw new Error('FK(pillar_id)');
      return { data: h.rows[table].filter(row => row.user_id === h.user?.id &&
        [...filters].every(([key, value]) => row[key] === value) &&
        [...excluded].every(([key, value]) => row[key] !== value) &&
        [...sets].every(([key, values]) => values.includes(row[key]))), error: null };
    };
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.set(key, value); return query; },
      neq: (key: string, value: unknown) => { excluded.set(key, value); return query; },
      in: (key: string, values: unknown[]) => { sets.set(key, values); return query; },
      order: () => query, limit: () => query,
      maybeSingle: async () => { const r = result(); if (r.data.length > 1) throw new Error('Expected at most one row'); return { ...r, data: r.data[0] ?? null }; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  },
}) }));

const OWN = '10000000-0000-0000-0000-000000000001';
const FOREIGN = '10000000-0000-0000-0000-000000000002';
const MISSING = '10000000-0000-0000-0000-000000000003';
const renderPage = (id = OWN) => ThesisDetailPage({ params: Promise.resolve({ id }) });

beforeEach(() => {
  h.user = { id: '00000000-0000-0000-0000-000000000001', email: 'owner@example.test' };
  h.pro = false; h.queries = [];
  h.requirePro.mockReset().mockImplementation(async () => ({ allowed: h.pro }));
  h.investigation.mockReset().mockResolvedValue(null);
  h.storyNotes.mockReset().mockResolvedValue(new Map());
  const owner = h.user.id;
  h.rows = {
    theses: [{ id: OWN, user_id: owner, ticker: 'BRK.B', tracked: true }, { id: FOREIGN, user_id: '00000000-0000-0000-0000-000000000002', ticker: 'AAPL', tracked: true }],
    thesis_pillars: [{ id: '20000000-0000-0000-0000-000000000001', thesis_id: OWN, user_id: owner, claim: 'My saved reason', confirmed: true, lifecycle: 'confirmed', status: 'intact', status_override: null }],
    pillar_evidence: [{ id: '30000000-0000-0000-0000-000000000001', pillar_id: '20000000-0000-0000-0000-000000000001', user_id: owner, source_key: 'filing:example', excerpt: 'Saved filing evidence', verdict: 'supports', materiality: 'material', source_type: 'filing', source_title: 'Annual report', source_url: null, source_published_at: '2026-09-01', created_at: '2026-09-01' }],
    thesis_investigations: [],
  };
  vi.stubGlobal('React', React);
});
afterEach(() => vi.unstubAllGlobals());

describe('actual saved-thesis detail route', () => {
  it.each([false, true])('sends a Free owner to their Classic thesis (tracked=%s) before any premium read', async tracked => {
    h.rows.theses[0].tracked = tracked;
    await expect(renderPage()).rejects.toMatchObject({ location: '/dashboard/theses/classic?ticker=BRK.B' });
    expect(h.queries.map(query => query.table)).toEqual(['theses']);
    expect(h.queries[0].filters.get('id')).toBe(OWN);
    expect(h.queries[0].filters.get('user_id')).toBe(h.user!.id);
    expect(h.investigation).not.toHaveBeenCalled();
    expect(h.storyNotes).not.toHaveBeenCalled();
  });
  it.each([false, true])('returns not-found for missing and foreign IDs before entitlement (Pro=%s)', async pro => {
    h.pro = pro;
    for (const id of [MISSING, FOREIGN]) await expect(renderPage(id)).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
    expect(h.requirePro).not.toHaveBeenCalled();
    expect(h.investigation).not.toHaveBeenCalled();
    expect(h.queries.map(query => query.table)).toEqual(['theses', 'theses']);
  });
  it('redirects an unauthenticated visitor to login before querying data', async () => {
    h.user = null;
    await expect(renderPage()).rejects.toMatchObject({ location: '/login' });
    expect(h.queries).toHaveLength(0);
    expect(h.requirePro).not.toHaveBeenCalled();
  });
  it.each(['pro', 'allowlisted'] as const)('preserves the premium detail for an entitled owner (%s)', async entitlement => {
    h.pro = entitlement === 'pro';
    if (entitlement === 'allowlisted') h.user!.email = 'evank8029@gmail.com';
    const page = await renderPage();
    expect(React.isValidElement(page)).toBe(true);
    expect(JSON.stringify(page)).toContain('My saved reason');
    expect(h.queries.map(query => query.table)).toEqual(['theses', 'thesis_pillars', 'pillar_evidence', 'thesis_investigations']);
    expect(h.investigation).toHaveBeenCalledWith(expect.anything(), OWN, 'BRK.B');
    expect(h.storyNotes).toHaveBeenCalledWith('BRK.B', ['My saved reason']);
    expect(h.requirePro).toHaveBeenCalledTimes(entitlement === 'pro' ? 1 : 0);
  });
  it('allows the redirected Free owner to read their existing reasons and evidence through Classic’s actual endpoint', async () => {
    await expect(renderPage()).rejects.toMatchObject({ location: '/dashboard/theses/classic?ticker=BRK.B' });
    const response = await readThesis(new Request('https://helm.example/api/thesis/BRK.B'), { params: Promise.resolve({ ticker: 'BRK.B' }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ thesis: { id: OWN }, pillars: [{ claim: 'My saved reason', evidence: [{ excerpt: 'Saved filing evidence' }] }] });
    const apiQueries = h.queries.slice(1);
    expect(apiQueries.map(query => query.table)).toEqual(['theses', 'thesis_pillars', 'pillar_evidence']);
    expect(apiQueries.every(query => query.filters.get('user_id') === h.user!.id)).toBe(true);
    expect(h.investigation).not.toHaveBeenCalled();
  });
});
