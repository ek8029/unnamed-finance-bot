'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Loader2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlaidUpdateLinkProps {
  itemId: string;
  institutionName: string;
  onSuccess: () => void;
  onError?: (error: string) => void;
}

/**
 * Opens Plaid Link in UPDATE mode to reconnect a broken bank connection.
 * Used when a plaid_item has status 'login_required' or 'error'.
 */
export function PlaidUpdateLink({
  itemId,
  institutionName,
  onSuccess,
  onError,
}: PlaidUpdateLinkProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'reconnecting' | 'error'>('idle');
  const hasOpened = useRef(false);

  const fetchUpdateToken = useCallback(async () => {
    setStatus('loading');
    hasOpened.current = false;
    try {
      const res = await fetch('/api/plaid/create-update-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create update token');
      }

      const data = await res.json();
      setLinkToken(data.link_token);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      onError?.(err instanceof Error ? err.message : 'Failed to initialize reconnection');
    }
  }, [itemId, onError]);

  const handleSuccess = useCallback(async () => {
    setStatus('reconnecting');
    try {
      // Trigger a sync to refresh data after reconnection
      await fetch('/api/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId }),
      });
      onSuccess();
    } catch {
      // The reconnection itself succeeded even if sync fails
      onSuccess();
    }
  }, [itemId, onSuccess]);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? '',
    onSuccess: handleSuccess,
    onExit: (err) => {
      if (err) {
        console.error('Plaid Update Link exit error:', err);
        onError?.('Reconnection was cancelled');
      }
      setStatus('idle');
    },
  });

  // Auto-open when ready
  useEffect(() => {
    if (ready && status === 'ready' && !hasOpened.current) {
      hasOpened.current = true;
      open();
    }
  }, [ready, status, open]);

  const isLoading = status === 'loading' || status === 'reconnecting';

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={fetchUpdateToken}
      disabled={isLoading}
      className="text-[var(--color-negative)] border-[var(--color-negative)]/30 hover:bg-[var(--color-negative)]/10"
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
      ) : (
        <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
      )}
      {status === 'reconnecting' ? 'Syncing...' : 'Reconnect'}
    </Button>
  );
}
