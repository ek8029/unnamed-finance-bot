import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Every sender reads the opt-out from user_preferences.notification_email,
 * the master switch that one-click unsubscribe sets. A sender that reads the
 * wrong table (user_profiles, as ea72acd did) gets a null row, reads it as
 * "never answered", and mails people who said no. The drip route had no read
 * at all. Source-level, because the route is not hermetically runnable.
 */
describe('drip route honours the master email opt-out', () => {
  const src = readFileSync(join(process.cwd(), 'app/api/emails/drip/route.ts'), 'utf8');

  it('reads notification_email from user_preferences', () => {
    expect(src).toMatch(/from\('user_preferences'\)/);
    expect(src).toContain('notification_email');
  });

  it('never reads preferences off user_profiles', () => {
    expect(src).not.toMatch(/from\('user_profiles'\)/);
  });

  it('caps sends per run so a revived backlog drains over days', () => {
    expect(src).toMatch(/MAX_SENDS_PER_RUN\s*=\s*\d+/);
  });
});

describe('watchlist route honours the master email opt-out', () => {
  const src = readFileSync(join(process.cwd(), 'app/api/cron/watchlist-alerts/route.ts'), 'utf8');

  it('reads notification_email alongside the market flag', () => {
    expect(src).toContain('notification_email');
    expect(src).toMatch(/wantsAlerts\(/);
  });
});
