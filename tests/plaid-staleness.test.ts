import { describe, expect, it } from 'vitest';
import { evaluateProviderFreshness, STALE_AFTER_DAYS } from '../lib/plaid-staleness';

// The real case: itemGet on 2026-09-22 for an Edward Jones item.
const FROZEN = {
  investments: { last_successful_update: '2026-07-30T14:16:05.962Z', last_failed_update: '2026-08-10T01:03:31.714Z' },
  transactions: { last_successful_update: '2026-07-31T02:45:46.106Z', last_failed_update: '2026-08-10T01:03:31.714Z' },
};
const NOW = new Date('2026-09-22T13:00:00Z');

describe('evaluateProviderFreshness', () => {
  it('flags the eight-week-frozen Edward Jones item and names both dates', () => {
    const v = evaluateProviderFreshness(FROZEN, NOW);
    expect(v.stale).toBe(true);
    if (!v.stale) return;
    expect(v.lastSuccessfulUpdate).toBe('2026-07-30T14:16:05.962Z');
    expect(v.ageDays).toBeGreaterThan(50);
    expect(v.reason).toContain('2026-07-30');
    expect(v.reason).toContain('failing since 2026-08-10');
  });

  it('leaves an item updated this morning alone', () => {
    const v = evaluateProviderFreshness(
      { investments: { last_successful_update: '2026-09-22T10:12:31Z', last_failed_update: null } },
      NOW,
    );
    expect(v.stale).toBe(false);
  });

  it('survives a long weekend plus a holiday without flagging', () => {
    // Friday update, judged the following Wednesday after a Monday holiday.
    const v = evaluateProviderFreshness(
      { investments: { last_successful_update: '2026-09-04T20:00:00Z' } },
      new Date('2026-09-09T13:00:00Z'),
    );
    expect(v.stale).toBe(false);
  });

  it('flags on the first day past the threshold', () => {
    const last = new Date(NOW.getTime() - (STALE_AFTER_DAYS + 1) * 86_400_000).toISOString();
    const v = evaluateProviderFreshness({ investments: { last_successful_update: last } }, NOW);
    expect(v.stale).toBe(true);
  });

  it('judges investments first and transactions only as a fallback', () => {
    const v = evaluateProviderFreshness(
      {
        investments: { last_successful_update: '2026-09-22T09:00:00Z' },
        transactions: { last_successful_update: '2026-01-01T00:00:00Z' },
      },
      NOW,
    );
    expect(v.stale).toBe(false);

    const w = evaluateProviderFreshness(
      { investments: null, transactions: { last_successful_update: '2026-01-01T00:00:00Z' } },
      NOW,
    );
    expect(w.stale).toBe(true);
  });

  it('does not call a status with no timestamps stale', () => {
    expect(evaluateProviderFreshness(undefined, NOW).stale).toBe(false);
    expect(evaluateProviderFreshness({}, NOW).stale).toBe(false);
    expect(evaluateProviderFreshness({ investments: { last_successful_update: null } }, NOW).stale).toBe(false);
    expect(evaluateProviderFreshness({ investments: { last_successful_update: 'not a date' } }, NOW).stale).toBe(false);
  });

  it('describes a frozen feed without a newer failure as simply not returning fresh data', () => {
    const v = evaluateProviderFreshness(
      { investments: { last_successful_update: '2026-07-30T14:16:05Z', last_failed_update: '2026-07-01T00:00:00Z' } },
      NOW,
    );
    expect(v.stale).toBe(true);
    if (v.stale) expect(v.reason).not.toContain('failing since');
  });
});
