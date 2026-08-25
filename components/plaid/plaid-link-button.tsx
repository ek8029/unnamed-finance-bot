'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Loader2, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import posthog from 'posthog-js';
import { useDemo } from '@/contexts/demo-context';
import { resolveLinkExitError } from '@/lib/plaid/link-exit';
import { runBackgroundSync, type BackgroundSyncResult } from '@/lib/plaid/background-sync';

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
  const { disableDemo } = useDemo();
  // Last institution the user searched for, so an exit can say what they wanted.
  const lastSearchRef = useRef<string | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  // Fetch link token once on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchToken() {
      try {
        const res = await fetch('/api/plaid/create-link-token', { method: 'POST' });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to create link token');
        }
        const data = await res.json();
        if (!cancelled) {
          setLinkToken(data.link_token);
        }
      } catch (err) {
        if (!cancelled) {
          setTokenError(true);
          const message = err instanceof Error ? err.message : 'Failed to initialize Plaid';
          onErrorRef.current?.(message);
        }
      }
    }

    fetchToken();
    return () => { cancelled = true; };
  }, []);

  const handleSuccess = useCallback(async (publicToken: string, metadata: unknown) => {
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
      sessionStorage.removeItem('helm_last_price_refresh');
      const itemId = typeof data.item_id === 'string' ? data.item_id : undefined;
      onSuccess(itemId);
      void runBackgroundSync().then((result) => onSyncedRef.current?.(result, itemId));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to link account';
      onError?.(message);
    } finally {
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

  const isLoading = !linkToken && !tokenError;
  const isDisabled = !ready || exchanging || tokenError;

  const label = exchanging
    ? 'Linking...'
    : isLoading
      ? 'Initializing...'
      : tokenError
        ? 'Connection Error'
        : null;

  return (
    <Button
      variant={variant}
      className={className}
      onClick={() => { if (!exchanging) { onOpen?.(); posthog.capture('plaid_link_started'); open(); } }}
      disabled={isDisabled}
    >
      {(isLoading || exchanging) ? (
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
      ) : (
        <Link2 className="w-4 h-4 mr-2" />
      )}
      {children || label || 'Connect with Plaid'}
    </Button>
  );
}
