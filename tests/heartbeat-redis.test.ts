import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  beatRedis, readHeartbeatsRedis, readHeartbeatLog, WATCH_NAMES, HB_LOG_LEN, HB_TTL_S,
} from '@/lib/agent/heartbeat-redis';

// An in-memory Redis behind withRedis. `store` null = unconfigured (getRedis
// returned null); `boom` = every call throws, the way a dead Upstash would.
// Values are kept as passed, the way the real client round-trips objects.
const redisMock = vi.hoisted(() => ({
  store: new Map<string, unknown>() as Map<string, unknown> | null,
  lists: new Map<string, unknown[]>(),
  ttl: new Map<string, number>(),
  boom: false,
}));
vi.mock('@/lib/redis', () => {
  const guard = () => { if (redisMock.boom) throw new Error('redis down'); };
  const r = {
    set: async (k: string, v: unknown, opts?: { ex?: number }) => {
      guard(); redisMock.store!.set(k, v); if (opts?.ex) redisMock.ttl.set(k, opts.ex); return 'OK';
    },
    mget: async (...keys: string[]) => { guard(); return keys.map((k) => redisMock.store!.get(k) ?? null); },
    lpush: async (k: string, ...vals: unknown[]) => {
      guard();
      const l = redisMock.lists.get(k) ?? [];
      l.unshift(...vals.reverse());
      redisMock.lists.set(k, l);
      return l.length;
    },
    ltrim: async (k: string, start: number, stop: number) => {
      guard();
      const l = redisMock.lists.get(k) ?? [];
      redisMock.lists.set(k, l.slice(start, stop + 1));
      return 'OK';
    },
    lrange: async (k: string, start: number, stop: number) => {
      guard();
      const l = redisMock.lists.get(k) ?? [];
      return l.slice(start, stop + 1);
    },
    expire: async (k: string, s: number) => { guard(); redisMock.ttl.set(k, s); return 1; },
  };
  return {
    withRedis: async <T,>(fn: (r: unknown) => Promise<T>, fallback: T) => {
      try { if (!redisMock.store) return fallback; return await fn(r); } catch { return fallback; }
    },
    redisKey: (...parts: string[]) => ['helm', ...parts].join(':'),
  };
});

beforeEach(() => {
  redisMock.store = new Map();
  redisMock.lists.clear();
  redisMock.ttl.clear();
  redisMock.boom = false;
});

describe('beatRedis', () => {
  it('writes the current key with a 48 h TTL and pushes onto the log', async () => {
    expect(await beatRedis('edgar-watch', '2026-09-09T14:00:00.000Z', { fetched: 3 })).toBe(true);
    expect(redisMock.store!.get('helm:hb:edgar-watch')).toEqual({ at: '2026-09-09T14:00:00.000Z', detail: { fetched: 3 } });
    expect(redisMock.ttl.get('helm:hb:edgar-watch')).toBe(HB_TTL_S);
    expect(redisMock.ttl.get('helm:hb:edgar-watch:log')).toBe(HB_TTL_S);
    expect(redisMock.lists.get('helm:hb:edgar-watch:log')).toEqual([{ at: '2026-09-09T14:00:00.000Z', detail: { fetched: 3 } }]);
  });

  it('caps the log at 60, newest first', async () => {
    for (let i = 0; i < 65; i++) {
      await beatRedis('judge-worker', `2026-09-09T14:${String(i).padStart(2, '0')}:00.000Z`, { i });
    }
    const log = await readHeartbeatLog('judge-worker');
    expect(log).toHaveLength(HB_LOG_LEN);
    expect(log[0]).toEqual({ name: 'judge-worker', at: '2026-09-09T14:64:00.000Z', detail: { i: 64 } });
    expect(log[59]).toEqual({ name: 'judge-worker', at: '2026-09-09T14:05:00.000Z', detail: { i: 5 } });
    expect(await readHeartbeatLog('judge-worker', 3)).toHaveLength(3);
  });

  it('accepts the names the Postgres CHECK rejects', async () => {
    expect(WATCH_NAMES).toContain('daily-scans');
    expect(WATCH_NAMES).toContain('market-morning');
    expect(WATCH_NAMES).toContain('intraday-prices');
    expect(await beatRedis('daily-scans', '2026-09-09T13:15:00.000Z', {})).toBe(true);
    expect(redisMock.store!.has('helm:hb:daily-scans')).toBe(true);
  });
});

describe('readHeartbeatsRedis', () => {
  it('returns only the names that have beaten', async () => {
    await beatRedis('news-watch', '2026-09-09T14:00:00.000Z', { slot: 2 });
    await beatRedis('judge-worker', '2026-09-09T14:01:00.000Z', { idle: true });
    const m = await readHeartbeatsRedis();
    expect(m).not.toBeNull();
    expect([...m!.keys()].sort()).toEqual(['judge-worker', 'news-watch']);
    expect(m!.get('news-watch')).toEqual({ name: 'news-watch', at: '2026-09-09T14:00:00.000Z', detail: { slot: 2 } });
    expect(m!.has('edgar-watch')).toBe(false);
  });

  it('is an empty map, not null, when Redis answers with nothing', async () => {
    const m = await readHeartbeatsRedis();
    expect(m).not.toBeNull();
    expect(m!.size).toBe(0);
  });
});

describe('without Redis', () => {
  it('unconfigured: beat false, read null, log empty', async () => {
    redisMock.store = null;
    expect(await beatRedis('edgar-watch', '2026-09-09T14:00:00.000Z', {})).toBe(false);
    expect(await readHeartbeatsRedis()).toBeNull();
    expect(await readHeartbeatLog('edgar-watch')).toEqual([]);
  });

  it('throwing: beat false, read null, log empty', async () => {
    await beatRedis('edgar-watch', '2026-09-09T14:00:00.000Z', {});
    redisMock.boom = true;
    expect(await beatRedis('edgar-watch', '2026-09-09T14:01:00.000Z', {})).toBe(false);
    expect(await readHeartbeatsRedis()).toBeNull();
    expect(await readHeartbeatLog('edgar-watch')).toEqual([]);
  });
});
