import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateInsights, INSIGHT_LIFETIMES, insightExpiresAt } from '../lib/insights-engine';

/**
 * Fake Supabase client for the insights table.
 *
 * Constraints enforced from the migrations, not from memory:
 *  - insights_insight_type_check (029_recurring_detection_enhancements.sql:9-10):
 *    insert rejects any insight_type outside the allowed list.
 *  - NOT NULL user_id / title / description (009_create_insights_engine.sql:12-18).
 *  - created_at DEFAULT NOW() is stamped on INSERT only. There is no trigger on
 *    the table, so an UPDATE never rewrites it (009:40).
 *  - Postgres three-valued logic: a range filter (lt/gte/lte) never matches a
 *    NULL column value. That is what makes today's expiry sweep a no-op.
 */
const ALLOWED_TYPES = new Set([
  'spending', 'portfolio', 'market', 'tax', 'credit', 'subscription',
  'cash_flow', 'performance', 'concentration',
]);

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

  function builder(table: string) {
    const filters: [string, string, unknown][] = [];
    let op = 'select';
    let payload: unknown = null;

    const run = () => {
      const rows = tables[table] || (tables[table] = []);
      if (op === 'insert') {
        const list = Array.isArray(payload) ? payload : [payload];
        for (const r of list as Row[]) {
          if (table === 'insights') {
            if (!ALLOWED_TYPES.has(String(r.insight_type))) {
              return { data: null, error: { message: 'insights_insight_type_check violation' } };
            }
            if (!r.user_id || !r.title || !r.description) {
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
      return { data: rows.filter((r) => matches(r, filters)), error: null };
    };

    const b: Record<string, unknown> = {
      select: () => b,
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
      maybeSingle: () => b,
      then: (res: (x: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(res, rej),
    };
    return b;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: { from: (t: string) => builder(t) } as any, writes, tables };
}

const USER = 'user-1';

/** Two positions, one of them 94% of the book, one of them a taxable loser. */
function fixtureTables(insights: Row[] = []): Record<string, Row[]> {
  return {
    linked_accounts: [],
    holdings: [
      {
        user_id: USER, id: 'h1', ticker: 'PRIM', total_value: 80000, total_cost_basis: 80000,
        unrealised_gain_loss: 0, shares: 100, current_price: 800, acquired_at: null,
        account: { account_name: 'Brokerage', account_subtype: 'brokerage' },
      },
      {
        user_id: USER, id: 'h2', ticker: 'LULU', total_value: 5000, total_cost_basis: 10000,
        unrealised_gain_loss: -5000, shares: 20, current_price: 250, acquired_at: null,
        account: { account_name: 'Brokerage', account_subtype: 'brokerage' },
      },
    ],
    transactions: [],
    capital_gains: [],
    insights,
  };
}

const daysOut = (iso: string) => (new Date(iso).getTime() - Date.now()) / 86400000;
const taxYearEnd = () => new Date().getUTCFullYear() + '-12-31T23:59:59.999Z';

describe('insight lifetimes', () => {
  it('states one lifetime per insight_type written to the table', () => {
    // 'concentration' is written by lib/cross-thesis-risk.ts, not by this engine;
    // 'cash_flow' and 'performance' by lib/overview-actions.ts. They live in the
    // same table so they take their lifetimes from the same policy.
    expect(Object.keys(INSIGHT_LIFETIMES).sort()).toEqual(
      ['cash_flow', 'concentration', 'credit', 'market', 'performance', 'portfolio', 'spending', 'subscription', 'tax'],
    );
  });

  it('gives each type the documented horizon, tax running to the tax-year deadline', () => {
    const now = new Date('2026-09-10T14:00:00Z');
    expect(insightExpiresAt('market', now)).toBe(new Date('2026-09-13T14:00:00Z').toISOString());
    expect(insightExpiresAt('spending', now)).toBe(new Date('2026-09-24T14:00:00Z').toISOString());
    expect(insightExpiresAt('subscription', now)).toBe(new Date('2026-09-24T14:00:00Z').toISOString());
    expect(insightExpiresAt('credit', now)).toBe(new Date('2026-10-10T14:00:00Z').toISOString());
    expect(insightExpiresAt('portfolio', now)).toBe(new Date('2026-12-09T14:00:00Z').toISOString());
    expect(insightExpiresAt('tax', now)).toBe('2026-12-31T23:59:59.999Z');
    expect(insightExpiresAt('cash_flow', now)).toBe(new Date('2026-09-17T14:00:00Z').toISOString());
    expect(insightExpiresAt('performance', now)).toBe(new Date('2026-09-13T14:00:00Z').toISOString());
  });

  it('stamps expires_at on every freshly inserted insight', async () => {
    const { client, tables } = makeClient(fixtureTables());
    const n = await generateInsights(client, USER);
    expect(n).toBeGreaterThan(0);

    const rows = tables.insights;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.expires_at != null)).toBe(true);

    const portfolio = rows.find((r) => r.insight_type === 'portfolio');
    expect(portfolio).toBeTruthy();
    expect(Math.round(daysOut(String(portfolio!.expires_at)))).toBe(INSIGHT_LIFETIMES.portfolio);

    const tax = rows.find((r) => r.insight_type === 'tax');
    expect(tax).toBeTruthy();
    expect(String(tax!.expires_at)).toBe(taxYearEnd());
  });
});

describe('recurrence', () => {
  it('leaves an unchanged flag alone: same id, same created_at, no content write', async () => {
    const first = makeClient(fixtureTables());
    await generateInsights(first.client, USER);
    const seeded = first.tables.insights.map((r) => ({ ...r }));
    expect(seeded.length).toBeGreaterThan(0);

    // Age every row so a re-raise would show up as a jump back to "just now".
    const oldStamp = new Date(Date.now() - 6 * 86400000).toISOString();
    const nearExpiry = new Date(Date.now() + 86400000).toISOString();
    for (const r of seeded) { r.created_at = oldStamp; r.expires_at = nearExpiry; }
    const ids = seeded.map((r) => r.id);

    const second = makeClient(fixtureTables(seeded));
    await generateInsights(second.client, USER);

    const rows = second.tables.insights;
    expect(rows.map((r) => r.id)).toEqual(ids);
    expect(rows.every((r) => r.created_at === oldStamp)).toBe(true);
    // expires_at pushed back out so a still-true flag does not age out under us.
    expect(rows.every((r) => new Date(String(r.expires_at)).getTime() > Date.now() + 86400000)).toBe(true);
    // No content column was rewritten. The end-of-run expiry sweep still issues
    // its is_dismissed statement, which is not a content write.
    const CONTENT = ['title', 'description', 'recommended_action', 'estimated_impact_amount', 'priority', 'insight_type'];
    const contentWrites = second.writes.filter(
      (w) => w.op === 'update' && w.table === 'insights'
        && Object.keys(w.payload as Row).some((k) => CONTENT.includes(k)),
    );
    expect(contentWrites).toEqual([]);
  });

  it('supersedes in place when the substance moves, still keeping id and created_at', async () => {
    const first = makeClient(fixtureTables());
    await generateInsights(first.client, USER);
    const seeded = first.tables.insights.map((r) => ({ ...r }));
    const oldStamp = new Date(Date.now() - 6 * 86400000).toISOString();
    for (const r of seeded) r.created_at = oldStamp;

    // Same normalized title, materially different substance.
    const tax = seeded.find((r) => r.insight_type === 'tax');
    expect(tax).toBeTruthy();
    tax!.description = 'You have $1 in unrealized losses across LULU.';
    tax!.recommended_action = 'Nothing to do.';
    tax!.estimated_impact_amount = 1;
    const taxId = tax!.id;

    const second = makeClient(fixtureTables(seeded));
    await generateInsights(second.client, USER);

    const after = second.tables.insights.find((r) => r.id === taxId);
    expect(after).toBeTruthy();
    expect(after!.created_at).toBe(oldStamp);
    expect(after!.description).not.toBe('You have $1 in unrealized losses across LULU.');
    expect(Number(after!.estimated_impact_amount)).toBeGreaterThan(1);
    expect(after!.expires_at).toBe(taxYearEnd());
  });

  /* Evan, 2026-09-10: "if a user dismisses or acts on it get rid of it."
     The recurrence check reads OPEN rows only, so a dismissed row was invisible
     to it and the next run inserted a fresh one for the same finding, with a new
     created_at, which the reader then announced. Dismissing changed nothing for
     more than a day. readDismissedFindings closes that. */
  it('does not raise a finding again after it was dismissed', async () => {
    const first = makeClient(fixtureTables());
    await generateInsights(first.client, USER);
    const seeded = first.tables.insights.map((r) => ({ ...r }));
    const dismissedId = seeded.find((r) => r.insight_type === 'portfolio')!.id;
    const dismissedTitle = seeded.find((r) => r.id === dismissedId)!.title;
    for (const r of seeded) {
      if (r.id === dismissedId) r.is_dismissed = true;
    }

    const second = makeClient(fixtureTables(seeded));
    await generateInsights(second.client, USER);

    const sameFinding = second.tables.insights.filter((r) => r.title === dismissedTitle);
    expect(sameFinding).toHaveLength(1);
    expect(sameFinding[0].id).toBe(dismissedId);
    expect(sameFinding[0].is_dismissed).toBe(true);
    // Nothing was inserted for it, so there is no new created_at to announce.
    const inserted = second.writes.filter((w) => w.op === 'insert' && w.table === 'insights');
    expect(inserted).toEqual([]);
  });

  it('lets a dismissed finding come back once its expiry has passed', async () => {
    const first = makeClient(fixtureTables());
    await generateInsights(first.client, USER);
    const seeded = first.tables.insights.map((r) => ({ ...r }));
    const target = seeded.find((r) => r.insight_type === 'portfolio')!;
    target.is_dismissed = true;
    // Past its life: the sweep would have retired it anyway, so the finding is
    // allowed to be raised as news again.
    target.expires_at = new Date(Date.now() - 86400000).toISOString();
    const title = target.title;

    const second = makeClient(fixtureTables(seeded));
    await generateInsights(second.client, USER);

    const rows = second.tables.insights.filter((r) => r.title === title);
    expect(rows).toHaveLength(2);
    expect(rows.some((r) => r.is_dismissed === false)).toBe(true);
  });
});

describe('expiry sweep', () => {
  /** Same book, diluted: no position is above the 25% concentration threshold
   *  and nothing is at a loss, so the previous run's flags are no longer true
   *  and nothing refreshes them. */
  function dilutedHoldings(): Row[] {
    return ['A', 'B', 'C', 'D', 'E'].map((t, i) => ({
      user_id: USER, id: 'd' + i, ticker: t, total_value: 20000, total_cost_basis: 20000,
      unrealised_gain_loss: 0, shares: 100, current_price: 200, acquired_at: null,
      account: { account_name: 'Brokerage', account_subtype: 'brokerage' },
    }));
  }

  afterEach(() => { vi.useRealTimers(); });

  it('dismisses a flag that stopped being true once it passes its lifetime', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T12:00:00Z'));
    const first = makeClient(fixtureTables());
    await generateInsights(first.client, USER);
    const seeded = first.tables.insights.map((r) => ({ ...r }));
    const portfolioId = seeded.find((r) => r.insight_type === 'portfolio')!.id;

    // Well past the portfolio lifetime, with the condition no longer holding.
    vi.setSystemTime(new Date('2026-08-02T12:00:00Z'));
    const tables = fixtureTables(seeded);
    tables.holdings = dilutedHoldings();
    const second = makeClient(tables);
    await generateInsights(second.client, USER);

    const row = second.tables.insights.find((r) => r.id === portfolioId)!;
    expect(row.is_dismissed).toBe(true);
  });

  it('keeps a lapsed flag visible until its lifetime is actually up', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T12:00:00Z'));
    const first = makeClient(fixtureTables());
    await generateInsights(first.client, USER);
    const seeded = first.tables.insights.map((r) => ({ ...r }));
    const portfolioId = seeded.find((r) => r.insight_type === 'portfolio')!.id;

    vi.setSystemTime(new Date('2026-03-12T12:00:00Z'));
    const tables = fixtureTables(seeded);
    tables.holdings = dilutedHoldings();
    const second = makeClient(tables);
    await generateInsights(second.client, USER);

    const row = second.tables.insights.find((r) => r.id === portfolioId)!;
    expect(row.is_dismissed).toBe(false);
  });
});
