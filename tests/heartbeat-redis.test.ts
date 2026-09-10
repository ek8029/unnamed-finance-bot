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
  // 'full' is the real reply, one entry per command. 'short' is truncated, so
  // the length is missing; 'stringy' carries it as a string, which `<=` would
  // happily coerce. Both must leave the list maintenance alone.
  execShape: 'full' as 'full' | 'short' | 'stringy',
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
      p.exec = async () => {
        guard();
        const out: unknown[] = [];
        for (const q of queued) out.push(await q());
        if (redisMock.execShape === 'short') return out.slice(0, 1);
        if (redisMock.execShape === 'stringy') return [out[0], String(out[1])];
        return out;
      };
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
  redisMock.execShape = 'full';
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

  it('arms the log lifetime on a fresh key and re-arms it on every beat below the cap', async () => {
    // The EXPIRE is the only thing that ever gives the log key a TTL, so the
    // beat that created it has to pay for one.
    await beatRedis('news-watch', '2026-09-09T14:00:00.000Z', {});
    expect(redisMock.cmds).toEqual(['set', 'lpush', 'expire']);

    // And so does every beat while the list is still short, or a watcher that
    // never reaches the cap would lose its log 48 h after the first beat.
    redisMock.cmds.length = 0;
    await beatRedis('news-watch', '2026-09-09T14:05:00.000Z', {});
    expect(redisMock.cmds).toEqual(['set', 'lpush', 'expire']);

    // The last beat below the cap still arms it.
    for (let i = 3; i < HB_LOG_LEN; i++) await beatRedis('news-watch', `2026-09-09T15:${String(i).padStart(2, '0')}:00.000Z`, {});
    redisMock.cmds.length = 0;
    await beatRedis('news-watch', '2026-09-09T16:00:00.000Z', {});
    expect(redisMock.lists.get('helm:hb:news-watch:log')).toHaveLength(HB_LOG_LEN);
    expect(redisMock.cmds).toEqual(['set', 'lpush', 'expire']);
  });

  it('costs two commands once the list is past the cap', async () => {
    for (let i = 1; i <= HB_LOG_LEN; i++) await beatRedis('news-watch', `2026-09-09T14:${String(i).padStart(2, '0')}:00.000Z`, { i });

    redisMock.cmds.length = 0;
    await beatRedis('news-watch', '2026-09-09T15:01:00.000Z', { i: 61 });
    expect(redisMock.cmds).toEqual(['set', 'lpush']);

    redisMock.cmds.length = 0;
    await beatRedis('news-watch', '2026-09-09T15:02:00.000Z', { i: 62 });
    expect(redisMock.cmds).toEqual(['set', 'lpush']);
  });

  it('skips both follow-ups when the exec reply does not carry a numeric length', async () => {
    // A truncated reply: the length is simply missing. The beat itself landed,
    // so it still reports true, and the list maintenance is not guessed at.
    redisMock.execShape = 'short';
    expect(await beatRedis('news-watch', '2026-09-09T14:00:00.000Z', { slot: 1 })).toBe(true);
    expect(redisMock.cmds).toEqual(['set', 'lpush']);
    expect(redisMock.store!.get('helm:hb:news-watch')).toEqual({ at: '2026-09-09T14:00:00.000Z', detail: { slot: 1 } });

    // A length that arrives as a string. A bare `<=` would coerce this and
    // fire an EXPIRE off a value the client never promised.
    redisMock.execShape = 'stringy';
    redisMock.cmds.length = 0;
    expect(await beatRedis('news-watch', '2026-09-09T14:01:00.000Z', { slot: 2 })).toBe(true);
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

  it('a once-a-day watcher keeps a growing log, because every beat re-arms the 48 h TTL', async () => {
    // daily-scans beats once a day and never comes near the cap. Its log key
    // has to be re-armed each time or it dies 48 h after the first beat and
    // the presence route, which asks for twenty entries, sees one or two.
    for (let day = 9; day <= 30; day++) {
      redisMock.cmds.length = 0;
      redisMock.ttl.delete('helm:hb:daily-scans:log');
      expect(await beatRedis('daily-scans', `2026-09-${String(day).padStart(2, '0')}T13:15:00.000Z`, { day })).toBe(true);
      // Every single beat pays for the EXPIRE and the TTL is back to 48 h,
      // so the key never reaches the end of its life while the watcher runs.
      expect(redisMock.cmds).toEqual(['set', 'lpush', 'expire']);
      expect(redisMock.ttl.get('helm:hb:daily-scans:log')).toBe(HB_TTL_S);
    }
    const log = await readHeartbeatLog('daily-scans', 20);
    expect(log).toHaveLength(20);
    expect(log[0].detail).toEqual({ day: 30 });
  });

  it('a failed EXPIRE is re-armed by the next beat, so the key cannot stay TTL-less', async () => {
    redisMock.boomFollowups = true;
    expect(await beatRedis('market-morning', '2026-09-09T12:45:00.000Z', {})).toBe(true);
    expect(redisMock.cmds).toEqual(['set', 'lpush', 'expire']);
    expect(redisMock.ttl.has('helm:hb:market-morning:log')).toBe(false);

    redisMock.boomFollowups = false;
    redisMock.cmds.length = 0;
    await beatRedis('market-morning', '2026-09-10T12:45:00.000Z', {});
    expect(redisMock.cmds).toEqual(['set', 'lpush', 'expire']);
    expect(redisMock.ttl.get('helm:hb:market-morning:log')).toBe(HB_TTL_S);
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
