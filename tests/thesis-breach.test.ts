// tests/thesis-breach.test.ts
import { describe, it, expect } from 'vitest';
import { isAllowedAlertRecipient } from '@/lib/thesis-breach';
import { getThesisBreachTemplate } from '@/lib/emails/templates';

describe('isAllowedAlertRecipient', () => {
  it('allows only the test account', () => {
    expect(isAllowedAlertRecipient('evank8029@gmail.com')).toBe(true);
    expect(isAllowedAlertRecipient('EvanK8029@gmail.com')).toBe(true);
  });
  it('blocks every other address', () => {
    expect(isAllowedAlertRecipient('ben@example.com')).toBe(false);
    expect(isAllowedAlertRecipient('evank7029@gmail.com')).toBe(false);
    expect(isAllowedAlertRecipient('')).toBe(false);
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
