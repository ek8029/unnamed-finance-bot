'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Shield, Loader2, Eye, EyeOff } from 'lucide-react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { HelmMark } from '@/components/helm-mark';
import { supabase } from '@/lib/supabase/client';
import { PlaidLinkButton } from '@/components/plaid/plaid-link-button';

/* ═══════════════════════════════════════════════════════════
   WRAPPED FUNNEL — single page, 4 states:
   1. Not logged in → marketing landing
   2. Signup → inline form (no redirect)
   3. Logged in, no Plaid → inline Plaid connect
   4. Logged in, has Plaid → redirect to /dashboard/wrapped
   ═══════════════════════════════════════════════════════════ */

type FlowState = 'loading' | 'landing' | 'signup' | 'confirming' | 'connect' | 'generating';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

/* ══════════════════════════════════════════
   Main component
   ══════════════════════════════════════════ */

export function WrappedLanding() {
  const router = useRouter();
  const [flowState, setFlowState] = useState<FlowState>('loading');
  const [plaidError, setPlaidError] = useState<string | null>(null);

  // Signup form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha | null>(null);
  const captchaSiteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;
  const formRenderedAt = useRef(Date.now());

  // Capture UTM params on landing (persist through signup flow)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get('utm_source');
    const medium = params.get('utm_medium');
    const campaign = params.get('utm_campaign');
    if (source) sessionStorage.setItem('utm_source', source);
    if (medium) sessionStorage.setItem('utm_medium', medium);
    if (campaign) sessionStorage.setItem('utm_campaign', campaign);
  }, []);

  // Check auth + Plaid on mount
  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setFlowState('landing');
        return;
      }
      // Authenticated — check Plaid
      try {
        const res = await fetch('/api/financial-summary');
        if (res.ok) {
          const d = await res.json();
          if (d?.hasPlaidConnection) {
            // Has Plaid — go straight to Wrapped
            router.replace('/dashboard/wrapped');
            return;
          }
        }
      } catch {}
      // No Plaid — show connect
      setFlowState('connect');
    }
    check();
  }, [router]);

  const handlePlaidSuccess = useCallback(() => {
    setFlowState('generating');
    // Brief delay for sync, then redirect
    setTimeout(() => {
      router.push('/dashboard/wrapped');
    }, 1500);
  }, [router]);

  // ── Signup handler ──
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);
    if (!email.trim() || !password.trim()) {
      setSignupError('Email and password required.');
      return;
    }
    if (password.length < 8) {
      setSignupError('Password must be at least 8 characters.');
      return;
    }
    if (captchaSiteKey && !captchaToken) {
      setSignupError('Please complete the captcha.');
      return;
    }
    setSignupLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          full_name: fullName.trim() || undefined,
          captchaToken,
          form_rendered_at: formRenderedAt.current,
          utm_source: sessionStorage.getItem('utm_source') || undefined,
          utm_medium: sessionStorage.getItem('utm_medium') || undefined,
          utm_campaign: sessionStorage.getItem('utm_campaign') || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSignupError(data.error || 'Signup failed.');
        captchaRef.current?.resetCaptcha();
        setCaptchaToken(null);
        return;
      }
      if (data.session) {
        // Auto-confirmed — go straight to Plaid
        setFlowState('connect');
      } else {
        // Email confirmation required — save userId, poll for confirmation
        if (data.user?.id) setPendingUserId(data.user.id);
        setFlowState('confirming');
      }
    } catch {
      setSignupError('Something went wrong. Try again.');
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    } finally {
      setSignupLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/wrapped` },
    });
  };

  // ── Poll for email confirmation via lightweight server check ──
  // Works cross-device: confirms on phone, desktop detects via admin API check
  useEffect(() => {
    if (flowState !== 'confirming') return;
    if (!pendingUserId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/check-confirmed?userId=${pendingUserId}`);
        if (!res.ok) return;
        const { confirmed } = await res.json();
        if (confirmed) {
          clearInterval(interval);
          // One sign-in attempt to establish session
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (data.session && !error) {
            setFlowState('connect');
          } else {
            // Confirmed but sign-in failed — send to login
            setSignupError('Email confirmed. Please log in to continue.');
            setFlowState('signup');
          }
        }
      } catch {
        // Network error, keep polling
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [flowState, pendingUserId, email, password]);

  // ── Loading state ──
  if (flowState === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center">
        <div className="animate-pulse"><HelmMark size={32} /></div>
      </div>
    );
  }

  // ── Generating state (post-Plaid, pre-redirect) ──
  if (flowState === 'generating') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-base)] flex flex-col items-center justify-center gap-5">
        <div className="w-8 h-8 border-2 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[14px] text-[var(--color-text-muted)]" style={MONO}>
          Generating your Wrapped...
        </p>
      </div>
    );
  }

  // ── Confirming state (waiting for email confirmation) ──
  if (flowState === 'confirming') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
        <nav className="fixed top-0 left-0 right-0 z-50 px-6 md:px-10 py-5 flex items-center">
          <div className="flex items-center gap-2.5 opacity-60">
            <HelmMark size={18} />
            <span className="text-[12px] font-bold uppercase tracking-[0.08em]">Helm</span>
          </div>
        </nav>

        <div className="flex flex-col items-center justify-center min-h-screen px-5">
          <div className="w-full max-w-sm text-center">
            {/* Progress */}
            <div className="flex items-center justify-center gap-2 mb-10">
              <div className="w-8 h-1 rounded-full bg-[var(--color-gold)]" />
              <div className="w-8 h-1 rounded-full bg-[var(--color-gold)]/40 animate-pulse" />
              <div className="w-8 h-1 rounded-full bg-white/10" />
            </div>

            {/* Email icon */}
            <div className="w-16 h-16 mx-auto mb-8 rounded-full border border-[var(--color-gold)]/20 bg-[var(--color-gold)]/[0.06] flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>

            <h2 className="text-[24px] font-bold tracking-tight mb-3">Check your email</h2>
            <p className="text-[15px] text-white/50 leading-relaxed mb-2">
              We sent a confirmation link to <span className="text-white/80 font-medium">{email}</span>
            </p>
            <p className="text-[14px] text-white/35 leading-relaxed mb-8">
              Click the link, then this page will automatically continue to the next step.
            </p>

            {/* Polling indicator */}
            <div className="flex items-center justify-center gap-2 text-[12px] text-white/40" style={MONO}>
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)] animate-pulse" />
              Waiting for confirmation...
            </div>

            <p className="text-[12px] text-white/40 mt-8">
              Didn&apos;t get it? Check spam, or{' '}
              <button
                onClick={() => setFlowState('signup')}
                className="text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors cursor-pointer"
              >
                try a different email
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Signup state (inline, no redirect) ──
  if (flowState === 'signup') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
        <nav className="fixed top-0 left-0 right-0 z-50 px-6 md:px-10 py-5 flex items-center justify-between">
          <button onClick={() => setFlowState('landing')} className="flex items-center gap-2.5 opacity-60 hover:opacity-100 transition-opacity">
            <HelmMark size={18} />
            <span className="text-[12px] font-bold uppercase tracking-[0.08em]">Helm</span>
          </button>
        </nav>

        <div className="flex flex-col items-center justify-center min-h-screen px-5">
          <div className="w-full max-w-sm">
            {/* Progress */}
            <div className="flex items-center justify-center gap-2 mb-10">
              <div className="w-8 h-1 rounded-full bg-[var(--color-gold)]" />
              <div className="w-8 h-1 rounded-full bg-white/10" />
              <div className="w-8 h-1 rounded-full bg-white/10" />
            </div>

            <div className="text-center mb-8">
              <h2 className="text-[28px] font-bold tracking-tight mb-2">Create your account</h2>
              <p className="text-[15px] text-white/50">to see your Wrapped</p>
            </div>

            {/* Google OAuth */}
            <button
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white text-black text-[14px] font-semibold rounded-md hover:bg-white/90 transition-colors mb-4 cursor-pointer"
            >
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-white/[0.08]" />
              <span className="text-[12px] text-white/30" style={MONO}>or</span>
              <div className="flex-1 h-px bg-white/[0.08]" />
            </div>

            {/* Email/password form */}
            <form onSubmit={handleSignup} className="space-y-3">
              <label className="sr-only" htmlFor="wrapped-name">Full name</label>
              <input
                id="wrapped-name"
                type="text"
                placeholder="Full name (optional)"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-md text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-[var(--color-gold)]/50 transition-colors"
                autoComplete="name"
              />
              <label className="sr-only" htmlFor="wrapped-email">Email</label>
              <input
                id="wrapped-email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-md text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-[var(--color-gold)]/50 transition-colors"
                autoComplete="email"
                required
              />
              <div className="relative">
                <label className="sr-only" htmlFor="wrapped-password">Password</label>
                <input
                  id="wrapped-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password (8+ characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-md text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-[var(--color-gold)]/50 transition-colors pr-11"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {captchaSiteKey && (
                <div className="flex justify-center">
                  <HCaptcha
                    ref={captchaRef}
                    sitekey={captchaSiteKey}
                    onVerify={setCaptchaToken}
                    onExpire={() => setCaptchaToken(null)}
                    onError={() => setCaptchaToken(null)}
                    theme="dark"
                  />
                </div>
              )}

              {signupError && (
                <p className="text-[13px] text-[#F87171]">{signupError}</p>
              )}

              <button
                type="submit"
                disabled={signupLoading || (!!captchaSiteKey && !captchaToken)}
                className="w-full px-4 py-3.5 bg-[var(--color-gold)] text-black text-[14px] font-bold rounded-md hover:bg-[var(--color-gold-hi)] transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {signupLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>
                ) : (
                  'Continue'
                )}
              </button>
            </form>

            <p className="text-[12px] text-white/40 text-center mt-6">
              Already have an account?{' '}
              <Link href="/login?redirect=/wrapped" className="text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Connect state (logged in, no Plaid) ──
  if (flowState === 'connect') {
    return (
      <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
        {/* Nav */}
        <nav className="sticky top-0 z-50 h-14 px-5 flex items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]">
          <div className="flex items-center gap-2">
            <HelmMark size={20} />
            <span className="text-[13px] font-bold uppercase tracking-tight">Helm</span>
          </div>
        </nav>

        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] px-5">
          <div className="w-full max-w-md text-center">
            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-2 mb-10">
              <div className="w-8 h-1 rounded-full bg-[var(--color-gold)]" />
              <div className="w-8 h-1 rounded-full bg-[var(--color-gold)]" />
              <div className="w-8 h-1 rounded-full bg-white/10" />
            </div>

            <HelmMark size={36} />

            <p className="text-[11px] tracking-[0.25em] text-[var(--color-gold)] uppercase mt-6 mb-3" style={MONO}>
              Helm Wrapped
            </p>

            <h1 className="text-[28px] md:text-[36px] font-bold tracking-tight leading-[1.1] mb-4">
              Connect your brokerage
            </h1>

            <p className="text-[15px] text-[var(--color-text-muted)] leading-relaxed mb-8 max-w-sm mx-auto">
              Helm reads your portfolio history to build your personalized year in review. Read-only — we can never trade or move money.
            </p>

            {/* Plaid button */}
            <div className="max-w-xs mx-auto">
              <PlaidLinkButton
                onSuccess={handlePlaidSuccess}
                onError={(msg) => setPlaidError(msg)}
                className="w-full"
              >
                Connect with Plaid
              </PlaidLinkButton>
            </div>

            {plaidError && (
              <p className="text-[13px] text-[var(--color-negative)] mt-3">{plaidError}</p>
            )}

            {/* Trust signals */}
            <div className="flex flex-col items-center gap-3 mt-8 text-[12px] text-[var(--color-text-muted)]">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-[var(--color-positive)]" />
                <span>Read-only access &middot; Bank-level encryption</span>
              </div>
              <span>12,000+ institutions &middot; Takes 30 seconds</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Landing state (not logged in) ──
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-white overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 md:px-12 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 opacity-70 hover:opacity-100 transition-opacity">
          <HelmMark size={20} />
          <span className="text-[13px] font-bold uppercase tracking-[0.06em]">Helm</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/login?redirect=/wrapped" className="text-[13px] text-white/50 hover:text-white transition-colors" style={MONO}>
            Log in
          </Link>
          <button
            onClick={() => setFlowState('signup')}
            className="text-[13px] text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] font-bold transition-colors cursor-pointer"
            style={MONO}
          >
            Get yours &rarr;
          </button>
        </div>
      </nav>

      {/* ══════════════════════════════════════
          HERO — viewport-filling, oversized type
          ══════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Subtle glow — reduced to prevent splotchy banding on monitors */}
        <div className="pointer-events-none absolute top-[10%] right-0 w-[800px] h-[800px] opacity-[0.04] blur-[200px]" style={{ background: 'var(--color-gold)' }} />

        <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-[1fr_480px] gap-10 lg:gap-16 items-center pt-28 pb-16 lg:pt-0 lg:pb-0">
          {/* LEFT — massive headline */}
          <div>
            <p className="text-[14px] tracking-[0.3em] text-[var(--color-gold)] uppercase mb-10" style={MONO}>
              Helm Wrapped &middot; 2025
            </p>

            <h1
              className="font-bold leading-[1.05] tracking-[-0.05em] mb-10"
              style={{ fontSize: 'clamp(52px, 10vw, 120px)' }}
            >
              Your portfolio.<br />
              <span
                className="text-[var(--color-gold)] italic font-normal"
                style={{ fontFamily: '"Source Serif Pro", Georgia, serif' }}
              >
                Wrapped.
              </span>
            </h1>

            <p className="text-[20px] md:text-[22px] text-white/60 leading-[1.6] max-w-[520px] mb-14">
              Spotify Wrapped, but for your investments. Return vs the S&amp;P, best trade, worst trade, and your investor personality type.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <button
                onClick={() => setFlowState('signup')}
                className="inline-flex items-center gap-3 px-12 py-5 bg-[var(--color-gold)] text-black text-[16px] font-bold tracking-[0.02em] rounded transition-all hover:bg-[var(--color-gold-hi)] cursor-pointer"
                style={{ boxShadow: '0 0 0 1px rgba(230,185,77,0.5), 0 20px 60px rgba(230,185,77,0.3)' }}
              >
                See my Wrapped
                <ArrowRight className="w-5 h-5" />
              </button>
              <span className="text-[14px] text-white/30" style={MONO}>or</span>
              <Link
                href="/wrapped/demo"
                className="text-[15px] text-white/50 hover:text-[var(--color-gold)] transition-colors font-medium"
              >
                See a Demo Wrapped
              </Link>
            </div>

            <Link href="/login?redirect=/wrapped" className="block text-[13px] text-white/40 hover:text-white transition-colors mt-6" style={MONO}>
              I have an account &rarr;
            </Link>

            <p className="text-[13px] text-white/40 mt-3" style={MONO}>Free &middot; 30 seconds &middot; Any brokerage</p>
            <Link href="/wrapped/demo" className="block text-[13px] text-white/40 hover:text-[var(--color-gold)] transition-colors mt-3" style={MONO}>
              See a demo first &rarr;
            </Link>
          </div>

          {/* RIGHT — V4 share card preview */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="w-full max-w-[420px] relative">
              <div className="absolute -inset-6 rounded-3xl opacity-[0.08] blur-[60px] pointer-events-none" style={{ background: 'var(--color-gold)' }} />
              <div
                className="relative rounded-2xl overflow-hidden"
                style={{
                  background: '#0A0A0A',
                  border: '2px solid rgba(230,185,77,0.25)',
                  padding: '20px 24px',
                  boxShadow: '0 50px 120px rgba(0,0,0,0.9)',
                }}
              >
                {/* Top bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HelmMark size={16} />
                    <span className="text-[10px] font-bold tracking-[0.12em] text-[var(--color-gold)]" style={MONO}>
                      HELM <span style={{ fontFamily: '"Source Serif Pro", Georgia, serif', fontStyle: 'italic', fontWeight: 400, letterSpacing: '0.03em' }}>Wrapped</span>
                    </span>
                  </div>
                  <span className="text-[9px] text-white/40 tracking-[0.2em]" style={MONO}>2025</span>
                </div>

                {/* Hero return */}
                <div className="text-center my-4">
                  <p className="text-[clamp(48px,11vw,72px)] font-bold leading-[0.82] tabular-nums tracking-[-0.04em] text-[#4ADE80]">
                    +28.41%
                  </p>
                  <div className="flex items-baseline justify-center gap-3 mt-2">
                    <span style={{ fontFamily: '"Source Serif Pro", Georgia, serif', fontStyle: 'italic' }} className="text-[14px] text-[var(--color-gold)]">
                      beat the market
                    </span>
                    <span className="text-[12px] text-[var(--color-gold)] font-bold" style={MONO}>ALPHA +8.59%</span>
                  </div>
                </div>

                {/* Sector bar */}
                <div className="mb-3">
                  <div className="flex gap-[2px] h-[6px] rounded-full overflow-hidden mb-1.5">
                    {[
                      { pct: 48, color: '#E6B94D' },
                      { pct: 18, color: '#7AA3C7' },
                      { pct: 14, color: '#9FB89D' },
                      { pct: 11, color: '#C8A165' },
                      { pct: 9, color: '#8E7DC7' },
                    ].map((s, i) => (
                      <div key={i} style={{ flex: s.pct, background: s.color }} className="rounded-sm" />
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { pct: 48, label: 'Tech', color: '#E6B94D' },
                      { pct: 18, label: 'Health', color: '#7AA3C7' },
                      { pct: 14, label: 'Finance', color: '#9FB89D' },
                      { pct: 11, label: 'Energy', color: '#C8A165' },
                    ].map((s) => (
                      <span key={s.label} className="text-[8px] font-medium" style={{ ...MONO, color: s.color }}>
                        {s.pct}% {s.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Gold divider */}
                <div className="h-px my-3" style={{ background: 'linear-gradient(to right, transparent, rgba(230,185,77,0.3), transparent)' }} />

                {/* 2x3 stat grid */}
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="p-2.5 rounded-lg" style={{ background: 'rgba(230,185,77,0.03)', border: '1px solid rgba(230,185,77,0.12)' }}>
                    <p className="text-[9px] text-white/40 tracking-[0.15em]" style={MONO}>MVP</p>
                    <p className="text-[20px] font-bold text-[var(--color-gold)] mt-1" style={MONO}>NVDA</p>
                    <p className="text-[12px] font-semibold text-[#4ADE80]" style={MONO}>+87.30%</p>
                  </div>
                  <div className="p-2.5 rounded-lg" style={{ background: 'rgba(230,185,77,0.03)', border: '1px solid rgba(230,185,77,0.12)' }}>
                    <p className="text-[9px] text-white/40 tracking-[0.15em]" style={MONO}>TYPE</p>
                    <p className="text-[13px] font-bold text-[var(--color-gold)] mt-1 leading-tight" style={{ fontFamily: '"Source Serif Pro", Georgia, serif', fontStyle: 'italic' }}>
                      Active Trader
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                    <p className="text-[9px] text-white/40 tracking-[0.15em]" style={MONO}>TRADES</p>
                    <p className="text-[20px] font-bold text-white mt-1 tabular-nums" style={MONO}>214</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                    <p className="text-[9px] text-white/40 tracking-[0.15em]" style={MONO}>DIVIDENDS</p>
                    <p className="text-[20px] font-bold text-white mt-1 tabular-nums" style={MONO}>$2K</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                    <p className="text-[9px] text-white/40 tracking-[0.15em]" style={MONO}>PORTFOLIO</p>
                    <p className="text-[20px] font-bold text-white mt-1 tabular-nums" style={MONO}>$155K</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                    <p className="text-[9px] text-white/40 tracking-[0.15em]" style={MONO}>VILLAIN</p>
                    <p className="text-[20px] font-bold text-[#F87171] mt-1" style={MONO}>INTC</p>
                    <p className="text-[12px] font-semibold text-[#F87171]" style={MONO}>-41.20%</p>
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="mt-3 flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'rgba(230,185,77,0.05)', border: '1px solid rgba(230,185,77,0.12)' }}>
                  <span className="text-[8px] text-white/60 tracking-[0.1em] font-semibold" style={MONO}>HELMTERMINAL.DEV/WRAPPED</span>
                  <span className="text-[9px] text-[var(--color-gold)] font-bold" style={{ fontFamily: '"Source Serif Pro", Georgia, serif', fontStyle: 'italic' }}>Get yours free &rarr;</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          WHAT'S INSIDE — oversized numbered list
          ══════════════════════════════════════ */}
      <section className="py-32 md:py-44 border-t border-white/[0.06]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <p className="text-[14px] tracking-[0.3em] text-[var(--color-gold)] uppercase mb-16" style={MONO}>
            Seven slides. One portfolio.
          </p>

          {[
            { n: '01', label: 'Total return vs the S&P 500', accent: true },
            { n: '02', label: 'Your best and worst trade' },
            { n: '03', label: 'How you traded — habits, timing, volume' },
            { n: '04', label: 'Sector conviction and allocation' },
            { n: '05', label: 'Your investor personality type', accent: true },
            { n: '06', label: 'A shareable card with your stats' },
          ].map((item) => (
            <div
              key={item.n}
              className="flex items-baseline gap-6 md:gap-10 py-7 md:py-8 border-b border-white/[0.06] group cursor-default"
            >
              <span className="text-[18px] md:text-[22px] text-[var(--color-gold)] tabular-nums shrink-0 font-bold" style={MONO}>{item.n}</span>
              <span
                className={`font-semibold tracking-[-0.025em] transition-colors duration-300 ${item.accent ? 'text-white' : 'text-white/55'} group-hover:text-white`}
                style={{ fontSize: 'clamp(24px, 5vw, 44px)' }}
              >
                {item.label}
              </span>
              <ArrowRight className="w-5 h-5 text-[var(--color-gold)] opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0 hidden md:block" />
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          HOW IT WORKS — big numbers
          ══════════════════════════════════════ */}
      <section className="py-32 md:py-44 border-t border-white/[0.06]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <p className="text-[14px] tracking-[0.3em] text-[var(--color-gold)] uppercase mb-16" style={MONO}>
            Three steps. Thirty seconds.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-14 md:gap-20">
            {[
              { n: '01', title: 'Create account', desc: 'Free. No credit card. Takes 10 seconds.' },
              { n: '02', title: 'Connect brokerage', desc: 'Read-only via Plaid. We can never trade or move money.' },
              { n: '03', title: 'See your Wrapped', desc: 'Personalized slides you can share anywhere.' },
            ].map((step) => (
              <div key={step.n} className="border-t border-white/[0.08] pt-10">
                <p className="text-[40px] md:text-[56px] text-[var(--color-gold)] font-bold mb-5 tabular-nums leading-none" style={MONO}>{step.n}</p>
                <h3 className="text-[24px] md:text-[28px] font-bold tracking-[-0.02em] mb-4">{step.title}</h3>
                <p className="text-[17px] text-white/50 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FINAL CTA — massive
          ══════════════════════════════════════ */}
      <section className="py-40 md:py-52 border-t border-white/[0.06]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <h2
            className="font-bold tracking-[-0.05em] leading-[0.88] mb-14"
            style={{ fontSize: 'clamp(44px, 9vw, 100px)' }}
          >
            See what your<br />portfolio did.
          </h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <button
              onClick={() => setFlowState('signup')}
              className="inline-flex items-center gap-3 px-14 py-6 bg-[var(--color-gold)] text-black text-[18px] font-bold tracking-[0.02em] rounded transition-all hover:bg-[var(--color-gold-hi)] cursor-pointer"
              style={{ boxShadow: '0 0 0 1px rgba(230,185,77,0.5), 0 24px 64px rgba(230,185,77,0.35)' }}
            >
              Get my Wrapped
              <ArrowRight className="w-5 h-5" />
            </button>
            <span className="text-[15px] text-white/40" style={MONO}>Free &middot; 30 seconds &middot; No card required</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 md:px-12 flex items-center justify-between border-t border-white/[0.04]">
        <span className="text-[10px] tracking-[0.15em] text-white/30 uppercase" style={MONO}>&copy; 2026 Helm</span>
        <span className="text-[10px] tracking-[0.15em] text-white/30 uppercase" style={MONO}>helmterminal.dev</span>
      </footer>
    </div>
  );
}
