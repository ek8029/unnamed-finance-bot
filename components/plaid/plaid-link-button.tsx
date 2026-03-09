'use client';

import { useState, useCallback } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [plaidReady, setPlaidReady] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);

  const createLinkToken = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/plaid/create-link-token', { method: 'POST' });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create link token');
      }

      const data = await res.json();
      setLinkToken(data.link_token);
      return data.link_token;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize Plaid';
      onError?.(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [onError]);

  const openPlaidLink = useCallback(async () => {
    // Get or create link token
    let token = linkToken;
    if (!token) {
      token = await createLinkToken();
      if (!token) return;
    }

    setLoading(true);

    // Dynamically load Plaid Link script if not already loaded
    if (!(window as unknown as Record<string, unknown>).Plaid) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Plaid Link'));
        document.head.appendChild(script);
      });
    }

    const Plaid = (window as unknown as Record<string, unknown>).Plaid as {
      create: (config: Record<string, unknown>) => {
        open: () => void;
        destroy: () => void;
      };
    };

    const handler = Plaid.create({
      token,
      onSuccess: async (publicToken: string, metadata: Record<string, unknown>) => {
        setLoading(true);
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
          setLoading(false);
        }
      },
      onExit: (err: unknown) => {
        setLoading(false);
        if (err) {
          console.error('Plaid Link exit error:', err);
        }
      },
      onLoad: () => {
        setPlaidReady(true);
      },
    });

    handler.open();
  }, [linkToken, createLinkToken, onSuccess, onError]);

  return (
    <Button
      variant={variant}
      className={className}
      onClick={openPlaidLink}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
      ) : (
        <Link2 className="w-4 h-4 mr-2" />
      )}
      {children || (loading ? 'Connecting...' : 'Connect with Plaid')}
    </Button>
  );
}
