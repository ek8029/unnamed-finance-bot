import { describe, it, expect } from 'vitest';
import { describeBeat, WATCHER_LABEL } from '@/lib/agent/heartbeat-line';
import { WATCH_NAMES, type Heartbeat, type WatchName } from '@/lib/agent/heartbeat-redis';
import { hasAdviceLanguage } from '@/lib/investigation-memo';

// A fixed clock so the lines are byte-stable; the component passes its ET formatter.
const clock = () => '14:32';
const at = '2026-09-09T18:32:00.000Z';
const hb = (name: WatchName, detail: Record<string, unknown>): Heartbeat => ({ name, at, detail });

// Every shape each watcher's beat(...) call site writes, zero and non-zero.
const SHAPES: Heartbeat[] = [
  hb('edgar-watch', { dry: false, fetched: 3, watched: 40, new: 0, queued: 0, hourly: 0, skipped: 0, skippedSeen: 12, errors: 0, ms: 410 }),
  hb('edgar-watch', { dry: false, fetched: 3, watched: 40, new: 2, queued: 2, hourly: 0, skipped: 0, skippedSeen: 0, errors: 0, ms: 410 }),
  hb('edgar-watch', { dry: false, fetched: 3, watched: 40, new: 1, queued: 0, hourly: 1, skipped: 0, skippedSeen: 0, errors: 1, ms: 410 }),
  hb('edgar-watch', { dry: true, fetched: 3, watched: 40, new: 0, queued: 0, hourly: 0, skipped: 0, skippedSeen: 0, errors: 0, ms: 410 }),
  hb('news-watch', { slot: 3, slice: 20, tickers: 130, inserted: 0, about: 0, queued: 0, classifierCostUsd: 0, errors: 0, ms: 900 }),
  hb('news-watch', { slot: 3, slice: 20, tickers: 130, inserted: 3, about: 1, queued: 1, classifierCostUsd: 0.001, errors: 0, ms: 900 }),
  hb('news-watch', { slot: 3, slice: 20, tickers: 130, inserted: 1, about: 0, queued: 0, classifierCostUsd: 0, errors: 2, ms: 900 }),
  hb('judge-worker', { idle: true, wakeAt: '2026-09-09T19:00:00.000Z', ms: 12 }),
  hb('judge-worker', { claimed: 0, done: 0, failed: 0, capped: 0, ranToday: 4, costUsd: 0, spentTodayUsd: 0.4, ms: 30 }),
  hb('judge-worker', { claimed: 2, done: 2, failed: 0, capped: 0, ranToday: 6, costUsd: 0.02, spentTodayUsd: 0.42, ms: 3000 }),
  hb('judge-worker', { claimed: 2, done: 1, failed: 1, capped: 0, ranToday: 6, costUsd: 0.01, spentTodayUsd: 0.42, ms: 3000 }),
  hb('judge-worker', { claimed: 0, done: 0, failed: 0, capped: 0, costUsd: 0, spentTodayUsd: 5, spendCapReached: true, ms: 5 }),
  hb('intraday-prices', { tickers: 130, priced: 130, updatedHoldings: 0, skippedHoldings: 130, updatedSecurities: 0, prevCloseSource: 'redis', ms: 2000 }),
  hb('intraday-prices', { tickers: 130, priced: 130, updatedHoldings: 12, skippedHoldings: 118, updatedSecurities: 12, prevCloseSource: 'redis', ms: 2000 }),
  hb('daily-scans', { users: 40, insights: 0, reconnectPushes: 0, ms: 90000 }),
  hb('daily-scans', { users: 40, insights: 3, reconnectPushes: 1, ms: 90000 }),
  hb('market-morning', { pricesRefreshed: 0, errors: 0, ms: 100 }),
  hb('market-morning', { pricesRefreshed: 130, errors: 0, ms: 60000 }),
  hb('market-morning', { pricesRefreshed: 1, errors: 1, ms: 60000 }),
];

describe('describeBeat', () => {
  it('edgar-watch: nothing new, filings with reads queued, an error, a dry run', () => {
    expect(describeBeat(SHAPES[0], clock)).toBe('EDGAR checked 14:32, nothing new');
    expect(describeBeat(SHAPES[1], clock)).toBe('EDGAR checked 14:32, 2 filings, 2 reads queued');
    expect(describeBeat(SHAPES[2], clock)).toBe('EDGAR checked 14:32, 1 filing, none queued, 1 error');
    expect(describeBeat(SHAPES[3], clock)).toBe('EDGAR dry run 14:32');
  });

  it('news-watch: nothing new, items taken in, errors', () => {
    expect(describeBeat(SHAPES[4], clock)).toBe('News checked 14:32, nothing new');
    expect(describeBeat(SHAPES[5], clock)).toBe('News checked 14:32, 3 items taken in');
    expect(describeBeat(SHAPES[6], clock)).toBe('News checked 14:32, 1 item taken in, 2 errors');
  });

  it('judge-worker: idle vs ran, a failure, the spend cap', () => {
    expect(describeBeat(SHAPES[7], clock)).toBe('Judge idle 14:32');
    expect(describeBeat(SHAPES[8], clock)).toBe('Judge ran 14:32, nothing new');
    expect(describeBeat(SHAPES[9], clock)).toBe('Judge ran 14:32, 2 done');
    expect(describeBeat(SHAPES[10], clock)).toBe('Judge ran 14:32, 1 done, 1 failure');
    expect(describeBeat(SHAPES[11], clock)).toBe('Judge ran 14:32, nothing new, spend cap reached');
  });

  it('intraday-prices: nothing new vs names moved', () => {
    expect(describeBeat(SHAPES[12], clock)).toBe('Prices checked 14:32, nothing new');
    expect(describeBeat(SHAPES[13], clock)).toBe('Prices checked 14:32, 12 names moved, 118 unchanged');
  });

  it('daily-scans: books with nothing flagged vs items flagged', () => {
    expect(describeBeat(SHAPES[14], clock)).toBe('Scans ran 14:32, 40 books, nothing new');
    expect(describeBeat(SHAPES[15], clock)).toBe('Scans ran 14:32, 40 books, 3 items flagged');
  });

  it('market-morning: nothing new, prices refreshed, an error', () => {
    expect(describeBeat(SHAPES[16], clock)).toBe('Morning prices ran 14:32, nothing new');
    expect(describeBeat(SHAPES[17], clock)).toBe('Morning prices ran 14:32, 130 prices refreshed');
    expect(describeBeat(SHAPES[18], clock)).toBe('Morning prices ran 14:32, 1 price refreshed, 1 error');
  });

  it('missing, empty or malformed detail falls back to "<Label> checked <time>" without throwing', () => {
    for (const name of WATCH_NAMES) {
      expect(describeBeat(hb(name, {}), clock)).toBe(`${WATCHER_LABEL[name]} checked 14:32`);
      expect(describeBeat({ name, at, detail: null as unknown as Record<string, unknown> }, clock)).toBe(`${WATCHER_LABEL[name]} checked 14:32`);
      expect(describeBeat(hb(name, { new: 'two', inserted: NaN, done: -1, updatedHoldings: 'x', users: null, pricesRefreshed: undefined }), clock)).toBe(`${WATCHER_LABEL[name]} checked 14:32`);
    }
  });

  it('uses the caller\'s clock for the time', () => {
    expect(describeBeat(SHAPES[0], (iso) => `at ${iso}`)).toBe(`EDGAR checked at ${at}, nothing new`);
  });

  it('every line: no em dash, no exclamation mark, no advice language', () => {
    const lines = [
      ...SHAPES.map((s) => describeBeat(s, clock)),
      ...WATCH_NAMES.map((name) => describeBeat(hb(name, {}), clock)),
    ];
    expect(lines.length).toBeGreaterThan(20);
    for (const line of lines) {
      expect(line, line).not.toMatch(/[—!]/);
      expect(hasAdviceLanguage(line), line).toBe(false);
    }
  });
});
