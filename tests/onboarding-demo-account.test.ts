import { describe, it, expect, afterEach } from 'vitest';
import { demoAccountEmail, isDemoAccount } from '@/lib/onboarding/demo-account';

const original = process.env.DEMO_ACCOUNT_EMAIL;
afterEach(() => {
  if (original === undefined) delete process.env.DEMO_ACCOUNT_EMAIL;
  else process.env.DEMO_ACCOUNT_EMAIL = original;
});

describe('isDemoAccount', () => {
  it('matches the demo login regardless of case or padding', () => {
    const demo = demoAccountEmail();
    expect(isDemoAccount(demo)).toBe(true);
    expect(isDemoAccount(demo.toUpperCase())).toBe(true);
    expect(isDemoAccount(`  ${demo}  `)).toBe(true);
  });

  it('matches nothing else, and never a missing address', () => {
    expect(isDemoAccount('someone@example.com')).toBe(false);
    expect(isDemoAccount('')).toBe(false);
    expect(isDemoAccount(null)).toBe(false);
    expect(isDemoAccount(undefined)).toBe(false);
  });

  it('follows DEMO_ACCOUNT_EMAIL when it is set', () => {
    process.env.DEMO_ACCOUNT_EMAIL = 'Other@Example.com';
    expect(demoAccountEmail()).toBe('other@example.com');
    expect(isDemoAccount('other@example.com')).toBe(true);
  });
});
