'use client';

import { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
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

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState('');
  const formRenderedAt = useRef<number>(0);
  const captchaRef = useRef<HCaptcha | null>(null);

  useEffect(() => { formRenderedAt.current = Date.now(); }, []);

  const captchaSiteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;
  const captchaConfigured = Boolean(captchaSiteKey);
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (strength.score < 3) {
      setError('Password is too weak. Meet at least 4 of the 5 requirements.');
      return;
    }
    if (captchaConfigured && !captchaToken) {
      setError('Please complete the captcha.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, password, full_name: fullName, captchaToken,
          website: honeypot, form_rendered_at: formRenderedAt.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Signup failed');
        captchaRef.current?.resetCaptcha();
        setCaptchaToken(null);
        return;
      }
      if (data.session) {
        router.push('/dashboard');
        router.refresh();
      } else {
        router.push('/login?message=Check your email to confirm your account. If you don\'t see it, check your spam or promotions folder — it may take a minute to arrive.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell subtitle="Create your account">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Honeypot — properly hidden */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '1px', height: '1px', overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
          <label htmlFor="website-field">Website</label>
          <input id="website-field" type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        </div>

        {error && (
          <div className="bg-[var(--color-negative-muted)] border border-[var(--color-negative-border)] text-[var(--color-negative-text)] px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Full Name</label>
          <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name"
            className="w-full px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)] transition-colors"
            placeholder="John Doe" />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
            className="w-full px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)] transition-colors"
            placeholder="you@example.com" />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Password</label>
          <div className="relative">
            <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password"
              className="w-full px-4 py-3 pr-12 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)] transition-colors"
              placeholder="Strong password" />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {password && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < strength.score ? strength.color : 'bg-[var(--color-border-base)]'}`} />
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

        {captchaConfigured && (
          <div className="flex justify-center">
            <HCaptcha ref={captchaRef} sitekey={captchaSiteKey!} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} onError={() => setCaptchaToken(null)} theme="dark" />
          </div>
        )}

        <button type="submit" disabled={loading}
          className="w-full py-3 px-4 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--color-bg-base)] font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
          {loading ? 'Creating account...' : (<>Start free — takes 30 seconds <ArrowRight className="w-4 h-4" /></>)}
        </button>

        <p className="text-[11px] text-center text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
          No credit card required · Read-only via Plaid · Cancel anytime
        </p>
      </form>

      <div className="mt-6 text-center">
        <p className="text-[var(--color-text-secondary)] text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors font-medium">Sign in</Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (<Suspense><SignupForm /></Suspense>);
}
