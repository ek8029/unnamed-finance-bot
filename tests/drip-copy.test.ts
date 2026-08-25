import { describe, it, expect } from 'vitest';
import { getTemplate, DRIP_DAYS } from '../lib/emails/templates';

/**
 * The drip sequence was silent from 2026-05-21 to 2026-08-25 and its copy
 * drifted: day 21 sold a $50 Max tier retired in August, day 14 quoted a
 * user's dollar figure with no source. Pin the rules the copy must keep.
 */
describe('drip email copy', () => {
  const days = [0, ...DRIP_DAYS] as const;

  it('every day has a template with no em dashes', () => {
    for (const d of days) {
      const t = getTemplate(d, 'Evan');
      expect(t, `day ${d}`).toBeTruthy();
      expect(t!.text.includes('\u2014'), `day ${d} text`).toBe(false);
      expect(t!.html.includes('\u2014'), `day ${d} html`).toBe(false);
    }
  });

  it('never sells a tier that is not on the pricing page', () => {
    for (const d of days) {
      const t = getTemplate(d, 'Evan')!;
      expect(/\bMax\b/.test(t.text + t.html), `day ${d} mentions Max`).toBe(false);
      expect(/\$50/.test(t.text + t.html), `day ${d} mentions $50`).toBe(false);
    }
  });

  it('quotes no dollar figures or percentages that would be a user\'s numbers', () => {
    for (const d of days) {
      if (d === 21) continue; // the price
      const t = getTemplate(d, 'Evan')!;
      expect(/\$\d/.test(t.text), `day ${d} has a dollar figure`).toBe(false);
      expect(/\d+%/.test(t.text), `day ${d} has a percentage`).toBe(false);
    }
  });
});
