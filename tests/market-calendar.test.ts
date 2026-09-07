// tests/market-calendar.test.ts
// The brief skips the days the exchange does: weekends and NYSE holidays, both
// read in New York.
import { describe, it, expect } from 'vitest';
import { dateET, isTradingDay, isWeekendET, isMarketHolidayET } from '@/lib/market-calendar';

describe('market calendar', () => {
  it('reads the date in New York, not UTC', () => {
    expect(dateET(new Date('2026-09-08T03:00:00Z'))).toBe('2026-09-07'); // Monday 11 PM ET, Tuesday in UTC
    expect(dateET(new Date('2026-09-08T13:15:00Z'))).toBe('2026-09-08');
  });
  it('knows a holiday from a trading day', () => {
    expect(isTradingDay('2026-09-07')).toBe(false); // Labor Day
    expect(isTradingDay('2026-09-08')).toBe(true);
    expect(isTradingDay('2026-09-05')).toBe(false); // Saturday
    expect(isTradingDay('2026-11-26')).toBe(false); // Thanksgiving
    expect(isTradingDay('not a date')).toBe(false);
  });
  it('Labor Day at 9:15 AM ET is a holiday, the Tuesday after is not', () => {
    expect(isMarketHolidayET(new Date('2026-09-07T13:15:00Z'))).toBe(true);
    expect(isMarketHolidayET(new Date('2026-09-08T03:00:00Z'))).toBe(true);  // still Monday in New York
    expect(isMarketHolidayET(new Date('2026-09-08T13:15:00Z'))).toBe(false);
    expect(isMarketHolidayET(new Date('2026-09-05T13:15:00Z'))).toBe(false); // Saturday is a weekend, not a holiday
    expect(isWeekendET(new Date('2026-09-05T13:15:00Z'))).toBe(true);
  });
});
