'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';

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

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

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
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Signup failed');
        return;
      }

      // If session exists, go directly to dashboard
      // Otherwise show confirmation message
      if (data.session) {
        router.push('/dashboard');
        router.refresh();
      } else {
        router.push('/login?message=Check your email to confirm your account');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell subtitle="Create your account">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-[var(--color-negative-muted)] border border-[var(--color-negative-border)] text-[var(--color-negative-text)] px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            className="w-full px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)] transition-colors"
            placeholder="John Doe"
          />
        </div>

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
          <label htmlFor="password" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)] transition-colors"
            placeholder="Strong password"
          />
          {password && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i < strength.score ? strength.color : 'bg-[var(--color-border-base)]'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-[var(--color-text-muted)]">{strength.label}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {strength.requirements.map((req) => (
                  <span key={req.label} className={`text-[10px] ${req.met ? 'text-[var(--color-positive)]' : 'text-[var(--color-text-muted)]'}`}>
                    {req.met ? '\u2713' : '\u2717'} {req.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)] transition-colors"
            placeholder="Confirm your password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] disabled:opacity-50 text-[var(--color-bg-base)] font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {loading ? 'Creating account...' : (
            <>
              Create account
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-[var(--color-text-secondary)] text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
