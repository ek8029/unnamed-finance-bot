// lib/preference-fields.ts
//
// Two lists that have to agree with each other.
//
// Every Helm email ends on a one-click unsubscribe link, and that link's
// confirmation page says "you can turn it back on anytime from your settings".
// Those words are only true if every column the unsubscribe route can switch
// off is a column the preferences route will accept back on.
//
// They did not agree. `notification_email` and `notification_weekly_update`
// could be set to false by an email footer and could not be set back to true by
// anything, because the PATCH handler dropped unlisted fields silently and
// still returned 200 with the row, so the toggle in Settings looked saved.
// tests/preference-fields.test.ts now fails if they drift apart again.

import type { UnsubKind } from '@/lib/emails/unsubscribe';

/** Columns a signed-in person may write through PATCH /api/user/preferences.
 *  Anything not on this list is dropped, so a control the UI renders and this
 *  list does not name is a control that does nothing. */
export const WRITABLE_PREFERENCE_FIELDS = [
  'theme', 'density', 'currency', 'number_format', 'date_format',
  'notification_market_alerts', 'notification_transaction_alerts',
  'notification_budget_alerts', 'notification_tax_reminders',
  'notification_weekly_digest', 'notification_monthly_report',
  'notification_daily_brief', 'notification_weekly_update',
  'notification_email', 'notification_push_level',
  'reduce_motion', 'high_contrast', 'large_text', 'screen_reader_optimized',
  'analytics_enabled', 'crash_reporting_enabled',
  'filing_status', 'tax_bracket', 'tax_state',
] as const;

/** What each unsubscribe link switches off.
 *
 *  `all` sets every specific flag as well as the master one. That is deliberate
 *  and not redundant: a sender that reads only its own flag would otherwise
 *  walk straight past the master switch. Both digest-cron and weekly-update
 *  now check `notification_email` too, but belt and braces on the one action a
 *  person cannot take back. */
export const UNSUB_FIELDS: Record<UnsubKind, Record<string, boolean>> = {
  brief: { notification_daily_brief: false },
  market: { notification_market_alerts: false },
  weekly: { notification_weekly_update: false },
  all: {
    notification_daily_brief: false,
    notification_market_alerts: false,
    notification_weekly_update: false,
    notification_email: false,
  },
};
