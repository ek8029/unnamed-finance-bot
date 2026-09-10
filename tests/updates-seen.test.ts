import { describe, it, expect, vi, afterEach } from 'vitest';
import { isMissingUpdatesSeenColumn, parseUpdatesSeenAt, readUpdatesSeenAt } from '@/lib/agent/updates-seen';

type Result = { data: { updates_seen_at?: string | null } | null; error: { code?: string; message?: string } | null };

/** The only shape readUpdatesSeenAt uses: from().select().eq().maybeSingle(). */
function client(result: Result) {
  return {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => result }) }) }),
  } as unknown as Parameters<typeof readUpdatesSeenAt>[0];
}

afterEach(() => { vi.restoreAllMocks(); });

describe('readUpdatesSeenAt', () => {
  it('returns the stamp once the column exists', async () => {
    const at = await readUpdatesSeenAt(client({ data: { updates_seen_at: '2026-09-09T18:00:00Z' }, error: null }), 'u1');
    expect(at).toBe('2026-09-09T18:00:00Z');
  });

  it('returns null when the person has no preferences row yet', async () => {
    expect(await readUpdatesSeenAt(client({ data: null, error: null }), 'u1')).toBeNull();
  });

  // Migration 078 is unapplied until Evan runs it. PostgREST answers the select
  // with its schema-cache error; the card must read exactly as it did before.
  it('returns null and stays silent when PostgREST does not know the column', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const at = await readUpdatesSeenAt(client({
      data: null,
      error: { code: 'PGRST204', message: "Could not find the 'updates_seen_at' column of 'user_preferences' in the schema cache" },
    }), 'u1');
    expect(at).toBeNull();
    expect(err).not.toHaveBeenCalled();
  });

  it('returns null and stays silent on the postgres undefined_column message', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const at = await readUpdatesSeenAt(client({
      data: null,
      error: { message: 'column user_preferences.updates_seen_at does not exist' },
    }), 'u1');
    expect(at).toBeNull();
    expect(err).not.toHaveBeenCalled();
  });

  it('logs any other failure rather than hiding it behind "never visited"', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const at = await readUpdatesSeenAt(client({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }), 'u1');
    expect(at).toBeNull();
    expect(err).toHaveBeenCalled();
  });
});

describe('isMissingUpdatesSeenColumn', () => {
  it('matches only the unapplied-migration shapes', () => {
    expect(isMissingUpdatesSeenColumn({ code: 'PGRST204' })).toBe(true);
    expect(isMissingUpdatesSeenColumn({ code: '42703' })).toBe(true);
    expect(isMissingUpdatesSeenColumn({ message: 'column user_preferences.updates_seen_at does not exist' })).toBe(true);
    expect(isMissingUpdatesSeenColumn({ code: '57014', message: 'statement timeout' })).toBe(false);
    expect(isMissingUpdatesSeenColumn({ message: 'permission denied for table user_preferences' })).toBe(false);
  });
});

describe('parseUpdatesSeenAt', () => {
  it('accepts a parsable timestamp and normalises it', () => {
    expect(parseUpdatesSeenAt('2026-09-09T18:00:00.000Z')).toBe('2026-09-09T18:00:00.000Z');
    expect(parseUpdatesSeenAt('2026-09-09T14:00:00-04:00')).toBe('2026-09-09T18:00:00.000Z');
  });

  it('rejects anything that is not a parsable timestamp string', () => {
    expect(parseUpdatesSeenAt('not a date')).toBeNull();
    expect(parseUpdatesSeenAt('')).toBeNull();
    expect(parseUpdatesSeenAt(null)).toBeNull();
    expect(parseUpdatesSeenAt(undefined)).toBeNull();
    expect(parseUpdatesSeenAt(1757440000000)).toBeNull();
    expect(parseUpdatesSeenAt({ at: '2026-09-09T18:00:00Z' })).toBeNull();
  });

  it('clamps a future stamp to the server clock, so a client cannot blank its own card', () => {
    const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const out = parseUpdatesSeenAt(soon);
    expect(out).not.toBeNull();
    expect(Date.parse(out as string)).toBeLessThanOrEqual(Date.now());
  });
});
