import { describe, it, expect } from 'vitest';
import { entitledToMonitoring, selectMonitored, FREE_THESIS_LIMIT, FREE_MONITORED_LIMIT } from '@/lib/thesis-entitlement';

/**
 * The scoring cron now filters by entitlement. The failure that matters is not
 * a free user sneaking monitoring, it is a PAYING user silently losing it, so
 * most of these assert the keep side.
 */

type Row = {
  user_id: string;
  tier: string | null;
  trial_ends_at: string | null;
  stripe_subscription_id: string | null;
};

/** Minimal stand-in for the service client: one .from().select().in() chain. */
function fakeClient(rows: Row[], emails: Record<string, string> = {}) {
  return {
    from() {
      return {
        select() {
          return {
            in(_col: string, ids: string[]) {
              return Promise.resolve({ data: rows.filter((r) => ids.includes(r.user_id)) });
            },
          };
        },
      };
    },
    auth: {
      admin: {
        getUserById(id: string) {
          return Promise.resolve({ data: emails[id] ? { user: { email: emails[id] } } : null });
        },
      },
    },
  } as never;
}

const future = new Date(Date.now() + 7 * 86400000).toISOString();
const past = new Date(Date.now() - 7 * 86400000).toISOString();

describe('entitledToMonitoring', () => {
  it('keeps a paying pro subscriber', async () => {
    const s = await entitledToMonitoring(
      fakeClient([{ user_id: 'u1', tier: 'pro', trial_ends_at: null, stripe_subscription_id: 'sub_1' }]),
      ['u1'],
    );
    expect(s.has('u1')).toBe(true);
  });

  it('keeps a legacy max row, which normalises to pro', async () => {
    const s = await entitledToMonitoring(
      fakeClient([{ user_id: 'u1', tier: 'max', trial_ends_at: null, stripe_subscription_id: null }]),
      ['u1'],
    );
    expect(s.has('u1')).toBe(true);
  });

  it('keeps someone whose card-required trial is still running', async () => {
    const s = await entitledToMonitoring(
      fakeClient([{ user_id: 'u1', tier: 'pro', trial_ends_at: future, stripe_subscription_id: null }]),
      ['u1'],
    );
    expect(s.has('u1')).toBe(true);
  });

  it('drops someone whose trial has lapsed without paying', async () => {
    const s = await entitledToMonitoring(
      fakeClient([{ user_id: 'u1', tier: 'pro', trial_ends_at: past, stripe_subscription_id: null }]),
      ['u1'],
    );
    expect(s.has('u1')).toBe(false);
  });

  it('keeps a lapsed trial that later became a real subscription', async () => {
    const s = await entitledToMonitoring(
      fakeClient([{ user_id: 'u1', tier: 'pro', trial_ends_at: past, stripe_subscription_id: 'sub_1' }]),
      ['u1'],
    );
    expect(s.has('u1')).toBe(true);
  });

  it('drops a free user', async () => {
    const s = await entitledToMonitoring(
      fakeClient([{ user_id: 'u1', tier: 'free', trial_ends_at: null, stripe_subscription_id: null }]),
      ['u1'],
    );
    expect(s.has('u1')).toBe(false);
  });

  it('drops a user with no subscription row at all', async () => {
    const s = await entitledToMonitoring(fakeClient([]), ['ghost']);
    expect(s.has('ghost')).toBe(false);
  });

  it('does not promote anyone when the email lookup throws', async () => {
    const client = {
      from: () => ({ select: () => ({ in: () => Promise.resolve({ data: [] }) }) }),
      auth: { admin: { getUserById: () => Promise.reject(new Error('boom')) } },
    } as never;
    const s = await entitledToMonitoring(client, ['u1']);
    expect(s.size).toBe(0);
  });

  it('returns an empty set for no input without querying', async () => {
    const s = await entitledToMonitoring(fakeClient([]), []);
    expect(s.size).toBe(0);
  });

  it('separates entitled from unentitled in one batch', async () => {
    const s = await entitledToMonitoring(
      fakeClient([
        { user_id: 'payer', tier: 'pro', trial_ends_at: null, stripe_subscription_id: 'sub_1' },
        { user_id: 'freebie', tier: 'free', trial_ends_at: null, stripe_subscription_id: null },
        { user_id: 'lapsed', tier: 'pro', trial_ends_at: past, stripe_subscription_id: null },
      ]),
      ['payer', 'freebie', 'lapsed'],
    );
    expect([...s].sort()).toEqual(['payer']);
  });

  it('caps free accounts at one thesis', () => {
    // The cap is what makes a second thesis the upgrade, so pin the value.
    expect(FREE_THESIS_LIMIT).toBe(1);
  });

  // ── The failure that actually costs money ──

  it('FAILS OPEN when the entitlement query errors, keeping paying users watched', async () => {
    // A transient database error must not silently unmonitor every subscriber
    // and log it as the ordinary "skipped N unentitled" line.
    const client = {
      from: () => ({
        select: () => ({ in: () => Promise.resolve({ data: null, error: { message: 'connection reset' } }) }),
      }),
      auth: { admin: { getUserById: () => Promise.resolve({ data: null }) } },
    } as never;
    const s = await entitledToMonitoring(client, ['payer', 'freebie']);
    expect(s.has('payer')).toBe(true);
    expect(s.has('freebie')).toBe(true);
  });

  it('keeps an allowlisted comp whose subscription row says free', async () => {
    // The allowlist is the documented override for the founder and comped
    // testers. If it stops being consulted they lose monitoring silently.
    const s = await entitledToMonitoring(
      fakeClient(
        [{ user_id: 'comp', tier: 'free', trial_ends_at: null, stripe_subscription_id: null }],
        { comp: 'evank8029@gmail.com' },
      ),
      ['comp'],
    );
    expect(s.has('comp')).toBe(true);
  });

  it('does not promote a non-allowlisted free user via the email backstop', async () => {
    const s = await entitledToMonitoring(
      fakeClient(
        [{ user_id: 'u1', tier: 'free', trial_ends_at: null, stripe_subscription_id: null }],
        { u1: 'stranger@example.com' },
      ),
      ['u1'],
    );
    expect(s.has('u1')).toBe(false);
  });

  it('chunks large id lists instead of truncating at the 1000-row cap', async () => {
    // PostgREST caps a result set at 1000. A single .in() past that silently
    // drops owners, who then read as unentitled while paying.
    const ids = Array.from({ length: 1200 }, (_, i) => `u${i}`);
    const rows = ids.map((id) => ({
      user_id: id, tier: 'pro', trial_ends_at: null, stripe_subscription_id: 'sub',
    }));
    let calls = 0;
    const client = {
      from: () => ({
        select: () => ({
          in: (_c: string, batch: string[]) => {
            calls++;
            expect(batch.length).toBeLessThanOrEqual(1000);
            return Promise.resolve({ data: rows.filter(r => batch.includes(r.user_id)), error: null });
          },
        }),
      }),
      auth: { admin: { getUserById: () => Promise.resolve({ data: null }) } },
    } as never;

    const s = await entitledToMonitoring(client, ids);
    expect(calls).toBeGreaterThan(1);
    expect(s.size).toBe(1200);
  });
});

/**
 * Free is not "the past only" any more. A free account keeps ONE thesis under
 * watch, its oldest tracked one; everything past that, and every agentic
 * pipeline, stays Pro. Decided 2026-08-25: after the 8/09 paywall, 15 free
 * theses had accumulated zero evidence and every August signup who wrote one
 * got nothing after the onboarding scan.
 */
describe('selectMonitored', () => {
  const t = (id: string, user_id: string, created_at: string) => ({ id, user_id, created_at });

  it('keeps every thesis of an entitled owner', () => {
    const rows = [t('a', 'pro', '2026-01-01'), t('b', 'pro', '2026-02-01'), t('c', 'pro', '2026-03-01')];
    const r = selectMonitored(rows, new Set(['pro']));
    expect(r.kept.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(r.skipped).toBe(0);
  });

  it('keeps exactly one thesis for a free owner: the oldest tracked one', () => {
    const rows = [t('newer', 'free', '2026-08-20'), t('oldest', 'free', '2026-07-01'), t('mid', 'free', '2026-08-01')];
    const r = selectMonitored(rows, new Set());
    expect(r.kept.map((x) => x.id)).toEqual(['oldest']);
    expect(r.skipped).toBe(2);
  });

  it('a free owner with one thesis keeps it', () => {
    const r = selectMonitored([t('only', 'free', '2026-08-20')], new Set());
    expect(r.kept.map((x) => x.id)).toEqual(['only']);
    expect(r.skipped).toBe(0);
  });

  it('mixes owners in one pass and preserves input order for the kept rows', () => {
    const rows = [
      t('p1', 'pro', '2026-05-01'),
      t('f2', 'free', '2026-08-02'),
      t('f1', 'free', '2026-08-01'),
      t('p2', 'pro', '2026-06-01'),
      t('g1', 'free2', '2026-07-01'),
    ];
    const r = selectMonitored(rows, new Set(['pro']));
    expect(r.kept.map((x) => x.id)).toEqual(['p1', 'f1', 'p2', 'g1']);
    expect(r.skipped).toBe(1);
  });

  it('breaks a created_at tie by id so the pick is stable across runs', () => {
    const rows = [t('b', 'free', '2026-08-01'), t('a', 'free', '2026-08-01')];
    expect(selectMonitored(rows, new Set()).kept.map((x) => x.id)).toEqual(['a']);
  });

  it('handles empty input', () => {
    expect(selectMonitored([], new Set())).toEqual({ kept: [], skipped: 0 });
  });

  it('pins the free monitoring allowance at one', () => {
    expect(FREE_MONITORED_LIMIT).toBe(1);
  });
});
