// tests/redis-helper.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// `store` is what the fake Upstash holds; `mgetCalls` records every MGET the
// helper sent, so a test can pin that several keys cost one round trip.
const upstash = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  mgetCalls: [] as string[][],
  boom: false,
}));

vi.mock('@upstash/redis', () => {
  class Redis {
    calls: unknown[] = [];
    static fromEnv = vi.fn(() => new Redis());
    async mget(...keys: string[]) {
      upstash.mgetCalls.push(keys);
      if (upstash.boom) throw new Error('redis down');
      return keys.map((k) => (upstash.store.has(k) ? upstash.store.get(k) : null));
    }
  }
  return { Redis };
});

import { getRedis, withRedis, readKeys, redisKey, __resetRedis } from '@/lib/redis';

const configured = () => {
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');
};

beforeEach(() => {
  __resetRedis();
  vi.unstubAllEnvs();
  upstash.store.clear();
  upstash.mgetCalls.length = 0;
  upstash.boom = false;
});

describe('getRedis', () => {
  it('returns null when UPSTASH_REDIS_REST_URL is missing', () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');

    expect(getRedis()).toBeNull();
  });

  it('returns null when UPSTASH_REDIS_REST_TOKEN is missing', () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');

    expect(getRedis()).toBeNull();
  });

  it('returns the same instance on repeated calls when both env vars are set', () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');

    const first = getRedis();
    const second = getRedis();

    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });
});

describe('withRedis', () => {
  it('returns fallback when getRedis() is null', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');

    const fn = vi.fn();
    const result = await withRedis(fn, 'fallback');

    expect(result).toBe('fallback');
    expect(fn).not.toHaveBeenCalled();
  });

  it("returns fn(redis)'s value when set", async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');

    const result = await withRedis(async () => 'value', 'fallback');

    expect(result).toBe('value');
  });

  it('returns fallback and logs once when fn throws', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await withRedis(async () => {
      throw new Error('boom');
    }, 'fallback');

    expect(result).toBe('fallback');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('[redis] call failed', expect.any(Error));

    errorSpy.mockRestore();
  });
});

describe('readKeys', () => {
  it('reads several keys in one MGET and answers in key order', async () => {
    configured();
    upstash.store.set('helm:a', '2026-09-09T14:00:00.000Z');
    upstash.store.set('helm:b', '2026-09-09T14:10:00.000Z');

    const out = await readKeys(['helm:a', 'helm:b']);

    expect(out).toEqual(['2026-09-09T14:00:00.000Z', '2026-09-09T14:10:00.000Z']);
    expect(upstash.mgetCalls).toEqual([['helm:a', 'helm:b']]);
  });

  it('a missing key is null while its neighbour keeps its value', async () => {
    configured();
    upstash.store.set('helm:b', '2026-09-09T14:10:00.000Z');

    expect(await readKeys(['helm:a', 'helm:b'])).toEqual([null, '2026-09-09T14:10:00.000Z']);
  });

  it('returns nulls of the same length when Redis is unconfigured, without a call', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');

    expect(await readKeys(['helm:a', 'helm:b', 'helm:c'])).toEqual([null, null, null]);
    expect(upstash.mgetCalls).toEqual([]);
  });

  it('returns nulls of the same length when the MGET throws', async () => {
    configured();
    upstash.boom = true;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await readKeys(['helm:a', 'helm:b'])).toEqual([null, null]);
    expect(upstash.mgetCalls).toEqual([['helm:a', 'helm:b']]);

    errorSpy.mockRestore();
  });

  it('sends nothing for an empty key list', async () => {
    configured();

    expect(await readKeys([])).toEqual([]);
    expect(upstash.mgetCalls).toEqual([]);
  });
});

describe('redisKey', () => {
  it("builds 'helm:hb:edgar-watch' from ('hb', 'edgar-watch')", () => {
    expect(redisKey('hb', 'edgar-watch')).toBe('helm:hb:edgar-watch');
  });
});
