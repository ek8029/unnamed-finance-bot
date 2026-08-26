import { describe, it, expect } from 'vitest';
import { liveStatus } from '../lib/live-status';

describe('liveStatus', () => {
  const now = 1_000_000;

  it('is closed outside market hours whatever the last quote says', () => {
    expect(liveStatus(false, now - 1_000, now).state).toBe('closed');
    expect(liveStatus(false, null, now).state).toBe('closed');
  });

  it('is connecting until the first quote lands', () => {
    expect(liveStatus(true, null, now).state).toBe('connecting');
  });

  it('is live within the stale window and delayed past it', () => {
    expect(liveStatus(true, now - 15_000, now).state).toBe('live');
    expect(liveStatus(true, now - 61_000, now).state).toBe('delayed');
    expect(liveStatus(true, now - 5_000, now, 4_000).state).toBe('delayed');
  });

  it('labels carry no em dashes', () => {
    for (const s of [liveStatus(false, null, now), liveStatus(true, null, now), liveStatus(true, now, now), liveStatus(true, 0, now)]) {
      expect(s.label.includes('\u2014')).toBe(false);
    }
  });
});
