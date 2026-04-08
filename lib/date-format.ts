/**
 * Shared date formatting utilities for chart labels and display.
 *
 * All functions accept date-only strings ("2026-04-01") safely by
 * appending T12:00:00 to avoid the UTC-midnight timezone shift that
 * causes 1st-of-month dates to display as the previous month in
 * western timezones.
 */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parse a date-only string ("2026-04-01") safely in local time.
 * Avoids the UTC-midnight issue where `new Date("2026-04-01")` can
 * shift to March 31 in US timezones.
 */
export function parseDateLocal(dateStr: string): Date {
  // If already has time component, parse as-is
  if (dateStr.includes('T')) return new Date(dateStr);
  return new Date(dateStr + 'T12:00:00');
}

/**
 * Format as "Apr '26" — unambiguous month + 2-digit year.
 * Avoids "Apr 26" which looks like April 26th.
 */
export function formatMonthLabel(date: Date): string {
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear().toString().slice(-2);
  return `${month} '${year}`;
}

/**
 * Format as "Apr" — short month name only (for charts within same year).
 */
export function formatMonthShort(date: Date): string {
  return MONTH_NAMES[date.getMonth()];
}
