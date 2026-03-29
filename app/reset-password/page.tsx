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
          <p className="text-[var(--color-text-secondary)] mt-2">Set a new password</p>
        </div>

        {/* Card */}
        <div className="relative">
          <div className="absolute -inset-px rounded-xl border border-[var(--color-border-subtle)]" />
          <div className="relative bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl p-8">
            {success ? (
              <div className="text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-[var(--color-positive)]/10 border border-[var(--color-positive)]/20 flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-[var(--color-positive)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Password updated</h2>
                <p className="text-[var(--color-text-secondary)] text-sm">
                  Redirecting you to the dashboard...
                </p>
              </div>
            ) : !sessionReady ? (
              <div className="text-center space-y-4">
                <p className="text-[var(--color-text-secondary)] text-sm">
                  Verifying your reset link...
                </p>
                <p className="text-[var(--color-text-muted)] text-xs">
                  If this takes too long, your link may have expired.{' '}
                  <Link href="/forgot-password" className="text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors">
                    Request a new one
                  </Link>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-[var(--color-negative-muted)] border border-[var(--color-negative-border)] text-[var(--color-negative-text)] px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                    New Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)] transition-colors"
                    placeholder="At least 8 characters"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                    Confirm New Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)] transition-colors"
                    placeholder="Confirm your new password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] disabled:opacity-50 text-[var(--color-bg-base)] font-semibold rounded-lg transition-colors"
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
