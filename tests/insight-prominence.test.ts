// tests/insight-prominence.test.ts
// The three states a flagged insight can be in, and the copy for the quiet one.
// Evan, 2026-09-10: "Flag it once, if a user dismisses or acts on it get rid of
// it, if not just keep a note that it's there and don't perpetually scream it
// into a user's face."
import { describe, it, expect } from 'vitest';
import {
  INSIGHT_ANNOUNCE_GRACE_MS,
  STANDING_COPY,
  insightProminence,
  standingLine,
} from '@/lib/insight-prominence';
import { hasAdviceLanguage } from '@/lib/investigation-memo';

const NOW = Date.parse('2026-09-10T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const HOUR = 3_600_000;

describe('insightProminence with a watermark', () => {
  const seen = ago(24 * HOUR);

  it('raised after the watermark: announced', () => {
    expect(insightProminence(ago(2 * HOUR), seen, NOW)).toBe('announced');
  });

  it('raised before the watermark: standing, however recent the watermark is', () => {
    expect(insightProminence(ago(48 * HOUR), seen, NOW)).toBe('standing');
  });

  it('a flag older than the grace window is still announced if it postdates the watermark', () => {
    // The whole point of the watermark: someone who has not visited in a month
    // meets a three-week-old flag as new, because they have never seen it.
    const monthAgo = ago(30 * 24 * HOUR);
    expect(insightProminence(ago(21 * 24 * HOUR), monthAgo, NOW)).toBe('announced');
  });

  it('raised at exactly the watermark: standing, since the read included it', () => {
    expect(insightProminence(seen, seen, NOW)).toBe('standing');
  });
});

describe('insightProminence with no watermark (the grace window)', () => {
  it('inside the window: announced', () => {
    expect(insightProminence(ago(INSIGHT_ANNOUNCE_GRACE_MS - HOUR), null, NOW)).toBe('announced');
  });

  it('outside the window: standing, which is how 100+ old open rows stay quiet with no backfill', () => {
    expect(insightProminence(ago(INSIGHT_ANNOUNCE_GRACE_MS + HOUR), null, NOW)).toBe('standing');
  });

  it('the window is 72 hours, the Updates card horizon and the Friday-to-Monday cron gap', () => {
    expect(INSIGHT_ANNOUNCE_GRACE_MS).toBe(72 * HOUR);
  });

  it('an unparsable watermark falls back to the window rather than announcing everything', () => {
    expect(insightProminence(ago(2 * HOUR), 'not a date', NOW)).toBe('announced');
    expect(insightProminence(ago(10 * 24 * HOUR), 'not a date', NOW)).toBe('standing');
  });

  it('a missing or unparsable created_at cannot be shown to be new, so it is standing', () => {
    expect(insightProminence(null, null, NOW)).toBe('standing');
    expect(insightProminence('', ago(HOUR), NOW)).toBe('standing');
    expect(insightProminence('nonsense', ago(HOUR), NOW)).toBe('standing');
  });
});

describe('standingLine', () => {
  it('reads as a count of open items', () => {
    expect(standingLine(1)).toBe('1 still open');
    expect(standingLine(12)).toBe('12 still open');
  });
});

describe('STANDING_COPY house rules', () => {
  const strings = Object.values(STANDING_COPY);

  it('has strings to sweep', () => {
    expect(strings.length).toBeGreaterThan(0);
    for (const s of strings) expect(typeof s).toBe('string');
  });

  it('no em dashes', () => {
    for (const s of strings) expect(s).not.toMatch(/—/);
  });

  it('no exclamation marks', () => {
    for (const s of strings) expect(s).not.toMatch(/!/);
  });

  it('no advice language', () => {
    for (const s of strings) expect(hasAdviceLanguage(s)).toBe(false);
  });

  it('the composed count line obeys the same rules', () => {
    const line = `${standingLine(6)}. ${STANDING_COPY.seen}`;
    expect(line).not.toMatch(/[—!]/);
    expect(hasAdviceLanguage(line)).toBe(false);
  });
});
