'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to send reset email');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell subtitle="Reset your password">
      {success ? (
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[var(--color-positive)]/10 border border-[var(--color-positive)]/20 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-[var(--color-positive)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Check your email</h2>
          <p className="text-[var(--color-text-secondary)] text-sm">
            If an account exists for <span className="text-[var(--color-text-primary)]">{email}</span>, you&apos;ll receive a password reset link shortly.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 mt-4 text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] text-sm transition-colors font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <p className="text-[var(--color-text-secondary)] text-sm mb-6">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-[var(--color-negative-muted)] border border-[var(--color-negative-border)] text-[var(--color-negative-text)] px-4 py-3 rounded-lg text-sm">
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] disabled:opacity-50 text-[var(--color-bg-base)] font-semibold rounded-lg transition-colors"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors font-medium">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to sign in
            </Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}
