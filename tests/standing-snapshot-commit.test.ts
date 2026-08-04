import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// retrieveContext is the only thing evaluateStandingQuestion reaches out to.
const retrieveContext = vi.fn();
vi.mock('@/lib/research/retrieve', () => ({
  retrieveContext: (...args: unknown[]) => retrieveContext(...args),
}));

import {
  evaluateStandingQuestion,
  commitStandingSnapshots,
  type StandingQuestion,
} from '@/lib/research/standing-questions';

/** Records every table write so a test can assert nothing was persisted. */
function stubDb() {
  const updates: { table: string; payload: Record<string, unknown>; id: string }[] = [];
  const db = {
    from(table: string) {
      return {
        update(payload: Record<string, unknown>) {
          return {
            eq(_col: string, id: string) {
              updates.push({ table, payload, id });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
  return { db: db as unknown as SupabaseClient, updates };
}

const question = (over: Partial<StandingQuestion> = {}): StandingQuestion => ({
  id: 'sq-1',
  question: 'is my NVDA thesis holding',
  active: true,
  lastRunAt: '2026-07-28T00:00:00.000Z',
  lastFindingIds: ['catch:old-1'],
  createdAt: '2026-07-01T00:00:00.000Z',
  ...over,
});

const finding = (id: string) => ({ id, ticker: 'NVDA', date: '2026-08-01', source: 'filing', quote: 'q' });

beforeEach(() => {
  retrieveContext.mockReset();
});

describe('standing-question snapshots are never advanced before the note is stored', () => {
  it('evaluate writes NOTHING — the whole point of the split', async () => {
    retrieveContext.mockResolvedValue({ findings: [finding('catch:old-1'), finding('catch:new-1')] });
    const { db, updates } = stubDb();

    const delta = await evaluateStandingQuestion(db, 'user-1', question());

    expect(updates).toHaveLength(0);
    expect(delta.newFindings.map((f) => f.id)).toEqual(['catch:new-1']);
    expect(delta.snapshot.questionId).toBe('sq-1');
    expect(delta.snapshot.findingIds).toEqual(['catch:old-1', 'catch:new-1']);
  });

  it('a delta survives a failed note: re-evaluating still reports the new finding', async () => {
    retrieveContext.mockResolvedValue({ findings: [finding('catch:old-1'), finding('catch:new-1')] });
    const { db } = stubDb();

    // Week 1: composed, then the note failed to save, so nothing was committed.
    const first = await evaluateStandingQuestion(db, 'user-1', question());
    expect(first.newFindings.map((f) => f.id)).toEqual(['catch:new-1']);

    // Week 2 reads the SAME unadvanced row and must surface it again.
    const second = await evaluateStandingQuestion(db, 'user-1', question());
    expect(second.newFindings.map((f) => f.id)).toEqual(['catch:new-1']);
  });

  it('commit advances exactly the snapshots it is handed', async () => {
    const { db, updates } = stubDb();
    const committed = await commitStandingSnapshots(db, [
      { questionId: 'sq-1', findingIds: ['a', 'b'], runAt: '2026-08-04T00:00:00.000Z' },
      { questionId: 'sq-2', findingIds: [], runAt: '2026-08-04T00:00:00.000Z' },
    ]);

    expect(committed).toBe(2);
    expect(updates).toHaveLength(2);
    expect(updates[0]).toEqual({
      table: 'standing_questions',
      id: 'sq-1',
      payload: { last_run_at: '2026-08-04T00:00:00.000Z', last_finding_ids: ['a', 'b'] },
    });
  });

  it('a first run establishes the baseline without reporting a delta', async () => {
    retrieveContext.mockResolvedValue({ findings: [finding('catch:a'), finding('catch:b')] });
    const { db } = stubDb();

    const delta = await evaluateStandingQuestion(db, 'user-1', question({ lastRunAt: null, lastFindingIds: [] }));

    expect(delta.newFindings).toEqual([]);
    expect(delta.snapshot.findingIds).toEqual(['catch:a', 'catch:b']);
  });

  it('one failed snapshot write does not stop the others', async () => {
    const attempted: string[] = [];
    const db = {
      from() {
        return {
          update() {
            return {
              eq(_col: string, id: string) {
                attempted.push(id);
                if (id === 'sq-1') return Promise.reject(new Error('transient'));
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    const committed = await commitStandingSnapshots(db, [
      { questionId: 'sq-1', findingIds: ['a'], runAt: '2026-08-04T00:00:00.000Z' },
      { questionId: 'sq-2', findingIds: ['b'], runAt: '2026-08-04T00:00:00.000Z' },
    ]);

    expect(attempted).toEqual(['sq-1', 'sq-2']);
    expect(committed).toBe(1);
  });
});
