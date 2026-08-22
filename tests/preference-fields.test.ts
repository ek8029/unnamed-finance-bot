// tests/preference-fields.test.ts
//
// The promise on the unsubscribe confirmation page, as a test.
import { describe, it, expect } from 'vitest';
import { WRITABLE_PREFERENCE_FIELDS, UNSUB_FIELDS } from '@/lib/preference-fields';

describe('anything an email can switch off can be switched back on', () => {
  const writable = new Set<string>(WRITABLE_PREFERENCE_FIELDS);

  for (const [kind, fields] of Object.entries(UNSUB_FIELDS)) {
    it(`the "${kind}" link only touches fields Settings can write`, () => {
      for (const column of Object.keys(fields)) {
        expect(writable.has(column), `${column} is set by the ${kind} unsubscribe link but PATCH /api/user/preferences drops it, so nothing can turn it back on`).toBe(true);
      }
    });
  }

  it('the master switch is writable, because the all link sets it', () => {
    expect(writable.has('notification_email')).toBe(true);
    expect(UNSUB_FIELDS.all.notification_email).toBe(false);
  });

  it('every specific alert flag is cleared by the all link, not just the master', () => {
    // A sender reading only its own flag would walk past a master switch it
    // does not know about. This is the belt to that pair of braces.
    expect(Object.keys(UNSUB_FIELDS.all).sort()).toEqual([
      'notification_daily_brief',
      'notification_email',
      'notification_market_alerts',
      'notification_weekly_update',
    ]);
  });
});
