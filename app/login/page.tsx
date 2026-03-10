'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LegalFooter } from '@/components/legal-footer';
import { HelmMark } from '@/components/helm-mark';
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
    <div className="min-h-screen bg-[var(--color-bg-base)] relative overflow-hidden flex items-center justify-center px-4">
      {/* Grid background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.02)_1px,_transparent_1px),linear-gradient(to_bottom,_rgba(255,255,255,0.02)_1px,_transparent_1px)] bg-[length:64px_64px] opacity-40" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center gap-3 mb-3 group">
            <HelmMark size={44} />
            <div>
              <div className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">Helm</div>
              <div className="type-eyebrow text-[var(--color-text-muted)]">Financial Intelligence</div>
            </div>
          </Link>
          <p className="text-[var(--color-text-secondary)] mt-2">
            {mfaStep ? 'Two-factor authentication' : 'Sign in to your account'}
          </p>
        </div>

        {/* Form Card */}
        <div className="relative">
          <div className="absolute -inset-px rounded-xl border border-[var(--color-border-subtle)]" />
          <div className="relative bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl p-8">
            {mfaStep ? (
              /* MFA Verification Step */
              <form onSubmit={handleMfaVerify} className="space-y-6">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
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
                <form onSubmit={handleSubmit} className="space-y-5">
                  {message && (
                    <div className="bg-[var(--color-positive)]/10 border border-[var(--color-positive)]/20 text-[var(--color-positive)] px-4 py-3 rounded-lg text-sm">
                      {message}
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
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
                    <input
                      id="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] text-[var(--color-gold)] focus:ring-[var(--color-gold)]/30 focus:ring-offset-0 cursor-pointer accent-[var(--color-gold)]"
                    />
                    <label htmlFor="remember-me" className="ml-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
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
          </div>
        </div>
        <LegalFooter variant="minimal" />
      </div>
    </div>
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
