import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: {
    getUser: async () => ({ data: { user: { id: '11111111-1111-4111-8111-111111111111' } } }),
    mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal1' } }) },
  } }),
}));
beforeEach(() => vi.stubEnv('NODE_ENV', 'production'));
afterEach(() => vi.unstubAllEnvs());

it('allows the actual Apple deletion SDK through the authenticated settings response policy', async () => {
  const response = await middleware(new NextRequest('https://helmterminal.dev/dashboard/settings'));
  expect(response.headers.get('location')).toBeNull();
  const policy = response.headers.get('content-security-policy')!;
  const scripts = policy.split('; ').find(part => part.startsWith('script-src '))!.split(' ');
  const sdk = new URL('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js');
  expect(scripts).toContain(sdk.origin);
  expect(scripts).not.toContain('https:');
  expect(scripts).not.toContain("'unsafe-eval'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("form-action 'self'");
});
