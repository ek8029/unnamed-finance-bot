'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Loader2, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlaidLinkButtonProps {
  onSuccess: () => void;
  onError?: (error: string) => void;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  children?: React.ReactNode;
}

export function PlaidLinkButton({
  onSuccess,
  onError,
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

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to link account');
      }

      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to link account';
      onError?.(message);
    } finally {
      setExchanging(false);
    }
  }, [onSuccess, onError]);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? '',
    onSuccess: handleSuccess,
    onExit: (err) => {
      if (err) {
        console.error('Plaid Link exit error:', err);
      }
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
      onClick={() => open()}
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
