import { describe, expect, it } from 'vitest';
import { confirmationUrl, loginUrlForNext, safeNext, signupUrlForIntent } from '@/lib/checkout-intent';

describe('purchase intent across authentication', () => {
  it.each(['pro', 'pro_annual'] as const)('preserves %s through confirmation, login and signup', plan => {
    const signup = new URL(signupUrlForIntent(plan), 'https://helmterminal.dev');
    const destination = signup.searchParams.get('next')!;
    const confirmation = new URL(confirmationUrl('https://helmterminal.dev', destination));
    const login = new URL(loginUrlForNext(confirmation.searchParams.get('next')!, 'check-email'), confirmation.origin);
    expect(login.searchParams.get('redirect')).toBe(`/dashboard?checkout=${plan}`);
    expect(login.searchParams.get('message')).toBe('check-email');
  });
  it('preserves a requested research page and fragment', () => {
    expect(safeNext('/analyze/MSFT?source=research#evidence')).toBe('/analyze/MSFT?source=research#evidence');
  });
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/\nevil.example', 'javascript:alert(1)', null])('rejects unsafe destination %s', next => {
    expect(safeNext(next)).toBe('/dashboard');
    expect(new URL(confirmationUrl('https://helmterminal.dev', next)).searchParams.get('next')).toBe('/dashboard');
  });
});
