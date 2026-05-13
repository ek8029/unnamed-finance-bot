'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { HelmMark } from '@/components/helm-mark';
import { PlaidLinkButton } from '@/components/plaid/plaid-link-button';
import { Shield } from 'lucide-react';

export default function WrappedConnectPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/signup?flow=wrapped');
        return;
      }
      setAuthed(true);
      // If user already has Plaid connected, skip straight to Wrapped
      fetch('/api/financial-summary')
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.hasPlaidConnection) router.replace('/dashboard/wrapped');
        })
        .catch(() => {});
    });
  }, [router]);

  const handlePlaidSuccess = () => {
    router.push('/dashboard/wrapped');
  };

  // Loading state while checking auth
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0A0A0A' }}>
        <div className="animate-pulse">
          <HelmMark size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0A0A0A' }}>
      <div className="w-full max-w-md mx-auto p-8 text-center">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <HelmMark size={32} />
        </div>

        {/* Eyebrow */}
        <p
          className="font-mono text-[10px] tracking-[0.2em] uppercase"
          style={{ color: '#E6B94D' }}
        >
          Helm Wrapped &middot; 2025
        </p>

        {/* Headline */}
        <h1 className="text-2xl font-bold text-white mt-4">
          Connect your brokerage
        </h1>

        {/* Subtext */}
        <p
          className="text-sm leading-relaxed mt-3 max-w-sm mx-auto"
          style={{ color: 'var(--color-text-muted, #888)' }}
        >
          Helm reads your portfolio history to create your personalized year in
          review. Read-only — we can never trade or transfer.
        </p>

        {/* Already connected shortcut */}
        <button
          onClick={() => router.push('/dashboard/wrapped')}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-gold)] transition-colors mt-3 cursor-pointer"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Already connected? Skip to Wrapped &rarr;
        </button>

        {/* Plaid connect button */}
        <div className="flex justify-center mt-8">
          <PlaidLinkButton
            onSuccess={handlePlaidSuccess}
            onError={(msg: string) => setError(msg)}
            className="w-full max-w-xs"
            variant="default"
          >
            Connect with Plaid
          </PlaidLinkButton>
        </div>

        {/* Error display */}
        {error && (
          <p className="text-sm text-red-400 mt-4">{error}</p>
        )}

        {/* Trust signals */}
        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted, #888)' }} />
            <span className="text-xs" style={{ color: 'var(--color-text-muted, #888)' }}>
              Read-only access &middot; Bank-level encryption
            </span>
          </div>
          <span className="text-xs" style={{ color: 'var(--color-text-muted, #888)' }}>
            12,000+ institutions supported
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-muted, #888)' }}>
            Takes about 30 seconds
          </span>
        </div>
      </div>
    </div>
  );
}
