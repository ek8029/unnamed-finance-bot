'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { AuthShell } from '@/components/auth-shell';

export default function MfaVerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState('');
  const [checking, setChecking] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // On mount, find the user's TOTP factor
  useEffect(() => {
    async function checkFactors() {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error || !data?.totp?.length) {
        router.push('/dashboard');
        return;
      }

      const verified = data.totp.filter(f => f.status === 'verified');
      if (verified.length === 0) {
        router.push('/dashboard');
        return;
      }

      setFactorId(verified[0].id);
      setChecking(false);

      setTimeout(() => inputRef.current?.focus(), 100);
    }
    checkFactors();
  }, [router]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;

      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid verification code';
      setError(message);
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center">
        <div className="text-[var(--color-text-muted)]">Loading...</div>
      </div>
    );
  }

  return (
    <AuthShell subtitle="Two-factor authentication">
      <form onSubmit={handleVerify} className="space-y-6">
        {error && (
          <div className="bg-[var(--color-negative-muted)] border border-[var(--color-negative-border)] text-[var(--color-negative-text)] px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-[var(--color-gold)]/10 border border-[var(--color-gold)]/20 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-[var(--color-gold)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-[var(--color-text-secondary)] text-sm">
            Enter the 6-digit code from your authenticator app to continue
          </p>
        </div>

        <div>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            required
            autoComplete="one-time-code"
            aria-label="Verification code"
            className="w-full px-4 py-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-lg text-[var(--color-text-primary)] text-center text-2xl tracking-[0.5em] font-mono placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)] transition-colors"
            placeholder="------"
          />
        </div>

        <button
          type="submit"
          disabled={code.length !== 6 || loading}
          className="w-full py-3 px-4 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] disabled:opacity-50 text-[var(--color-bg-base)] font-semibold rounded-lg transition-colors"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>

        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut();
            router.push('/login');
            router.refresh();
          }}
          className="w-full text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          Sign out and go back
        </button>
      </form>
    </AuthShell>
  );
}
