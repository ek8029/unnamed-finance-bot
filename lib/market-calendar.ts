// lib/market-calendar.ts
// When the US market is open, for the jobs that only make sense on a trading
// day: the morning brief, the session counts in the digest pack. Pure, no
// clients, so it can be tested without keys.
//
// MUST BE EXTENDED: the holiday list covers 2026 and 2027 only. Any date
// outside those years is treated as a trading day if it falls on a weekday,
// so add the NYSE calendar for each new year before it starts.

export const NYSE_HOLIDAYS: string[] = [
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19',
  '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18',
  '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
];
const HOLIDAY_SET = new Set(NYSE_HOLIDAYS);

/** A calendar date (YYYY-MM-DD) on which the NYSE trades. */
export function isTradingDay(dateISO: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return false;
  const w = new Date(`${dateISO}T12:00:00Z`).getUTCDay();
  if (w === 0 || w === 6) return false;
  return !HOLIDAY_SET.has(dateISO);
}

/** The calendar date in New York as YYYY-MM-DD, whatever the server clock says. */
export function dateET(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Saturday or Sunday in New York. Markets are closed, nothing in the brief has moved, so no brief goes out. */
export function isWeekendET(now: Date = new Date()): boolean {
  const day = now.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' });
  return day === 'Sat' || day === 'Sun';
}

/** A weekday the NYSE is closed, read in New York: Labor Day, Thanksgiving, and the rest of the list above. */
export function isMarketHolidayET(now: Date = new Date()): boolean {
  return HOLIDAY_SET.has(dateET(now));
}
