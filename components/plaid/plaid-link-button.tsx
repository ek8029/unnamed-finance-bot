'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Loader2, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import posthog from 'posthog-js';
import { useDemo } from '@/contexts/demo-context';

// User-friendly messages for common Plaid Link error codes
const PLAID_ERROR_MESSAGES: Record<string, string> = {
  INSTITUTION_REGISTRATION_REQUIRED:
    'Your bank requires online banking to be set up. Please enable online banking with your institution and try again.',
  INSTITUTION_NO_LONGER_SUPPORTED:
    'This institution is no longer supported by Plaid. Try connecting a different account.',
  // "Try a different name" is the wrong advice and it is what nine people were
  // given. Plaid's catalogue genuinely does not include every broker: Webull
  // and Public.com are absent from PRODUCTION entirely, so searching harder
  // cannot work. Say that, and point at the path that does.
  INSTITUTION_NOT_FOUND:
    'Plaid does not cover every broker. Webull and Public are not available through it. You can add those holdings by importing them instead.',
  INSTITUTION_DOWN:
    'This institution is temporarily unavailable. Please try again later.',
  INVALID_CREDENTIALS:
    'The credentials you entered were incorrect. Please try again.',
  ITEM_LOCKED:
    'Your account is locked. Please unlock it with your institution and try again.',
};

interface PlaidLinkButtonProps {
  onSuccess: () => void;
  onError?: (error: string) => void;
  onLinkError?: (errorCode: string, message: string) => void;
  onExit?: () => void;
  onWarning?: (message: string) => void;
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

      sessionStorage.removeItem('helm_last_auto_sync');
      sessionStorage.removeItem('helm_last_price_refresh');
      await fetch('/api/plaid/sync', { method: 'POST' }).catch(() => {});
      // Refresh market prices so holdings have real prices (Plaid sandbox doesn't provide them)
      await fetch('/api/market/prices/refresh', { method: 'POST' }).catch(() => {});

      posthog.capture('plaid_link_completed');
      // Real accounts connected: end demo mode so sample data does not linger.
      try { sessionStorage.removeItem('helm_demo_mode'); } catch {}
      disableDemo();
      onSuccess();
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
      if (err) {
        console.error('Plaid Link exit error:', err);
        const code = err.error_code || '';
        const friendlyMessage =
          PLAID_ERROR_MESSAGES[code] ||
          err.display_message ||
          'Something went wrong connecting your account. Please try again.';
        onLinkError?.(code, friendlyMessage);
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
      onClick={() => { if (!exchanging) { posthog.capture('plaid_link_started'); open(); } }}
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
