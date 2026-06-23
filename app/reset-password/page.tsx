'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { createClient } from '@/lib/supabase/client';

function getPasswordStrength(password: string) {
  const requirements = [
    { label: '8+ characters', met: password.length >= 8 },
    { label: 'Uppercase', met: /[A-Z]/.test(password) },
    { label: 'Lowercase', met: /[a-z]/.test(password) },
    { label: 'Number', met: /\d/.test(password) },
    { label: 'Special char', met: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = Math.min(4, requirements.filter(r => r.met).length) as 0 | 1 | 2 | 3 | 4;
  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['bg-[var(--color-negative)]', 'bg-[var(--color-negative)]', 'bg-[var(--color-warning)]', 'bg-[var(--color-positive)]/70', 'bg-[var(--color-positive)]'];
  return { score, label: labels[score], color: colors[score], requirements };
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  // Supabase automatically picks up the token from the URL hash
  useEffect(() => {
    const supabase = createClient();

    // Listen for the PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });

    // Also check if we already have a session (in case the event fired before we subscribed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (strength.score < 3) {
      setError('Password is too weak. Meet at least 4 of the 5 requirements.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-inset,#060606)] relative overflow-hidden flex items-center justify-center px-4 py-12">
      {/* Grid background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.02)_1px,_transparent_1px),linear-gradient(to_bottom,_rgba(255,255,255,0.02)_1px,_transparent_1px)] bg-[length:64px_64px] opacity-40" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Brand mark */}
        <div className="flex flex-col items-center mb-9">
          <Link href="/" className="flex flex-col items-center gap-4 group">
            <HelmMark size={44} />
            <div
              className="text-[22px] font-bold uppercase tracking-[0.42em] text-[var(--color-gold)] pl-[0.42em]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Helm
            </div>
          </Link>
          <div
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6A6A6A] mt-3"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Financial Intelligence Terminal
          </div>
          <p className="text-[15px] text-[var(--color-text-secondary)] mt-4 text-center">Set a new password</p>
        </div>

        {/* Sovereign card */}
        <div
          className="relative rounded-xl border border-white/[0.07] bg-[var(--color-bg-surface,#131313)] p-8 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]"
          style={{ borderTop: '2px solid rgba(230,185,77,0.30)' }}
        >
          <div>
            {success ? (
              <div className="text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-[var(--color-positive)]/10 border border-[var(--color-positive)]/20 flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-[var(--color-positive)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Password updated</h2>
                <p className="text-[15px] text-[var(--color-text-secondary)]">
                  Redirecting you to the dashboard...
                </p>
              </div>
            ) : !sessionReady ? (
              <div className="text-center space-y-4">
                <p className="text-[15px] text-[var(--color-text-secondary)]">
                  Verifying your reset link...
                </p>
                <p className="text-[var(--color-text-muted)] text-[13px]">
                  If this takes too long, your link may have expired.{' '}
                  <Link href="/forgot-password" className="text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors">
                    Request a new one
                  </Link>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-[var(--color-negative-muted)] border border-[var(--color-negative-border)] text-[var(--color-negative-text)] px-4 py-3 rounded-md text-[15px]">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="password" className="block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9A9A9A] mb-2">
                    New Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full px-4 py-3 bg-[var(--color-bg-inset,#060606)] border border-white/[0.07] rounded-md text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors"
                    placeholder="At least 8 characters"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9A9A9A] mb-2">
                    Confirm New Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full px-4 py-3 bg-[var(--color-bg-inset,#060606)] border border-white/[0.07] rounded-md text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors"
                    placeholder="Confirm your new password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] disabled:opacity-50 text-[#0A0A0A] font-semibold rounded-md transition-colors"
                >
                  {loading ? 'Updating...' : 'Update password'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
