// tests/expired-link.test.ts
// Supabase bounces a dead email link to the site root with the error in the
// query string. That landing becomes the one login message that explains it.
import { describe, it, expect } from 'vitest';
import { AUTH_MESSAGES, expiredLinkRedirect } from '@/lib/auth-messages';

describe('expiredLinkRedirect', () => {
  it('turns the homepage error landing into the login message', () => {
    const u = new URL('https://helmterminal.dev/?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    expect(expiredLinkRedirect(u)).toBe('/login?message=link-expired');
    expect('link-expired' in AUTH_MESSAGES).toBe(true);
  });
  it('leaves every other homepage and every other path alone', () => {
    expect(expiredLinkRedirect(new URL('https://helmterminal.dev/'))).toBeNull();
    expect(expiredLinkRedirect(new URL('https://helmterminal.dev/?utm_source=x'))).toBeNull();
    expect(expiredLinkRedirect(new URL('https://helmterminal.dev/dashboard?error_code=otp_expired'))).toBeNull();
  });
});
