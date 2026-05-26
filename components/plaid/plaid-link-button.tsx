'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Loader2, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// User-friendly messages for common Plaid Link error codes
const PLAID_ERROR_MESSAGES: Record<string, string> = {
  INSTITUTION_REGISTRATION_REQUIRED:
    'Your bank requires online banking to be set up. Please enable online banking with your institution and try again.',
  INSTITUTION_NO_LONGER_SUPPORTED:
    'This institution is no longer supported by Plaid. Try connecting a different account.',
  INSTITUTION_NOT_FOUND:
    'Institution not found. Try searching with a different name.',
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

      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to link account';
      onError?.(message);
    } finally {
      setExchanging(false);
    }
  }, [onSuccess, onError, onWarning]);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? '',
    onSuccess: handleSuccess,
    onExit: (err) => {
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
      onClick={() => { if (!exchanging) open(); }}
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
