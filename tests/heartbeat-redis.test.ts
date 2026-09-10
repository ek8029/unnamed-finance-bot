import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  beatRedis, readHeartbeatsRedis, WATCH_NAMES, HB_TTL_S,
} from '@/lib/agent/heartbeat-redis';

// An in-memory Redis behind withRedis. `store` null = unconfigured (getRedis
// returned null); `boom` = every call throws, the way a dead Upstash would.
// Values are JSON round-tripped the way the real client serializes them, so a
// Date or an undefined inside detail changes shape here as it would in prod.
// `cmds` records every command that actually reached the fake server, in
// order, so a test can pin how many commands one beat costs.
const redisMock = vi.hoisted(() => ({
  store: new Map<string, unknown>() as Map<string, unknown> | null,
  ttl: new Map<string, number>(),
  cmds: [] as string[],
  boom: false,
}));
vi.mock('@/lib/redis', () => {
  const guard = () => { if (redisMock.boom) throw new Error('redis down'); };
  const wire = (v: unknown) => JSON.parse(JSON.stringify(v));
  const r = {
    set: async (k: string, v: unknown, opts?: { ex?: number }) => {
      guard(); redisMock.cmds.push('set'); redisMock.store!.set(k, wire(v)); if (opts?.ex) redisMock.ttl.set(k, opts.ex); return 'OK';
    },
    mget: async (...keys: string[]) => { guard(); redisMock.cmds.push('mget'); return keys.map((k) => redisMock.store!.get(k) ?? null); },
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
  redisMock.ttl.clear();
  redisMock.cmds.length = 0;
  redisMock.boom = false;
});

describe('beatRedis', () => {
  it('writes the current key with a 48 h TTL, in one command', async () => {
    expect(await beatRedis('edgar-watch', '2026-09-09T14:00:00.000Z', { fetched: 3, skipped: undefined })).toBe(true);
    // undefined does not survive the wire: the read-back shape is what production sees.
    expect(redisMock.store!.get('helm:hb:edgar-watch')).toEqual({ at: '2026-09-09T14:00:00.000Z', detail: { fetched: 3 } });
    expect(redisMock.ttl.get('helm:hb:edgar-watch')).toBe(HB_TTL_S);
    // The whole beat, every beat: no list to push onto and none to trim.
    expect(redisMock.cmds).toEqual(['set']);
  });

  it('the latest beat replaces the one before it', async () => {
    await beatRedis('news-watch', '2026-09-09T14:00:00.000Z', { inserted: 1 });
    await beatRedis('news-watch', '2026-09-09T14:05:00.000Z', { inserted: 0 });
    expect(redisMock.store!.get('helm:hb:news-watch')).toEqual({ at: '2026-09-09T14:05:00.000Z', detail: { inserted: 0 } });
    expect(redisMock.cmds).toEqual(['set', 'set']);
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
  it('unconfigured: beat false, read null', async () => {
    redisMock.store = null;
    expect(await beatRedis('edgar-watch', '2026-09-09T14:00:00.000Z', {})).toBe(false);
    expect(await readHeartbeatsRedis()).toBeNull();
  });

  it('throwing: beat false, read null', async () => {
    await beatRedis('edgar-watch', '2026-09-09T14:00:00.000Z', {});
    redisMock.boom = true;
    expect(await beatRedis('edgar-watch', '2026-09-09T14:01:00.000Z', {})).toBe(false);
    expect(await readHeartbeatsRedis()).toBeNull();
  });
});
