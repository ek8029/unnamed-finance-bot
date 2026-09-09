import { describe, it, expect } from 'vitest';
import {
  TICK_FRESH_MS, to4dp, holdingNeedsUpdate, changedPrices, securitiesUpsertRows, etDay, pricesFreshFromHeartbeat,
  parsePrevCloseCache, stalePrevCloseTickers,
} from '@/lib/market/tick-diff';

// 2026-09-09 is EDT: midnight ET is 04:00Z.
const SESSION_START = '2026-09-09T04:00:00.000Z';

describe('holdingNeedsUpdate', () => {
  it('skips a row whose stored price equals the print and was touched this session', () => {
    expect(holdingNeedsUpdate({ current_price: '150.2500', last_updated_at: '2026-09-09T14:05:00.000Z' }, 150.25, SESSION_START)).toBe(false);
  });

  it('rewrites when the print differs from the stored price', () => {
    expect(holdingNeedsUpdate({ current_price: 150.25, last_updated_at: '2026-09-09T14:05:00.000Z' }, 150.26, SESSION_START)).toBe(true);
  });

  it('compares at the four decimals the column stores, so a long print does not rewrite the row every tick', () => {
    // holdings.current_price is NUMERIC(15, 4): 12.3456789 is stored as 12.3457.
    expect(holdingNeedsUpdate({ current_price: '12.3457', last_updated_at: '2026-09-09T14:05:00.000Z' }, 12.3456789, SESSION_START)).toBe(false);
    expect(holdingNeedsUpdate({ current_price: '12.3458', last_updated_at: '2026-09-09T14:05:00.000Z' }, 12.3457, SESSION_START)).toBe(true);
    expect(to4dp(12.3456789)).toBe(12.3457);
    expect(to4dp(150.25)).toBe(150.25);
  });

  it('rewrites an equal price when the row was last touched before this session', () => {
    expect(holdingNeedsUpdate({ current_price: 150.25, last_updated_at: '2026-09-08T20:05:00.000Z' }, 150.25, SESSION_START)).toBe(true);
    // 23:59 ET the previous evening is 03:59Z: still last session.
    expect(holdingNeedsUpdate({ current_price: 150.25, last_updated_at: '2026-09-09T03:59:59.000Z' }, 150.25, SESSION_START)).toBe(true);
  });

  it('rewrites when the row has no stored price or no stamp', () => {
    expect(holdingNeedsUpdate({ current_price: null, last_updated_at: '2026-09-09T14:05:00.000Z' }, 150.25, SESSION_START)).toBe(true);
    expect(holdingNeedsUpdate({ current_price: 150.25, last_updated_at: null }, 150.25, SESSION_START)).toBe(true);
    expect(holdingNeedsUpdate({ current_price: 'abc', last_updated_at: '2026-09-09T14:05:00.000Z' }, 150.25, SESSION_START)).toBe(true);
  });
});

describe('changedPrices', () => {
  it('drops equal prints, keeps new and different ones', () => {
    const changed = changedPrices({ AAPL: 150, MSFT: 300 }, new Map([['AAPL', 150], ['MSFT', 301], ['NVDA', 900]]));
    expect([...changed.entries()]).toEqual([['MSFT', 301], ['NVDA', 900]]);
  });

  it('treats an empty cache as everything changed', () => {
    expect(changedPrices({}, new Map([['AAPL', 150]])).size).toBe(1);
  });
});

describe('prior close cache', () => {
  it('parses the dated shape and drops anything else, so an old-shape value is a miss rather than a crash', () => {
    const parsed = parsePrevCloseCache({ AAPL: { close: 140, date: '2026-09-08' }, MSFT: 290, NVDA: { close: 'x', date: '2026-09-08' }, TSLA: { close: 200 } });
    expect([...parsed.entries()]).toEqual([['AAPL', { close: 140, date: '2026-09-08' }]]);
    expect(parsePrevCloseCache(null).size).toBe(0);
    expect(parsePrevCloseCache('junk').size).toBe(0);
    expect(parsePrevCloseCache([1, 2]).size).toBe(0);
  });

  it('flags an entry dated before the newest close in the map as stale', () => {
    const map = parsePrevCloseCache({
      AAPL: { close: 140, date: '2026-09-08' },
      MSFT: { close: 290, date: '2026-09-08' },
      ORCL: { close: 100, date: '2026-09-04' },
    });
    expect(stalePrevCloseTickers(map)).toEqual(['ORCL']);
  });

  it('flags nothing when every entry shares the newest date, or the map is empty', () => {
    expect(stalePrevCloseTickers(parsePrevCloseCache({ AAPL: { close: 140, date: '2026-09-08' } }))).toEqual([]);
    expect(stalePrevCloseTickers(new Map())).toEqual([]);
  });
});

describe('securitiesUpsertRows', () => {
  it('builds a row only for tickers with a securities id', () => {
    const rows = securitiesUpsertRows(new Map([['AAPL', 150], ['ZZZZ', 1]]), new Map([['AAPL', 'sec-1']]), 'now');
    expect(rows).toEqual([{ id: 'sec-1', current_price: 150, last_updated_at: 'now' }]);
  });
});

describe('etDay', () => {
  it('rolls a late UTC instant back to the previous New York day in daylight time', () => {
    // 02:30Z on Sept 10 is 22:30 EDT on Sept 9.
    expect(etDay(new Date('2026-09-10T02:30:00Z'))).toEqual({ day: '2026-09-09', startIso: '2026-09-09T04:00:00.000Z' });
  });

  it('rolls a late UTC instant back to the previous New York day in standard time', () => {
    // 03:30Z on Jan 10 is 22:30 EST on Jan 9.
    expect(etDay(new Date('2026-01-10T03:30:00Z'))).toEqual({ day: '2026-01-09', startIso: '2026-01-09T05:00:00.000Z' });
  });

  it('keeps a midday instant on its own day', () => {
    expect(etDay(new Date('2026-09-09T15:00:00Z')).day).toBe('2026-09-09');
  });
});

describe('pricesFreshFromHeartbeat', () => {
  const now = Date.parse('2026-09-09T15:00:00.000Z');

  it('is null without a heartbeat, so the caller falls back to the stamp', () => {
    expect(pricesFreshFromHeartbeat(undefined, now)).toBeNull();
    expect(pricesFreshFromHeartbeat({ at: 'not a date' }, now)).toBeNull();
  });

  it('is fresh inside ten minutes of the last tick and stale past it', () => {
    expect(pricesFreshFromHeartbeat({ at: '2026-09-09T14:55:00.000Z' }, now)).toBe(true);
    expect(pricesFreshFromHeartbeat({ at: new Date(now - TICK_FRESH_MS).toISOString() }, now)).toBe(false);
    expect(pricesFreshFromHeartbeat({ at: '2026-09-09T14:30:00.000Z' }, now)).toBe(false);
  });
});
