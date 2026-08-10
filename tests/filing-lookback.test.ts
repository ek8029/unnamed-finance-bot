import { describe, it, expect } from 'vitest';
import { filingSinceDate } from '@/lib/filing-window';

/**
 * Pins the filing lookback window.
 *
 * Background: the score-theses cron runs hourly on weekdays and `sinceDate`
 * sets the window to the last scan, so filings were being requested from EDGAR
 * over a window of a few hours. Companies file ~5 periodic reports a year, so
 * that window was empty on nearly every run. The corpus ended up 2,124 news
 * rows against 67 filing rows, 2.3% of source documents, while "grounded in
 * filings" was claimed publicly.
 */
describe('filingSinceDate', () => {
  const now = new Date('2026-08-10T12:00:00Z');
  // 120 days before 2026-08-10
  const WINDOW_START = '2026-04-12';

  it('widens a narrow incremental window to the full filing lookback', () => {
    // This is the bug case: the cron passes today, so filings were never found.
    expect(filingSinceDate('2026-08-10', now)).toBe(WINDOW_START);
  });

  it('asserts the naive version FAILS: it must not return the caller window', () => {
    // If someone "simplifies" this back to `since`, this test fails and the
    // 2.3%-filings regression is caught rather than shipped.
    const naive = '2026-08-10';
    expect(filingSinceDate(naive, now)).not.toBe(naive);
  });

  it('covers a full quarter, so every thesis sees its latest 10-Q', () => {
    const days =
      (Date.parse('2026-08-10') - Date.parse(filingSinceDate('2026-08-10', now))) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(92);
  });

  it('preserves an explicit historical backfill window', () => {
    // The demo seed passes an old `since`. Narrowing it to 120 days would
    // silently truncate the backfill.
    expect(filingSinceDate('2025-01-01', now)).toBe('2025-01-01');
  });

  it('returns the window start when the caller window is inside it', () => {
    expect(filingSinceDate('2026-07-01', now)).toBe(WINDOW_START);
  });

  it('is stable on the boundary', () => {
    expect(filingSinceDate(WINDOW_START, now)).toBe(WINDOW_START);
  });
});
