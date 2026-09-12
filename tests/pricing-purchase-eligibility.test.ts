import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

// Run the real pricing component, tier hook, cache and click callbacks. Only
// React scheduling, network responses and unrelated visual children are mocked.
const h = vi.hoisted(() => ({
  slots: [] as any[], cursor: 0,
  effects: [] as Array<() => void | (() => void)>,
  cleanups: [] as Array<() => void>,
  preview: { tier: 'free' as 'free' | 'pro', resolved: true },
  capture: vi.fn(),
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
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
      const index = h.cursor++;
      const before = h.slots[index] as unknown[] | undefined;
      if (!before || before.length !== deps.length || deps.some((value, i) => !Object.is(value, before[i]))) {
        h.slots[index] = deps;
        h.effects.push(effect);
      }
    },
  };
});
vi.mock('@/components/site-nav', () => ({ SiteNav: () => null }));
vi.mock('@/components/checkout-modal', () => ({ CheckoutModal: () => null }));
vi.mock('@/components/ui/animated-section', () => ({ AnimatedSection: () => null }));
vi.mock('@/components/legal-footer', () => ({ LegalFooter: () => null }));
vi.mock('@/components/cinematic-bg', () => ({ CinematicBg: () => null }));
vi.mock('@/lib/preview-context', () => ({ usePreview: () => h.preview }));
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/theses/builder' }));
vi.mock('posthog-js', () => ({ default: { capture: h.capture } }));

import PricingPage from '@/app/pricing/page';
import { CheckoutModal } from '@/components/checkout-modal';
import { TierLock } from '@/components/tier-lock';
import { __resetApiCache } from '@/lib/api-cache';

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
function render(component = PricingPage) {
  h.cursor = 0;
  const tree = nodes(component());
  for (const effect of h.effects.splice(0)) {
    const cleanup = effect();
    if (cleanup) h.cleanups.push(cleanup);
  }
  return tree;
}
function start(tree = render()) {
  return tree.find(node => node.type === 'button' && text(node).trim() === 'Start Pro');
}
const request = vi.fn<typeof fetch>();
const quota = { allowed: true, used: 0, limit: 100, remaining: 100 };
const answer = (payload: Record<string, unknown>) => new Response(JSON.stringify({ quota, ...payload }), { status: 200 });

beforeEach(() => {
  vi.useFakeTimers();
  h.slots = []; h.cursor = 0; h.effects = []; h.cleanups = [];
  h.preview = { tier: 'free', resolved: true };
  h.capture.mockReset(); request.mockReset(); __resetApiCache();
  vi.stubGlobal('React', React);
  vi.stubGlobal('fetch', request);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  h.cleanups.forEach(cleanup => cleanup());
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe('pricing purchase continuation', () => {
  it.each(['pro', 'pro_annual'])('lets an active no-card Pro trial open %s checkout', async period => {
    request.mockResolvedValue(answer({ tier: 'pro', realTier: 'pro', canPurchasePro: true }));
    render(); await vi.runAllTimersAsync();
    let tree = render();
    expect(tree.some(node => text(node).trim() === 'Current plan')).toBe(false);
    if (period === 'pro_annual') {
      tree.find(node => node.type === 'button' && text(node) === 'Yearly')!.props.onClick();
      tree = render();
      expect(tree.some(node => text(node).replace(/\s/g, '') === '$149')).toBe(true);
    }
    expect(start(tree)).toBeDefined();
    start(tree)!.props.onClick();
    expect(render().find(node => node.type === CheckoutModal)?.props.billingPeriod).toBe(period);
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/user/tier');
  });

  it.each(['Stripe', 'App Store', 'permanent complimentary'])('keeps %s Pro access on Current plan', async () => {
    request.mockResolvedValue(answer({ tier: 'pro', realTier: 'pro', canPurchasePro: false }));
    render(); await vi.runAllTimersAsync();
    const tree = render();
    expect(tree.some(node => text(node).trim() === 'Current plan')).toBe(true);
    expect(start(tree)).toBeUndefined();
  });

  it.each(['fresh Free', 'lapsed no-card trial', 'open-access Free'])('keeps %s purchase available', async scenario => {
    request.mockResolvedValue(answer({ tier: scenario === 'open-access Free' ? 'pro' : 'free', realTier: 'free', canPurchasePro: true }));
    render(); await vi.runAllTimersAsync();
    expect(start()).toBeDefined();
  });

  it('keeps an actionable neutral CTA while the tier lookup is pending', () => {
    request.mockReturnValue(new Promise(() => {}));
    const tree = render();
    expect(start(tree)).toBeDefined();
    start(tree)!.props.onClick();
    expect(render().some(node => node.type === CheckoutModal)).toBe(true);
  });

  it.each(['anonymous', 'network failure', 'server failure', 'missing field', 'malformed field'])('does not invent a Current plan for %s', async scenario => {
    if (scenario === 'anonymous') request.mockResolvedValue(new Response('', { status: 401 }));
    else if (scenario === 'network failure') request.mockRejectedValue(new Error('offline'));
    else if (scenario === 'server failure') request.mockResolvedValue(new Response('', { status: 503 }));
    else request.mockResolvedValue(answer({ tier: 'pro', realTier: 'pro', ...(scenario === 'malformed field' ? { canPurchasePro: 'false' } : {}) }));
    render(); await vi.runAllTimersAsync();
    const tree = render();
    expect(start(tree)).toBeDefined();
    expect(tree.some(node => text(node).trim() === 'Current plan')).toBe(false);
    start(tree)!.props.onClick();
    expect(render().find(node => node.type === CheckoutModal)?.props.billingPeriod).toBe('pro');
  });
});

describe('TierLock qualified offer and unchanged access/analytics', () => {
  const lock = () => TierLock({ required: 'pro', surface: 'fixture-builder', children: React.createElement('div', {}, 'Premium preview') });
  it('sends Free/lapsed viewers to plans without promising another trial', () => {
    const tree = render(lock);
    const cta = tree.find(node => node.props.href === '/pricing');
    expect(text(cta)).toBe('See Pro plans');
    expect(tree.some(node => text(node).includes('Eligible accounts'))).toBe(true);
    expect(tree.some(node => text(node).includes('Card required'))).toBe(true);
    expect(tree.some(node => node.props['aria-hidden'] && text(node) === 'Premium preview')).toBe(true);
    expect(h.capture).toHaveBeenCalledWith('paywall_hit', { surface: 'fixture-builder', required: 'pro', tier: 'free' });
    cta!.props.onClick();
    expect(h.capture).toHaveBeenCalledWith('paywall_cta_clicked', { surface: 'fixture-builder', required: 'pro', tier: 'free' });
  });
  it.each([['loading', 'free', false], ['entitled', 'pro', true]] as const)('keeps %s out of paywall analytics', (_, tier, resolved) => {
    h.preview = { tier, resolved };
    const tree = render(lock);
    expect(tree.some(node => node.props.href === '/pricing')).toBe(false);
    expect(h.capture).not.toHaveBeenCalled();
  });
});
