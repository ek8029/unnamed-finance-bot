// tests/thesis-insight-recurrence.test.ts
//
// The three thesis-sourced writers of the `insights` table used to dismiss the open
// row and insert a replacement on every run, with a NULL expiry. That is why the same
// flags ("Trim LULU?", "Why PRIM moved", "Shared risk: ...") kept arriving as new and
// never aged out. Per writer: a fresh flag gets a lifetime, an unchanged recurrence
// keeps its original created_at, and a changed recurrence is rewritten in place.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// cross-thesis-risk constructs an OpenAI client lazily when it asks for clusters; the
// SDK constructor throws without a key, so give it one. The clustering call itself is
// mocked below, so no request is made.
process.env.OPENAI_API_KEY = 'test-key';

// Driver clusters come from the synthesis cache or an LLM. Neither belongs in this
// test, so the clustering entry point is stubbed and the risk logic runs for real.
vi.mock('@/lib/thesis-synthesis', () => ({
  getCachedClusters: vi.fn(async () => [
    {
      driver: 'Consumer spending trends',
      pillars: [
        { id: 'p-lulu', ticker: 'LULU', claim: 'Sales keep compounding' },
        { id: 'p-prim', ticker: 'PRIM', claim: 'Backlog keeps converting to revenue' },
      ],
    },
  ]),
}));

import { generateThesisActions } from '@/lib/thesis-actions';
import { generateInvestigations } from '@/lib/thesis-investigation';
import { generateCrossThesisRisks } from '@/lib/cross-thesis-risk';
import { INSIGHT_LIFETIMES } from '@/lib/insights-engine';

/**
 * Fake Supabase client for the insights table.
 *
 * Constraints enforced from the migrations, not from memory:
 *  - insights_insight_type_check (029_recurring_detection_enhancements.sql:9-10):
 *    insert and update reject any insight_type outside the allowed list.
 *  - priority CHECK (009_create_insights_engine.sql:15): critical/high/medium/low
 *    only. Nothing has ever relaxed it, so a row carrying any other priority is
 *    rejected exactly as Postgres would reject it.
 *  - NOT NULL user_id / insight_type / title / description (009:12-18).
 *  - created_at DEFAULT NOW() is stamped on INSERT only. There is no trigger on the
 *    table, so an UPDATE never rewrites it (009:40).
 *  - Postgres three-valued logic: a range filter never matches a NULL column value.
 *    That is what made the expiry sweep a no-op while nothing wrote expires_at.
 *  - A select on `insights` PROJECTS the requested columns. A permissive mock would
 *    hand back a column the production select never asked for and certify a
 *    substance comparison that reads null in production.
 */
const ALLOWED_TYPES = new Set([
  'spending', 'portfolio', 'market', 'tax', 'credit', 'subscription',
  'cash_flow', 'performance', 'concentration',
]);
const ALLOWED_PRIORITIES = new Set(['critical', 'high', 'medium', 'low']);

type Row = Record<string, unknown>;

function makeClient(tables: Record<string, Row[]>) {
  let seq = 0;
  const writes: { op: string; table: string; payload: unknown }[] = [];

  // PostgREST's or-string, e.g. 'is_dismissed.eq.true,is_archived.eq.true'.
  // Parsed rather than stubbed true, because a permissive mock here would
  // certify the belief that a dealt-with finding is held back without testing it.
  const parseOr = (spec: string): [string, string, unknown][] =>
    spec.split(',').map((clause) => {
      const [col, op, ...rest] = clause.split('.');
      const raw = rest.join('.');
      const val = raw === 'true' ? true : raw === 'false' ? false : raw === 'null' ? null : raw;
      return [op, col, val] as [string, string, unknown];
    });

  const matches = (row: Row, filters: [string, string, unknown][]): boolean =>
    filters.every(([op, col, val]) => {
      const v = row[col];
      switch (op) {
        case 'or': return (val as [string, string, unknown][]).some((f) => matches(row, [f]));
        case 'eq': return v === val;
        case 'neq': return v !== val;
        case 'in': return Array.isArray(val) && (val as unknown[]).includes(v);
        case 'gt': return v != null && String(v) > String(val);
        case 'lt': return v != null && String(v) < String(val);
        case 'lte': return v != null && String(v) <= String(val);
        case 'gte': return v != null && String(v) >= String(val);
        default: return true;
      }
    });

  const project = (row: Row, cols: string | null): Row => {
    if (!cols || cols.trim() === '*') return { ...row };
    const out: Row = {};
    for (const raw of cols.split(',')) {
      const col = raw.trim();
      if (!col) continue;
      out[col] = row[col];
    }
    return out;
  };

  function builder(table: string) {
    const filters: [string, string, unknown][] = [];
    let op = 'select';
    let payload: unknown = null;
    let cols: string | null = null;

    const violation = (r: Row): string | null => {
      if (table !== 'insights') return null;
      if ('insight_type' in r && !ALLOWED_TYPES.has(String(r.insight_type))) {
        return 'insights_insight_type_check violation';
      }
      if ('priority' in r && r.priority != null && !ALLOWED_PRIORITIES.has(String(r.priority))) {
        return 'insights_priority_check violation';
      }
      return null;
    };

    const run = () => {
      const rows = tables[table] || (tables[table] = []);
      if (op === 'insert') {
        const list = Array.isArray(payload) ? payload : [payload];
        for (const r of list as Row[]) {
          if (table === 'insights') {
            const bad = violation(r);
            if (bad) return { data: null, error: { message: bad } };
            if (!r.user_id || !r.insight_type || !r.title || !r.description) {
              return { data: null, error: { message: 'null value violates not-null constraint' } };
            }
          }
          rows.push({
            id: 'gen-' + (++seq),
            created_at: new Date().toISOString(),
            is_dismissed: false,
            is_archived: false,
            expires_at: null,
            ...r,
          });
        }
        writes.push({ op, table, payload });
        return { data: null, error: null };
      }
      if (op === 'update') {
        const bad = violation(payload as Row);
        if (bad) return { data: null, error: { message: bad } };
        const hit = rows.filter((r) => matches(r, filters));
        for (const r of hit) Object.assign(r, payload as Row);
        writes.push({ op, table, payload });
        return { data: hit, error: null };
      }
      if (op === 'delete') {
        const gone = rows.filter((r) => matches(r, filters));
        writes.push({ op, table, payload: gone.map((r) => r.id) });
        tables[table] = rows.filter((r) => !matches(r, filters));
        return { data: null, error: null };
      }
      const found = rows.filter((r) => matches(r, filters));
      const data = table === 'insights' ? found.map((r) => project(r, cols)) : found.map((r) => ({ ...r }));
      return { data, error: null };
    };

    const b: Record<string, unknown> = {
      select: (c?: string) => { cols = c ?? null; return b; },
      order: () => b,
      limit: () => b,
      insert: (p: unknown) => { op = 'insert'; payload = p; return b; },
      update: (p: unknown) => { op = 'update'; payload = p; return b; },
      upsert: (p: unknown) => { op = 'insert'; payload = p; return b; },
      delete: () => { op = 'delete'; return b; },
      eq: (c: string, v: unknown) => { filters.push(['eq', c, v]); return b; },
      neq: (c: string, v: unknown) => { filters.push(['neq', c, v]); return b; },
      gt: (c: string, v: unknown) => { filters.push(['gt', c, v]); return b; },
      lt: (c: string, v: unknown) => { filters.push(['lt', c, v]); return b; },
      lte: (c: string, v: unknown) => { filters.push(['lte', c, v]); return b; },
      gte: (c: string, v: unknown) => { filters.push(['gte', c, v]); return b; },
      in: (c: string, v: unknown) => { filters.push(['in', c, v]); return b; },
      or: (spec: string) => { filters.push(['or', '', parseOr(spec)]); return b; },
      maybeSingle: () => {
        const single = { ...b, then: (res: (x: unknown) => unknown, rej?: (e: unknown) => unknown) => {
          const out = run() as { data: Row[] | null; error: unknown };
          return Promise.resolve({ data: out.data?.[0] ?? null, error: out.error }).then(res, rej);
        } };
        return single;
      },
      then: (res: (x: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(res, rej),
    };
    return b;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: { from: (t: string) => builder(t) } as any, writes, tables };
}

const USER = 'user-1';
const OLD_CREATED = '2026-09-01T12:00:00.000Z';

/** Two tracked theses, both with a broken confirmed pillar carrying a material
 *  primary contradiction. LULU is underwater in a taxable account (harvestable),
 *  PRIM is up (so its action is a trim, not a harvest). */
function fixture(overrides: { evidence?: Row[]; pillarStatus?: Record<string, string> } = {}): Record<string, Row[]> {
  const status = overrides.pillarStatus ?? {};
  return {
    // A granted personal-AI consent row. The version is the literal from
    // AI_CONSENT_VERSION in lib/ai-consent.ts, spelled out rather than imported so
    // this test does not depend on a module that is still uncommitted; if that
    // constant is bumped, the cross-thesis cases here fail loudly rather than
    // silently skipping. Only the cross-thesis monitor reads it.
    user_ai_consents: [
      { user_id: USER, version: '2026-09-07', granted_at: '2026-09-07T00:00:00Z', revoked_at: null },
    ],
    theses: [
      { id: 't-lulu', user_id: USER, ticker: 'LULU', tracked: true },
      { id: 't-prim', user_id: USER, ticker: 'PRIM', tracked: true },
    ],
    thesis_pillars: [
      {
        id: 'p-lulu', thesis_id: 't-lulu', claim: 'Sales keep compounding',
        status: status['p-lulu'] ?? 'broken', status_override: null, confirmed: true, lifecycle: 'active',
      },
      {
        id: 'p-prim', thesis_id: 't-prim', claim: 'Backlog keeps converting to revenue',
        status: status['p-prim'] ?? 'broken', status_override: null, confirmed: true, lifecycle: 'active',
      },
    ],
    pillar_evidence: overrides.evidence ?? [
      {
        pillar_id: 'p-lulu', verdict: 'contradicts', materiality: 'material', source_type: 'filing',
        excerpt: 'comparable sales declined in the quarter', what_it_means: 'the growth pillar is under stress',
        source_title: 'LULU 10-Q', source_url: 'https://example.com/lulu', is_backfill: false,
        source_published_at: '2026-09-02',
      },
      {
        pillar_id: 'p-prim', verdict: 'contradicts', materiality: 'material', source_type: 'price_move',
        excerpt: 'PRIM fell 28.7% on 2026-09-02', what_it_means: 'the market repriced the backlog',
        source_title: 'Price move', source_url: null, is_backfill: false,
        source_published_at: '2026-09-02',
      },
    ],
    holdings: [
      {
        user_id: USER, id: 'h-lulu', ticker: 'LULU', total_value: 5000, total_cost_basis: 10000,
        unrealised_gain_loss: -5000, shares: 20, current_price: 250, acquired_at: null,
        account: { account_name: 'Brokerage', account_subtype: 'brokerage' },
      },
      {
        user_id: USER, id: 'h-prim', ticker: 'PRIM', total_value: 12000, total_cost_basis: 9000,
        unrealised_gain_loss: 3000, shares: 15, current_price: 800, acquired_at: null,
        account: { account_name: 'Brokerage', account_subtype: 'brokerage' },
      },
    ],
    capital_gains: [],
    insights: [],
  };
}

const daysOut = (iso: string) => (new Date(iso).getTime() - Date.now()) / 86400000;
const openRows = (tables: Record<string, Row[]>, entity: string) =>
  tables.insights.filter((r) => r.related_entity_type === entity && r.is_dismissed !== true);
const insertsTo = (writes: { op: string; table: string }[]) =>
  writes.filter((w) => w.table === 'insights' && w.op === 'insert').length;

/** Age the rows written by the first run, so a second run has something whose
 *  created_at can be checked for having survived. */
function age(tables: Record<string, Row[]>) {
  for (const r of tables.insights) r.created_at = OLD_CREATED;
}

beforeEach(() => vi.clearAllMocks());

describe('thesis actions recurrence', () => {
  it('stamps a lifetime on a fresh action: the tax-year deadline for a harvest, the portfolio horizon for a trim', async () => {
    const tables = fixture();
    const { client } = makeClient(tables);
    const { generated } = await generateThesisActions(client, USER);

    expect(generated).toBe(2);
    const rows = openRows(tables, 'thesis');
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.expires_at).not.toBeNull();

    const tax = rows.find((r) => r.insight_type === 'tax');
    const portfolio = rows.find((r) => r.insight_type === 'portfolio');
    expect(tax!.expires_at).toBe(new Date().getUTCFullYear() + '-12-31T23:59:59.999Z');
    expect(Math.round(daysOut(String(portfolio!.expires_at)))).toBe(INSIGHT_LIFETIMES.portfolio);
  });

  it('leaves an unchanged action alone: same row, original created_at, expiry pushed out, nothing re-inserted', async () => {
    const tables = fixture();
    const first = makeClient(tables);
    await generateThesisActions(first.client, USER);
    age(tables);
    const before = openRows(tables, 'thesis').map((r) => ({ id: r.id, created_at: r.created_at, expires_at: r.expires_at }));
    for (const r of tables.insights) r.expires_at = '2026-09-02T00:00:00.000Z';

    const second = makeClient(tables);
    const { generated } = await generateThesisActions(second.client, USER);

    expect(generated).toBe(0);
    expect(insertsTo(second.writes)).toBe(0);
    const after = openRows(tables, 'thesis');
    expect(after).toHaveLength(2);
    expect(after.map((r) => r.id).sort()).toEqual(before.map((r) => r.id).sort());
    for (const r of after) {
      expect(r.created_at).toBe(OLD_CREATED);
      expect(daysOut(String(r.expires_at))).toBeGreaterThan(1);
    }
  });

  it('rewrites a changed action in place, keeping its created_at', async () => {
    const tables = fixture();
    const first = makeClient(tables);
    await generateThesisActions(first.client, USER);
    age(tables);
    const before = openRows(tables, 'thesis').map((r) => ({ id: r.id, description: r.description }));

    // The evidence itself changed, so the action's prose changes with it.
    (tables.pillar_evidence[0] as Row).what_it_means = 'the growth pillar has broken outright';
    (tables.pillar_evidence[0] as Row).excerpt = 'management withdrew full-year guidance';
    const second = makeClient(tables);
    const { generated } = await generateThesisActions(second.client, USER);

    expect(generated).toBe(1);
    expect(insertsTo(second.writes)).toBe(0);
    const after = openRows(tables, 'thesis');
    expect(after).toHaveLength(2);
    expect(after.map((r) => r.id).sort()).toEqual(before.map((r) => r.id).sort());
    for (const r of after) expect(r.created_at).toBe(OLD_CREATED);
    const lulu = after.find((r) => (r.related_entity_ids as string[])[0] === 't-lulu')!;
    expect(String(lulu.explanation)).toContain('withdrew full-year guidance');
    expect(lulu.expires_at).not.toBeNull();
  });
});

describe('thesis investigation recurrence', () => {
  it('stamps the market lifetime on a fresh investigation', async () => {
    const tables = fixture();
    const { client } = makeClient(tables);
    const { generated } = await generateInvestigations(client, USER);

    expect(generated).toBeGreaterThan(0);
    const rows = openRows(tables, 'thesis_investigation');
    expect(rows.length).toBeGreaterThan(0);
    const prim = rows.find((r) => r.title === 'Why PRIM moved');
    expect(prim).toBeDefined();
    expect(prim!.insight_type).toBe('market');
    expect(Math.round(daysOut(String(prim!.expires_at)))).toBe(INSIGHT_LIFETIMES.market);
  });

  it('treats a drifting percentage as the same finding: original created_at kept, only the expiry moves', async () => {
    const tables = fixture();
    const first = makeClient(tables);
    await generateInvestigations(first.client, USER);
    age(tables);
    const before = openRows(tables, 'thesis_investigation').map((r) => ({ id: r.id, title: r.title }));
    expect(before.length).toBeGreaterThan(0);
    for (const r of tables.insights) r.expires_at = '2026-09-02T00:00:00.000Z';

    // Same event, restated with a different number. Money and percentages are
    // normalized, so this must not count as news.
    (tables.pillar_evidence[1] as Row).excerpt = 'PRIM fell 31.4% on 2026-09-02';
    const second = makeClient(tables);
    const { generated } = await generateInvestigations(second.client, USER);

    expect(generated).toBe(0);
    expect(insertsTo(second.writes)).toBe(0);
    const after = openRows(tables, 'thesis_investigation');
    expect(after.map((r) => r.id).sort()).toEqual(before.map((r) => r.id).sort());
    for (const r of after) {
      expect(r.created_at).toBe(OLD_CREATED);
      expect(daysOut(String(r.expires_at))).toBeGreaterThan(1);
    }
  });

  it('rewrites a changed investigation in place, keeping its created_at', async () => {
    const tables = fixture();
    const first = makeClient(tables);
    await generateInvestigations(first.client, USER);
    age(tables);
    const before = openRows(tables, 'thesis_investigation').map((r) => ({ id: r.id }));

    (tables.pillar_evidence[1] as Row).what_it_means = 'the backlog conversion pillar is now broken';
    const second = makeClient(tables);
    const { generated } = await generateInvestigations(second.client, USER);

    expect(generated).toBeGreaterThan(0);
    expect(insertsTo(second.writes)).toBe(0);
    const after = openRows(tables, 'thesis_investigation');
    expect(after.map((r) => r.id).sort()).toEqual(before.map((r) => r.id).sort());
    const prim = after.find((r) => r.title === 'Why PRIM moved')!;
    expect(prim.created_at).toBe(OLD_CREATED);
    expect(String(prim.explanation)).toContain('now broken');
    expect(prim.expires_at).not.toBeNull();
  });
});

describe('cross-thesis risk recurrence', () => {
  it('stamps the concentration lifetime on a fresh shared-risk alert', async () => {
    const tables = fixture();
    const { client } = makeClient(tables);
    const { generated } = await generateCrossThesisRisks(client, USER);

    expect(generated).toBe(1);
    const rows = openRows(tables, 'thesis_risk');
    expect(rows).toHaveLength(1);
    expect(rows[0].insight_type).toBe('concentration');
    expect(rows[0].title).toBe('Shared risk: Consumer spending trends');
    expect(Math.round(daysOut(String(rows[0].expires_at)))).toBe(INSIGHT_LIFETIMES.concentration);
  });

  it('leaves an unchanged shared risk alone: same row, original created_at, expiry pushed out', async () => {
    const tables = fixture();
    const first = makeClient(tables);
    await generateCrossThesisRisks(first.client, USER);
    age(tables);
    const before = openRows(tables, 'thesis_risk').map((r) => r.id);
    for (const r of tables.insights) r.expires_at = '2026-09-02T00:00:00.000Z';

    const second = makeClient(tables);
    const { generated } = await generateCrossThesisRisks(second.client, USER);

    expect(generated).toBe(0);
    expect(insertsTo(second.writes)).toBe(0);
    const after = openRows(tables, 'thesis_risk');
    expect(after.map((r) => r.id)).toEqual(before);
    expect(after[0].created_at).toBe(OLD_CREATED);
    expect(daysOut(String(after[0].expires_at))).toBeGreaterThan(1);
  });

  it('rewrites a changed shared risk in place when its severity moves', async () => {
    const tables = fixture();
    const first = makeClient(tables);
    await generateCrossThesisRisks(first.client, USER);
    age(tables);
    const before = openRows(tables, 'thesis_risk').map((r) => r.id);
    expect(tables.insights[0].priority).toBe('critical');

    // One of the two names recovers to weakening, so one pillar is broken instead of
    // two and the alert drops from critical to high. Same driver, same title.
    (tables.thesis_pillars[1] as Row).status = 'weakening';
    const second = makeClient(tables);
    const { generated } = await generateCrossThesisRisks(second.client, USER);

    expect(generated).toBe(1);
    expect(insertsTo(second.writes)).toBe(0);
    const after = openRows(tables, 'thesis_risk');
    expect(after.map((r) => r.id)).toEqual(before);
    expect(after[0].created_at).toBe(OLD_CREATED);
    expect(after[0].priority).toBe('high');
    expect(after[0].expires_at).not.toBeNull();
  });
});

/* Before this, all three thesis writers decided "is this already on the books?"
   from OPEN rows only. A dismissed row is not open, so it was invisible to that
   check and the next run inserted a fresh one for the same finding with a new
   created_at, which the reader then announced. Dismissing a thesis flag bought
   one day of quiet. lib/thesis-actions.ts is keyed by thesis id and
   lib/thesis-investigation.ts by normalized title, so each reads the dismissal
   set the same way it reads its own match, and the two cannot disagree about
   what counts as the same finding. */
describe('a dealt-with thesis finding is not raised again', () => {
  /** Mark every row for this entity as dealt with, the way the UI does. The
   *  expiry the writer stamped is left in place, so the finding is still live. */
  const dealtWith = (tables: Record<string, Row[]>, entity: string, field: string) => {
    const hit = tables.insights.filter((r) => r.related_entity_type === entity);
    expect(hit.length).toBeGreaterThan(0);
    for (const r of hit) {
      r[field] = true;
      expect(daysOut(String(r.expires_at))).toBeGreaterThan(0);
    }
    return hit.map((r) => String(r.id));
  };

  it('thesis actions: a dismissed action is not re-inserted while it is still live', async () => {
    const tables = fixture();
    const first = makeClient(tables);
    await generateThesisActions(first.client, USER);
    const dismissedIds = dealtWith(tables, 'thesis', 'is_dismissed');
    age(tables);

    const second = makeClient(tables);
    const { generated } = await generateThesisActions(second.client, USER);

    expect(generated).toBe(0);
    expect(insertsTo(second.writes)).toBe(0);
    expect(openRows(tables, 'thesis')).toEqual([]);
    // The dismissed rows are untouched, not rewritten and not re-opened.
    for (const id of dismissedIds) {
      const row = tables.insights.filter((r) => r.id === id)[0];
      expect(row.is_dismissed).toBe(true);
      expect(row.created_at).toBe(OLD_CREATED);
    }
  });

  it('thesis actions: the hold is keyed by thesis, so it survives the title moving', async () => {
    const tables = fixture();
    const first = makeClient(tables);
    await generateThesisActions(first.client, USER);
    dealtWith(tables, 'thesis', 'is_dismissed');
    // Under one thesis match both the title and the insight_type can move (a
    // portfolio "Trim X?" becoming a tax "Harvest the loss in X"). A title-keyed
    // dismissal would leak here; an entity-keyed one does not.
    for (const r of tables.insights) r.title = 'Something this writer would never say';

    const second = makeClient(tables);
    const { generated } = await generateThesisActions(second.client, USER);

    expect(generated).toBe(0);
    expect(insertsTo(second.writes)).toBe(0);
  });

  it('thesis actions: acting on an action holds it too, not only dismissing it', async () => {
    const tables = fixture();
    const first = makeClient(tables);
    await generateThesisActions(first.client, USER);
    // Acting on a card sets is_archived or is_useful, never is_dismissed, so a
    // filter on is_dismissed alone let an acted finding come straight back.
    dealtWith(tables, 'thesis', 'is_archived');

    const second = makeClient(tables);
    const { generated } = await generateThesisActions(second.client, USER);

    expect(generated).toBe(0);
    expect(insertsTo(second.writes)).toBe(0);
  });

  it('thesis actions: the hold lasts the life of the finding and then lets go', async () => {
    const tables = fixture();
    const first = makeClient(tables);
    await generateThesisActions(first.client, USER);
    dealtWith(tables, 'thesis', 'is_dismissed');
    // Past its life. The finding may be raised again, which is also when the
    // expiry sweep would have retired the row anyway.
    for (const r of tables.insights) r.expires_at = '2026-09-02T00:00:00.000Z';

    const second = makeClient(tables);
    const { generated } = await generateThesisActions(second.client, USER);

    expect(generated).toBeGreaterThan(0);
    expect(insertsTo(second.writes)).toBeGreaterThan(0);
  });

  it('thesis investigation: a dismissed investigation is not re-inserted while it is still live', async () => {
    const tables = fixture();
    const first = makeClient(tables);
    await generateInvestigations(first.client, USER);
    dealtWith(tables, 'thesis_investigation', 'is_dismissed');
    age(tables);

    const second = makeClient(tables);
    const { generated } = await generateInvestigations(second.client, USER);

    expect(generated).toBe(0);
    expect(insertsTo(second.writes)).toBe(0);
    expect(openRows(tables, 'thesis_investigation')).toEqual([]);
  });

  it('thesis investigation: marking it useful holds it too, not only dismissing it', async () => {
    const tables = fixture();
    const first = makeClient(tables);
    await generateInvestigations(first.client, USER);
    // A row marked useful is still is_dismissed false and is_archived false, so
    // it stays in the open select and a run with no hold would find it there and
    // refresh its expiry. The untouched expires_at is what proves the guard, not
    // the zero, which both paths produce.
    const expiries = dealtWith(tables, 'thesis_investigation', 'is_useful').map(
      (id) => String(tables.insights.filter((r) => r.id === id)[0].expires_at),
    );

    const second = makeClient(tables);
    const { generated } = await generateInvestigations(second.client, USER);

    expect(generated).toBe(0);
    expect(insertsTo(second.writes)).toBe(0);
    const after = tables.insights
      .filter((r) => r.related_entity_type === 'thesis_investigation')
      .map((r) => String(r.expires_at));
    expect(after).toEqual(expiries);
  });

  it('thesis investigation: the hold lasts the life of the finding and then lets go', async () => {
    const tables = fixture();
    const first = makeClient(tables);
    await generateInvestigations(first.client, USER);
    dealtWith(tables, 'thesis_investigation', 'is_dismissed');
    for (const r of tables.insights) r.expires_at = '2026-09-02T00:00:00.000Z';

    const second = makeClient(tables);
    const { generated } = await generateInvestigations(second.client, USER);

    expect(generated).toBeGreaterThan(0);
    expect(insertsTo(second.writes)).toBeGreaterThan(0);
  });

  /* A NULL expiry suppresses nothing, deliberately: no row written before
     2026-09-10 carries one, and treating "no known life" as "gone for good"
     would bury every finding people dismissed in the months before. The
     consequence is that the hold only starts working for rows that carry an
     expiry, which is why the backfill matters. */
  it('a dismissal with no expiry holds nothing, so old rows are not buried', async () => {
    const tables = fixture();
    const first = makeClient(tables);
    await generateThesisActions(first.client, USER);
    for (const r of tables.insights) {
      r.is_dismissed = true;
      r.expires_at = null;
    }

    const second = makeClient(tables);
    const { generated } = await generateThesisActions(second.client, USER);

    expect(generated).toBeGreaterThan(0);
    expect(insertsTo(second.writes)).toBeGreaterThan(0);
  });
});

describe('expiry is no longer inert for thesis-sourced rows', () => {
  it('a row that has aged past its expiry is dismissed by its own writer, and a NULL expiry is left alone', async () => {
    const tables = fixture();
    tables.insights = [
      {
        id: 'expired-1', user_id: USER, insight_type: 'concentration', priority: 'medium',
        title: 'Shared risk: Something else entirely', description: 'stale', explanation: null,
        recommended_action: null, estimated_impact_amount: null, source_type: 'ai_generated',
        related_entity_type: 'thesis_risk', related_entity_ids: ['t-old'],
        is_dismissed: false, is_archived: false, created_at: OLD_CREATED,
        expires_at: '2026-09-02T00:00:00.000Z',
      },
      {
        id: 'legacy-null', user_id: USER, insight_type: 'concentration', priority: 'medium',
        title: 'Shared risk: A legacy row', description: 'no expiry was ever written', explanation: null,
        recommended_action: null, estimated_impact_amount: null, source_type: 'ai_generated',
        related_entity_type: 'thesis_risk', related_entity_ids: ['t-older'],
        is_dismissed: false, is_archived: false, created_at: OLD_CREATED,
        expires_at: null,
      },
    ];

    const { client } = makeClient(tables);
    await generateCrossThesisRisks(client, USER);

    const expired = tables.insights.find((r) => r.id === 'expired-1')!;
    const legacy = tables.insights.find((r) => r.id === 'legacy-null')!;
    expect(expired.is_dismissed).toBe(true);
    // A range filter never matches NULL, so the 91 open rows already carrying a null
    // expiry are untouched by this sweep. That is a backfill decision, not a code one.
    expect(legacy.is_dismissed).toBe(false);
  });
});
