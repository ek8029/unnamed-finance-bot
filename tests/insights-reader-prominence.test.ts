// tests/insights-reader-prominence.test.ts
// readInsights is the read layer every insights surface uses. This pins the
// three-way split it now applies to the default open view:
//   announced  created after this person's updates_seen_at watermark
//   standing   open, but older than the watermark (or, with no watermark, older
//              than INSIGHT_ANNOUNCE_GRACE_MS)
//   gone       dismissed, archived, snoozed, expired, or acted on (is_useful)
//
// The insights fake below EVALUATES the filters the reader sends instead of
// returning every fixture row, so a reader that dropped the expiry or the
// acted-on filter would hand these tests rows the database would never have
// returned. Columns and nullability follow the migrations: 009 created
// insights(is_dismissed BOOLEAN DEFAULT FALSE, is_useful BOOLEAN, nullable with
// no default, expires_at TIMESTAMPTZ) and 015 added snoozed_until TIMESTAMPTZ
// plus is_archived BOOLEAN DEFAULT FALSE. is_useful being nullable is the point
// of `not.is.true`: null and false both stay open.
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { readInsights } from '@/lib/insights-reader';
import { INSIGHT_ANNOUNCE_GRACE_MS } from '@/lib/insight-prominence';

vi.mock('@/lib/thesis-access-server', () => ({ hasThesisAccess: async () => false }));

const user = { id: 'user-1', email: 'user@example.test' };
const HOUR = 3_600_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const ahead = (ms: number) => new Date(Date.now() + ms).toISOString();

interface Row {
  id: string;
  /** insights.user_id is NOT NULL (009). The fake applies .eq(user_id) like any
   *  other filter, so a row belonging to someone else is never returned. */
  user_id: string;
  insight_type: string;
  priority: string;
  title: string;
  description: string;
  recommended_action: string | null;
  estimated_impact_amount: number | null;
  source_type: string;
  created_at: string;
  expires_at: string | null;
  snoozed_until: string | null;
  is_archived: boolean;
  is_dismissed: boolean;
  is_useful: boolean | null;
  related_entity_type: string | null;
  related_entity_ids: string[] | null;
}

let seq = 0;
function row(over: Partial<Row> = {}): Row {
  seq += 1;
  return {
    id: `i${seq}`, user_id: user.id, insight_type: 'portfolio', priority: 'medium',
    title: `flag ${seq}`, description: 'd', recommended_action: null,
    estimated_impact_amount: null, source_type: 'rule_based',
    created_at: ago(HOUR), expires_at: null, snoozed_until: null,
    is_archived: false, is_dismissed: false, is_useful: null,
    related_entity_type: null, related_entity_ids: null,
    ...over,
  };
}

/** Value of one column, as PostgREST would compare it. */
const val = (r: Row, col: string) => (r as unknown as Record<string, unknown>)[col];

/** One `col.op.value` term out of an or() expression. */
function term(r: Row, clause: string): boolean {
  const [col, op, ...rest] = clause.split('.');
  const raw = rest.join('.');
  const v = val(r, col);
  if (op === 'is') return raw === 'null' ? v === null || v === undefined : v === (raw === 'true');
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  const u = Date.parse(raw);
  if (Number.isNaN(t)) return false; // NULL compared with a range is never true
  if (op === 'lte') return t <= u;
  if (op === 'gt') return t > u;
  if (op === 'lt') return t < u;
  if (op === 'gte') return t >= u;
  throw new Error(`prominence test: unsupported operator "${op}"`);
}

interface Recorded { orExprs: string[]; nots: string[]; orderCols: string[] }

function fakeSupabase(rows: Row[], seenAt: string | null, rec: Recorded) {
  return {
    from: (table: string) => {
      if (table === 'insights') {
        let kept = rows.slice();
        const query: Record<string, unknown> = {};
        Object.assign(query, {
          select: () => query,
          eq: (col: string, v: unknown) => { kept = kept.filter(r => val(r, col) === v); return query; },
          in: (col: string, vs: unknown[]) => { kept = kept.filter(r => vs.includes(val(r, col))); return query; },
          gt: (col: string, v: string) => { kept = kept.filter(r => term(r, `${col}.gt.${v}`)); return query; },
          or: (expr: string) => {
            rec.orExprs.push(expr);
            const clauses = expr.split(',');
            kept = kept.filter(r => clauses.some(c => term(r, c)));
            return query;
          },
          not: (col: string, op: string, v: unknown) => {
            rec.nots.push(`${col}.${op}.${v}`);
            if (op !== 'is') throw new Error(`prominence test: unsupported not operator "${op}"`);
            kept = kept.filter(r => !(val(r, col) === v));
            return query;
          },
          order: (col: string) => { rec.orderCols.push(col); return query; },
          limit: (n: number) => Promise.resolve({ data: kept.slice(0, n), error: null }),
        });
        return query;
      }
      if (table === 'user_preferences') {
        const query: Record<string, unknown> = {};
        Object.assign(query, {
          select: () => query,
          eq: () => query,
          maybeSingle: () => Promise.resolve({ data: { updates_seen_at: seenAt }, error: null }),
        });
        return query;
      }
      if (table === 'linked_accounts') {
        const query: Record<string, unknown> = {};
        Object.assign(query, {
          select: () => query,
          eq: () => query,
          limit: () => Promise.resolve({ data: [], error: null }),
        });
        return query;
      }
      throw new Error(`prominence test: unexpected table "${table}"`);
    },
  };
}

function reader(rows: Row[], seenAt: string | null = null) {
  const rec: Recorded = { orExprs: [], nots: [], orderCols: [] };
  return { rec, run: (opts = {}) => readInsights(fakeSupabase(rows, seenAt, rec) as never, user, opts) };
}

// The onboarding v3 standing nudge has its own suite; keep it out of these counts.
beforeEach(() => { vi.stubEnv('NEXT_PUBLIC_ONBOARDING_V3', ''); });
afterEach(() => { vi.unstubAllEnvs(); });

describe('readInsights prominence, with a watermark', () => {
  it('splits announced from standing on the watermark', async () => {
    const fresh = row({ id: 'new-1', created_at: ago(2 * HOUR) });
    const old = row({ id: 'old-1', created_at: ago(30 * 24 * HOUR) });
    const { run } = reader([fresh, old], ago(24 * HOUR));
    const out = await run();
    expect(out.find(r => r.id === 'new-1')!.prominence).toBe('announced');
    expect(out.find(r => r.id === 'old-1')!.prominence).toBe('standing');
  });

  it('an unchanged flag stays standing across reads, which is the whole point', async () => {
    // lib/insight-recurrence.ts leaves created_at alone when substance has not
    // moved, so the same row reads standing again on the next visit.
    const old = row({ id: 'stale', created_at: ago(10 * 24 * HOUR) });
    expect((await reader([old], ago(5 * 24 * HOUR)).run())[0].prominence).toBe('standing');
    expect((await reader([old], ago(1 * HOUR)).run())[0].prominence).toBe('standing');
  });
});

describe('readInsights prominence, no watermark', () => {
  it('does not announce a backlog: only rows inside the grace window are announced', async () => {
    const rows = [
      row({ id: 'g-in', created_at: ago(INSIGHT_ANNOUNCE_GRACE_MS - HOUR) }),
      row({ id: 'g-out', created_at: ago(INSIGHT_ANNOUNCE_GRACE_MS + HOUR) }),
      row({ id: 'g-ancient', created_at: ago(139 * 24 * HOUR) }),
    ];
    const out = await reader(rows, null).run();
    expect(out.find(r => r.id === 'g-in')!.prominence).toBe('announced');
    expect(out.find(r => r.id === 'g-out')!.prominence).toBe('standing');
    expect(out.find(r => r.id === 'g-ancient')!.prominence).toBe('standing');
  });
});

describe('readInsights "gone"', () => {
  it('drops an expired row, keeps a null and a future expiry', async () => {
    const rows = [
      row({ id: 'e-lapsed', expires_at: ago(HOUR) }),
      row({ id: 'e-future', expires_at: ahead(24 * HOUR) }),
      row({ id: 'e-null', expires_at: null }),
    ];
    const { rec, run } = reader(rows, null);
    const out = await run();
    expect(out.map(r => r.id).sort()).toEqual(['e-future', 'e-null']);
    expect(rec.orExprs.some(e => e.startsWith('expires_at.is.null'))).toBe(true);
  });

  it('drops an acted-on row and keeps false and null is_useful', async () => {
    const rows = [
      row({ id: 'u-done', is_useful: true }),
      row({ id: 'u-no', is_useful: false }),
      row({ id: 'u-null', is_useful: null }),
    ];
    const { rec, run } = reader(rows, null);
    const out = await run();
    expect(out.map(r => r.id).sort()).toEqual(['u-no', 'u-null']);
    expect(rec.nots).toContain('is_useful.is.true');
  });

  it('still drops dismissed, archived and snoozed rows', async () => {
    const rows = [
      row({ id: 'd', is_dismissed: true }),
      row({ id: 'a', is_archived: true }),
      row({ id: 's', snoozed_until: ahead(48 * HOUR) }),
      row({ id: 'open' }),
      row({ id: 'snooze-lapsed', snoozed_until: ago(HOUR) }),
    ];
    const out = await reader(rows, null).run();
    expect(out.map(r => r.id).sort()).toEqual(['open', 'snooze-lapsed']);
  });

  it('an acted-on row is still reachable through status=done', async () => {
    const rows = [row({ id: 'u-done', is_useful: true }), row({ id: 'u-open' })];
    const { rec, run } = reader(rows, null);
    const out = await run({ status: 'done' });
    expect(out.map(r => r.id)).toEqual(['u-done']);
    // The open view's filters must not leak into the history views.
    expect(rec.nots).toHaveLength(0);
    expect(rec.orExprs).toHaveLength(0);
  });
});

describe('readInsights ordering and history views', () => {
  it('the open view fetches newest first, so a new low-priority row is not crowded out', async () => {
    const { rec, run } = reader([row()], null);
    await run();
    expect(rec.orderCols[0]).toBe('created_at');
  });

  it('history views keep the priority-first order and announce nothing', async () => {
    const { rec, run } = reader([row({ id: 'arch', is_archived: true })], null);
    const out = await run({ archived: 'true' });
    expect(rec.orderCols[0]).toBe('priority');
    expect(out[0].prominence).toBe('standing');
  });
});
