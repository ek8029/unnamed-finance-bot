import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';
import { GET as callback } from '@/app/auth/callback/route';
import { confirmationUrl } from '@/lib/checkout-intent';

const h = vi.hoisted(() => ({ signedIn: true, needsMfa: false, exchange: vi.fn() }));
// Auth-only doubles: no database writes or permissive table mocks.
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: {
  getUser: async () => ({ data: { user: h.signedIn ? { id: 'owner' } : null } }),
  mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1', nextLevel: h.needsMfa ? 'aal2' : 'aal1' } }) },
} }) }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: {
  exchangeCodeForSession: h.exchange,
  getUser: async () => ({ data: { user: null } }),
} }) }));
vi.mock('@/lib/posthog-server', () => ({ captureServer: vi.fn() }));

const origin = 'https://helmterminal.dev';
const destination = '/dashboard/theses/classic?ticker=AAPL';
const signup = `/signup?next=${encodeURIComponent(destination)}`;
async function location(path: string) {
  const response = await middleware(new NextRequest(new URL(path, origin)));
  return response.headers.get('location');
}
beforeEach(() => {
  h.signedIn = true; h.needsMfa = false;
  h.exchange.mockReset().mockResolvedValue({ error: null });
  vi.stubEnv('NODE_ENV', 'production');
});
afterEach(() => vi.unstubAllEnvs());

describe('public thesis destination across authentication', () => {
  it('connects the actual article CTA to the existing Free drafting workspace', () => {
    const article = readFileSync('content/blog/investment-thesis-examples.mdx', 'utf8');
    const cta = article.match(/<CTACard[\s\S]*?buttonText="Start with one thesis"[\s\S]*?\/>/)![0];
    const url = new URL(cta.match(/href="([^"]+)"/)![1], origin);
    expect(url.pathname).toBe('/signup');
    expect(url.searchParams.get('next')).toBe('/dashboard/theses/classic');
  });
  it('keeps a new visitor on signup', async () => {
    h.signedIn = false;
    expect(await location(signup)).toBeNull();
  });
  it('takes an existing signed-in visitor directly to the requested draft', async () => {
    expect(await location(signup)).toBe(origin + destination);
  });
  it('also preserves the login redirect used after email confirmation', async () => {
    expect(await location(`/login?redirect=${encodeURIComponent(destination)}`)).toBe(origin + destination);
  });
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/\nevil.example', 'javascript:alert(1)', '/a/..//evil.example', '/a/%2e%2e//evil.example', '/.//evil.example'])('rejects unsafe auth next %s', async (next) => {
    expect(await location(`/signup?next=${encodeURIComponent(next)}`)).toBe(origin + '/dashboard');
    expect(await location(`/login?redirect=${encodeURIComponent(next)}`)).toBe(origin + '/dashboard');
    expect(await location(`/mfa-verify?next=${encodeURIComponent(next)}`)).toBe(origin + '/dashboard');
  });
  it('leaves the ordinary signup and Wrapped destinations unchanged', async () => {
    expect(await location('/signup')).toBe(origin + '/dashboard');
    expect(await location(signup + '&flow=wrapped')).toBe(origin + '/wrapped');
  });
  it.each(['/signup', '/login?redirect=%2Fsignup', '/mfa-verify', '/forgot-password/'])('avoids an authenticated redirect loop through %s', async next => {
    expect(await location(`/signup?next=${encodeURIComponent(next)}`)).toBe(origin + '/dashboard');
    expect(await location(`/mfa-verify?next=${encodeURIComponent(next)}`)).toBe(origin + '/dashboard');
  });
  it('keeps a requested thesis query through an expired dashboard session', async () => {
    h.signedIn = false;
    const login = new URL((await location(destination))!);
    expect(login.pathname).toBe('/login');
    expect(login.searchParams.get('redirect')).toBe(destination);
  });
  it.each([signup, destination])('requires MFA before continuing from %s', async path => {
    h.needsMfa = true;
    const verify = new URL((await location(path))!);
    expect(verify.pathname).toBe('/mfa-verify');
    expect(verify.searchParams.get('next')).toBe(destination);
    expect(await location(verify.pathname + verify.search)).toBeNull();
    h.needsMfa = false;
    expect(await location(verify.pathname + verify.search)).toBe(origin + destination);
  });
  it('rejects an unsafe MFA destination after verification', async () => {
    expect(await location('/mfa-verify?next=%2F%2Fevil.example')).toBe(origin + '/dashboard');
  });
  it('preserves the requested destination if the MFA session expires', async () => {
    h.signedIn = false;
    const login = new URL((await location(`/mfa-verify?next=${encodeURIComponent(destination)}`))!);
    expect(login.pathname).toBe('/login');
    expect(login.searchParams.get('redirect')).toBe(destination);
  });
  it('passes a successful confirmation code through the actual callback redirect', async () => {
    const url = new URL(confirmationUrl(origin, destination));
    url.searchParams.set('code', 'confirmation-code');
    const response = await callback(new NextRequest(url));
    expect(h.exchange).toHaveBeenCalledWith('confirmation-code');
    expect(response.headers.get('location')).toBe(origin + destination);
  });
});
