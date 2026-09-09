// tests/redis-helper.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@upstash/redis', () => {
  class Redis {
    calls: unknown[] = [];
    static fromEnv = vi.fn(() => new Redis());
  }
  return { Redis };
});

import { getRedis, withRedis, redisKey, __resetRedis } from '@/lib/redis';

beforeEach(() => {
  __resetRedis();
  vi.unstubAllEnvs();
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

describe('redisKey', () => {
  it("builds 'helm:hb:edgar-watch' from ('hb', 'edgar-watch')", () => {
    expect(redisKey('hb', 'edgar-watch')).toBe('helm:hb:edgar-watch');
  });
});
