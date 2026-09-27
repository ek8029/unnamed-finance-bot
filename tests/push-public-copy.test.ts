import { describe, it, expect } from 'vitest';
import { PUBLIC_COPY, pushRef } from '../lib/push/send';
import { KIND_LEVEL } from '../lib/push/policy';

describe('what a push shows on the lock screen', () => {
  it('has a line for every kind the policy can send', () => {
    expect(Object.keys(PUBLIC_COPY).sort()).toEqual(Object.keys(KIND_LEVEL).sort());
  });

  it('never carries a figure, a ticker-shaped word, an em dash or advice', () => {
    for (const [kind, { title, body }] of Object.entries(PUBLIC_COPY)) {
      const text = `${title} ${body}`;
      expect(text, kind).not.toMatch(/[0-9$%]/);
      // A ticker would be an all-caps word of 1-5 letters; the product name is
      // written "Helm", never HELM, on this surface.
      expect(text, kind).not.toMatch(/\b[A-Z]{2,5}\b/);
      expect(text, kind).not.toMatch(/—/);
      expect(text, kind).not.toMatch(/\b(buy|sell|trim|should|recommend)\b/i);
      expect(title.length, kind).toBeLessThanOrEqual(40);
    }
  });

  it('lets only an opaque id travel in the payload, never a ticker', () => {
    const id = '3f2b1c9e-8a4d-4c1e-9b7a-2d6e5f4a3b21';
    expect(pushRef({ route: 'thesis', id })).toBe(id);
    expect(pushRef({ route: 'reconnect', id })).toBe(id);
    // The book route's id is a ticker: dropped.
    expect(pushRef({ route: 'book', id: 'NVDA' })).toBeUndefined();
    // A ticker arriving on a thesis route by mistake is dropped too.
    expect(pushRef({ route: 'thesis', id: 'NVDA' })).toBeUndefined();
    expect(pushRef({ route: 'brief' })).toBeUndefined();
    expect(pushRef({ route: 'thesis' })).toBeUndefined();
  });
});
