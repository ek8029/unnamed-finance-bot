// tests/pii-guard.test.ts
import { describe, it, expect } from 'vitest';
import { scrubOutbound, wasScrubbed, describeScrub } from '@/lib/pii-guard';

describe('scrubOutbound', () => {
  it('removes structured identifiers', () => {
    const s = scrubOutbound('Reach me at evan@helmterminal.dev or 917-555-0142. SSN 123-45-6789.');
    expect(s.text).not.toContain('evan@helmterminal.dev');
    expect(s.text).not.toContain('917-555-0142');
    expect(s.text).not.toContain('123-45-6789');
    expect(s.removed).toEqual({ email: 1, phone: 1, ssn: 1 });
  });

  it('removes an account number only when something calls it one', () => {
    expect(scrubOutbound('Account #12345678 at Fidelity').text).toContain('[account]');
    expect(scrubOutbound('acct: 987654321').text).toContain('[account]');
  });

  it('LEAVES MONEY ALONE — the whole point of the prompt', () => {
    const facts = 'NVDA: $12,400 (8.2%, unrealized +$3,150), market cap $2,150,000,000, 1,000 shares';
    const s = scrubOutbound(facts);
    expect(s.text).toBe(facts);
    expect(wasScrubbed(s)).toBe(false);
  });

  it('leaves prices, ratios and dates intact', () => {
    const facts = 'Price $178.45, P/E 54.20, +1.94% on 2026-09-04, 52W high $195.10';
    expect(scrubOutbound(facts).text).toBe(facts);
  });

  it('leaves an already-masked account tail alone', () => {
    const t = 'Brokerage ...4821 and Roth IRA ...9930';
    expect(scrubOutbound(t).text).toBe(t);
  });

  it('catches a card-shaped digit run', () => {
    expect(scrubOutbound('4111 1111 1111 1111').text).toContain('[card]');
  });

  it('reports counts and never values', () => {
    const s = scrubOutbound('a@b.com and c@d.com');
    expect(describeScrub(s)).toBe('emailx2');
    expect(describeScrub(s)).not.toContain('@');
  });

  it('clean text passes through untouched', () => {
    const t = 'What changed on NVDA this week?';
    const s = scrubOutbound(t);
    expect(s.text).toBe(t);
    expect(describeScrub(s)).toBe('');
  });
});
