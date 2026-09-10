// tests/overview-actions.test.ts
//
// The overview's "Actions inbox" recomputed its items from holdings on every
// request (lib/intelligence-feed.ts behind /api/dashboard/intelligence), stamped
// each one createdAt = request time, and wrote nothing down. So nothing could be
// dismissed, nothing remembered when it was first raised, and the same findings
// came back forever by construction.
//
// lib/overview-actions.ts persists that feed into `insights` under the recurrence
// policy the other writers already share (lib/insight-recurrence.ts), so the panel
// can be read back through readInsights and inherit prominence and dismissal.
//
// The fake below enforces the constraints the migrations declare, so a payload the
// database would reject fails here too:
//   009 insights(insight_type NOT NULL, title NOT NULL, description NOT NULL,
//       created_at TIMESTAMPTZ DEFAULT NOW(), expires_at TIMESTAMPTZ)
//   029 insight_type CHECK IN (spending, portfolio, market, tax, credit,
//       subscription, cash_flow, performance, concentration)
//   009 priority CHECK IN (critical, high, medium, low)
// and it rejects any payload carrying created_at, because preserving the first
// time a finding was raised is the whole point of the change.
import { describe, it, expect, vi } from 'vitest';
import { readInsights, INSIGHT_SURFACE_TYPES } from '@/lib/insights-reader';
import {
  FEED_SOURCE_TO_INSIGHT_TYPE,
  OVERVIEW_INSIGHT_TYPES,
  feedInsightToCandidate,
  persistOverviewActions,
} from '@/lib/overview-actions';
import { INSIGHT_LIFETIMES } from '@/lib/insights-engine';
import type { FeedInsight, InsightSource } from '@/lib/intelligence-feed';

vi.mock('@/lib/thesis-access-server', () => ({ hasThesisAccess: async () => false }));

/** insight_type values migration 029's CHECK constraint allows. */
const ALLOWED_TYPES = [
  'spending', 'portfolio', 'market', 'tax', 'credit',
  'subscription', 'cash_flow', 'performance', 'concentration',
];
const ALLOWED_PRIORITIES = ['critical', 'high', 'medium', 'low'];

const HOUR = 3_600_000;
const ahead = (ms: number) => new Date(Date.now() + ms).toISOString();
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

function feed(over: Partial<FeedInsight> = {}): FeedInsight {
  return {
    id: 'ins_1',
    type: 'risk',
    priority: 'medium',
    title: 'PLTR concentration above 25%',
    summary: 'PLTR is 31.0% of your portfolio ($31,000.00).',
    detail: 'A position this size carries concentrated single-stock risk.',
    metrics: [{ label: 'Allocation', value: '31.0%' }],
    suggestedFollowUp: 'What is my concentration risk in PLTR?',
    source: 'concentration',
    createdAt: new Date().toISOString(),
    ...over,
  };
}

interface Row {
  id: string;
  user_id: string;
  insight_type: string;
  priority: string | null;
  title: string;
  description: string | null;
  recommended_action: string | null;
  explanation: string | null;
  estimated_impact_amount: number | null;
  is_dismissed: boolean;
  is_archived: boolean;
  expires_at: string | null;
}

let seq = 0;
function row(over: Partial<Row> = {}): Row {
  seq += 1;
  return {
    id: `r${seq}`, user_id: 'user-1', insight_type: 'portfolio', priority: 'medium',
    title: `flag ${seq}`, description: 'd', recommended_action: null, explanation: null,
    estimated_impact_amount: null, is_dismissed: false, is_archived: false,
    expires_at: ahead(30 * 24 * HOUR),
    ...over,
  };
}

interface Recorded {
  inserts: Record<string, unknown>[];
  updates: { fields: Record<string, unknown>; id: string }[];
  deletes: number;
  selectedTypes: unknown[];
}

function fakeSupabase(rows: Row[], rec: Recorded) {
  return {
    from: (table: string) => {
      if (table !== 'insights') throw new Error(`overview-actions must not touch "${table}"`);
      let kept = rows.slice();
      const query: Record<string, unknown> = {};
      Object.assign(query, {
        select: () => query,
        eq: (col: string, v: unknown) => {
          kept = kept.filter(r => (r as unknown as Record<string, unknown>)[col] === v);
          return query;
        },
        in: (col: string, vs: unknown[]) => {
          if (col === 'insight_type') rec.selectedTypes = vs;
          kept = kept.filter(r => vs.includes((r as unknown as Record<string, unknown>)[col]));
          return query;
        },
        or: (spec: string) => {
          // PostgREST's or-string, e.g. 'is_dismissed.eq.true,is_archived.eq.true'.
          // Parsed rather than stubbed true, so this mock cannot certify a
          // suppression it never actually applied. A column that is absent reads
          // as undefined and does not match true, which is what NULL does in
          // Postgres.
          const clauses = spec.split(',').map(c => {
            const [col, op, ...rest] = c.split('.');
            const raw = rest.join('.');
            return { col, op, val: raw === 'true' ? true : raw === 'false' ? false : raw as unknown };
          });
          kept = kept.filter(r => clauses.some(({ col, op, val }) => {
            const v = (r as unknown as Record<string, unknown>)[col];
            return op === 'eq' ? v === val : false;
          }));
          return query;
        },
        gt: (col: string, v: string) => {
          // A range filter never matches NULL, which is what lets a row dismissed
          // before expiries existed stay out of the suppression set.
          kept = kept.filter(r => {
            const raw = (r as unknown as Record<string, unknown>)[col];
            return typeof raw === 'string' && Date.parse(raw) > Date.parse(v);
          });
          return query;
        },
        order: () => query,
        limit: () => Promise.resolve({ data: kept, error: null }),
        insert: (payload: Record<string, unknown>[]) => {
          for (const p of payload) {
            // Constraints from migrations 009 and 029.
            if (!p.user_id) throw new Error('insert without user_id');
            if (!ALLOWED_TYPES.includes(String(p.insight_type))) {
              throw new Error(`insight_type "${p.insight_type}" violates the 029 CHECK`);
            }
            if (p.priority != null && !ALLOWED_PRIORITIES.includes(String(p.priority))) {
              throw new Error(`priority "${p.priority}" violates the 009 CHECK`);
            }
            if (!p.title) throw new Error('title is NOT NULL');
            if (!p.description) throw new Error('description is NOT NULL');
            if ('created_at' in p) throw new Error('a writer must never stamp created_at');
            rec.inserts.push(p);
          }
          return Promise.resolve({ error: null });
        },
        update: (fields: Record<string, unknown>) => {
          if ('created_at' in fields) throw new Error('a writer must never rewrite created_at');
          const u = { fields, id: '' };
          const chain: Record<string, unknown> = {};
          Object.assign(chain, {
            eq: (col: string, v: unknown) => {
              if (col === 'id') u.id = String(v);
              return chain;
            },
            then: (res: (v: { error: null }) => unknown) => {
              rec.updates.push(u);
              return Promise.resolve({ error: null }).then(res);
            },
          });
          return chain;
        },
        delete: () => {
          rec.deletes += 1;
          throw new Error('overview-actions must never delete a row');
        },
      });
      return query;
    },
  };
}

function recorder(): Recorded {
  return { inserts: [], updates: [], deletes: 0, selectedTypes: [] };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (rows: Row[], items: FeedInsight[], rec: Recorded) =>
  persistOverviewActions(fakeSupabase(rows, rec) as any, 'user-1', items);

describe('feed source mapping', () => {
  const sources: InsightSource[] = [
    'concentration', 'tax', 'earnings', 'cash_flow', 'market', 'performance', 'rebalancing',
  ];

  it('maps every source the feed can emit', () => {
    for (const s of sources) expect(FEED_SOURCE_TO_INSIGHT_TYPE[s]).toBeTruthy();
  });

  it('only maps onto insight_type values the 029 CHECK allows', () => {
    for (const s of sources) expect(ALLOWED_TYPES).toContain(FEED_SOURCE_TO_INSIGHT_TYPE[s]);
  });

  it('only maps onto types that carry a lifetime, so every row can expire', () => {
    for (const s of sources) {
      expect(INSIGHT_LIFETIMES[FEED_SOURCE_TO_INSIGHT_TYPE[s]]).toBeDefined();
    }
  });

  it('reads back exactly the types it writes', () => {
    for (const s of sources) {
      expect(OVERVIEW_INSIGHT_TYPES).toContain(FEED_SOURCE_TO_INSIGHT_TYPE[s]);
    }
  });

  it('carries the feed copy into the row without inventing a created_at', () => {
    const c = feedInsightToCandidate(feed());
    expect(c.insight_type).toBe('portfolio');
    expect(c.priority).toBe('medium');
    expect(c.title).toBe('PLTR concentration above 25%');
    expect(c.description).toBe('PLTR is 31.0% of your portfolio ($31,000.00).');
    expect(Object.keys(c)).not.toContain('created_at');
  });
});

describe('persistOverviewActions', () => {
  it('inserts a finding that has never been raised, with an expiry', async () => {
    const rec = recorder();
    const res = await run([], [feed()], rec);
    expect(res.inserted).toBe(1);
    expect(rec.inserts).toHaveLength(1);
    expect(rec.inserts[0].expires_at).toBeTruthy();
    expect(rec.inserts[0].user_id).toBe('user-1');
  });

  it('collapses two feed items that normalize to the same finding', async () => {
    const rec = recorder();
    // Two lots of one position: the feed loops holdings, so it emits the alert twice.
    const res = await run([], [
      feed({ id: 'a', title: 'PLTR concentration above 25%' }),
      feed({ id: 'b', title: 'PLTR concentration above 25%', summary: 'PLTR is 31.4% of your portfolio ($31,400.00).' }),
    ], rec);
    expect(res.inserted).toBe(1);
    expect(rec.inserts).toHaveLength(1);
  });

  it('leaves an unchanged recurrence alone and only pushes its expiry out', async () => {
    // Round trip rather than a hand-built row: the second run sees exactly what
    // the first one wrote, which is the only way to be sure this reaches the
    // "substance has not moved" branch and not the restate branch.
    const first = recorder();
    await run([], [feed()], first);
    const written = first.inserts[0];
    const existing = row({
      title: String(written.title),
      description: String(written.description),
      explanation: written.explanation as string | null,
      priority: String(written.priority),
      expires_at: ahead(HOUR),
    });
    const rec = recorder();
    // Same finding tomorrow, with the dollars and the percentage drifted.
    const res = await run([existing], [feed({
      title: 'PLTR concentration above 27%',
      summary: 'PLTR is 31.4% of your portfolio ($31,400.00).',
    })], rec);
    expect(res.inserted).toBe(0);
    expect(res.refreshed).toBe(1);
    expect(rec.updates).toHaveLength(1);
    // The expiry is the only column that may move: rewriting the row is what
    // makes a flag that has been true since Tuesday feel like news.
    expect(Object.keys(rec.updates[0].fields)).toEqual(['expires_at']);
    expect(rec.updates[0].id).toBe(existing.id);
  });

  it('restates a recurrence whose substance moved, still without touching created_at', async () => {
    const rec = recorder();
    const existing = row({
      title: 'PLTR concentration above 27%',
      description: 'PLTR is 31.4% of your portfolio ($31,400.00).',
      priority: 'low',
    });
    const res = await run([existing], [feed({ priority: 'high' })], rec);
    expect(res.updated).toBe(1);
    expect(rec.updates).toHaveLength(1);
    expect(rec.updates[0].fields.priority).toBe('high');
    expect(rec.updates[0].fields.expires_at).toBeTruthy();
  });

  it('does not raise a second card when the persistent engine already owns the finding', async () => {
    const rec = recorder();
    // What lib/insights-engine.ts writes for the same position, above its own
    // critical threshold. Its wording differs, so a title match cannot see it.
    const engineRow = row({ title: 'PLTR is 31% of your portfolio' });
    const res = await run([engineRow], [feed()], rec);
    expect(res.skipped).toBe(1);
    expect(rec.inserts).toHaveLength(0);
    expect(rec.updates).toHaveLength(0);
  });

  it('keeps a dismissed finding gone for the rest of its life', async () => {
    const rec = recorder();
    const dismissed = row({
      title: 'PLTR concentration above 27%',
      is_dismissed: true,
      expires_at: ahead(30 * 24 * HOUR),
    });
    const res = await run([dismissed], [feed()], rec);
    expect(res.skipped).toBe(1);
    expect(rec.inserts).toHaveLength(0);
    expect(rec.updates).toHaveLength(0);
  });

  it('keeps a dismissed engine card gone too', async () => {
    const rec = recorder();
    const dismissed = row({ title: 'PLTR is 31% of your portfolio', is_dismissed: true, expires_at: ahead(HOUR) });
    const res = await run([dismissed], [feed()], rec);
    expect(res.skipped).toBe(1);
    expect(rec.inserts).toHaveLength(0);
  });

  it('lets a finding come back once the dismissed row has outlived its expiry', async () => {
    const rec = recorder();
    const stale = row({ title: 'PLTR concentration above 27%', is_dismissed: true, expires_at: ago(HOUR) });
    const res = await run([stale], [feed()], rec);
    expect(res.inserted).toBe(1);
  });

  it('does not suppress on a dismissed row that predates the expiry work', async () => {
    // Nothing stamped expires_at before 2026-09-10, and suppressing on those
    // would hide findings people dismissed months ago for good.
    const rec = recorder();
    const legacy = row({ title: 'PLTR concentration above 27%', is_dismissed: true, expires_at: null });
    const res = await run([legacy], [feed()], rec);
    expect(res.inserted).toBe(1);
  });

  it('writes nothing at all for an empty feed', async () => {
    const rec = recorder();
    const res = await run([row()], [], rec);
    expect(res).toEqual({ inserted: 0, updated: 0, refreshed: 0, skipped: 0 });
    expect(rec.inserts).toHaveLength(0);
    expect(rec.updates).toHaveLength(0);
  });

  it('reads only the types it can write', async () => {
    const rec = recorder();
    await run([], [feed()], rec);
    expect(rec.selectedTypes).toEqual([...OVERVIEW_INSIGHT_TYPES]);
  });
});

/* The overview reads one more type than the Actions page does: its generator has
   a cash_flow lane (large charges, deposits) that free accounts see as their
   basic alerts, and 'cash_flow' is deliberately absent from the Actions page,
   where the 2026-07-24 "not a budgeting app" decision applies. */
describe('readInsights type list', () => {
  interface ReaderRow { id: string; insight_type: string; title: string }

  function readerClient(rows: ReaderRow[]) {
    return {
      from: (table: string) => {
        const query: Record<string, unknown> = {};
        if (table === 'user_preferences') {
          Object.assign(query, {
            select: () => query,
            eq: () => query,
            maybeSingle: () => Promise.resolve({ data: { updates_seen_at: null }, error: null }),
          });
          return query;
        }
        if (table === 'insights') {
          let kept = rows.slice();
          Object.assign(query, {
            select: () => query,
            eq: () => query,
            in: (col: string, vs: unknown[]) => {
              if (col === 'insight_type') kept = kept.filter(r => vs.includes(r.insight_type));
              return query;
            },
            or: () => query,
            not: () => query,
            order: () => query,
            limit: () => Promise.resolve({ data: kept, error: null }),
          });
          return query;
        }
        Object.assign(query, {
          select: () => query, eq: () => query,
          limit: () => Promise.resolve({ data: [], error: null }),
        });
        return query;
      },
    };
  }

  const rows: ReaderRow[] = [
    { id: 'p', insight_type: 'portfolio', title: 'PLTR is 31% of your portfolio' },
    { id: 'c', insight_type: 'cash_flow', title: 'Large charge: $2,400.00' },
    { id: 's', insight_type: 'spending', title: 'Groceries spending up 40%' },
  ];
  const user = { id: 'user-1', email: 'user@example.test' };

  it('leaves the Actions page reading the five types it always read', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await readInsights(readerClient(rows) as any, user);
    expect(out.map(r => r.id)).toEqual(['p']);
    expect([...INSIGHT_SURFACE_TYPES]).not.toContain('cash_flow');
  });

  it('lets the overview ask for its cash_flow lane as well', async () => {
    const types = [...INSIGHT_SURFACE_TYPES, 'cash_flow'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await readInsights(readerClient(rows) as any, user, { types });
    expect(out.map(r => r.id).sort()).toEqual(['c', 'p']);
    // Never budgeting rows the product decided against, whoever asks.
    expect(out.map(r => r.id)).not.toContain('s');
  });
});
