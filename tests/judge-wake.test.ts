import { describe, it, expect } from 'vitest';
import { shouldWakeJudge, minIso, JUDGE_WAKE_KEY, JUDGE_SLEEP_MS } from '@/lib/agent/judge-wake';

const NOW = new Date('2026-09-09T14:00:00.000Z');

describe('shouldWakeJudge', () => {
  it('wakes when the flag is missing (unknown state, poll to be safe)', () => {
    expect(shouldWakeJudge(null, NOW)).toBe(true);
    expect(shouldWakeJudge(undefined, NOW)).toBe(true);
  });
  it('wakes when the flag time has arrived or passed', () => {
    expect(shouldWakeJudge('2026-09-09T13:59:59.000Z', NOW)).toBe(true);
    expect(shouldWakeJudge('2026-09-09T14:00:00.000Z', NOW)).toBe(true);
  });
  it('sleeps while the flag is in the future', () => {
    expect(shouldWakeJudge('2026-09-09T14:00:00.001Z', NOW)).toBe(false);
    expect(shouldWakeJudge('2026-09-10T14:00:00.000Z', NOW)).toBe(false);
  });
  it('wakes on garbage rather than sleeping on a value it cannot read', () => {
    expect(shouldWakeJudge('not a date', NOW)).toBe(true);
    expect(shouldWakeJudge('', NOW)).toBe(true);
  });
});

describe('minIso', () => {
  it('returns the earlier of two ISO strings', () => {
    expect(minIso('2026-09-09T15:00:00.000Z', '2026-09-09T14:00:00.000Z')).toBe('2026-09-09T14:00:00.000Z');
    expect(minIso('2026-09-09T13:00:00.000Z', '2026-09-09T14:00:00.000Z')).toBe('2026-09-09T13:00:00.000Z');
  });
  it('returns the right side when the left is missing or garbage', () => {
    expect(minIso(null, '2026-09-09T14:00:00.000Z')).toBe('2026-09-09T14:00:00.000Z');
    expect(minIso(undefined, '2026-09-09T14:00:00.000Z')).toBe('2026-09-09T14:00:00.000Z');
    expect(minIso('junk', '2026-09-09T14:00:00.000Z')).toBe('2026-09-09T14:00:00.000Z');
  });
});

describe('constants', () => {
  it('names the key and bounds the sleep to one hour', () => {
    expect(JUDGE_WAKE_KEY).toBe('agent:judge:wake');
    expect(JUDGE_SLEEP_MS).toBe(60 * 60 * 1000);
  });
});
