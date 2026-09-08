'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Loader2, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import posthog from 'posthog-js';
import { useDemo } from '@/contexts/demo-context';
import { resolveLinkExitError } from '@/lib/plaid/link-exit';
import { runBackgroundSync, type BackgroundSyncResult } from '@/lib/plaid/background-sync';
import { AUTO_SYNC_ATTEMPT_KEY } from '@/lib/plaid/sync-client';
import { createLinkTokenLoader, linkButtonStatus } from '@/lib/plaid/link-token-loader';

interface PlaidLinkButtonProps {
  /** Receives the new item id. Optional so existing `() => void`
   *  handlers stay valid. */
  onSuccess: (itemId?: string) => void;
  onError?: (error: string) => void;
  onLinkError?: (errorCode: string, message: string) => void;
  onExit?: () => void;
  onWarning?: (message: string) => void;
  /** Fires when the user actually opens Link. A wrapper's onClickCapture
   *  cannot tell: the disabled button uses pointer-events-none, so clicks
   *  while it is disabled fall through to the wrapper and count as starts. */
  onOpen?: () => void;
  /** The background sync behind onSuccess settled. Minutes later on a real
   *  book; the button may be unmounted by then, the callback still runs. */
  onSynced?: (result: BackgroundSyncResult, itemId?: string) => void;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  children?: React.ReactNode;
}

export function PlaidLinkButton({
  onSuccess,
  onError,
  onLinkError,
  onExit,
  onWarning,
  onOpen,
  onSynced,
  className,
  variant = 'default',
  children,
}: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [exchanging, setExchanging] = useState(false);
  const [tokenError, setTokenError] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [tokenAttempt, setTokenAttempt] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const initializingRef = useRef(true);
  const exchangingRef = useRef(false);
  const linkOpenRef = useRef(false);
  const tokenLoaderRef = useRef<ReturnType<typeof createLinkTokenLoader> | null>(null);
  if (!tokenLoaderRef.current) tokenLoaderRef.current = createLinkTokenLoader((...args) => fetch(...args));
  const { disableDemo } = useDemo();
  // Last institution the user searched for, so an exit can say what they wanted.
  const lastSearchRef = useRef<string | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  // Retry initialization without remounting the surrounding onboarding flow.
  useEffect(() => {
    let cancelled = false;
    const loader = tokenLoaderRef.current!;

    async function fetchToken() {
      try {
        const token = await loader.load();
        if (!cancelled && token) {
          setLinkToken(token);
          setTokenError(false);
        }
      } catch (err) {
        if (!cancelled) {
          setTokenError(true);
          const message = err instanceof Error ? err.message : 'Failed to initialize Plaid';
          onErrorRef.current?.(message);
        }
      } finally {
        if (!cancelled) {
          initializingRef.current = false;
          setInitializing(false);
        }
      }
    }

    fetchToken();
    return () => { cancelled = true; loader.cancel(); };
  }, [tokenAttempt]);

  const handleSuccess = useCallback(async (publicToken: string, metadata: unknown) => {
    if (exchangingRef.current) return;
    exchangingRef.current = true;
    linkOpenRef.current = false;
    setLinkOpen(false);
    setExchanging(true);
    try {
      const res = await fetch('/api/plaid/exchange-public-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_token: publicToken,
          metadata,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to link account');
      }

      if (data.duplicate_institution) {
        onWarning?.('This institution was already connected. Duplicate connection created.');
      }

      // The item and its accounts exist from here. Hand it back now and pull
      // the holdings in the background: that pull takes one to six minutes on
      // a real book, and the 8/16 Wells Fargo link is active in the database
      // with no completion because the person left while this said "Linking".
      posthog.capture('plaid_link_completed');
      // Real accounts connected: end demo mode so sample data does not linger.
      try { sessionStorage.removeItem('helm_demo_mode'); } catch {}
      disableDemo();
      sessionStorage.removeItem('helm_last_auto_sync');
      // The scoped import below owns this attempt. A dashboard remount should
      // not immediately fan out into a second, all-institution refresh.
      sessionStorage.setItem(AUTO_SYNC_ATTEMPT_KEY, String(Date.now()));
      sessionStorage.removeItem('helm_last_price_refresh');
      const itemId = typeof data.item_id === 'string' ? data.item_id : undefined;
      onSuccess(itemId);
      // Only the newly linked item needs its first import; an older broken
      // institution must not turn this connection into a failed first run.
      void (itemId ? runBackgroundSync({ itemId }) : Promise.resolve('failed' as const)).then((result) => onSyncedRef.current?.(result, itemId));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to link account';
      onError?.(message);
    } finally {
      exchangingRef.current = false;
      setExchanging(false);
    }
  }, [onSuccess, onError, onWarning, disableDemo]);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? '',
    onSuccess: handleSuccess,
    // WHAT THE USER TYPED, not just that they failed.
    //
    // `institution_name` on exit is null unless an institution was actually
    // selected, so every `institution_not_found` exit told us someone could not
    // find their brokerage and nothing about which one. Nine people hit that and
    // the list of institutions they wanted is unrecoverable.
    //
    // Link fires SEARCH_INSTITUTION with the query as the user types. Keeping
    // the last one lets the exit event carry it. Only the search term is
    // recorded, never credentials, and only when the user is searching Helm's
    // own Link instance.
    onEvent: (eventName, metadata) => {
      if (eventName === 'SEARCH_INSTITUTION') {
        const q = metadata?.institution_search_query;
        if (q) lastSearchRef.current = q;
      }
    },
    onExit: (err, metadata) => {
      linkOpenRef.current = false;
      setLinkOpen(false);
      posthog.capture('plaid_link_exit', {
        exit_status: metadata?.status ?? null,
        error_type: err?.error_type ?? null,
        error_code: err?.error_code ?? null,
        institution_name: metadata?.institution?.name ?? null,
        // Populated on institution_not_found, where institution_name is null.
        institution_search_query: lastSearchRef.current ?? null,
      });
      const linkError = resolveLinkExitError(err, metadata?.status);
      if (linkError) {
        if (err) console.error('Plaid Link exit error:', err);
        onLinkError?.(linkError.code, linkError.message);
      }
      onExit?.();
    },
  });

  const status = linkButtonStatus({ initializing, tokenError, ready, exchanging, linkOpen });

  const handleClick = () => {
    if (initializingRef.current || exchangingRef.current || linkOpenRef.current) return;
    if (tokenError) {
      initializingRef.current = true;
      setInitializing(true);
      setTokenError(false);
      setLinkToken(null);
      setTokenAttempt(attempt => attempt + 1);
      return;
    }
    if (!ready || !linkToken) return;
    linkOpenRef.current = true;
    setLinkOpen(true);
    lastSearchRef.current = null;
    try {
      onOpen?.();
      posthog.capture('plaid_link_started');
      open();
    } catch {
      linkOpenRef.current = false;
      setLinkOpen(false);
      onErrorRef.current?.('Could not open the connection window. Please try again.');
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      onClick={handleClick}
      disabled={status.disabled}
      aria-busy={status.busy}
    >
      {status.busy ? (
        <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin mr-2" />
      ) : (
        <Link2 aria-hidden="true" className="w-4 h-4 mr-2" />
      )}
      <span aria-live="polite">{status.label ?? children ?? 'Connect with Plaid'}</span>
    </Button>
  );
}
