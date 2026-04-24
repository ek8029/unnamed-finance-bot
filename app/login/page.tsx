'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';
import { supabase } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';
  const message = searchParams.get('message');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // MFA state
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [verifyingMfa, setVerifyingMfa] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Load saved email if "remember me" was previously used
  useEffect(() => {
    const savedEmail = localStorage.getItem('helm_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Auto-focus code input when MFA step appears
  useEffect(() => {
    if (mfaStep && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [mfaStep]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      // Save or clear remembered email
      if (rememberMe) {
        localStorage.setItem('helm_remembered_email', email);
      } else {
        localStorage.removeItem('helm_remembered_email');
      }

      // Check if MFA is required
      if (data.mfa_required) {
        setFactorId(data.factor_id);
        setMfaStep(true);
        setLoading(false);
        return;
      }

      router.push(redirect);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setVerifyingMfa(true);

    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: mfaCode,
      });
      if (verifyError) throw verifyError;

      router.push(redirect);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid verification code';
      setError(message);
      setMfaCode('');
    } finally {
      setVerifyingMfa(false);
    }
  };

  return (
    <AuthShell subtitle={mfaStep ? 'Two-factor authentication' : 'Sign in to your account'}>
      {mfaStep ? (
        /* MFA Verification Step */
        <form onSubmit={handleMfaVerify} className="space-y-6">
          {error && (
            <div role="alert" className="bg-[var(--color-negative-muted)] border border-[var(--color-negative-border)] text-[var(--color-negative-text)] px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-[var(--color-gold)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-[var(--color-text-secondary)] text-sm">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          <div>
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              required
              autoComplete="one-time-code"
              aria-label="MFA verification code"
              className="w-full px-4 py-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-lg text-[var(--color-text-primary)] text-center text-2xl tracking-[0.5em] font-mono placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)] transition-colors"
              placeholder="------"
            />
          </div>

          <button
            type="submit"
            disabled={mfaCode.length !== 6 || verifyingMfa}
            className="w-full py-3 px-4 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] disabled:opacity-50 text-[var(--color-bg-base)] font-semibold rounded-lg transition-colors"
          >
            {verifyingMfa ? 'Verifying...' : 'Verify'}
          </button>

          <button
            type="button"
            onClick={() => {
              setMfaStep(false);
              setMfaCode('');
              setFactorId('');
              setError('');
            }}
            className="w-full text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Back to sign in
          </button>
        </form>
      ) : (
        /* Password Step */
        <>
          <button type="button" onClick={async () => {
            await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}` },
            });
          }}
            className="w-full py-3 px-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] hover:border-[var(--color-border-hover)] text-[var(--color-text-primary)] font-medium rounded-lg transition-colors flex items-center justify-center gap-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--color-border-base)]" /></div>
            <div className="relative flex justify-center text-xs"><span className="px-3 bg-[var(--color-bg-base)] text-[var(--color-text-muted)]">or</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {message && (
              <div role="status" className="bg-[var(--color-positive-muted)] border border-[var(--color-positive-border)] text-[var(--color-positive)] px-4 py-3 rounded-lg text-sm">
                {message}
              </div>
            )}

            {error && (
              <div role="alert" className="bg-[var(--color-negative-muted)] border border-[var(--color-negative-border)] text-[var(--color-negative-text)] px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)] transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-[var(--color-text-secondary)]">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)] transition-colors"
                placeholder="Enter your password"
              />
            </div>

            <div className="flex items-center">
              <label htmlFor="remember-me" className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer py-1">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] text-[var(--color-gold)] focus:ring-[var(--color-gold)]/30 focus:ring-offset-0 cursor-pointer accent-[var(--color-gold)]"
                />
                Remember me
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] disabled:opacity-50 text-[var(--color-bg-base)] font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? 'Signing in...' : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[var(--color-text-secondary)] text-sm">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </>
      )}
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center">
        <div className="text-[var(--color-text-muted)]">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
