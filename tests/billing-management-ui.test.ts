import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

const h = vi.hoisted(() => {
  vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_fixture');
  return {
    slots: [] as any[], cursor: 0, effects: [] as { index: number; effect: () => void | (() => void) }[],
    cleanups: new Map<number, () => void>(), request: vi.fn(), capture: vi.fn(), showError: vi.fn(),
    billing: {} as Record<string, unknown>, billingFailure: null as 'network' | 'http' | null,
    tierLoading: false, checkoutCode: 'billing_management_required', checkoutStatus: 400,
  };
});
// Execute the actual Settings and CheckoutModal components, effects and clicks.
// Only React scheduling, browser/network boundaries and unrelated panels are mocked.
vi.mock('react', async original => {
  const actual = await original<typeof import('react')>();
  const same = (a?: unknown[], b?: unknown[]) => !!a && !!b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
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
    useMemo: (factory: () => unknown, deps: unknown[]) => {
      const index = h.cursor++;
      if (!same(h.slots[index]?.deps, deps)) h.slots[index] = { deps, value: factory() };
      return h.slots[index].value;
    },
    useCallback: (callback: unknown, deps: unknown[]) => {
      const index = h.cursor++;
      if (!same(h.slots[index]?.deps, deps)) h.slots[index] = { deps, callback };
      return h.slots[index].callback;
    },
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
      const index = h.cursor++;
      if (!same(h.slots[index], deps)) { h.slots[index] = deps; h.effects.push({ index, effect }); }
    },
  };
});
vi.mock('@/contexts/settings-context', () => ({ useSettings: () => ({
  settings: { currency: 'USD', density: 'comfortable', theme: 'dark', notifications: {} },
  updateSettings: vi.fn(), resetSettings: vi.fn(), formatCurrency: String, formatCurrencyDetailed: String, formatDate: String,
}) }));
vi.mock('@/contexts/toast-context', () => ({ useToast: () => ({ success: vi.fn(), info: vi.fn(), error: h.showError }) }));
vi.mock('@/hooks/use-tier', () => ({ useTier: () => ({ tier: 'free', isPro: false, loading: h.tierLoading }) }));
vi.mock('@/hooks/use-financial-data', () => ({ useAccounts: () => ({ accounts: [], loading: false, error: null, refetch: vi.fn() }) }));
vi.mock('@/hooks/use-format', () => ({ useFormat: () => ({ formatCurrency: String }) }));
vi.mock('@/lib/supabase/client', () => ({ supabase: { auth: {
  getSession: async () => ({ data: { session: null } }), mfa: { listFactors: async () => ({ data: { totp: [] } }) },
} } }));
vi.mock('@/components/plaid/plaid-link-button', () => ({ PlaidLinkButton: 'button' }));
vi.mock('@/components/plaid/plaid-update-link', () => ({ PlaidUpdateLink: 'button' }));
vi.mock('@/app/dashboard/settings/password-section', () => ({ PasswordSection: () => null }));
vi.mock('@/components/ai-consent-panel', () => ({ AiConsentPanel: () => null }));
vi.mock('@/components/pro-waitlist-button', () => ({ ProWaitlistButton: () => null }));
vi.mock('@/components/survey-deferral', () => ({ useSurveyDeferral: () => {} }));
vi.mock('@/components/ui/button', () => ({ Button: 'button' }));
vi.mock('next/link', () => ({ default: 'a' }));
vi.mock('posthog-js', () => ({ default: { capture: h.capture } }));
vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve({}) }));
vi.mock('@stripe/react-stripe-js', () => ({ EmbeddedCheckoutProvider: 'div', EmbeddedCheckout: 'div' }));

import SettingsPage from '@/app/dashboard/settings/page';
import { CheckoutModal } from '@/components/checkout-modal';

type Element = React.ReactElement<Record<string, any>>;
function nodes(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
function text(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join(' ');
  return React.isValidElement<Record<string, any>>(node) ? text(node.props.children) : '';
}
const close = vi.fn();
const modal = () => CheckoutModal({ billingPeriod: 'pro', onClose: close });
function render(component = SettingsPage) {
  h.cursor = 0;
  const tree = nodes(component());
  for (const { index, effect } of h.effects.splice(0)) {
    h.cleanups.get(index)?.();
    const cleanup = effect();
    if (cleanup) h.cleanups.set(index, cleanup);
  }
  return tree;
}
const button = (tree: Element[], label: string) => tree.find(node => node.type === 'button' && text(node).trim() === label);
const apple = (tree: Element[]) => tree.find(node => node.type === 'a' && node.props.href === 'https://apps.apple.com/account/subscriptions');
async function settle(component = SettingsPage) { render(component); await vi.runAllTimersAsync(); return render(component); }
const payload = (overrides: Record<string, unknown> = {}) => ({
  tier: 'free', realTier: 'free', canPurchasePro: true, billingPeriod: null,
  currentPeriodEnd: null, cancelAtPeriodEnd: false, trialEndsAt: null,
  billingManagement: { stripe: false, apple: false }, ...overrides,
});

beforeEach(() => {
  vi.useFakeTimers(); h.slots = []; h.cursor = 0; h.effects = []; h.cleanups.clear();
  h.billing = payload(); h.billingFailure = null; h.tierLoading = false;
  h.checkoutCode = 'billing_management_required'; h.checkoutStatus = 400;
  h.request.mockReset(); h.capture.mockReset(); h.showError.mockReset(); close.mockReset();
  h.request.mockImplementation(async (url: string) => {
    if (url === '/api/user/tier') {
      if (h.billingFailure === 'network') throw new Error('offline');
      return Response.json(h.billing, { status: h.billingFailure === 'http' ? 503 : 200 });
    }
    if (url === '/api/stripe/portal') return Response.json({ url: 'https://billing.stripe.com/fixture' });
    if (url === '/api/stripe/checkout') return Response.json({ error: 'Manage the existing subscription.', code: h.checkoutCode }, { status: h.checkoutStatus });
    if (['/api/user/profile', '/api/user/preferences', '/api/plaid/health'].includes(url)) return Response.json({});
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal('React', React); vi.stubGlobal('fetch', h.request);
  vi.stubGlobal('window', { location: { hash: '#billing', href: 'https://helm.example/dashboard/settings#billing' }, history: { replaceState: vi.fn() }, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('document', { activeElement: { focus: vi.fn() }, body: { style: { overflow: '' } }, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => {
  for (const cleanup of h.cleanups.values()) cleanup();
  h.cleanups.clear(); vi.useRealTimers(); vi.unstubAllGlobals();
});
afterAll(() => vi.unstubAllEnvs());

describe('actual Settings billing controls', () => {
  it.each(['free', 'pro'])('lets %s access manage an existing Stripe customer', async tier => {
    h.billing = payload({ tier, realTier: tier, canPurchasePro: tier === 'free', billingManagement: { stripe: true, apple: false } });
    const tree = await settle();
    expect(button(tree, 'Manage Stripe billing')).toBeDefined();
    expect(apple(tree)).toBeUndefined();
    await button(tree, 'Manage Stripe billing')!.props.onClick();
    expect(h.request).toHaveBeenCalledWith('/api/stripe/portal', { method: 'POST' });
    expect(window.location.href).toBe('https://billing.stripe.com/fixture');
  });
  it.each(['free', 'pro'])('routes %s Apple history directly to Apple without Stripe', async tier => {
    h.billing = payload({ tier, realTier: tier, source: 'revenuecat', billingManagement: { stripe: false, apple: true } });
    const tree = await settle();
    expect(apple(tree)).toBeDefined();
    expect(button(tree, 'Manage Stripe billing')).toBeUndefined();
    expect(button(tree, 'Manage billing')).toBeUndefined();
    expect(h.request.mock.calls.some(([url]) => url === '/api/stripe/portal')).toBe(false);
  });
  it('shows both management destinations even when Apple is the displayed provider', async () => {
    h.billing = payload({ tier: 'pro', realTier: 'pro', source: 'revenuecat', canPurchasePro: false, billingManagement: { stripe: true, apple: true } });
    const tree = await settle();
    expect(apple(tree)).toBeDefined(); expect(button(tree, 'Manage Stripe billing')).toBeDefined();
  });
  it('offers Free purchase without inventing a billing account', async () => {
    const tree = await settle();
    expect(tree.some(node => node.type === 'a' && node.props.href === '/pricing')).toBe(true);
    expect(button(tree, 'Manage Stripe billing')).toBeUndefined(); expect(apple(tree)).toBeUndefined();
  });
  it('shows a lifetime grant without labeling it a monthly renewal', async () => {
    h.billing = payload({ tier: 'pro', realTier: 'pro', canPurchasePro: false, billingPeriod: 'lifetime', currentPeriodEnd: '9999-12-31T23:59:59Z' });
    const tree = await settle(); const content = tree.map(text).join(' ').replace(/\s+/g, ' ');
    expect(content).toContain('Lifetime'); expect(content).not.toContain('Pro Monthly'); expect(content).not.toContain('Renews on');
    expect(button(tree, 'Manage billing')).toBeUndefined();
  });
  it('does not label complimentary Pro access as a paid monthly subscription', async () => {
    h.billing = payload({ tier: 'pro', realTier: 'pro', canPurchasePro: false });
    const tree = await settle(); const content = tree.map(text).join(' ').replace(/\s+/g, ' ');
    expect(content).not.toContain('Pro Monthly'); expect(content).not.toContain('Renews on');
    expect(button(tree, 'Manage billing')).toBeUndefined();
  });
  it('does not claim lifetime access from an old billing period on a Free account', async () => {
    h.billing = payload({ billingPeriod: 'lifetime' });
    const tree = await settle(); const content = tree.map(text).join(' ').replace(/\s+/g, ' ');
    expect(content).toContain('Free Plan'); expect(content).not.toContain('Lifetime Plan');
  });
  it.each(['annual', 'pro_annual'])('preserves the %s interval and cancellation date', async billingPeriod => {
    h.billing = payload({ tier: 'pro', realTier: 'pro', canPurchasePro: false, billingPeriod,
      currentPeriodEnd: '2027-09-19T12:00:00Z', cancelAtPeriodEnd: true, billingManagement: { stripe: true, apple: false } });
    const tree = await settle(); const content = tree.map(text).join(' ').replace(/\s+/g, ' ');
    expect(content).toContain('Pro Annual'); expect(content).toContain('Cancels on September 19, 2027');
    expect(content).not.toContain('Pro Monthly');
  });
  it('lets an eligible no-card trial choose a plan without claiming it renews', async () => {
    h.billing = payload({ tier: 'pro', realTier: 'pro', canPurchasePro: true, trialEndsAt: '2026-09-25T00:00:00Z' });
    const tree = await settle(); const content = tree.map(text).join(' ').replace(/\s+/g, ' ');
    expect(tree.some(node => node.type === 'a' && node.props.href === '/pricing')).toBe(true);
    expect(content).toContain('Trial ends'); expect(content).not.toContain('Renews on');
    expect(button(tree, 'Manage billing')).toBeUndefined();
  });
  it.each(['network', 'http'] as const)('replaces a %s failure with a retry that reaches the real fetch', async failure => {
    h.billingFailure = failure;
    let tree = await settle();
    expect(button(tree, 'Retry billing')).toBeDefined();
    h.billingFailure = null; h.billing = payload({ billingManagement: { stripe: true, apple: false } });
    button(tree, 'Retry billing')!.props.onClick(); tree = await settle();
    expect(button(tree, 'Manage Stripe billing')).toBeDefined();
  });
  it('treats unknown management data as unknown, while preserving the membership display', async () => {
    h.billing = payload({ tier: 'pro', realTier: 'pro', canPurchasePro: false, billingManagement: null });
    const tree = await settle();
    expect(button(tree, 'Retry billing')).toBeDefined();
    expect(button(tree, 'Manage Stripe billing')).toBeUndefined(); expect(apple(tree)).toBeUndefined();
  });
  it('does not offer management before the billing response arrives', async () => {
    h.request.mockImplementation(() => new Promise(() => {}));
    render(); const tree = render();
    expect(button(tree, 'Manage Stripe billing')).toBeUndefined(); expect(apple(tree)).toBeUndefined();
  });
  it('surfaces an unavailable portal without claiming restored access or creating checkout', async () => {
    h.billing = payload({ billingManagement: { stripe: true, apple: false } });
    const tree = await settle();
    h.request.mockImplementationOnce(async () => Response.json({ error: 'Billing unavailable' }, { status: 503 }));
    await button(tree, 'Manage Stripe billing')!.props.onClick();
    expect(h.showError).toHaveBeenCalledWith('Billing error', 'Billing unavailable');
    expect(window.location.href).toContain('/dashboard/settings#billing');
    expect(h.request.mock.calls.some(([url]) => url === '/api/stripe/checkout')).toBe(false);
  });
});

describe('actual shared checkout error recovery', () => {
  it.each(['billing_management_required', 'membership_exists'])('turns %s into a Settings billing action', async code => {
    h.checkoutCode = code;
    const tree = await settle(modal);
    expect(tree.some(node => node.type === 'a' && node.props.href === '/dashboard/settings#billing')).toBe(true);
    expect(button(tree, 'Retry checkout')).toBeUndefined();
    expect(h.request).toHaveBeenCalledWith('/api/stripe/checkout', expect.objectContaining({ method: 'POST' }));
  });
  it('keeps a generic server error retryable', async () => {
    h.checkoutCode = ''; h.checkoutStatus = 500;
    const tree = await settle(modal);
    expect(button(tree, 'Retry checkout')).toBeDefined();
    expect(tree.some(node => node.props.href === '/dashboard/settings#billing')).toBe(false);
  });
  it('keeps an expired login on the existing signup continuation', async () => {
    h.checkoutCode = ''; h.checkoutStatus = 401;
    await settle(modal);
    expect(window.location.href).toBe('/signup?next=%2Fdashboard%3Fcheckout%3Dpro');
  });
});
