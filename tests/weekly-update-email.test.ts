import { describe, it, expect } from 'vitest';
import { mdToEmailHtml, buildWeeklyEmailHtml } from '../lib/emails/weekly-update-html';
import { signUnsub, verifyUnsub } from '../lib/emails/unsubscribe';

describe('mdToEmailHtml', () => {
  it('renders paragraphs and bold', () => {
    const html = mdToEmailHtml('Hello **world**.\n\nSecond para.');
    expect(html).toContain('<strong style="color:#FAFAFA;">world</strong>');
    expect((html.match(/<p /g) ?? []).length).toBe(2);
  });
  it('renders bullet groups', () => {
    const html = mdToEmailHtml('- one\n- two **bold**');
    expect(html).toContain('<ul');
    expect((html.match(/<li /g) ?? []).length).toBe(2);
  });
  it('expands relative links to absolute and keeps absolute', () => {
    const html = mdToEmailHtml('Read [this](/blog/x) and [that](https://a.b/c).');
    expect(html).toContain('href="https://helmterminal.dev/blog/x"');
    expect(html).toContain('href="https://a.b/c"');
  });
  it('escapes HTML in content', () => {
    const html = mdToEmailHtml('a <script>bad</script> & more');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp; more');
  });
});

describe('buildWeeklyEmailHtml', () => {
  const u = { week_of: '2000-01-06', title: 'T', intro: 'I', body_helm: '**B**', body_market: 'M' };
  it('includes title, intro, body, market section, site link, unsubscribe', () => {
    const html = buildWeeklyEmailHtml(u, 'user-123');
    expect(html).toContain('T</h1>');
    expect(html).toContain('I</p>');
    expect(html).toContain('The broader market');
    expect(html).toContain('https://helmterminal.dev/this-week/2000-01-06');
    expect(html).toContain('/api/emails/unsubscribe?u=user-123&k=weekly&t=');
  });
  it('omits market section when null', () => {
    expect(buildWeeklyEmailHtml({ ...u, body_market: null }, 'x')).not.toContain('The broader market');
  });
});

describe('weekly unsubscribe signatures', () => {
  it('round-trips and rejects tampering', () => {
    const t = signUnsub('uid-1', 'weekly');
    expect(verifyUnsub('uid-1', 'weekly', t)).toBe(true);
    expect(verifyUnsub('uid-2', 'weekly', t)).toBe(false);
    expect(verifyUnsub('uid-1', 'brief', t)).toBe(false);
  });
});
