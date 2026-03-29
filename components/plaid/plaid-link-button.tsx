'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Loader2, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlaidLinkButtonProps {
  onSuccess: () => void;
  onError?: (error: string) => void;
  onExit?: () => void;
  onWarning?: (message: string) => void;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  children?: React.ReactNode;
}

export function PlaidLinkButton({
  onSuccess,
  onError,
  onExit,
  onWarning,
  className,
  variant = 'default',
  children,
}: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [exchanging, setExchanging] = useState(false);
  const [tokenError, setTokenError] = useState(false);

  // Fetch link token when the component mounts
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
          onError?.(message);
        }
      }
    }

    fetchToken();
    return () => { cancelled = true; };
  }, [onError]);

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
