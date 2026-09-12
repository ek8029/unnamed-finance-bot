'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loginUrlForNext } from '@/lib/checkout-intent';

type CheckResult = 'confirmed' | 'pending' | 'unavailable' | 'unauthenticated' | 'cancelled';
type DisplayState = 'hidden' | 'checking' | Exclude<CheckResult, 'confirmed' | 'cancelled'>;

const POLL_INTERVAL_MS = 2_000;
const REQUEST_TIMEOUT_MS = 5_000;
const TOTAL_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 12;

/** This is a read of server access, not proof of a payment. The success query
 * parameter only requests a check; open-access preview tiers cannot confirm it. */
function readAccess(signal: AbortSignal, timeoutMs: number): Promise<CheckResult> {
  if (signal.aborted) return Promise.resolve('cancelled');
  return new Promise((resolve) => {
    const request = new AbortController();
    let settled = false;
    const finish = (result: CheckResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      request.abort();
      resolve(result);
    };
    const cancel = () => finish('cancelled');
    // Resolve ourselves as well as aborting fetch: a late response/body must
    // never outlive this request's timeout or a component cleanup.
    const timer = setTimeout(() => finish('unavailable'), timeoutMs);
    signal.addEventListener('abort', cancel, { once: true });
    void (async () => {
      try {
        const response = await fetch('/api/user/tier', {
          cache: 'no-store', credentials: 'same-origin', signal: request.signal,
        });
        if (response.status === 401) return finish('unauthenticated');
        if (!response.ok) return finish('unavailable');
        const data = await response.json();
        if (data?.realTier === 'pro' || data?.realTier === 'max') return finish('confirmed');
        finish(data?.realTier === 'free' ? 'pending' : 'unavailable');
      } catch {
        finish('unavailable');
      }
    })();
  });
}

function pause(signal: AbortSignal, milliseconds: number): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    signal.addEventListener('abort', finish, { once: true });
  });
}

/** Bounded, uncached polling shared by the real component and regression tests. */
export async function checkCheckoutAccess(signal: AbortSignal): Promise<CheckResult> {
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let result: CheckResult = 'pending';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (signal.aborted) return 'cancelled';
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    result = await readAccess(signal, Math.min(REQUEST_TIMEOUT_MS, remaining));
    if (signal.aborted) return 'cancelled';
    if (result === 'confirmed' || result === 'unauthenticated') return result;
    const timeLeft = deadline - Date.now();
    if (timeLeft <= 0) break;
    if (attempt + 1 < MAX_ATTEMPTS) {
      await pause(signal, Math.min(POLL_INTERVAL_MS, timeLeft));
    }
  }
  return signal.aborted ? 'cancelled' : result;
}

/** Use the current document's path, never a next/return URL from the query. */
export function checkoutReturnPath(href: string): string {
  const url = new URL(href);
  url.searchParams.delete('upgrade');
  url.searchParams.delete('session_id');
  // A leading // path would be treated as a different host by location.replace.
  const pathname = url.pathname.startsWith('//') ? '/dashboard' : url.pathname;
  return `${pathname}${url.search}${url.hash}`;
}

export function CheckoutReturnStatus() {
  const [state, setState] = useState<DisplayState>('hidden');
  const [loginHref, setLoginHref] = useState('/login');
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(false);

  const check = useCallback(async () => {
    // Synchronous guard also protects two clicks before React disables a button.
    if (!mounted.current || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setState('checking');
    try {
      const result = await checkCheckoutAccess(controller.signal);
      if (!mounted.current || controller.signal.aborted || active.current !== controller) return;
      if (result === 'confirmed') {
        // A fresh document resets both useTier's cache and the root production
        // PreviewProvider. Invalidating one cache cannot update mounted readers.
        window.location.replace(checkoutReturnPath(window.location.href));
      } else if (result !== 'cancelled') {
        setState(result);
      }
    } catch {
      if (mounted.current && !controller.signal.aborted && active.current === controller) {
        setState('unavailable');
      }
    } finally {
      if (active.current === controller) active.current = null;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const url = new URL(window.location.href);
    if (url.searchParams.get('upgrade') === 'success') {
      setLoginHref(loginUrlForNext(`${url.pathname}${url.search}${url.hash}`));
      void check();
    }
    return () => {
      mounted.current = false;
      active.current?.abort();
      active.current = null;
    };
  }, [check]);

  if (state === 'hidden') return null;

  const checking = state === 'checking';
  const title = checking ? 'Checking your membership'
    : state === 'unauthenticated' ? 'Sign in to check your membership'
    : state === 'pending' ? 'Your Pro access is not confirmed yet'
    : 'We couldn’t check your membership';
  const detail = checking
    ? 'If you completed checkout, your access may take a moment to update. This page will refresh once it is ready.'
    : state === 'unauthenticated'
      ? 'Sign in with the account you used at checkout, then we can check your access.'
      : state === 'pending'
        ? 'If you just completed checkout, the update may still be arriving. Check again shortly or contact us for help.'
        : 'We could not confirm your access right now. Check again or contact us for help.';

  return (
    <aside
      aria-label="Checkout status"
      className="fixed bottom-20 left-4 right-4 z-[150] rounded-xl border border-[var(--color-gold-border)] bg-[var(--color-bg-surface)] p-5 shadow-xl sm:bottom-6 sm:left-auto sm:w-[420px]"
    >
      <div role="status" aria-live="polite" aria-atomic="true">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">{detail}</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
        {state === 'unauthenticated' && (
          <a href={loginHref} className="inline-flex min-h-[44px] items-center font-semibold text-[var(--color-gold)] hover:underline">Sign in</a>
        )}
        <button
          type="button"
          onClick={() => { void check(); }}
          disabled={checking}
          className="inline-flex min-h-[44px] items-center font-semibold text-[var(--color-gold)] hover:underline disabled:cursor-wait disabled:opacity-60"
        >
          {checking ? 'Checking…' : 'Check again'}
        </button>
        <a href="/contact" className="inline-flex min-h-[44px] items-center text-[var(--color-text-secondary)] hover:underline">Contact support</a>
      </div>
    </aside>
  );
}
