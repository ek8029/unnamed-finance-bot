import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  beatRedis, readHeartbeatsRedis, readHeartbeatLog, WATCH_NAMES, HB_LOG_LEN, HB_TTL_S,
} from '@/lib/agent/heartbeat-redis';

// An in-memory Redis behind withRedis. `store` null = unconfigured (getRedis
// returned null); `boom` = every call throws, the way a dead Upstash would.
// Values are JSON round-tripped the way the real client serializes them, so a
// Date or an undefined inside detail changes shape here as it would in prod.
// multi() queues commands and exec() applies them as a unit, or throws as one.
// `cmds` records every command that actually reached the fake server, in
// order, so a test can pin how many commands one beat costs.
// `boomFollowups` fails only EXPIRE and LTRIM, the way a throttled follow-up
// call would, while the beat itself still lands.
const redisMock = vi.hoisted(() => ({
  store: new Map<string, unknown>() as Map<string, unknown> | null,
  lists: new Map<string, unknown[]>(),
  ttl: new Map<string, number>(),
  cmds: [] as string[],
  boom: false,
  boomFollowups: false,
}));
vi.mock('@/lib/redis', () => {
  const guard = () => { if (redisMock.boom) throw new Error('redis down'); };
  const wire = (v: unknown) => JSON.parse(JSON.stringify(v));
  const r = {
    set: async (k: string, v: unknown, opts?: { ex?: number }) => {
      guard(); redisMock.cmds.push('set'); redisMock.store!.set(k, wire(v)); if (opts?.ex) redisMock.ttl.set(k, opts.ex); return 'OK';
    },
    mget: async (...keys: string[]) => { guard(); redisMock.cmds.push('mget'); return keys.map((k) => redisMock.store!.get(k) ?? null); },
    lpush: async (k: string, ...vals: unknown[]) => {
      guard();
      redisMock.cmds.push('lpush');
      const l = redisMock.lists.get(k) ?? [];
      l.unshift(...vals.map(wire).reverse());
      redisMock.lists.set(k, l);
      return l.length;
    },
    ltrim: async (k: string, start: number, stop: number) => {
      guard();
      redisMock.cmds.push('ltrim');
      if (redisMock.boomFollowups) throw new Error('redis throttled');
      const l = redisMock.lists.get(k) ?? [];
      redisMock.lists.set(k, l.slice(start, stop + 1));
      return 'OK';
    },
    lrange: async (k: string, start: number, stop: number) => {
      guard();
      redisMock.cmds.push('lrange');
      const l = redisMock.lists.get(k) ?? [];
      return l.slice(start, stop + 1);
    },
    expire: async (k: string, s: number) => {
      guard();
      redisMock.cmds.push('expire');
      if (redisMock.boomFollowups) throw new Error('redis throttled');
      redisMock.ttl.set(k, s);
      return 1;
    },
    multi: () => {
      const queued: (() => Promise<unknown>)[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p: any = {};
      for (const name of ['set', 'lpush', 'ltrim', 'expire'] as const) {
        p[name] = (...args: unknown[]) => { queued.push(() => (r[name] as (...a: unknown[]) => Promise<unknown>)(...args)); return p; };
      }
      p.exec = async () => { guard(); const out = []; for (const q of queued) out.push(await q()); return out; };
      return p;
    },
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
  redisMock.cmds.length = 0;
  redisMock.boom = false;
  redisMock.boomFollowups = false;
});

describe('beatRedis', () => {
  it('writes the current key with a 48 h TTL and pushes onto the log', async () => {
    expect(await beatRedis('edgar-watch', '2026-09-09T14:00:00.000Z', { fetched: 3, skipped: undefined })).toBe(true);
    // undefined does not survive the wire: the read-back shape is what production sees.
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

  it('costs three commands on a fresh log key and two on every beat after', async () => {
    await beatRedis('news-watch', '2026-09-09T14:00:00.000Z', {});
    // The EXPIRE is the only thing that ever gives the log key a TTL, so the
    // beat that created it has to pay for one.
    expect(redisMock.cmds).toEqual(['set', 'lpush', 'expire']);

    redisMock.cmds.length = 0;
    await beatRedis('news-watch', '2026-09-09T14:05:00.000Z', {});
    expect(redisMock.cmds).toEqual(['set', 'lpush']);

    redisMock.cmds.length = 0;
    await beatRedis('news-watch', '2026-09-09T14:10:00.000Z', {});
    expect(redisMock.cmds).toEqual(['set', 'lpush']);
  });

  it('trims past the threshold, not every beat, and the slack is invisible to readers', async () => {
    for (let i = 1; i <= HB_LOG_LEN + 20; i++) {
      await beatRedis('judge-worker', `2026-09-09T14:00:${String(i).padStart(2, '0')}.000Z`, { i });
    }
    // Eighty entries and not one LTRIM: the list is allowed to run long.
    expect(redisMock.cmds.filter((c) => c === 'ltrim')).toEqual([]);
    expect(redisMock.lists.get('helm:hb:judge-worker:log')).toHaveLength(HB_LOG_LEN + 20);
    // A reader still sees only the newest sixty, in order.
    const log = await readHeartbeatLog('judge-worker');
    expect(log).toHaveLength(HB_LOG_LEN);
    expect(log[0].detail).toEqual({ i: HB_LOG_LEN + 20 });

    redisMock.cmds.length = 0;
    await beatRedis('judge-worker', '2026-09-09T14:01:21.000Z', { i: 81 });
    expect(redisMock.cmds).toEqual(['set', 'lpush', 'ltrim']);
    expect(redisMock.lists.get('helm:hb:judge-worker:log')).toHaveLength(HB_LOG_LEN);
  });

  it('a once-a-day watcher gets a TTL on its log key every time the key is recreated', async () => {
    expect(await beatRedis('daily-scans', '2026-09-09T13:15:00.000Z', {})).toBe(true);
    expect(redisMock.ttl.get('helm:hb:daily-scans:log')).toBe(HB_TTL_S);

    // The next beat is inside the 48 h window: the key still exists, the list
    // grows to two, and no EXPIRE is paid for.
    redisMock.cmds.length = 0;
    await beatRedis('daily-scans', '2026-09-10T13:15:00.000Z', {});
    expect(redisMock.cmds).toEqual(['set', 'lpush']);

    // Now let both keys expire the way Redis would, and beat again. The list
    // is recreated at length one, so it is armed with a TTL again. It never
    // reaches the trim threshold, so this is its only source of one.
    redisMock.store!.delete('helm:hb:daily-scans');
    redisMock.lists.delete('helm:hb:daily-scans:log');
    redisMock.ttl.clear();
    redisMock.cmds.length = 0;
    await beatRedis('daily-scans', '2026-09-12T13:15:00.000Z', {});
    expect(redisMock.cmds).toEqual(['set', 'lpush', 'expire']);
    expect(redisMock.ttl.get('helm:hb:daily-scans:log')).toBe(HB_TTL_S);
  });

  it('still reports true when the follow-up EXPIRE or LTRIM throws', async () => {
    redisMock.boomFollowups = true;
    // Fresh key: the EXPIRE throws, the beat is already on Redis.
    expect(await beatRedis('edgar-watch', '2026-09-09T14:00:00.000Z', { fetched: 1 })).toBe(true);
    expect(redisMock.cmds).toEqual(['set', 'lpush', 'expire']);
    expect(redisMock.store!.get('helm:hb:edgar-watch')).toEqual({ at: '2026-09-09T14:00:00.000Z', detail: { fetched: 1 } });
    expect(redisMock.ttl.has('helm:hb:edgar-watch:log')).toBe(false);

    // Past the threshold: the LTRIM throws and the beat still reports true.
    for (let i = 2; i <= HB_LOG_LEN + 20; i++) {
      await beatRedis('edgar-watch', `2026-09-09T14:00:${String(i).padStart(2, '0')}.000Z`, { i });
    }
    redisMock.cmds.length = 0;
    expect(await beatRedis('edgar-watch', '2026-09-09T14:01:21.000Z', { i: 81 })).toBe(true);
    expect(redisMock.cmds).toEqual(['set', 'lpush', 'ltrim']);
    expect(redisMock.lists.get('helm:hb:edgar-watch:log')).toHaveLength(HB_LOG_LEN + 21);
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
