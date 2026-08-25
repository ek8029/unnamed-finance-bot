'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { useRouter } from 'next/navigation';
import { HelmMark } from '@/components/helm-mark';
import { Loader2, AlertCircle } from 'lucide-react';

export default function OAuthCallbackPage() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'linking' | 'exchanging' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasOpened = useRef(false);

  // Step 1: Fetch a new link token for OAuth re-initialization
  useEffect(() => {
    async function fetchToken() {
      try {
        const res = await fetch('/api/plaid/create-link-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            receivedRedirectUri: window.location.href,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to initialize connection');
        }

        const data = await res.json();
        setLinkToken(data.link_token);
        setStatus('linking');
      } catch (err) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Failed to resume bank connection');
      }
    }

    fetchToken();
  }, []);

  // Step 3: Exchange public token on success
  const handleSuccess = useCallback(async (publicToken: string, metadata: unknown) => {
    setStatus('exchanging');
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

      // Hand off to the dashboard. With these keys cleared its auto-sync runs
      // on mount and refetches when done, so one sync happens, not two, and
      // this page no longer holds people for one to six minutes on a real book.
      sessionStorage.removeItem('helm_last_auto_sync');
      sessionStorage.removeItem('helm_last_price_refresh');

      setStatus('success');
      router.push('/dashboard');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to complete account linking');
    }
  }, [router]);

  const handleExit = useCallback(() => {
    setStatus('error');
    setErrorMessage('Bank connection was cancelled. Please try again from the Accounts page.');
  }, []);

  // Step 2: Initialize Plaid Link with receivedRedirectUri for OAuth continuation
  const { open, ready } = usePlaidLink({
    token: linkToken ?? '',
    receivedRedirectUri: typeof window !== 'undefined' ? window.location.href : undefined,
    onSuccess: handleSuccess,
    onExit: handleExit,
  });

  // Auto-open Plaid Link as soon as the hook is ready
  useEffect(() => {
    if (ready && !hasOpened.current) {
      hasOpened.current = true;
      open();
    }
  }, [ready, open]);

  const statusText = {
    loading: 'Resuming bank connection...',
    linking: 'Opening secure connection...',
    exchanging: 'Completing bank connection...',
    success: 'Account linked successfully. Redirecting...',
    error: errorMessage || 'Something went wrong',
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-6 max-w-md text-center">
        <HelmMark size={48} />

        {status === 'error' ? (
          <>
            <AlertCircle className="w-8 h-8 text-[var(--color-negative)]" />
            <div className="space-y-2">
              <h1 className="type-h2 text-[var(--color-text-primary)]">Connection Failed</h1>
              <p className="type-body text-[var(--color-text-secondary)]">
                {statusText[status]}
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard/accounts')}
              className="px-6 py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold rounded transition-colors text-[15px]"
            >
              Back to Accounts
            </button>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 text-[var(--color-gold)] animate-spin" />
            <div className="space-y-2">
              <h1 className="type-h2 text-[var(--color-text-primary)]">
                {status === 'success' ? 'Account Connected' : 'Completing Bank Connection'}
              </h1>
              <p className="type-body text-[var(--color-text-secondary)]">
                {statusText[status]}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
