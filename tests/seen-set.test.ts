import { describe, it, expect, beforeEach, vi } from 'vitest';
import { unseen, markSeen, SEEN_TTL_S } from '@/lib/watch/seen-set';

// An in-memory Redis behind withRedis. `mode` switches between a working
// client, a null client (Redis unconfigured) and one whose calls throw.
const redisMock = vi.hoisted(() => ({
  sets: new Map<string, Set<string>>(),
  ttl: new Map<string, number>(),
  calls: [] as string[],
  mode: 'ok' as 'ok' | 'null' | 'throw',
}));
vi.mock('@/lib/redis', () => {
  const guard = (name: string) => {
    redisMock.calls.push(name);
    if (redisMock.mode === 'throw') throw new Error('redis down');
  };
  const r = {
    smismember: async (k: string, members: string[]) => {
      guard('smismember');
      const s = redisMock.sets.get(k);
      return members.map((m) => (s?.has(m) ? 1 : 0));
    },
    sadd: async (k: string, ...members: string[]) => {
      guard('sadd');
      const s = redisMock.sets.get(k) ?? new Set<string>();
      for (const m of members) s.add(m);
      redisMock.sets.set(k, s);
      return members.length;
    },
    expire: async (k: string, s: number) => { guard('expire'); redisMock.ttl.set(k, s); return 1; },
  };
  return {
    withRedis: async <T,>(fn: (r: unknown) => Promise<T>, fallback: T) => {
      if (redisMock.mode === 'null') return fallback;
      try { return await fn(r); } catch { return fallback; }
    },
    redisKey: (...parts: string[]) => ['helm', ...parts].join(':'),
  };
});
beforeEach(() => { redisMock.sets.clear(); redisMock.ttl.clear(); redisMock.calls.length = 0; redisMock.mode = 'ok'; });

const KEY = 'helm:watch:seen:edgar';

describe('unseen', () => {
  it('is read-only: twice in a row returns every id both times', async () => {
    expect(await unseen('edgar', ['a', 'b'])).toEqual(['a', 'b']);
    expect(await unseen('edgar', ['a', 'b'])).toEqual(['a', 'b']);
    expect(redisMock.calls).toEqual(['smismember', 'smismember']);
    expect(redisMock.sets.has(KEY)).toBe(false);
  });

  it('after markSeen the same ids return nothing', async () => {
    await unseen('edgar', ['a', 'b']);
    await markSeen('edgar', ['a', 'b']);
    expect(await unseen('edgar', ['a', 'b'])).toEqual([]);
  });

  it('a mix returns only the unmarked ids, in input order', async () => {
    await markSeen('edgar', ['b']);
    expect(await unseen('edgar', ['a', 'b', 'c'])).toEqual(['a', 'c']);
  });

  it('Redis null returns every id (today: the upsert dedupes)', async () => {
    redisMock.mode = 'null';
    expect(await unseen('edgar', ['a', 'b'])).toEqual(['a', 'b']);
    expect(redisMock.calls).toEqual([]);
  });

  it('a Redis throw returns every id', async () => {
    redisMock.mode = 'throw';
    expect(await unseen('edgar', ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('empty input makes no Redis call', async () => {
    expect(await unseen('edgar', [])).toEqual([]);
    expect(redisMock.calls).toEqual([]);
  });
});

describe('markSeen', () => {
  it('adds the ids and sets the seven day TTL', async () => {
    await markSeen('edgar', ['a', 'b']);
    expect([...redisMock.sets.get(KEY)!].sort()).toEqual(['a', 'b']);
    expect(redisMock.ttl.get(KEY)).toBe(SEEN_TTL_S);
    expect(SEEN_TTL_S).toBe(7 * 24 * 3600);
    expect(redisMock.calls).toEqual(['sadd', 'expire']);
  });

  it('keys per watcher', async () => {
    await markSeen('news', ['a']);
    expect(redisMock.sets.has('helm:watch:seen:news')).toBe(true);
    expect(redisMock.sets.has(KEY)).toBe(false);
  });

  it('empty input makes no Redis call', async () => {
    await markSeen('edgar', []);
    expect(redisMock.calls).toEqual([]);
  });

  it('Redis null or a throw is silent', async () => {
    redisMock.mode = 'null';
    await expect(markSeen('edgar', ['a'])).resolves.toBeUndefined();
    redisMock.mode = 'throw';
    await expect(markSeen('edgar', ['a'])).resolves.toBeUndefined();
  });
});
