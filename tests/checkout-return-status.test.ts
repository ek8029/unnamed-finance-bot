import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { CheckoutReturnStatus, checkCheckoutAccess, checkoutReturnPath } from '@/components/checkout-return-status';

// The real component/effect/click callbacks and poller run here. Only React's
// scheduler and the browser/network boundaries are controlled. Response mocks
// follow GET /api/user/tier's realTier contract; there is no database mock.
const h = vi.hoisted(() => ({
  slots: [] as any[], cursor: 0,
  effects: [] as { index: number; effect: () => void | (() => void) }[],
  cleanups: new Map<number, () => void>(), updates: 0,
}));
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>();
  const equal = (a?: unknown[], b?: unknown[]) => !!a && !!b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = h.cursor++;
      if (!(index in h.slots)) h.slots[index] = typeof initial === 'function' ? initial() : initial;
      return [h.slots[index], (value: unknown) => {
        h.updates++;
        h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value;
      }];
    },
    useRef: (initial: unknown) => {
      const index = h.cursor++;
      if (!(index in h.slots)) h.slots[index] = { current: initial };
      return h.slots[index];
    },
    useCallback: (callback: unknown, deps: unknown[]) => {
      const index = h.cursor++;
      if (!equal(h.slots[index]?.deps, deps)) h.slots[index] = { deps, callback };
      return h.slots[index].callback;
    },
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
      const index = h.cursor++;
      if (!equal(h.slots[index], deps)) {
        h.slots[index] = deps;
        h.effects.push({ index, effect });
      }
    },
  };
});

type Element = React.ReactElement<Record<string, any>>;
function nodes(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
function render() {
  h.cursor = 0;
  const tree = nodes(CheckoutReturnStatus());
  for (const { index, effect } of h.effects.splice(0)) {
    h.cleanups.get(index)?.();
    const cleanup = effect();
    if (cleanup) h.cleanups.set(index, cleanup);
  }
  return tree;
}
function unmount() {
  for (const cleanup of h.cleanups.values()) cleanup();
  h.cleanups.clear();
}
function retry() {
  return render().find((node) => node.type === 'button')!;
}
function visibleText() {
  return render().map((node) => typeof node.props.children === 'string' ? node.props.children : '').join(' ');
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function tier(realTier: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ tier: realTier, realTier, ...extra }), { status: 200 });
}
const request = vi.fn<typeof fetch>();
const replace = vi.fn();
let location: { href: string; replace: typeof replace };

beforeEach(() => {
  vi.useFakeTimers();
  h.slots = [];
  h.cursor = 0;
  h.effects = [];
  h.cleanups.clear();
  h.updates = 0;
  request.mockReset();
  replace.mockReset();
  location = { href: 'https://helmterminal.dev/dashboard?upgrade=success&session_id=cs_test', replace };
  vi.stubGlobal('React', React);
  vi.stubGlobal('fetch', request);
  vi.stubGlobal('window', { location });
});
afterEach(() => {
  unmount();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('checkout return server access polling', () => {
  it.each(['pro', 'max'])('accepts already-confirmed %s with an uncached authenticated read', async (realTier) => {
    request.mockResolvedValue(tier(realTier));
    expect(await checkCheckoutAccess(new AbortController().signal)).toBe('confirmed');
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/user/tier', {
      cache: 'no-store', credentials: 'same-origin', signal: expect.any(AbortSignal),
    });
  });

  it('recovers from Free, server failure and network failure before confirming Pro', async () => {
    request.mockResolvedValueOnce(tier('free'))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(tier('pro'));
    const result = checkCheckoutAccess(new AbortController().signal);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(await result).toBe('confirmed');
    expect(request).toHaveBeenCalledTimes(4);
  });

  it('does not accept preview Pro and stops after a bounded number of Free reads', async () => {
    request.mockImplementation(async () => tier('free', { tier: 'pro', openAccess: true }));
    const result = checkCheckoutAccess(new AbortController().signal);
    await vi.runAllTimersAsync();
    expect(await result).toBe('pending');
    expect(request).toHaveBeenCalledTimes(12);
  });

  it.each([
    ['server error', () => new Response('', { status: 500 })],
    ['invalid body', () => new Response('not-json', { status: 200 })],
    ['missing realTier', () => new Response(JSON.stringify({ tier: 'pro' }), { status: 200 })],
  ])('keeps %s unavailable instead of granting access', async (_, response) => {
    request.mockImplementation(async () => response());
    const result = checkCheckoutAccess(new AbortController().signal);
    await vi.runAllTimersAsync();
    expect(await result).toBe('unavailable');
    expect(request).toHaveBeenCalledTimes(12);
  });

  it('stops immediately when authentication is missing', async () => {
    request.mockResolvedValue(new Response('', { status: 401 }));
    expect(await checkCheckoutAccess(new AbortController().signal)).toBe('unauthenticated');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('bounds a fetch that ignores abort to 30 seconds, aborting each request', async () => {
    request.mockImplementation(() => new Promise(() => {}));
    const result = checkCheckoutAccess(new AbortController().signal);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await result).toBe('unavailable');
    expect(request).toHaveBeenCalledTimes(5);
    expect(request.mock.calls.every(([, options]) => options?.signal?.aborted)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels a hanging response body and ignores a late Pro result', async () => {
    const body = deferred<unknown>();
    request.mockResolvedValue({ ok: true, status: 200, json: () => body.promise } as Response);
    const controller = new AbortController();
    const result = checkCheckoutAccess(controller.signal);
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    expect(await result).toBe('cancelled');
    body.resolve({ realTier: 'pro' });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(request).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels during the polling interval and never starts another request', async () => {
    request.mockResolvedValue(tier('free'));
    const controller = new AbortController();
    const result = checkCheckoutAccess(controller.signal);
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    expect(await result).toBe('cancelled');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe('real checkout return component lifecycle and controls', () => {
  it.each(['', '?upgrade=cancelled', '?session_id=cs_test'])('stays hidden without a success return: %s', (query) => {
    location.href = `https://helmterminal.dev/dashboard${query}`;
    expect(render()).toEqual([]);
    expect(request).not.toHaveBeenCalled();
  });

  it('reloads the current same-origin document only after Free becomes Pro', async () => {
    request.mockResolvedValueOnce(tier('free')).mockResolvedValueOnce(tier('pro'));
    render();
    expect(retry().props.disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(replace).not.toHaveBeenCalled();
    // A dashboard navigation while waiting must not send the buyer backwards.
    location.href = 'https://helmterminal.dev/dashboard/theses?upgrade=success&view=open&session_id=cs_test&view=all#evidence';
    await vi.advanceTimersByTimeAsync(2_000);
    expect(replace).toHaveBeenCalledExactlyOnceWith('/dashboard/theses?view=open&view=all#evidence');
  });

  it('shows honest pending help on a spoofed return, and deduplicates manual retries', async () => {
    request.mockImplementation(async () => tier('free', { tier: 'pro' }));
    render();
    await vi.runAllTimersAsync();
    expect(replace).not.toHaveBeenCalled();
    expect(visibleText()).toContain('Your Pro access is not confirmed yet');
    expect(render().find((node) => node.props.href === '/contact')).toBeDefined();
    const late = deferred<Response>();
    request.mockImplementation(() => late.promise);
    const button = retry();
    button.props.onClick();
    button.props.onClick();
    expect(request).toHaveBeenCalledTimes(13);
    expect(retry().props.disabled).toBe(true);
    late.resolve(tier('pro'));
    await vi.advanceTimersByTimeAsync(0);
    expect(replace).toHaveBeenCalledExactlyOnceWith('/dashboard');
  });

  it('offers sign-in and support after 401 without claiming a failed payment', async () => {
    request.mockResolvedValue(new Response('', { status: 401 }));
    render();
    await vi.advanceTimersByTimeAsync(0);
    expect(visibleText()).toContain('Sign in to check your membership');
    const login = render().find((node) => node.props.children === 'Sign in')!;
    const next = new URL(login.props.href, 'https://helmterminal.dev').searchParams.get('redirect');
    expect(next).toBe('/dashboard?upgrade=success&session_id=cs_test');
    expect(retry().props.disabled).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it('offers a recoverable check after provider errors, without another checkout', async () => {
    request.mockRejectedValue(new Error('offline'));
    render();
    await vi.runAllTimersAsync();
    expect(visibleText()).toContain('We couldn’t check your membership');
    request.mockResolvedValue(tier('max'));
    retry().props.onClick();
    await vi.advanceTimersByTimeAsync(0);
    expect(replace).toHaveBeenCalledExactlyOnceWith('/dashboard');
    expect(request.mock.calls.every(([url, options]) => url === '/api/user/tier' && !options?.method)).toBe(true);
  });

  it('ignores an unmounted request even when the late response claims Pro', async () => {
    const late = deferred<Response>();
    request.mockImplementation(() => late.promise);
    render();
    unmount();
    const updates = h.updates;
    late.resolve(tier('pro'));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(replace).not.toHaveBeenCalled();
    expect(h.updates).toBe(updates);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('keeps a replayed mount independent from a stale aborted request', async () => {
    const late = deferred<Response>();
    request.mockImplementationOnce(() => late.promise).mockImplementation(async () => tier('free'));
    render();
    unmount();
    // React StrictMode replays the effect, retaining state/ref/callback slots.
    h.slots[h.slots.length - 1] = undefined;
    render();
    late.resolve(tier('pro'));
    await vi.runAllTimersAsync();
    expect(replace).not.toHaveBeenCalled();
    expect(visibleText()).toContain('Your Pro access is not confirmed yet');
    expect(request).toHaveBeenCalledTimes(13);
  });
});

describe('checkout return URL cleanup', () => {
  it('removes only checkout-return keys, preserving unrelated duplicates and hash', () => {
    expect(checkoutReturnPath('https://helmterminal.dev/dashboard?upgrade=success&keep=a&session_id=one&keep=b&session_id=two#chart'))
      .toBe('/dashboard?keep=a&keep=b#chart');
  });

  it('does not follow an external query destination or protocol-relative pathname', () => {
    expect(checkoutReturnPath('https://helmterminal.dev/dashboard?upgrade=success&next=https%3A%2F%2Fevil.example#x'))
      .toBe('/dashboard?next=https%3A%2F%2Fevil.example#x');
    expect(checkoutReturnPath('https://helmterminal.dev//evil.example?upgrade=success'))
      .toBe('/dashboard');
  });
});
