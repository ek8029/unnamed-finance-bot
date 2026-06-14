// tests/coalesce.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { coalesce, __resetCoalesce } from '@/lib/coalesce';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => __resetCoalesce());

describe('coalesce', () => {
  it('runs fn once for concurrent callers sharing a key', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      await sleep(20);
      return calls;
    };

    const results = await Promise.all([
      coalesce('k', 1000, fn),
      coalesce('k', 1000, fn),
      coalesce('k', 1000, fn),
      coalesce('k', 1000, fn),
    ]);

    expect(calls).toBe(1);
    expect(results).toEqual([1, 1, 1, 1]); // all share the single in-flight result
  });

  it('serves the cached result within freshMs without re-running fn', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      return calls;
    };

    const first = await coalesce('k', 1000, fn);
    const second = await coalesce('k', 1000, fn);

    expect(calls).toBe(1);
    expect(first).toBe(1);
    expect(second).toBe(1);
  });

  it('re-runs fn after freshMs elapses', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      return calls;
    };

    await coalesce('k', 10, fn);
    await sleep(25);
    const again = await coalesce('k', 10, fn);

    expect(calls).toBe(2);
    expect(again).toBe(2);
  });

  it('keeps separate keys independent', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      return calls;
    };

    await Promise.all([coalesce('a', 1000, fn), coalesce('b', 1000, fn)]);
    expect(calls).toBe(2);
  });

  it('does not cache failures — next call retries', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls === 1) throw new Error('boom');
      return calls;
    };

    await expect(coalesce('k', 1000, fn)).rejects.toThrow('boom');
    const recovered = await coalesce('k', 1000, fn);

    expect(calls).toBe(2);
    expect(recovered).toBe(2);
  });
});
