import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import SignupPage from '@/app/signup/page';
import MfaVerifyPage from '@/app/mfa-verify/page';
import LoginPage from '@/app/login/page';

const h = vi.hoisted(() => ({
  query: '', path: '/signup', slots: [] as any[], cursor: 0,
  effects: [] as (() => unknown)[],
  router: { push: vi.fn(), refresh: vi.fn() },
  fetch: vi.fn(), oauth: vi.fn(), verify: vi.fn(), challenge: vi.fn(),
}));
vi.mock('react', async original => {
  const actual = await original<typeof import('react')>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = h.cursor++;
      if (!(index in h.slots)) h.slots[index] = typeof initial === 'function' ? initial() : initial;
      return [h.slots[index], (value: unknown) => { h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value; }];
    },
    useRef: (initial: unknown) => {
      const index = h.cursor++;
      if (!(index in h.slots)) h.slots[index] = { current: initial };
      return h.slots[index];
    },
    useMemo: (compute: () => unknown) => compute(),
    useEffect: (effect: () => unknown, deps: unknown[]) => {
      const index = h.cursor++;
      const previous = h.slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous[i]))) {
        h.slots[index] = deps; h.effects.push(effect);
      }
    },
  };
});
vi.mock('next/navigation', () => ({ useRouter: () => h.router, useSearchParams: () => new URLSearchParams(h.query), usePathname: () => h.path }));
vi.mock('next/link', () => ({ default: 'a' }));
vi.mock('@hcaptcha/react-hcaptcha', () => ({ default: () => null }));
vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }));
// Auth SDK / HTTP contracts only; these tests do not mock or write database rows.
vi.mock('@/lib/supabase/client', () => ({ supabase: { auth: {
  signInWithOAuth: h.oauth,
  signOut: async () => ({}),
  mfa: {
    listFactors: async () => ({ data: { totp: [{ id: 'factor', status: 'verified' }] }, error: null }),
    challenge: h.challenge, verify: h.verify,
  },
} } }));

type Element = React.ReactElement<Record<string, any>>;
const expand = new Set(['SignupPage', 'SignupForm', 'MfaVerifyPage', 'MfaVerifyForm', 'LoginPage', 'LoginForm', 'AuthShell']);
function nodes(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  if (typeof node.type === 'function' && expand.has(node.type.name)) {
    return nodes((node.type as (props: any) => React.ReactNode)(node.props));
  }
  return [node, ...nodes(node.props.children)];
}
function render(Component: () => React.ReactNode) {
  h.path = Component === SignupPage ? '/signup' : Component === LoginPage ? '/login' : '/mfa-verify';
  h.cursor = 0;
  const tree = nodes(React.createElement(Component));
  h.effects.splice(0).forEach(effect => effect());
  return tree;
}
async function settle(Component: () => React.ReactNode) {
  let tree = render(Component);
  for (let i = 0; i < 5; i++) { await Promise.resolve(); tree = render(Component); }
  return tree;
}
const destination = '/dashboard/theses/classic?ticker=AAPL';
beforeEach(() => {
  vi.useFakeTimers();
  h.query = `next=${encodeURIComponent(destination)}`;
  h.slots = []; h.cursor = 0; h.effects = [];
  h.router.push.mockReset(); h.router.refresh.mockReset();
  h.fetch.mockReset(); h.oauth.mockReset();
  h.challenge.mockReset().mockResolvedValue({ data: { id: 'challenge' }, error: null });
  h.verify.mockReset().mockResolvedValue({ error: null });
  vi.stubGlobal('React', React);
  vi.stubGlobal('fetch', h.fetch);
  vi.stubGlobal('window', { location: { origin: 'https://helmterminal.dev' } });
  vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
  vi.stubEnv('NEXT_PUBLIC_HCAPTCHA_SITE_KEY', '');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('actual signup handlers retain thesis intent', () => {
  it.each(['/dashboard/theses/classic', destination])('keeps the signup promise about thesis drafting for %s', async next => {
    h.query = `next=${encodeURIComponent(next)}`;
    const tree = await settle(SignupPage);
    expect(tree.find(node => node.props.className === 'helm-auth-subtitle')!.props.children).toBe('Create your account, then draft and track your first investment thesis. No card required.');
    expect(tree.some(node => node.props.children === 'One thesis free · No brokerage connection required')).toBe(true);
    expect(tree.some(node => node.props.children === 'No credit card required · Connect or enter positions after sign-up')).toBe(false);
  });
  it.each(['', 'next=%2Fdashboard%3Fcheckout%3Dpro', 'flow=wrapped', 'next=%2Fdashboard%2Ftheses%2Fclassic-extra'])('retains ordinary signup copy for %s', async query => {
    h.query = query;
    const tree = await settle(SignupPage);
    expect(tree.find(node => node.props.className === 'helm-auth-subtitle')!.props.children).toBe('Create your account, then connect a brokerage or add your first position. No card required.');
    expect(tree.some(node => node.props.children === 'No credit card required · Connect or enter positions after sign-up')).toBe(true);
  });
  it.each([true, false])('preserves the submitted destination when signup session=%s', async session => {
    h.fetch.mockResolvedValue(new Response(JSON.stringify({ session: session ? { access_token: 'fixture' } : null })));
    let tree = await settle(SignupPage);
    tree.find(node => node.props.id === 'email')!.props.onChange({ target: { value: 'fixture@example.test' } });
    tree.find(node => node.props.id === 'password')!.props.onChange({ target: { value: 'Example-Strong9' } });
    tree = await settle(SignupPage);
    await tree.find(node => node.type === 'form')!.props.onSubmit({ preventDefault() {} });
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(h.fetch.mock.calls[0][1].body).next).toBe(destination);
    const pushed = h.router.push.mock.calls[0][0];
    if (session) expect(pushed).toBe(destination);
    else {
      const login = new URL(pushed, 'https://helmterminal.dev');
      expect(login.pathname).toBe('/login');
      expect(login.searchParams.get('redirect')).toBe(destination);
      expect(login.searchParams.get('message')).toBe('check-email');
    }
  });
  it.each([destination, '//evil.example', '/a/..//evil.example'])('passes only a safe next to Google OAuth (%s)', async next => {
    h.query = `next=${encodeURIComponent(next)}`;
    const tree = await settle(SignupPage);
    const google = tree.find(node => node.type === 'button' && node.props.onClick?.name === 'handleGoogleSignIn')!;
    await google.props.onClick();
    const request = h.oauth.mock.calls[0][0];
    expect(request.provider).toBe('google');
    const callback = new URL(request.options.redirectTo);
    expect(callback.pathname).toBe('/auth/callback');
    expect(callback.searchParams.get('next')).toBe(next === destination ? destination : '/dashboard');
  });
});

describe('actual login handler uses the same safe destination', () => {
  it.each([destination, '/a/..//evil.example', '/a/%2e%2e//evil.example', '/.//evil.example'])('continues safely after password login (%s)', async next => {
    h.query = `redirect=${encodeURIComponent(next)}`;
    h.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    let tree = await settle(LoginPage);
    tree.find(node => node.props.id === 'email')!.props.onChange({ target: { value: 'fixture@example.test' } });
    tree.find(node => node.props.id === 'password')!.props.onChange({ target: { value: 'Example-Strong9' } });
    tree = await settle(LoginPage);
    await tree.find(node => node.type === 'form')!.props.onSubmit({ preventDefault() {} });
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(h.fetch.mock.calls[0][0]).toBe('/api/auth/login');
    expect(h.router.push).toHaveBeenCalledWith(next === destination ? destination : '/dashboard');
  });
});

describe('actual MFA verification handler retains thesis intent', () => {
  it.each([destination, '//evil.example', '/a/..//evil.example'])('continues to a safe path only after successful verification (%s)', async next => {
    h.query = `next=${encodeURIComponent(next)}`;
    let tree = await settle(MfaVerifyPage);
    expect(h.router.push).not.toHaveBeenCalled();
    tree.find(node => node.type === 'input')!.props.onChange({ target: { value: '123456' } });
    tree = await settle(MfaVerifyPage);
    await tree.find(node => node.type === 'form')!.props.onSubmit({ preventDefault() {} });
    expect(h.challenge).toHaveBeenCalledWith({ factorId: 'factor' });
    expect(h.verify).toHaveBeenCalledWith({ factorId: 'factor', challengeId: 'challenge', code: '123456' });
    expect(h.router.push).toHaveBeenCalledWith(next === destination ? destination : '/dashboard');
  });
  it('does not navigate when MFA verification fails', async () => {
    h.verify.mockResolvedValue({ error: new Error('Invalid verification code') });
    const tree = await settle(MfaVerifyPage);
    await tree.find(node => node.type === 'form')!.props.onSubmit({ preventDefault() {} });
    expect(h.verify).toHaveBeenCalled();
    expect(h.router.push).not.toHaveBeenCalled();
  });
});
