// tests/thesis-breach.test.ts
import { describe, it, expect } from 'vitest';
import { wantsBreachAlerts } from '@/lib/thesis-breach';
import { getThesisBreachTemplate } from '@/lib/emails/templates';

describe('wantsBreachAlerts', () => {
  // Never-answered is not the same as declined. A user who has not touched
  // notification settings still gets the alert the product is sold on, which is
  // what the defaults route already assumes.
  it('treats a missing row or null columns as opted in', () => {
    expect(wantsBreachAlerts(null)).toBe(true);
    expect(wantsBreachAlerts({})).toBe(true);
    expect(wantsBreachAlerts({ notification_market_alerts: null, notification_email: null })).toBe(true);
  });
  it('honours the specific preference', () => {
    expect(wantsBreachAlerts({ notification_market_alerts: true })).toBe(true);
    expect(wantsBreachAlerts({ notification_market_alerts: false })).toBe(false);
  });
  it('lets the master switch win, which is what one-click unsubscribe sets', () => {
    expect(wantsBreachAlerts({ notification_email: false })).toBe(false);
    expect(wantsBreachAlerts({ notification_email: false, notification_market_alerts: true })).toBe(false);
  });
});

describe('getThesisBreachTemplate', () => {
  const tpl = getThesisBreachTemplate({
    ticker: 'AMD',
    claim: 'Data center demand keeps growing',
    excerpt: 'The company expects data center revenue to decline sequentially.',
    sourceTitle: 'AMD Q2 10-Q',
    sourceUrl: 'https://www.sec.gov/example',
  });
  it('subject names the ticker and severity', () => {
    expect(tpl.subject).toContain('AMD');
    expect(tpl.subject.toLowerCase()).toContain('break');
  });
  it('body carries the verbatim excerpt and the source', () => {
    expect(tpl.html).toContain('The company expects data center revenue to decline sequentially.');
    expect(tpl.html).toContain('AMD Q2 10-Q');
    expect(tpl.text).toContain('The company expects data center revenue to decline sequentially.');
  });
  it('copy contains no em dashes', () => {
    expect(tpl.subject).not.toContain('\u2014');
    expect(tpl.text).not.toContain('\u2014');
  });
});
