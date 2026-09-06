// tests/digest-send.test.ts
import { describe, it, expect } from 'vitest';
import { isWeekendET, digestEmailPayload, chunk, BATCH_MAX } from '@/lib/emails/digest-send';

describe('isWeekendET', () => {
  it('reads the day in New York, not UTC', () => {
    expect(isWeekendET(new Date('2026-09-05T13:15:00Z'))).toBe(true);  // Saturday 9:15 AM ET
    expect(isWeekendET(new Date('2026-09-06T13:15:00Z'))).toBe(true);  // Sunday
    expect(isWeekendET(new Date('2026-09-07T03:00:00Z'))).toBe(true);  // Sunday 11 PM ET, Monday in UTC
    expect(isWeekendET(new Date('2026-09-07T13:15:00Z'))).toBe(false); // Monday 9:15 AM ET
    expect(isWeekendET(new Date('2026-09-05T03:00:00Z'))).toBe(false); // Friday 11 PM ET, Saturday in UTC
  });
});

describe('digestEmailPayload', () => {
  it('carries the one-click unsubscribe headers and the brief subject', () => {
    const p = digestEmailPayload({ id: 'u1', email: 'someone@example.com', firstName: 'Sam' }, 'First paragraph.\n\nSecond.');
    expect(p.to).toBe('someone@example.com');
    expect(p.subject).toContain('The Current');
    expect(p.headers['List-Unsubscribe']).toMatch(/^<https?:\/\/.+>$/);
    expect(p.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(p.html).toContain('First paragraph.');
    expect(p.text).toContain('Good morning, Sam.');
  });
});

describe('chunk', () => {
  it('cuts at the batch endpoint limit and keeps order', () => {
    const xs = Array.from({ length: 254 }, (_, i) => i);
    const cs = chunk(xs);
    expect(cs.map((c) => c.length)).toEqual([BATCH_MAX, BATCH_MAX, 54]);
    expect(cs[2][0]).toBe(200);
    expect(chunk([])).toEqual([]);
  });
});
