'use client';

import { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { AuthShell } from '@/components/auth-shell';
import { supabase } from '@/lib/supabase/client';

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

  const isWrappedFlow = searchParams.get('flow') === 'wrapped';

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
        router.push(isWrappedFlow ? '/wrapped' : '/dashboard');
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

  const handleGoogleSignIn = async () => {
    const nextPath = isWrappedFlow ? '/wrapped' : '/dashboard';
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}` },
    });
  };

  return (
    <AuthShell subtitle={isWrappedFlow ? "Create your account to see your Wrapped" : "Create your account"}>
      {isWrappedFlow && (
        <p className="text-sm text-[var(--color-text-muted)] -mt-2 mb-4 text-center">
          Connect any brokerage and get your personalized year in review in 30 seconds.
        </p>
      )}
      <button type="button" onClick={handleGoogleSignIn}
        className="w-full py-3 px-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] hover:border-[var(--color-border-hover)] text-[var(--color-text-primary)] font-medium rounded-lg transition-colors flex items-center justify-center gap-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/30 focus:border-[var(--color-gold)]">
        <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        Continue with Google
      </button>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--color-border-base)]" /></div>
        <div className="relative flex justify-center text-xs"><span className="px-3 bg-[var(--color-bg-base)] text-[var(--color-text-muted)]">or</span></div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Honeypot — properly hidden */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '1px', height: '1px', overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
          <label htmlFor="website-field">Website</label>
          <input id="website-field" type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        </div>

        {error && (
          <div role="alert" className="bg-[var(--color-negative-muted)] border border-[var(--color-negative-border)] text-[var(--color-negative-text)] px-4 py-3 rounded-lg text-sm">{error}</div>
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
                <span className="text-xs text-[var(--color-text-muted)]">{strength.label}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {strength.requirements.map((req) => (
                  <span key={req.label} className={`text-xs ${req.met ? 'text-[var(--color-positive)]' : 'text-[var(--color-text-muted)]'}`}>
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

        <p className="text-xs text-center text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
          No credit card required · Read-only via Plaid · Cancel anytime
        </p>
      </form>

      <div className="mt-6 text-center">
        <p className="text-[var(--color-text-secondary)] text-sm">
          Already have an account?{' '}
          <Link href={isWrappedFlow ? "/login?redirect=/dashboard/wrapped" : "/login"} className="text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors font-medium">Sign in</Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center">
        <div className="text-[var(--color-text-muted)]">Loading...</div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
