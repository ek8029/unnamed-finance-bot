import { describe, it, expect } from 'vitest';
import {
  concentrationLines, parseRiskProfile, readRiskProfile, lineSource,
  PROFILE_POSITION_LINE, DEFAULT_POSITION_LINE, SECTOR_LINE,
} from '../lib/concentration-lines';
import { generateInsights } from '../lib/insights-engine';
import { WRITABLE_PREFERENCE_FIELDS } from '../lib/preference-fields';

/**
 * Fake Supabase client, the same shape as tests/insight-expiry.test.ts.
 *
 * Constraints enforced from the migrations, not from memory:
 *  - insights_insight_type_check (029:9-10): insert rejects unknown insight_type.
 *  - NOT NULL user_id / title / description on insights (009:12-18).
 *  - risk_profile_known (081): risk_profile is NULL or one of three profiles.
 *    Enforced on user_preferences rows seeded below by `seedPrefs`, so a test
 *    cannot seed a value the database would refuse.
 */
const ALLOWED_TYPES = new Set([
  'spending', 'portfolio', 'market', 'tax', 'credit', 'subscription',
  'cash_flow', 'performance', 'concentration',
]);
type Row = Record<string, unknown>;

function makeClient(tables: Record<string, Row[]>) {
  let seq = 0;
  const matches = (row: Row, filters: [string, string, unknown][]): boolean =>
    filters.every(([op, col, val]) => {
      const v = row[col];
      switch (op) {
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
        for (const r of (Array.isArray(payload) ? payload : [payload]) as Row[]) {
          if (table === 'insights') {
            if (!ALLOWED_TYPES.has(String(r.insight_type))) return { data: null, error: { message: 'insights_insight_type_check violation' } };
            if (!r.user_id || !r.title || !r.description) return { data: null, error: { message: 'null value violates not-null constraint' } };
          }
          rows.push({ id: 'gen-' + (++seq), created_at: new Date().toISOString(), is_dismissed: false, is_archived: false, expires_at: null, ...r });
        }
        return { data: null, error: null };
      }
      if (op === 'update') {
        const hit = rows.filter((r) => matches(r, filters));
        for (const r of hit) Object.assign(r, payload as Row);
        return { data: hit, error: null };
      }
      if (op === 'delete') {
        tables[table] = rows.filter((r) => !matches(r, filters));
        return { data: null, error: null };
      }
      return { data: rows.filter((r) => matches(r, filters)), error: null };
    };
    const b: Record<string, unknown> = {
      select: () => b, order: () => b, limit: () => b, or: () => b,
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
      maybeSingle: () => b,
      then: (res: (x: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
    };
    return b;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: { from: (t: string) => builder(t) } as any, tables };
}

const USER = 'user-1';

function seedPrefs(risk_profile: string | null): Row[] {
  if (risk_profile !== null && !['aggressive', 'moderate', 'passive'].includes(risk_profile)) {
    throw new Error('risk_profile_known would reject this row');
  }
  return [{ user_id: USER, risk_profile }];
}

/** Two positions at 15% of the book, six at about 11.7%: over a 12% line,
 *  under 20% and 25%. Tickers are not ETFs, so look-through adds nothing. */
function book(): Row[] {
  const lot = (ticker: string, total_value: number, i: number): Row => ({
    user_id: USER, id: `h${i}`, ticker, total_value, total_cost_basis: total_value,
    unrealised_gain_loss: 0, shares: 10, current_price: total_value / 10, acquired_at: null,
    account: { account_name: 'Brokerage', account_subtype: 'brokerage' },
  });
  const rest = ['CCC', 'DDD', 'EEE', 'FFF', 'GGG', 'HHH'];
  return [lot('AAA', 15000, 1), lot('BBB', 15000, 2), ...rest.map((t, i) => lot(t, 70000 / 6, i + 3))];
}

function tablesFor(risk_profile: string | null | 'absent', holdings = book()): Record<string, Row[]> {
  return {
    linked_accounts: [], holdings, transactions: [], capital_gains: [], insights: [],
    ...(risk_profile === 'absent' ? {} : { user_preferences: seedPrefs(risk_profile) }),
  };
}

const concentrationTitles = (tables: Record<string, Row[]>) =>
  (tables.insights ?? []).map((r) => String(r.title)).filter((t) => t.includes('of your portfolio')).sort();

describe('concentration lines', () => {
  it('a chosen profile sets the position line; no choice keeps the 25% default; sectors are one 40%', () => {
    expect(concentrationLines('passive')).toEqual({ profile: 'passive', position: 12, sector: 40, chosen: true });
    expect(concentrationLines('moderate').position).toBe(20);
    expect(concentrationLines('aggressive').position).toBe(30);
    expect(concentrationLines(null)).toEqual({ profile: null, position: 25, sector: 40, chosen: false });
    expect(DEFAULT_POSITION_LINE).toBe(25);
    expect(SECTOR_LINE).toBe(40);
    expect(PROFILE_POSITION_LINE).toEqual({ aggressive: 30, moderate: 20, passive: 12 });
  });

  it('parses only the three known profiles', () => {
    expect(parseRiskProfile('passive')).toBe('passive');
    for (const bad of ['Passive', 'conservative', '', null, undefined, 12, {}]) expect(parseRiskProfile(bad)).toBeNull();
  });

  it('names whose line it is', () => {
    expect(lineSource(concentrationLines('moderate'))).toBe('the line you set');
    expect(lineSource(concentrationLines(null))).toBe("Helm's default line");
  });

  it('reads a stored profile, and reads a failed or missing read as "not chosen"', async () => {
    expect(await readRiskProfile(makeClient(tablesFor('passive')).client, USER)).toBe('passive');
    expect(await readRiskProfile(makeClient(tablesFor(null)).client, USER)).toBeNull();
    expect(await readRiskProfile(makeClient(tablesFor('absent')).client, USER)).toBeNull();
    // Before 081 is applied, PostgREST answers with an error and no data.
    const missingColumn = {
      from: () => ({ select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: null, error: { message: 'column user_preferences.risk_profile does not exist' } }) }) }) }),
    };
    expect(await readRiskProfile(missingColumn, USER)).toBeNull();
    const throws = { from: () => { throw new Error('network'); } };
    expect(await readRiskProfile(throws, USER)).toBeNull();
  });

  it('risk_profile is a field the preferences route will write', () => {
    expect((WRITABLE_PREFERENCE_FIELDS as readonly string[]).includes('risk_profile')).toBe(true);
  });
});

describe('the insights engine measures against the person\'s line', () => {
  it('Passive (12%) flags the two 15% positions and nothing under the line', async () => {
    const { client, tables } = makeClient(tablesFor('passive'));
    await generateInsights(client, USER);
    expect(concentrationTitles(tables)).toEqual(['AAA is 15% of your portfolio', 'BBB is 15% of your portfolio']);
    const aaa = tables.insights.find((r) => String(r.title).startsWith('AAA'))!;
    expect(String(aaa.description)).toContain('above the line you set of 12% for a single position');
    expect(String(aaa.description)).toContain('$15,000 of your $100,000 portfolio');
  });

  it('with no choice, the same book is under Helm\'s 25% default and nothing is flagged, exactly as before', async () => {
    for (const state of [null, 'absent'] as const) {
      const { client, tables } = makeClient(tablesFor(state));
      await generateInsights(client, USER);
      expect(concentrationTitles(tables)).toEqual([]);
    }
  });

  it('Moderate (20%) flags nothing in a book whose largest position is 15%', async () => {
    const { client, tables } = makeClient(tablesFor('moderate'));
    await generateInsights(client, USER);
    expect(concentrationTitles(tables)).toEqual([]);
  });

  it('says it is Helm\'s default line when the person never chose one', async () => {
    const holdings = book();
    holdings[0].total_value = 40000; // AAA 40,000 of 125,000 = 32%
    const { client, tables } = makeClient(tablesFor(null, holdings));
    await generateInsights(client, USER);
    const aaa = tables.insights.find((r) => String(r.title).startsWith('AAA'))!;
    expect(String(aaa.title)).toBe('AAA is 32% of your portfolio');
    expect(String(aaa.description)).toContain("above Helm's default line of 25% for a single position");
    expect(String(aaa.recommended_action)).toContain("Helm's default line is 25% of the book in one position");
  });
});
