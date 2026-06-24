'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { HelmMark } from '@/components/helm-mark';
import { PlaidLinkButton } from '@/components/plaid/plaid-link-button';
import { Shield } from 'lucide-react';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

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
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-inset)]">
        <div className="animate-pulse">
          <HelmMark size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--color-bg-inset)] text-[var(--color-text-primary)]">
      <div className="w-full max-w-md mx-auto p-8 text-center">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="w-8 h-1 rounded-full bg-[var(--color-gold)]" />
          <div className="w-8 h-1 rounded-full bg-[var(--color-gold)]" />
          <div className="w-8 h-1 rounded-full bg-white/10" />
        </div>

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <HelmMark size={36} />
        </div>

        {/* Eyebrow */}
        <p
          className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]"
          style={MONO}
        >
          Helm Wrapped &middot; 2025
        </p>

        {/* Headline */}
        <h1 className="type-h1 mt-5">
          Connect your brokerage
        </h1>

        {/* Subtext */}
        <p className="type-body mt-4 max-w-sm mx-auto text-[15px] leading-[1.65] text-[#9A9A9A]">
          Helm reads your portfolio history to build your personalized year in
          review. Read-only, we can never trade or transfer.
        </p>

        {/* Already connected shortcut */}
        <button
          onClick={() => router.push('/dashboard/wrapped')}
          className="font-mono text-[12px] uppercase tracking-[0.14em] text-[#7A7A7A] hover:text-[var(--color-gold)] transition-colors mt-4 cursor-pointer"
          style={MONO}
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
          <p className="text-[14px] text-[#F87171] mt-4">{error}</p>
        )}

        {/* Trust signals */}
        <div className="sovereign-card rounded-lg px-5 py-4 mt-8 flex flex-col items-center gap-2.5">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-[var(--color-positive)]" />
            <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-[#9A9A9A]" style={MONO}>
              Read-only access &middot; Bank-level encryption
            </span>
          </div>
          <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-[#7A7A7A]" style={MONO}>
            12,000+ institutions supported
          </span>
          <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-[#7A7A7A]" style={MONO}>
            Takes about 30 seconds
          </span>
        </div>
      </div>
    </div>
  );
}
